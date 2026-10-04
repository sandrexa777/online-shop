const API = "https://api.everrest.educata.dev";
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const verificationPanel = document.getElementById("verificationPanel");
const verificationMessage = document.getElementById("verificationMessage");
const emailInput = document.getElementById("email");
const pendingEmail = localStorage.getItem("pending_verification_email");
if (pendingEmail) {
    emailInput.value = pendingEmail;
    verificationPanel.classList.remove("hidden");
}

async function resendVerification() {
    const email = emailInput.value.trim();
    if (!email) { verificationMessage.textContent = "Enter your email address first."; return; }
    verificationMessage.textContent = "Sending verification email...";
    try {
        const response = await fetch(`${API}/auth/verify_email`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email })
        });
        const data = response.status === 204 ? {} : await response.json();
        if (!response.ok) throw new Error(data.error || data.message || "Could not send the verification email.");
        localStorage.setItem("pending_verification_email", email);
        verificationMessage.textContent = "If the account exists, EverREST sent a new verification link. Check your inbox and spam folder.";
    } catch (error) { verificationMessage.textContent = error.message; }
}

document.getElementById("resendVerificationButton").addEventListener("click", resendVerification);

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = document.getElementById("password").value;
    loginMessage.textContent = "Signing in...";
    verificationPanel.classList.add("hidden");
    verificationMessage.textContent = "";
    try {
        const response = await fetch(`${API}/auth/sign_in`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            if ((data.errorKeys || []).includes("errors.user_email_not_verified")) {
                localStorage.setItem("pending_verification_email", email);
                verificationPanel.classList.remove("hidden");
                loginMessage.textContent = "Your email address is not verified yet.";
                return;
            }
            throw new Error(data.error || data.message || "Sign in failed.");
        }

        const accessToken = data.access_token || data.accessToken || data.token;
        if (!accessToken) throw new Error("No access token was returned.");

        const profileResponse = await fetch(`${API}/auth`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const profile = profileResponse.status === 204 ? {} : await profileResponse.json();
        const notVerified = (profile.errorKeys || []).includes("errors.user_email_not_verified") || profile.verified === false;
        if (notVerified) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            localStorage.setItem("pending_verification_email", email);
            verificationPanel.classList.remove("hidden");
            loginMessage.textContent = "Your email address is not verified yet.";
            return;
        }
        if (!profileResponse.ok) throw new Error(profile.error || "Could not confirm the account status. Please try again.");

        localStorage.setItem("access_token", accessToken);
        if (data.refresh_token || data.refreshToken) localStorage.setItem("refresh_token", data.refresh_token || data.refreshToken);
        localStorage.removeItem("pending_verification_email");
        loginMessage.textContent = "Signed in successfully.";
        setTimeout(() => { window.location.href = "index.html"; }, 400);
    } catch (error) { loginMessage.textContent = error.message || "Something went wrong. Please try again."; }
});
