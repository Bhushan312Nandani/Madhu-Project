// routes/flashSales.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flashFile = path.join(__dirname, "../data/flashSales.json");
const timerFile = path.join(__dirname, "../data/flashTimer.json");

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { return []; }
}

// GET flash sales products
router.get("/", (req, res) => {
  res.json(readJSON(flashFile));
});

export default router;
