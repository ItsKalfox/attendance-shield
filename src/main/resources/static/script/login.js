const BASE_URL = window.location.origin;
let jwtToken = sessionStorage.getItem("jwt_token") || "";

window.addEventListener('DOMContentLoaded', () => {
    // Check if token exists and is valid. If yes, redirect to /index.html
    if (jwtToken) {
        if (parseAndValidateToken(jwtToken)) {
            window.location.href = "/index.html";
            return;
        }
    }
});

function parseAndValidateToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const claims = JSON.parse(jsonPayload);

        // Expiry Check
        if (claims.exp * 1000 < Date.now()) {
            return false;
        }

        if (claims.role === 'STUDENT') {
            return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}

// Login Handler
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const errorMsgEl = document.getElementById("login-error-msg");
        
        if (errorMsgEl) {
            errorMsgEl.classList.add("hidden");
            errorMsgEl.textContent = "";
        }

        const submitBtn = loginForm.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="btn-loader"><span></span><span></span><span></span></div>';
        }

        try {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) {
                let errorData = { message: "Login failed" };
                try {
                    errorData = await res.json();
                } catch(e) {}
                throw new Error(errorData.message || "Login failed");
            }

            const data = await res.json();
            if (data.role === 'STUDENT') {
                throw new Error("Access denied: Students are not allowed to log in to the admin/lecturer portal.");
            }

            sessionStorage.setItem("jwt_token", data.token);
            window.location.href = "/index.html";

        } catch (err) {
            if (errorMsgEl) {
                errorMsgEl.textContent = err.message;
                errorMsgEl.classList.remove("hidden");
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Sign In";
            }
        }
    });
}
