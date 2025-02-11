const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// Connect to MySQL
const db = mysql.createConnection({
    host: "localhost",
    user: "root", // Change if needed
    password: "yourpassword", // Change to your actual password
    database: "therapy", charset: "utf8mb4"
});

db.connect(err => {
    if (err) throw err;
    console.log("Connected to MySQL database");
});

// Save notes to MySQL
app.post("/saveNotes", (req, res) => {
    const { userId, feeling, thoughts } = req.body;

    // Find user first
    db.query("SELECT text_history FROM users WHERE id = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (results.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const oldTextHistory = results[0].text_history || ""; // Get previous text history

        // Update user's feeling and append to text history
        db.query(
            "UPDATE users SET feeling = ?, text_history = ? WHERE id = ?",
            [feeling, oldTextHistory + "\n" + thoughts, userId],
            (err, result) => {
                if (err) return res.status(500).json({ message: "Error updating data" });

                res.json({ message: "Notes saved successfully" });
            }
        );
    });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
