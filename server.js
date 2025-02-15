require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const schedule = require("node-schedule");

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://127.0.0.1:5500", credentials: true }));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Google Gemini API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyD5-hh0DQ-gdEIBBkbFqKQEsH6Gg7MC8js";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateText?key=${GEMINI_API_KEY}`;

console.log("🚀 Server is starting...");

// **Connect to MySQL**
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "therapy",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// **Token Verification Middleware**
const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token" });
        }
        req.user = decoded;
        next();
    });
};

// **Register Function**
const registerUser = async (req, res) => {
    console.log("📌 Register Request:", req.body);
    const { name, email, password, birthdate, country } = req.body;
    if (!name || !email || !password || !birthdate || !country) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
        if (users.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            "INSERT INTO users (name, email, password, birthdate, country) VALUES (?, ?, ?, ?, ?)", 
            [name, email.toLowerCase(), hashedPassword, birthdate, country]
        );

        res.status(201).json({ message: "Account created successfully" });
    } catch (error) {
        console.error("❌ Database Error in Registration:", error);
        res.status(500).json({ message: "Database error" });
    }
};

// **Login Function**
const loginUser = async (req, res) => {
    console.log("📌 Login Request:", req.body);
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
    }

    try {
        const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
        if (users.length === 0) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ 
            message: "Login successful", 
            token,
            user: { id: user.id, name: user.name, email: user.email } 
        });
    } catch (error) {
        console.error("❌ Database Error in Login:", error);
        res.status(500).json({ message: "Database error" });
    }
};

// **Save User Settings**
const saveUserSettings = async (req, res) => {
    try {
        const { userName, gender, chatWith, aiName } = req.body;

        if (!userName || !aiName) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        const [existing] = await db.query("SELECT * FROM user_settings WHERE user_id = ?", [req.user.id]);

        if (existing.length > 0) {
            await db.query(
                "UPDATE user_settings SET user_name = ?, gender = ?, chat_with = ?, ai_name = ? WHERE user_id = ?",
                [userName, gender, chatWith, aiName, req.user.id]
            );
        } else {
            await db.query(
                "INSERT INTO user_settings (user_id, user_name, gender, chat_with, ai_name) VALUES (?, ?, ?, ?, ?)",
                [req.user.id, userName, gender, chatWith, aiName]
            );
        }

        res.json({ success: true, message: "Settings saved successfully" });
    } catch (error) {
        console.error("Error saving user settings:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

// **Chat Function**
// **Chat Function (Fixed)**
const chatWithAI = async (req, res) => {
    try {
        console.log("📌 Chat Request from User ID:", req.user.id);

        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        // ✅ Fetch user settings from database
        const [settings] = await db.query("SELECT * FROM user_settings WHERE user_id = ?", [req.user.id]);
        if (settings.length === 0) {
            return res.status(400).json({ error: "User settings not found. Please set up first." });
        }

        const userData = settings[0];
        const userName = userData.user_name;
        const aiName = userData.ai_name;
        const userGender = userData.gender;
        const aiGender = userData.chat_with;

        // ✅ Fetch past conversations for context
        const [pastChats] = await db.query("SELECT message, response FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", [req.user.id]);

        let conversationHistory = pastChats.map(chat => `${userName}: ${chat.message}\n${aiName}: ${chat.response}`).join("\n");
        if (!conversationHistory) {
            conversationHistory = `${aiName} is your personal AI friend. They always listen and engage in meaningful conversations with you.`;
        }

        // ✅ Construct the AI prompt
        const prompt = `
        You are ${aiName} with ${aiGender} as your gender, a best friend for ${userName}, who is a ${userGender}. 
        Your goal is to be engaging, supportive, and interesting. You remember past conversations and respond naturally like a friend.
        Stop repeating ${userName}'s name in every message. Be a good listener and provide thoughtful responses.
        Try to start conversations and pick up where you left off or any random topic that makes sense based on the ${conversationHistory}.
        
        
        Previous chats:
        ${conversationHistory}
        
        Current chat:
        ${userName}: ${message}
        ${aiName}:`;

        // ✅ Send request to Google Gemini
        const geminiResponse = await axios.post(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ]
        }, {
            headers: { "Content-Type": "application/json" }
        });

        // ✅ Extract AI response
        const aiResponse = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm here for you! 😊";

        console.log("🤖 AI Response:", aiResponse);

        // ✅ Save chat history for personalization
        await db.query("INSERT INTO chat_history (user_id, message, response) VALUES (?, ?, ?)", [req.user.id, message, aiResponse]);

        res.json({ reply: aiResponse });

    } catch (error) {
        console.error("❌ Error in Chat:", error?.response?.data || error.message);
        res.status(500).json({ error: "Failed to get AI response" });
    }
};

const getChatHistory = async (req, res) => {
    try {
        const { email, userId } = req.body; // Accept email or userId from the request
        if (!email && !userId) {
            return res.status(400).json({ error: "Email or User ID is required" });
        }

        console.log("📌 Fetching Chat History for:", email || userId);

        // Determine which parameter to use
        let query, param;
        if (userId) {
            query = "SELECT message, response, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at ASC";
            param = userId;
        } else {
            query = `
                SELECT chat_history.message, chat_history.response, chat_history.created_at 
                FROM chat_history
                JOIN users ON chat_history.user_id = users.id
                WHERE users.email = ? 
                ORDER BY chat_history.created_at ASC`;
            param = email;
        }

        // Fetch chat history
        const [history] = await db.query(query, [param]);

        res.json({ success: true, chatHistory: history });
    } catch (error) {
        console.error("❌ Error Fetching Chat History:", error.message);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
};









// **Routes**
app.post("/register", registerUser);
app.post("/login", loginUser);
app.post("/save_user_settings", verifyToken, saveUserSettings);
app.post("/chat", verifyToken, chatWithAI);
app.post("/chat-history", getChatHistory);



// **Serve Frontend**
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// **Start Server**
app.listen(PORT, () => console.log(`🚀 Server running on http://127.0.0.1:${PORT}`));
