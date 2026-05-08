// routes/flashTimer.js - Flash sale countdown timer API
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const timerFile = path.join(__dirname, "../data/flashTimer.json");

const defaultTimer = { days: 3, hours: 23, minutes: 19, seconds: 56 };

function readTimer() {
  if (!fs.existsSync(timerFile)) return defaultTimer;
  try { return JSON.parse(fs.readFileSync(timerFile, "utf-8")); } catch { return defaultTimer; }
}

// GET flash timer
router.get("/", (req, res) => {
  res.json(readTimer());
});

// PUT update flash timer (admin only)
router.put("/", (req, res) => {
  const { days, hours, minutes, seconds } = req.body;
  const timer = {
    days: Number(days) || 0,
    hours: Number(hours) || 0,
    minutes: Number(minutes) || 0,
    seconds: Number(seconds) || 0,
  };
  fs.writeFileSync(timerFile, JSON.stringify(timer, null, 2));
  res.json({ message: "Timer updated", timer });
});

export default router;
