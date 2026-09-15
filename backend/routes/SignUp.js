// routes/SignUp.js — Prisma (PostgreSQL) with JSON fallback
import express from "express";
import fs from "fs";
import path from "path";
import bcryptjs from "bcryptjs";
import { fileURLToPath } from "url";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { validateSignup } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { dbMode } from "../config/db.js";
import prisma from "../lib/prisma.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersFile = path.join(__dirname, "../data/users.json");

// JSON helpers
const readUsers = () => {
  try { return JSON.parse(fs.readFileSync(usersFile, "utf-8") || "[]"); } catch { return []; }
};
const writeUsers = (users) => fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");

// POST /api/signup
router.post("/", authLimiter, validateSignup, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcryptjs.hash(password, ROUNDS);

    if (dbMode === "postgres") {
      // Check existing
      const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (exists) return res.status(400).json({ message: "An account with this email already exists." });

      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          password: hashedPassword,
          role: "USER",
          lastLogin: new Date(),
        },
      });

      const tokenPayload = { id: user.id, email: user.email, role: user.role.toLowerCase(), name: user.name };
      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken({ id: user.id });

      // Store refresh token
      await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const { password: _p, refreshToken: _rt, ...safe } = user;
      return res.status(201).json({ message: "Account created successfully!", user: safe, accessToken });
    }

    // JSON fallback
    const users = readUsers();
    if (users.find(u => u.email === email.toLowerCase())) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    const newUser = {
      id: Date.now().toString(),
      name, email: email.toLowerCase(), phone,
      password: hashedPassword,
      role: "user", isActive: true, addresses: [],
      createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
      loginAttempts: 0, lockUntil: null,
    };
    users.push(newUser);
    writeUsers(users);

    const tokenPayload = { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken({ id: newUser.id });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { password: _p, ...safe } = newUser;
    return res.status(201).json({ message: "Account created successfully!", user: safe, accessToken });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error during signup. Please try again." });
  }
});

export default router;
