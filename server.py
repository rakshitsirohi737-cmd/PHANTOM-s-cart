import hashlib
import hmac
import http.cookies
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "accounts.sqlite3"
SESSION_COOKIE = "phantom_session"
SESSION_LIFETIME = 30 * 24 * 60 * 60
PASSWORD_ITERATIONS = 310_000
MAX_REQUEST_BYTES = 16_384
DUMMY_SALT = bytes.fromhex("d4b8e7b2a49618a4c0562f9af7bd8f61")
DUMMY_PASSWORD_HASH = hashlib.pbkdf2_hmac(
    "sha256", b"not-a-real-password", DUMMY_SALT, PASSWORD_ITERATIONS
)
EMAIL_PATTERN = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
STATIC_EXTENSIONS = {
    ".css",
    ".html",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".png",
    ".svg",
    ".webp",
    ".woff2",
}
COOKIE_SECURE = os.environ.get("PHANTOM_COOKIE_SECURE", "").lower() in {
    "1",
    "true",
    "yes",
}


@contextmanager
def database_connection():
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_database():
    with database_connection() as connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash BLOB NOT NULL,
                password_salt BLOB NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash BLOB PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)"
        )


def password_digest(password, salt):
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )


def new_session(user_id):
    token = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + SESSION_LIFETIME
    token_hash = hashlib.sha256(token.encode("ascii")).digest()
    with database_connection() as connection:
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (token_hash, user_id, expires_at),
        )
    return token, expires_at


class StorefrontHandler(BaseHTTPRequestHandler):
    server_version = "PhantomsCart"

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def respond_json(self, status, payload, extra_headers=()):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in extra_headers:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def respond_error(self, status, message):
        self.respond_json(status, {"error": message})

    def read_json_body(self):
        content_type = self.headers.get("Content-Type", "")
        if content_type.split(";", 1)[0].strip().lower() != "application/json":
            self.respond_error(415, "Send this request as JSON.")
            return None

        content_length = self.headers.get("Content-Length")
        try:
            body_size = int(content_length)
        except (TypeError, ValueError):
            self.respond_error(400, "The request body is invalid.")
            return None
        if body_size < 0 or body_size > MAX_REQUEST_BYTES:
            self.respond_error(413, "The request is too large.")
            return None

        try:
            payload = json.loads(self.rfile.read(body_size))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.respond_error(400, "The request body is invalid.")
            return None
        if not isinstance(payload, dict):
            self.respond_error(400, "The request body is invalid.")
            return None
        return payload

    def origin_is_valid(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        parsed_origin = urlsplit(origin)
        return (
            parsed_origin.scheme in {"http", "https"}
            and parsed_origin.netloc.lower() == self.headers.get("Host", "").lower()
        )

    def session_token(self):
        cookie_header = self.headers.get("Cookie", "")
        cookies = http.cookies.SimpleCookie()
        try:
            cookies.load(cookie_header)
        except http.cookies.CookieError:
            return None
        morsel = cookies.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def current_user(self):
        token = self.session_token()
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode("utf-8")).digest()
        with database_connection() as connection:
            return connection.execute(
                """
                SELECT users.id, users.name, users.email
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
                """,
                (token_hash, int(time.time())),
            ).fetchone()

    def session_cookie(self, token, expires_at):
        cookie = (
            f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; "
            f"Expires={time.strftime('%a, %d %b %Y %H:%M:%S GMT', time.gmtime(expires_at))}"
        )
        if COOKIE_SECURE:
            cookie += "; Secure"
        return cookie

    def clear_session_cookie(self):
        cookie = f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
        if COOKIE_SECURE:
            cookie += "; Secure"
        return cookie

    def user_payload(self, user):
        return {"id": user["id"], "name": user["name"], "email": user["email"]}

    def do_GET(self):
        request_path = urlsplit(self.path).path
        if request_path == "/api/auth/me":
            user = self.current_user()
            self.respond_json(200, {"user": self.user_payload(user) if user else None})
            return
        if request_path.startswith("/api/"):
            self.respond_error(404, "That API endpoint was not found.")
            return
        self.serve_static_file()

    def do_HEAD(self):
        self.serve_static_file(head_only=True)

    def serve_static_file(self, head_only=False):
        request_path = unquote(urlsplit(self.path).path)
        if request_path == "/":
            request_path = "/index.html"
        file_path = (BASE_DIR / request_path.lstrip("/")).resolve()
        try:
            file_path.relative_to(BASE_DIR)
        except ValueError:
            self.send_error(404)
            return
        if file_path.suffix.lower() not in STATIC_EXTENSIONS or not file_path.is_file():
            self.send_error(404)
            return

        body = file_path.read_bytes()
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith(("text/", "application/javascript")) else content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def do_POST(self):
        request_path = urlsplit(self.path).path
        if request_path not in {
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/logout",
        }:
            self.respond_error(404, "That API endpoint was not found.")
            return
        if not self.origin_is_valid():
            self.respond_error(403, "This request could not be verified.")
            return

        payload = self.read_json_body()
        if payload is None:
            return
        if request_path == "/api/auth/register":
            self.register(payload)
        elif request_path == "/api/auth/login":
            self.login(payload)
        else:
            self.logout()

    def register(self, payload):
        name = payload.get("name")
        email = payload.get("email")
        password = payload.get("password")
        if not isinstance(name, str) or not isinstance(email, str) or not isinstance(password, str):
            self.respond_error(400, "Enter your name, email, and password.")
            return

        name = name.strip()
        email = email.strip().lower()
        if not name or len(name) > 80:
            self.respond_error(400, "Your name must be between 1 and 80 characters.")
            return
        if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
            self.respond_error(400, "Enter a valid email address.")
            return
        if len(password) < 8 or len(password) > 128:
            self.respond_error(400, "Your password must be between 8 and 128 characters.")
            return

        salt = secrets.token_bytes(16)
        digest = password_digest(password, salt)
        try:
            with database_connection() as connection:
                cursor = connection.execute(
                    """
                    INSERT INTO users (name, email, password_hash, password_salt, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (name, email, digest, salt, int(time.time())),
                )
                user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            self.respond_error(409, "An account with that email already exists.")
            return

        token, expires_at = new_session(user_id)
        self.respond_json(
            201,
            {"user": {"id": user_id, "name": name, "email": email}},
            (("Set-Cookie", self.session_cookie(token, expires_at)),),
        )

    def login(self, payload):
        email = payload.get("email")
        password = payload.get("password")
        if not isinstance(email, str) or not isinstance(password, str):
            self.respond_error(400, "Enter your email and password.")
            return
        email = email.strip().lower()
        if len(email) > 254 or len(password) > 128:
            self.respond_error(400, "The email or password is invalid.")
            return

        with database_connection() as connection:
            user = connection.execute(
                """
                SELECT id, name, email, password_hash, password_salt
                FROM users WHERE email = ?
                """,
                (email,),
            ).fetchone()
        salt = user["password_salt"] if user else DUMMY_SALT
        expected_hash = user["password_hash"] if user else DUMMY_PASSWORD_HASH
        supplied_hash = password_digest(password, salt)
        if not user or not hmac.compare_digest(supplied_hash, expected_hash):
            self.respond_error(401, "Email or password is incorrect.")
            return

        token, expires_at = new_session(user["id"])
        self.respond_json(
            200,
            {"user": self.user_payload(user)},
            (("Set-Cookie", self.session_cookie(token, expires_at)),),
        )

    def logout(self):
        token = self.session_token()
        if token:
            token_hash = hashlib.sha256(token.encode("utf-8")).digest()
            with database_connection() as connection:
                connection.execute(
                    "DELETE FROM sessions WHERE token_hash = ?", (token_hash,)
                )
        self.respond_json(
            200,
            {"ok": True},
            (("Set-Cookie", self.clear_session_cookie()),),
        )


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Phantoms Cart website and account server")
    parser.add_argument("--host", default="127.0.0.1", help="interface to listen on")
    parser.add_argument("--port", type=int, default=8000, help="port to listen on")
    args = parser.parse_args()

    initialize_database()
    server = ThreadingHTTPServer((args.host, args.port), StorefrontHandler)
    print(f"Phantoms Cart is serving on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Phantoms Cart server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
