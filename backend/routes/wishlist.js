// routes/wishlist.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wishlistFile = path.join(__dirname, "../data/wishlist.json");

// ensure file exists and is an object mapping userId -> []
if (!fs.existsSync(wishlistFile)) {
  fs.writeFileSync(wishlistFile, JSON.stringify({}, null, 2), "utf8");
}

function readWishlist() {
  try {
    const raw = fs.readFileSync(wishlistFile, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    console.error("readWishlist error:", err);
    return {};
  }
}

function writeWishlist(data) {
  try {
    fs.writeFileSync(wishlistFile, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("writeWishlist error:", err);
    throw err;
  }
}

// unified userId extraction: header > query > body > guest
function getUserId(req) {
  return (
    req.headers["x-user-id"] ||
    req.query.userId ||
    req.body.userId ||
    "guest"
  ).toString();
}

// GET wishlist for user
router.get("/", (req, res) => {
  const userId = getUserId(req);
  const data = readWishlist();
  res.json(data[userId] || []);
});

// POST add to wishlist (idempotent)
router.post("/", (req, res) => {
  try {
    const userId = getUserId(req);
    const incomingId = req.body.productId ?? req.body.id ?? (req.body.product && req.body.product.id);
    if (!incomingId) return res.status(400).json({ message: "productId required" });

    const productId = String(incomingId);
    const name = req.body.name ?? req.body.title ?? "";
    const price = req.body.price !== undefined ? Number(req.body.price) : 0;
    const image = req.body.image ?? "";

    const data = readWishlist();
    if (!Array.isArray(data[userId])) data[userId] = [];

    const wishlist = data[userId];

    const exists = wishlist.find(i => String(i.productId) === productId);
    if (exists) {
      return res.status(200).json({ message: "Already in wishlist", item: exists, wishlist });
    }

    const newItem = {
      id: Date.now(),
      productId,
      name,
      price,
      image,
      addedAt: new Date().toISOString(),
    };

    wishlist.push(newItem);
    data[userId] = wishlist;
    writeWishlist(data);

    return res.status(201).json({ message: "Added to wishlist", item: newItem, wishlist });
  } catch (err) {
    console.error("POST /api/wishlist error:", err);
    return res.status(500).json({ message: "Server error adding to wishlist" });
  }
});

// DELETE by productId (not internal numeric id) — frontend uses product id
router.delete("/:productId", (req, res) => {
  try {
    const userId = getUserId(req);
    const productId = String(req.params.productId);

    const data = readWishlist();
    if (!Array.isArray(data[userId])) data[userId] = [];

    const beforeLen = data[userId].length;
    data[userId] = data[userId].filter(i => String(i.productId) !== productId);
    writeWishlist(data);

    if (data[userId].length === beforeLen) {
      // nothing removed
      return res.status(404).json({ message: "Item not found", wishlist: data[userId] });
    }

    return res.json({ message: "Removed from wishlist", wishlist: data[userId] });
  } catch (err) {
    console.error("DELETE /api/wishlist/:productId error:", err);
    return res.status(500).json({ message: "Server error removing from wishlist" });
  }
});



// POST /api/wishlist/bulk-delete
router.post("/bulk-delete", (req, res) => {
  try {
    const userId = getUserId(req);
    const ids = Array.isArray(req.body.productIds) ? req.body.productIds.map(String) : [];
    if (!ids.length) return res.status(400).json({ message: "productIds required" });

    const data = readWishlist();
    if (!Array.isArray(data[userId])) data[userId] = [];

    const before = data[userId].length;
    data[userId] = data[userId].filter(i => !ids.includes(String(i.productId)));
    writeWishlist(data);

    return res.json({
      message: "Removed",
      removedCount: before - data[userId].length,
      wishlist: data[userId],
    });
  } catch (err) {
    console.error("bulk-delete error:", err);
    return res.status(500).json({ message: "server error" });
  }
});


export default router;
