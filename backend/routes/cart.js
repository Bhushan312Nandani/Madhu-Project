// routes/cart.js — Prisma (PostgreSQL) with JSON fallback
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dbMode } from "../config/db.js";
import prisma from "../lib/prisma.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cartFile = path.join(__dirname, "../data/cart.json");

if (!fs.existsSync(cartFile)) fs.writeFileSync(cartFile, JSON.stringify({}, null, 2), "utf8");

const readCart = () => { try { return JSON.parse(fs.readFileSync(cartFile, "utf8") || "{}"); } catch { return {}; } };
const writeCart = (d) => fs.writeFileSync(cartFile, JSON.stringify(d, null, 2), "utf8");
const getUserId = (req) => (req.headers["x-user-id"] || req.query.userId || req.body?.userId || "guest").toString();

// ─── Prisma helpers ────────────────────────────────────────────────────────────
async function getOrCreateCart(userId) {
  return await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: { items: { include: { product: { select: { name: true, mainImage: true, price: true, slug: true } } } } },
  });
}

function cartItemsToLegacy(items) {
  return items.map(i => ({
    id: i.id,
    productId: i.productId,
    name: i.product?.name || i.name || "",
    image: i.product?.mainImage || "",
    price: Number(i.product?.price || 0),
    quantity: i.quantity,
    slug: i.product?.slug,
  }));
}

// ─── GET cart ─────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const userId = getUserId(req);
  if (dbMode === "postgres" && userId !== "guest") {
    try {
      const cart = await getOrCreateCart(userId);
      return res.json(cartItemsToLegacy(cart.items));
    } catch (err) {
      console.error("[Cart] GET:", err.message);
      return res.status(500).json({ message: "Failed to fetch cart" });
    }
  }
  const data = readCart();
  res.json(data[userId] || []);
});

// ─── POST add to cart ─────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, name, image, price = 0, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ message: "productId required" });

    if (dbMode === "postgres" && userId !== "guest") {
      const cart = await prisma.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      // Upsert cart item (increment quantity if exists)
      const existing = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId: String(productId) } },
      });

      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + Number(quantity) },
        });
      } else {
        await prisma.cartItem.create({
          data: { cartId: cart.id, productId: String(productId), quantity: Number(quantity) },
        });
      }

      const updatedCart = await getOrCreateCart(userId);
      return res.status(201).json({ message: "Cart updated", cart: cartItemsToLegacy(updatedCart.items) });
    }

    // JSON fallback
    const data = readCart();
    if (!Array.isArray(data[userId])) data[userId] = [];
    const existing = data[userId].find(i => String(i.productId) === String(productId));
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + Number(quantity || 1);
    } else {
      data[userId].push({ id: Date.now(), productId: String(productId), name: name || "", image: image || "", price: Number(price) || 0, quantity: Number(quantity) || 1, addedAt: new Date().toISOString() });
    }
    writeCart(data);
    return res.status(201).json({ message: "Cart updated", cart: data[userId] });
  } catch (err) {
    console.error("[Cart] POST:", err.message);
    return res.status(500).json({ message: "Server error adding to cart" });
  }
});

// ─── PUT update quantity ───────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const itemId = req.params.id;
    const quantity = parseInt(req.body.quantity, 10);
    if (isNaN(quantity) || quantity < 1) return res.status(400).json({ message: "Quantity must be >= 1" });

    if (dbMode === "postgres" && userId !== "guest") {
      await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
      const cart = await getOrCreateCart(userId);
      return res.json({ message: "Quantity updated", cart: cartItemsToLegacy(cart.items) });
    }

    const data = readCart();
    const userCart = data[userId] || [];
    const item = userCart.find(i => String(i.id) === String(itemId));
    if (!item) return res.status(404).json({ message: "Item not found" });
    item.quantity = quantity;
    writeCart(data);
    return res.json({ message: "Quantity updated", item, cart: userCart });
  } catch (err) {
    return res.status(500).json({ message: "Server error updating quantity" });
  }
});

// ─── DELETE item ──────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const itemId = req.params.id;

    if (dbMode === "postgres" && userId !== "guest") {
      await prisma.cartItem.deleteMany({ where: { id: itemId } });
      const cart = await getOrCreateCart(userId);
      return res.json({ message: "Removed", cart: cartItemsToLegacy(cart.items) });
    }

    const data = readCart();
    data[userId] = (data[userId] || []).filter(i => String(i.id) !== String(itemId));
    writeCart(data);
    return res.json({ message: "Removed", cart: data[userId] });
  } catch (err) {
    return res.status(500).json({ message: "Server error removing item" });
  }
});

export default router;
