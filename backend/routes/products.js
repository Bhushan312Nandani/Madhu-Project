import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readJSON = (file) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, "../data", file), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
};

// GET all products with optional category or search filtering
router.get("/", (req, res) => {
  try {
    const products = readJSON("products.json");
    const { category, search } = req.query;

    let filtered = products;

    if (category && category !== "all") {
      const catLower = category.toLowerCase();
      filtered = filtered.filter((p) => {
        const pCat = (p.category || "").toLowerCase();
        const pName = (p.name || "").toLowerCase();
        return pCat.includes(catLower) || catLower.includes(pCat) || pName.includes(catLower);
      });
    }

    if (search) {
      const sLower = search.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.name || "").toLowerCase().includes(sLower) ||
        (p.description || "").toLowerCase().includes(sLower) ||
        (p.category || "").toLowerCase().includes(sLower)
      );
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET single product by ID (searches products.json, then flashSales.json)
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const products = readJSON("products.json");
    const flashSales = readJSON("flashSales.json");
    const all = [...products, ...flashSales];

    const found = all.find((p) => String(p.id) === String(id));
    if (found) {
      return res.json(found);
    }

    res.status(404).json({ error: "Product not found" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
