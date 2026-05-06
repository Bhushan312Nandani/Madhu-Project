import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/", (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, "../data/footer.json"), "utf-8");
    const oils = JSON.parse(data);
    res.json(oils);
  } catch (err) {
    console.error(err); // log the actual error for debugging
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
