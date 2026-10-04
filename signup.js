const API = "https://api.everrest.educata.dev";
const form = document.getElementById("signupForm");
const message = document.getElementById("signupMessage");
const verificationPanel = document.getElementById("verificationPanel");
const verificationMessage = document.getElementById("verificationMessage");
let registeredEmail = "";
document.getElementById("resendVerificationButton").addEventListener("click", async () => {
    const email = registeredEmail || document.getElementById("email").value.trim();
    if (!email) { verificationMessage.textContent = "Enter your email address first."; return; }
    verificationMessage.textContent = "Sending verification email...";
    try {
        const response = await fetch(`${API}/auth/verify_email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        const data = response.status === 204 ? {} : await response.json();
        if (!response.ok) throw new Error(data.error || data.message || "Could not send the verification email.");
        verificationMessage.textContent = "If the account exists, EverREST sent a new verification link. Check your inbox and spam folder.";
    } catch (error) { verificationMessage.textContent = error.message; }
});
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const age = Number(document.getElementById("age").value);
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const address = document.getElementById("address").value.trim();
    const phone = document.getElementById("phone").value.trim().replace(/[\s()-]/g, "");
    const zipcode = document.getElementById("zipcode").value.trim();
    const avatar = document.getElementById("avatar").value.trim();
    const gender = document.getElementById("gender").value;
    message.textContent = "Creating your account...";
    try {
        const response = await fetch(`${API}/auth/sign_up`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firstName, lastName, age, email, password, address, phone, zipcode, avatar, gender })
        });
        const data = response.status === 204 ? {} : await response.json();
        if (!response.ok) {
            const labels = { "errors.invalid_address": "address", "errors.invalid_phone_number": "phone number", "errors.invalid_zipcode": "postal code", "errors.invalid_avatar": "avatar URL", "errors.invalid_gender": "gender" };
            const invalidFields = (data.errorKeys || []).map((key) => labels[key]).filter(Boolean);
            throw new Error(invalidFields.length ? `Please check: ${invalidFields.join(", ")}.` : (data.error || data.message || "Could not create account."));
        }
        registeredEmail = email;
        localStorage.setItem("pending_verification_email", email);
        verificationPanel.classList.remove("hidden");
        message.textContent = "Account created. Verify your email before signing in.";
    } catch (error) { message.textContent = error.message || "Something went wrong. Please try again."; }
});
