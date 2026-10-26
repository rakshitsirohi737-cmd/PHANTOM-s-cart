const form = document.querySelector("#login-form");
const formMessage = document.querySelector("#form-message");
const modeToggle = document.querySelector("#mode-toggle");
const nameField = document.querySelector("#name-field");
const nameInput = document.querySelector("#name");
const passwordInput = document.querySelector("#password");
const confirmField = document.querySelector("#confirm-field");
const confirmInput = document.querySelector("#confirm-password");
const submitButton = document.querySelector("#submit-button");
const switchPrompt = document.querySelector("#login-switch");
const signedInPanel = document.querySelector("#signed-in-panel");
let isRegistering = false;

function showMessage(message, isSuccess = false) {
	formMessage.textContent = message;
	formMessage.classList.toggle("is-success", isSuccess);
}

function setMode(registering) {
	isRegistering = registering;
	nameField.hidden = !registering;
	nameInput.required = registering;
	confirmField.hidden = !registering;
	confirmInput.required = registering;
	passwordInput.autocomplete = registering ? "new-password" : "current-password";
	document.querySelector("#form-eyebrow").textContent = registering ? "START WITH THE GOOD STUFF" : "NICE TO SEE YOU AGAIN";
	document.querySelector("#form-title").innerHTML = registering ? "Create your account<span>.</span>" : "Welcome back<span>.</span>";
	document.querySelector("#form-intro").textContent = registering
		? "A few details and your next favorite is just around the corner."
		: "Sign in to your account and get back to the good stuff.";
	submitButton.innerHTML = registering
		? 'Create account <span aria-hidden="true">→</span>'
		: 'Sign in <span aria-hidden="true">→</span>';
	switchPrompt.firstChild.textContent = registering ? "Already have an account? " : "New around here? ";
	modeToggle.textContent = registering ? "Sign in" : "Create an account";
	showMessage("");
}

async function requestJson(path, payload) {
	const response = await fetch(path, {
		method: payload ? "POST" : "GET",
		headers: payload ? { "Content-Type": "application/json" } : {},
		body: payload ? JSON.stringify(payload) : undefined,
		credentials: "same-origin"
	});
	const result = await response.json();
	if (!response.ok) {
		throw new Error(result.error || "We couldn't complete that request.");
	}
	return result;
}

function redirectAfterSignIn() {
	const requestedPath = new URLSearchParams(window.location.search).get("next");
	const safePath = requestedPath && requestedPath.startsWith("/") && !requestedPath.startsWith("//")
		? requestedPath
		: "index.html";
	window.location.assign(safePath);
}

modeToggle.addEventListener("click", () => setMode(!isRegistering));

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	showMessage("");
	if (!form.reportValidity()) return;
	if (isRegistering && passwordInput.value !== confirmInput.value) {
		showMessage("Those passwords don't match yet.");
		confirmInput.focus();
		return;
	}

	const payload = {
		email: document.querySelector("#email").value.trim(),
		password: passwordInput.value
	};
	if (isRegistering) payload.name = nameInput.value.trim();
	const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
	submitButton.disabled = true;
	try {
		await requestJson(endpoint, payload);
		redirectAfterSignIn();
	} catch (error) {
		showMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
	} finally {
		submitButton.disabled = false;
	}
});

document.querySelector("#sign-out-button").addEventListener("click", async (event) => {
	const button = event.currentTarget;
	const signOutMessage = document.querySelector("#sign-out-message");
	signOutMessage.textContent = "";
	button.disabled = true;
	try {
		await requestJson("/api/auth/logout", {});
		signedInPanel.hidden = true;
		form.hidden = false;
		switchPrompt.hidden = false;
		showMessage("You've signed out.", true);
	} catch (error) {
		signOutMessage.textContent = error instanceof Error ? error.message : "We couldn't sign you out.";
	} finally {
		button.disabled = false;
	}
});

requestJson("/api/auth/me")
	.then(({ user }) => {
		if (!user) return;
		form.hidden = true;
		switchPrompt.hidden = true;
		signedInPanel.hidden = false;
		document.querySelector("#signed-in-name").textContent = `${user.name} · ${user.email}`;
	})
	.catch((error) => {
		showMessage(error instanceof Error ? error.message : "The account server is unavailable.");
	});
