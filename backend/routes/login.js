// routes/login.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcryptjs from "bcryptjs";
import { signAccessToken, signRefreshToken, signAdminToken, verifyRefreshToken, extractToken } from "../utils/jwt.js";
import { validateLogin } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersFile = path.join(__dirname, "../data/users.json");
const dataDir = path.join(__dirname, "../data");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify([], null, 2), "utf8");

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf-8") || "[]");
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
}

const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

// ─── User Login ───────────────────────────────────────────────────────────────
router.post("/", authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.email === email.toLowerCase());

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Check account lock
    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.lockUntil) - Date.now()) / 60000);
      return res.status(403).json({
        message: `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`,
        locked: true,
        lockUntil: user.lockUntil,
      });
    }

    // Compare hashed password
    let passwordMatch = false;
    // Support both hashed (new) and plaintext (legacy migration) passwords
    if (user.password && user.password.startsWith("$2")) {
      passwordMatch = await bcryptjs.compare(password, user.password);
    } else {
      // Legacy plaintext — migrate on successful login
      passwordMatch = user.password === password;
      if (passwordMatch) {
        const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        user.password = await bcryptjs.hash(password, ROUNDS);
      }
    }

    if (!passwordMatch) {
      // Increment failed attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS).toISOString();
        writeUsers(users);
        return res.status(403).json({
          message: "Too many failed attempts. Account locked for 15 minutes.",
          locked: true,
          lockUntil: user.lockUntil,
        });
      }
      writeUsers(users);
      const remaining = MAX_ATTEMPTS - user.loginAttempts;
      return res.status(401).json({
        message: `Invalid email or password. ${remaining} attempt(s) remaining before lockout.`,
      });
    }

    // Successful login — reset attempts, update lastLogin
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date().toISOString();
    writeUsers(users);

    const tokenPayload = { id: String(user.id), email: user.email, role: user.role || "user", name: user.name };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken({ id: String(user.id) });

    // Store refresh token in user record
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) { users[idx].refreshToken = refreshToken; writeUsers(users); }

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (email !== adminEmail || password !== adminPassword) {
      console.warn(`[ADMIN LOGIN FAILED] IP: ${req.ip}, Email: ${email}`);
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    const adminPayload = { id: "admin-001", email: adminEmail, role: "admin", name: "Admin" };
    const accessToken = signAdminToken(adminPayload);
    const refreshToken = signRefreshToken({ id: "admin-001", role: "admin" });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log(`[ADMIN LOGIN] Admin logged in from IP: ${req.ip}`);
    return res.json({
      message: "Admin login successful",
      user: adminPayload,
      accessToken,
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ message: "Server error during admin login." });
  }
});

// ─── Token Refresh ────────────────────────────────────────────────────────────
router.post("/refresh", (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token required." });

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) return res.status(401).json({ message: "Invalid or expired refresh token." });

    // For admin
    if (decoded.role === "admin") {
      const adminPayload = { id: "admin-001", email: process.env.ADMIN_EMAIL, role: "admin", name: "Admin" };
      const newAccessToken = signAdminToken(adminPayload);
      return res.json({ accessToken: newAccessToken });
    }

    // For regular users — verify user still exists
    const users = readUsers();
    const user = users.find(u => String(u.id) === String(decoded.id));
    if (!user || !user.isActive) return res.status(401).json({ message: "User not found or inactive." });

    const tokenPayload = { id: String(user.id), email: user.email, role: user.role || "user", name: user.name };
    const newAccessToken = signAccessToken(tokenPayload);
    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("Token refresh error:", err);
    return res.status(500).json({ message: "Server error refreshing token." });
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
  return res.json({ message: "Logged out successfully." });
});

export default router;
