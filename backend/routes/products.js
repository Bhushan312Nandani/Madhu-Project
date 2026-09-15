// routes/products.js — Prisma (PostgreSQL) with JSON fallback
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dbMode } from "../config/db.js";
import prisma from "../lib/prisma.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON fallback reader
const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "../data", file), "utf-8"));
  } catch { return []; }
};

// ─── GET all products ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { category, search, featured, flash } = req.query;

    if (dbMode === "postgres") {
      const where = { isActive: true };
      if (category && category !== "all") {
        where.category = { contains: category, mode: "insensitive" };
      }
      if (featured === "true") where.isFeatured = true;
      if (flash === "true") {
        where.isFlashSale = true;
        where.flashSaleEnd = { gt: new Date() };
      }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
          { tags: { array_contains: [search.toLowerCase()] } },
        ];
      }

      const products = await prisma.product.findMany({
        where,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      });

      return res.json(products.map(normalizeProduct));
    }

    // JSON fallback
    let products = readJSON("products.json");
    if (category && category !== "all") {
      const cat = category.toLowerCase();
      products = products.filter(p =>
        (p.category || "").toLowerCase().includes(cat) ||
        (p.name || "").toLowerCase().includes(cat)
      );
    }
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p =>
        (p.name || "").toLowerCase().includes(s) ||
        (p.description || "").toLowerCase().includes(s)
      );
    }
    res.json(products);
  } catch (err) {
    console.error("[Products] GET /:", err.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ─── GET single product ───────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (dbMode === "postgres") {
      const product = await prisma.product.findFirst({
        where: {
          OR: [{ id }, { slug: id }],
          isActive: true,
        },
        include: {
          reviews: {
            include: { user: { select: { name: true, avatar: true } } },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });
      if (!product) return res.status(404).json({ error: "Product not found" });
      return res.json(normalizeProduct(product));
    }

    // JSON fallback
    const all = [...readJSON("products.json"), ...readJSON("flashSales.json")];
    const found = all.find(p => String(p.id) === String(id) || p.slug === id);
    if (!found) return res.status(404).json({ error: "Product not found" });
    res.json(found);
  } catch (err) {
    console.error("[Products] GET /:id:", err.message);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Normalize Prisma product to match legacy JSON shape expected by frontend
function normalizeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    shortDesc: p.shortDesc,
    price: Number(p.price),
    salePrice: p.salePrice ? Number(p.salePrice) : null,
    stock: p.stock,
    category: p.category,
    images: Array.isArray(p.images) ? p.images : [],
    image: p.mainImage || (Array.isArray(p.images) ? p.images[0] : null),
    mainImage: p.mainImage,
    benefits: Array.isArray(p.benefits) ? p.benefits : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    weight: p.weight,
    unit: p.unit,
    brand: p.brand,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isFlashSale: p.isFlashSale,
    flashDiscount: p.flashDiscount,
    flashSaleEnd: p.flashSaleEnd,
    rating: Number(p.rating),
    reviewCount: p.reviewCount,
    soldCount: p.soldCount,
    reviews: p.reviews || [],
    createdAt: p.createdAt,
  };
}

export default router;
