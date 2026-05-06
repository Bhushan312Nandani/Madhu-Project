import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/", (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, "../data/SearchByCategories.json"), "utf-8");
    const categories = JSON.parse(data);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Unable to read categories data" });
  }
});

export default router;
