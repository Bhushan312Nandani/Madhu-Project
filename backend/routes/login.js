// routes/login.js — Prisma (PostgreSQL) with JSON fallback
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcryptjs from "bcryptjs";
import { signAccessToken, signRefreshToken, signAdminToken, verifyRefreshToken } from "../utils/jwt.js";
import { validateLogin } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { dbMode } from "../config/db.js";
import prisma from "../lib/prisma.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersFile = path.join(__dirname, "../data/users.json");
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

const readUsers = () => {
  try { return JSON.parse(fs.readFileSync(usersFile, "utf-8") || "[]"); } catch { return []; }
};
const writeUsers = (u) => fs.writeFileSync(usersFile, JSON.stringify(u, null, 2));

// ─── User Login ───────────────────────────────────────────────────────────────
router.post("/", authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (dbMode === "postgres") {
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user) return res.status(401).json({ message: "Invalid email or password." });
      if (!user.isActive) return res.status(403).json({ message: "Account deactivated. Contact support." });

      // Check lock
      if (user.lockUntil && user.lockUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
        return res.status(403).json({
          message: `Account locked. Try again in ${minutesLeft} minute(s).`,
          locked: true, lockUntil: user.lockUntil,
        });
      }

      const passwordMatch = await bcryptjs.compare(password, user.password);

      if (!passwordMatch) {
        const attempts = user.loginAttempts + 1;
        const lockUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_TIME_MS) : null;
        await prisma.user.update({
          where: { id: user.id },
          data: { loginAttempts: attempts, ...(lockUntil && { lockUntil }) },
        });
        if (lockUntil) {
          return res.status(403).json({ message: "Too many failed attempts. Account locked for 15 minutes.", locked: true });
        }
        return res.status(401).json({
          message: `Invalid email or password. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.`,
        });
      }

      // Successful login
      const refreshToken = signRefreshToken({ id: user.id });
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockUntil: null, lastLogin: new Date(), refreshToken },
      });

      const tokenPayload = { id: user.id, email: user.email, role: user.role.toLowerCase(), name: user.name };
      const accessToken = signAccessToken(tokenPayload);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const { password: _p, refreshToken: _rt, ...safe } = user;
      return res.json({ message: "Login successful", user: safe, accessToken });
    }

    // JSON fallback (same logic as before)
    const users = readUsers();
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(401).json({ message: "Invalid email or password." });

    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.lockUntil) - Date.now()) / 60000);
      return res.status(403).json({ message: `Account locked. Try again in ${minutesLeft} minute(s).`, locked: true });
    }

    let match = user.password?.startsWith("$2")
      ? await bcryptjs.compare(password, user.password)
      : user.password === password;

    if (!match) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= MAX_ATTEMPTS) user.lockUntil = new Date(Date.now() + LOCK_TIME_MS).toISOString();
      writeUsers(users);
      if (user.loginAttempts >= MAX_ATTEMPTS)
        return res.status(403).json({ message: "Account locked for 15 minutes.", locked: true });
      return res.status(401).json({ message: `Invalid password. ${MAX_ATTEMPTS - user.loginAttempts} attempt(s) left.` });
    }

    user.loginAttempts = 0; user.lockUntil = null; user.lastLogin = new Date().toISOString();
    const tokenPayload = { id: String(user.id), email: user.email, role: user.role || "user", name: user.name };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken({ id: String(user.id) });
    user.refreshToken = refreshToken;
    writeUsers(users);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const { password: _p, refreshToken: _rt, ...safe } = user;
    return res.json({ message: "Login successful", user: safe, accessToken });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
});

// ─── Admin Login ──────────────────────────────────────────────────────────────
router.post("/admin", authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || "admin@madhuoil.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@MadhuOil2024!";

    if (email !== adminEmail) {
      console.warn(`[ADMIN LOGIN FAILED] IP: ${req.ip}, Email: ${email}`);
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    // Support both bcrypt hash and plaintext admin password in env
    let match = false;
    if (adminPassword.startsWith("$2")) {
      match = await bcryptjs.compare(password, adminPassword);
    } else {
      match = password === adminPassword;
    }

    if (!match) {
      console.warn(`[ADMIN LOGIN FAILED] IP: ${req.ip}, Wrong password`);
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    const adminPayload = { id: "admin-001", email: adminEmail, role: "admin", name: "Admin" };
    const accessToken = signAdminToken(adminPayload);
    const refreshToken = signRefreshToken({ id: "admin-001", role: "admin" });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log(`[ADMIN LOGIN] ✅ Admin logged in from IP: ${req.ip}`);
    return res.json({ message: "Admin login successful", user: adminPayload, accessToken });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ message: "Server error during admin login." });
  }
});

// ─── Token Refresh ────────────────────────────────────────────────────────────
router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) return res.status(401).json({ message: "Refresh token required." });

    const decoded = verifyRefreshToken(token);
    if (!decoded) return res.status(401).json({ message: "Invalid or expired refresh token." });

    if (decoded.role === "admin") {
      const adminPayload = { id: "admin-001", email: process.env.ADMIN_EMAIL, role: "admin", name: "Admin" };
      return res.json({ accessToken: signAdminToken(adminPayload) });
    }

    if (dbMode === "postgres") {
      const user = await prisma.user.findFirst({
        where: { id: decoded.id, isActive: true, refreshToken: token },
      });
      if (!user) return res.status(401).json({ message: "User not found or session expired." });
      const tokenPayload = { id: user.id, email: user.email, role: user.role.toLowerCase(), name: user.name };
      return res.json({ accessToken: signAccessToken(tokenPayload) });
    }

    const users = readUsers();
    const user = users.find(u => String(u.id) === String(decoded.id));
    if (!user || !user.isActive) return res.status(401).json({ message: "User not found." });
    const tokenPayload = { id: String(user.id), email: user.email, role: user.role || "user", name: user.name };
    return res.json({ accessToken: signAccessToken(tokenPayload) });
  } catch (err) {
    console.error("Token refresh error:", err);
    return res.status(500).json({ message: "Server error refreshing token." });
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token && dbMode === "postgres") {
      const decoded = verifyRefreshToken(token);
      if (decoded?.id) {
        await prisma.user.update({ where: { id: decoded.id }, data: { refreshToken: null } }).catch(() => {});
      }
    }
  } catch {}
  res.clearCookie("refreshToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
  return res.json({ message: "Logged out successfully." });
});

export default router;
