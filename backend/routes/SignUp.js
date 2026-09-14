// routes/SignUp.js
import express from "express";
import fs from "fs";
import path from "path";
import bcryptjs from "bcryptjs";
import { fileURLToPath } from "url";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { validateSignup } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../data/users.json");

// Ensure data directory and users file exist
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([], null, 2), "utf8");

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8") || "[]");
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), "utf8");
}

// POST /api/signup
router.post("/", authLimiter, validateSignup, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const users = readUsers();

    // Check for existing email
    if (users.find(u => u.email === email.toLowerCase())) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    // Hash password with bcrypt (12 rounds)
    const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcryptjs.hash(password, ROUNDS);

    const newUser = {
      id: Date.now().toString(),
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role: "user",
      isActive: true,
      addresses: [],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      loginAttempts: 0,
      lockUntil: null,
    };

    users.push(newUser);
    writeUsers(users);

    // Issue JWT tokens immediately after signup
    const tokenPayload = { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken({ id: newUser.id });

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return safe user (no password)
    const { password: _p, ...safe } = newUser;
    return res.status(201).json({
      message: "Account created successfully!",
      user: safe,
      accessToken,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error during signup. Please try again." });
  }
});

export default router;
