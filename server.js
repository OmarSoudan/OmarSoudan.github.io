const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Google Gemini API Setup
const GEMINI_API_KEY = "AIzaSyD5-hh0DQ-gdEIBBkbFqKQEsH6Gg7MC8js"; // Replace with your actual Gemini API key
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "therapy",
    charset: "utf8mb4",
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
        return;
    }
    console.log("Connected to MySQL database");
});

app.use(express.static(path.join(__dirname, "public"))); // Serve static files

// Register User
app.post("/register", (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
    db.query(sql, [username, email, password], (err) => {
        if (err) {
            console.error("Database error during registration:", err);
            return res.status(500).json({ message: "Error registering user" });
        }
        res.json({ message: "User registered successfully" });
    });
});

// Login User
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
    }

    const sql = "SELECT id FROM users WHERE username = ? AND password = ?";
    db.query(sql, [username, password], (err, result) => {
        if (err) {
            return res.status(500).json({ message: "Error retrieving data" });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Invalid credentials" });
        }

        res.json({ message: "Login successful", userId: result[0].id });
    });
});

// Fetch Previous Thoughts
app.get("/getPreviousThoughts", (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
    }

    const query = "SELECT text_history FROM users WHERE id = ?";
    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.json({ text_history: [] });
        }

        try {
            res.json({ text_history: results[0]?.text_history ? results[0].text_history.split("*") : [] });
        } catch (error) {
            console.error("Error processing text_history:", error);
            res.json({ text_history: [] }); // Return empty array instead of crashing
        }
        
    });
});

// Save Notes
app.post("/saveNotes", (req, res) => {
    const { userId, feeling, thoughts } = req.body;

    db.query("SELECT text_history FROM users WHERE id = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (results.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const oldTextHistory = results[0].text_history || "";
        const updatedTextHistory = oldTextHistory + "*" + thoughts;

        db.query(
            "UPDATE users SET feeling = ?, text_history = ? WHERE id = ?",
            [feeling, updatedTextHistory, userId],
            (err) => {
                if (err) return res.status(500).json({ message: "Error updating data" });

                res.json({ message: "Notes saved successfully" });
            }
        );
    });
});

// Logout
app.post("/logout", (req, res) => {
    res.json({ message: "Logged out successfully" });
});

// Chat With Gemini
app.post("/chatWithGemini", async (req, res) => {
    const { userMessage } = req.body;

    if (!userMessage) {
        return res.status(400).json({ reply: "Message cannot be empty!" });
    }

    try {
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
        });

        res.json({ reply: response.data.candidates[0].content.parts[0].text });
    } catch (error) {
        console.error("Gemini API error:", error);
        res.status(500).json({ reply: "Error getting response from Gemini." });
    }
});

// Serve login.html
app.get("/login.html", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

// Serve user.html
app.get("/user/:userId", (req, res) => {
    res.sendFile(path.join(__dirname, "user.html"));
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});



app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on port 3000");
});
