require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors()); // ✅ Enable CORS

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// **Connect to MySQL**
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "therapy",
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
        return;
    }
    console.log("✅ MySQL Connected!");
});

// **Ensure Users Table Exists**
db.query(
    `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
    )`,
    (err) => {
        if (err) console.error("Table creation error:", err);
        else console.log("✅ Users table ready");
    }
);

// **Register Route**
app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (results.length > 0) return res.status(400).json({ message: "User already exists" });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        db.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword], (err) => {
            if (err) return res.status(500).json({ message: "Database error" });
            res.status(201).json({ message: "Account created successfully" });
        });
    });
});

// **Login Route**
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (results.length === 0) return res.status(400).json({ message: "Invalid credentials" });

        const user = results[0];

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        // Generate token
        const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "1h" });

        res.json({ message: "Login successful", token });
    });
});

// **Start Server**
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
