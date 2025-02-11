document.addEventListener("DOMContentLoaded", () => {
    console.log("Script Loaded!"); // Debugging

    // **Handle Register Form**
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("registerEmail").value.trim();
            const password = document.getElementById("registerPassword").value.trim();

            console.log("Registering:", email, password); // Debugging

            try {
                const response = await fetch("http://localhost:5000/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();
                console.log("Server Response:", data); // Debugging

                if (response.ok) {
                    alert("Registration successful!");
                    registerForm.reset();
                } else {
                    alert("Error: " + data.message);
                }
            } catch (error) {
                console.error("Fetch Error:", error);
                alert("Network error, check server.");
            }
        });
    }

    // **Handle Login Form**
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("loginEmail").value.trim();
            const password = document.getElementById("loginPassword").value.trim();

            console.log("Logging in:", email, password); // Debugging

            try {
                const response = await fetch("http://localhost:5000/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();
                console.log("Server Response:", data); // Debugging

                if (response.ok) {
                    localStorage.setItem("token", data.token);
                    alert("Login successful! Redirecting...");
                    window.location.href = "dashboard.html";
                } else {
                    alert("Error: " + data.message);
                }
            } catch (error) {
                console.error("Fetch Error:", error);
                alert("Network error, check server.");
            }
        });
    }
});
