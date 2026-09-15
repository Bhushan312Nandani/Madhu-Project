// routes/wishlist.js — Prisma (PostgreSQL) with JSON fallback
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dbMode } from "../config/db.js";
import prisma from "../lib/prisma.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wishlistFile = path.join(__dirname, "../data/wishlist.json");

if (!fs.existsSync(wishlistFile)) fs.writeFileSync(wishlistFile, JSON.stringify({}, null, 2), "utf8");

const readWishlist = () => { try { return JSON.parse(fs.readFileSync(wishlistFile, "utf8") || "{}"); } catch { return {}; } };
const writeWishlist = (d) => fs.writeFileSync(wishlistFile, JSON.stringify(d, null, 2), "utf8");
const getUserId = (req) => (req.headers["x-user-id"] || req.query.userId || req.body?.userId || "guest").toString();

async function getOrCreateWishlist(userId) {
  return await prisma.wishlist.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      items: {
        include: { product: { select: { id: true, name: true, mainImage: true, price: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

function wishlistToLegacy(items) {
  return items.map(i => ({
    id: i.id,
    productId: i.productId,
    name: i.product?.name || "",
    price: Number(i.product?.price || 0),
    image: i.product?.mainImage || "",
    slug: i.product?.slug,
    addedAt: i.createdAt,
  }));
}

// ─── GET wishlist ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const userId = getUserId(req);
  if (dbMode === "postgres" && userId !== "guest") {
    try {
      const wishlist = await getOrCreateWishlist(userId);
      return res.json(wishlistToLegacy(wishlist.items));
    } catch (err) {
      console.error("[Wishlist] GET:", err.message);
      return res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  }
  const data = readWishlist();
  res.json(data[userId] || []);
});

// ─── POST add to wishlist ─────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    const productId = String(req.body.productId ?? req.body.id ?? (req.body.product?.id) ?? "");
    if (!productId) return res.status(400).json({ message: "productId required" });

    if (dbMode === "postgres" && userId !== "guest") {
      const wishlist = await prisma.wishlist.upsert({
        where: { userId }, create: { userId }, update: {},
      });

      const existing = await prisma.wishlistItem.findUnique({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      });
      if (existing) return res.status(200).json({ message: "Already in wishlist" });

      await prisma.wishlistItem.create({
        data: { wishlistId: wishlist.id, productId },
      });

      const updated = await getOrCreateWishlist(userId);
      return res.status(201).json({ message: "Added to wishlist", wishlist: wishlistToLegacy(updated.items) });
    }

    // JSON fallback
    const data = readWishlist();
    if (!Array.isArray(data[userId])) data[userId] = [];
    if (data[userId].find(i => String(i.productId) === productId)) {
      return res.status(200).json({ message: "Already in wishlist", wishlist: data[userId] });
    }
    data[userId].push({
      id: Date.now(), productId,
      name: req.body.name || "", price: Number(req.body.price) || 0,
      image: req.body.image || "", addedAt: new Date().toISOString(),
    });
    writeWishlist(data);
    return res.status(201).json({ message: "Added to wishlist", wishlist: data[userId] });
  } catch (err) {
    console.error("[Wishlist] POST:", err.message);
    return res.status(500).json({ message: "Server error adding to wishlist" });
  }
});

// ─── DELETE by productId ──────────────────────────────────────────────────────
router.delete("/:userId/:productId", async (req, res) => {
  const userId = req.params.userId;
  const productId = req.params.productId;
  return deleteItem(res, userId, productId);
});

router.delete("/:productId", async (req, res) => {
  const userId = getUserId(req);
  const productId = req.params.productId;
  return deleteItem(res, userId, productId);
});

async function deleteItem(res, userId, productId) {
  try {
    if (dbMode === "postgres" && userId !== "guest") {
      const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
      if (wishlist) {
        await prisma.wishlistItem.deleteMany({
          where: { wishlistId: wishlist.id, productId: String(productId) },
        });
      }
      const updated = await getOrCreateWishlist(userId);
      return res.json({ message: "Removed from wishlist", wishlist: wishlistToLegacy(updated.items) });
    }

    const data = readWishlist();
    data[userId] = (data[userId] || []).filter(i => String(i.productId) !== String(productId));
    writeWishlist(data);
    return res.json({ message: "Removed from wishlist", wishlist: data[userId] });
  } catch (err) {
    return res.status(500).json({ message: "Server error removing from wishlist" });
  }
}

// ─── POST bulk-delete ─────────────────────────────────────────────────────────
router.post("/bulk-delete", async (req, res) => {
  try {
    const userId = getUserId(req);
    const ids = Array.isArray(req.body.productIds) ? req.body.productIds.map(String) : [];
    if (!ids.length) return res.status(400).json({ message: "productIds required" });

    if (dbMode === "postgres" && userId !== "guest") {
      const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
      if (wishlist) {
        await prisma.wishlistItem.deleteMany({
          where: { wishlistId: wishlist.id, productId: { in: ids } },
        });
      }
      const updated = await getOrCreateWishlist(userId);
      return res.json({ message: "Removed", wishlist: wishlistToLegacy(updated.items) });
    }

    const data = readWishlist();
    const before = (data[userId] || []).length;
    data[userId] = (data[userId] || []).filter(i => !ids.includes(String(i.productId)));
    writeWishlist(data);
    return res.json({ message: "Removed", removedCount: before - data[userId].length, wishlist: data[userId] });
  } catch (err) {
    return res.status(500).json({ message: "server error" });
  }
});

export default router;
