// routes/cart.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cartFile = path.join(__dirname, "../data/cart.json");

// ensure file exists as object
if (!fs.existsSync(cartFile)) {
  fs.writeFileSync(cartFile, JSON.stringify({}, null, 2), "utf8");
}

function readCart() {
  try {
    const raw = fs.readFileSync(cartFile, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    console.error("readCart error:", err);
    return {};
  }
}

function writeCart(data) {
  try {
    fs.writeFileSync(cartFile, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("writeCart error:", err);
    throw err;
  }
}

function getUserId(req) {
  return (
    req.headers["x-user-id"] ||
    req.query.userId ||
    req.body.userId ||
    "guest"
  ).toString();
}

// GET user's cart
router.get("/", (req, res) => {
  const userId = getUserId(req);
  const data = readCart();
  res.json(data[userId] || []);
});

// POST add to cart (idempotent per productId+size)
router.post("/", (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, name, image, price = 0, size = "", quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ message: "ProductId required" });

    const data = readCart();
    if (!Array.isArray(data[userId])) data[userId] = [];

    const userCart = data[userId];

    // match by productId + size to avoid duplicates
    const existing = userCart.find(item => String(item.productId) === String(productId) && (item.size || "") === (size || ""));

    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + Number(quantity || 1);
    } else {
      userCart.push({
        id: Date.now(), // internal cart item id
        productId: String(productId),
        name: name || "",
        image: image || "",
        price: Number(price) || 0,
        size: size || "",
        quantity: Number(quantity) || 1,
        addedAt: new Date().toISOString()
      });
    }

    data[userId] = userCart;
    writeCart(data);

    return res.status(201).json({ message: "Cart updated", cart: userCart });
  } catch (err) {
    console.error("POST /api/cart error:", err);
    return res.status(500).json({ message: "Server error adding to cart" });
  }
});

// PUT update quantity by cart item id
router.put("/:id", (req, res) => {
  try {
    const userId = getUserId(req);
    const itemId = String(req.params.id);
    let { quantity } = req.body;
    quantity = parseInt(quantity, 10);
    if (isNaN(quantity) || quantity < 1) return res.status(400).json({ message: "Quantity must be >= 1" });

    const data = readCart();
    const userCart = data[userId] || [];

    const item = userCart.find(i => String(i.id) === itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.quantity = quantity;
    writeCart(data);
    return res.json({ message: "Quantity updated", item, cart: userCart });
  } catch (err) {
    console.error("PUT /api/cart/:id error:", err);
    return res.status(500).json({ message: "Server error updating quantity" });
  }
});

// DELETE by cart item id
router.delete("/:id", (req, res) => {
  try {
    const userId = getUserId(req);
    const itemId = String(req.params.id);

    const data = readCart();
    const userCart = data[userId] || [];
    const beforeLen = userCart.length;
    const filtered = userCart.filter(i => String(i.id) !== itemId);

    data[userId] = filtered;
    writeCart(data);

    if (filtered.length === beforeLen) {
      return res.json({ message: "Item not found (or already removed)", cart: filtered });
    }

    return res.json({ message: "Removed", cart: filtered });
  } catch (err) {
    console.error("DELETE /api/cart/:id error:", err);
    return res.status(500).json({ message: "Server error removing item" });
  }
});

export default router;
