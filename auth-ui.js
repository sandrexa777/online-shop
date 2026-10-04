const AUTH_API = "https://api.everrest.educata.dev";
(async function syncAccountHeader() {
    const token = localStorage.getItem("access_token");
    const accountLink = document.querySelector(".account-link");
    if (!accountLink || !token) return;
    try {
        const response = await fetch(`${AUTH_API}/auth`, { headers: { Authorization: `Bearer ${token}` } });
        const profile = await response.json();
        if (!response.ok || profile.verified === false) {
            if ((profile.errorKeys || []).includes("errors.user_email_not_verified")) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                if (profile.email) localStorage.setItem("pending_verification_email", profile.email);
            }
            return;
        }
        accountLink.textContent = `Hi, ${profile.firstName || "Account"}`;
        accountLink.href = "#account";
        accountLink.setAttribute("aria-label", `Signed in as ${profile.firstName || "account"}`);
        if (accountLink.parentElement.querySelector(".logout-button")) return;
        const logoutButton = document.createElement("button");
        logoutButton.type = "button";
        logoutButton.className = "logout-button";
        logoutButton.textContent = "Sign out";
        logoutButton.addEventListener("click", async () => {
            try { await fetch(`${AUTH_API}/auth/sign_out`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); }
            finally {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                location.href = "index.html";
            }
        });
        accountLink.parentElement.appendChild(logoutButton);
    } catch (error) { console.warn("Could not load the signed-in account header.", error); }
})();
