document.addEventListener("DOMContentLoaded", () => {
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirm-password");
    const registerButton = document.getElementById("register");
    const errorText = document.getElementById("error");

    registerButton.addEventListener("click", async (e) => {
        e.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Basisvalidierung
        if (!username || !password || !confirmPassword) {
            errorText.innerText = "All fields are required.";
            return;
        }
        if (password !== confirmPassword) {
            errorText.innerText = "Passwords do not match.";
            return;
        }

        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (response.ok) {
                errorText.style.color = "lightgreen";
                errorText.innerText = "Registration successful! Redirecting to login in a moment...";

                setTimeout(() => {
                    window.location.href = "/login.html";
                }, 2000);
            } else {
                errorText.style.color = "red";
                errorText.innerText = data.error || "Registration failed.";
            }
        } catch (err) {
            errorText.style.color = "red";
            errorText.innerText = "An error occurred.";
            console.error("Registration error:", err);
        }
    });
});
