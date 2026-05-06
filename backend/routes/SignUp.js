// routes/SignUp.js
import express from "express";
import fs from "fs";
import path from "path";
const router = express.Router();

const filePath = path.resolve("data", "users.json");
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([], null, 2), "utf8");

router.post("/", (req, res) => {
  const { name, email, phone, password, confirmPassword } = req.body;
  if (!name || !email || !phone || !password || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const users = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const newUser = { id: Date.now(), name, email, phone, password };
  users.push(newUser);
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), "utf8");

  // Return no password
  const { password: _p, ...safe } = newUser;
  return res.status(201).json({ message: "Signup successful!", user: safe });
});

export default router;
