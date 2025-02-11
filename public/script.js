document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    let username = document.getElementById("loginUsername").value;
    let password = document.getElementById("loginPassword").value;

    console.log("Login Attempt:", username, password);

    try {
        const response = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();
        alert(result.message);
        
        if (response.ok) {
            console.log("Redirecting to:", `/user/${result.userId}`);
            window.location.replace(`http://localhost:3000/user/${result.userId}`);

        }
    } catch (error) {
        console.error("Error:", error);
        alert("Failed to connect to server");
    }
});


document.getElementById("registerForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    let username = document.getElementById("registerUsername").value;
    let email = document.getElementById("registerEmail").value;
    let password = document.getElementById("registerPassword").value;

    console.log("Registration Attempt:", username, email, password);

    try {
        const response = await fetch("http://localhost:3000/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });

        const result = await response.json();
        alert(result.message);
        if (response.ok) this.reset();  // Clear form if registration is successful
    } catch (error) {
        console.error("Error:", error);
        alert("Failed to connect to server");
    }
});
