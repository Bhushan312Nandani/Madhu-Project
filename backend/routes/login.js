// routes/login.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersFile = path.join(__dirname, "../data/users.json");
const currentFile = path.join(__dirname, "../data/current.json");

// helper
function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return [];
  }
}

router.post("/", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  const users = readJSON(usersFile);
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const sessionData = {
    id: String(user.id),
    name: user.name,
    email: user.email,
    loginTime: new Date().toISOString(),
    location: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
    userAgent: req.headers["user-agent"] || ""
  };

  try {
    fs.writeFileSync(currentFile, JSON.stringify(sessionData, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving current.json", err);
  }

  return res.json({ message: "Login successful", user: sessionData });
});

export default router;
