# Phantoms Cart

## Run the website and account server

The account server uses Python's standard library and SQLite; no package installation is needed.

1. Open a terminal in this folder.
2. Run `python server.py` (or `py server.py` on Windows).
3. Open <http://127.0.0.1:8000>.
4. Choose **Account** in the shop header to sign in or create an account.

New registrations are stored in the server-side `accounts.sqlite3` database. Passwords are stored as salted PBKDF2 hashes, and sign-in sessions use HttpOnly cookies. The database file is not served as a website asset.

To make the site available to other devices on your local network, run `python server.py --host 0.0.0.0` and open the computer's local IP address on port 8000 from those devices. For a public deployment, host the server behind HTTPS, set `PHANTOM_COOKIE_SECURE=1`, and use a production-ready hosting and database setup. Do not expose this development server directly to the public internet.
