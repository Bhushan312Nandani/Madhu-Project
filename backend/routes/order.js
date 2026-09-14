// routes/order.js
import express from "express";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { optionalAuth } from "../middleware/auth.js";
import { validateOrder } from "../middleware/validate.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ordersFile = path.join(__dirname, "../data/orders.json");
const couponsFile = path.join(__dirname, "../data/coupons.json");

const readFile = (file) => {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf-8") || "[]"); }
  catch { return []; }
};

const writeFile = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// Ensure orders file exists
if (!fs.existsSync(ordersFile)) writeFile(ordersFile, []);

// GET all orders for current user
router.get("/", optionalAuth, apiLimiter, (req, res) => {
  const orders = readFile(ordersFile);
  const userId = req.user?.id || req.headers["x-user-id"] || req.query.userId;
  if (userId && userId !== "all") {
    return res.json(orders.filter(o => String(o.userId) === String(userId)).reverse());
  }
  // Guests can't see all orders
  if (!req.user) return res.json([]);
  res.json(orders.reverse());
});

// GET single order by orderId
router.get("/:orderId", optionalAuth, apiLimiter, (req, res) => {
  const orders = readFile(ordersFile);
  const order = orders.find(o => o.orderId === req.params.orderId || String(o.id) === String(req.params.orderId));
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.json(order);
});

// POST new order
router.post("/", optionalAuth, validateOrder, (req, res) => {
  try {
    const { billing, items, paymentMethod, total, couponCode, discount = 0, notes } = req.body;
    const orders = readFile(ordersFile);

    // Generate UUID-based orderId
    const orderId = "ORD-" + uuidv4().split("-")[0].toUpperCase() + "-" + Date.now().toString(36).toUpperCase();

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    const newOrder = {
      id: orders.length + 1,
      orderId,
      userId: req.user?.id || req.headers["x-user-id"] || "guest",
      billing,
      items,
      paymentMethod: paymentMethod || "cash",
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Number(discount) || 0,
      couponCode: couponCode || null,
      shippingCost: 0,
      total: Number(total),
      status: "pending",
      notes: notes || "",
      statusHistory: [{ status: "pending", timestamp: new Date().toISOString(), note: "Order placed" }],
      createdAt: new Date().toISOString(),
    };

    // Increment coupon usage if coupon was applied
    if (couponCode) {
      const coupons = readFile(couponsFile);
      const couponIdx = coupons.findIndex(c => c.code === couponCode.toUpperCase());
      if (couponIdx !== -1) {
        coupons[couponIdx].usedCount = (coupons[couponIdx].usedCount || 0) + 1;
        writeFile(couponsFile, coupons);
      }
    }

    orders.push(newOrder);
    writeFile(ordersFile, orders);

    console.log(`[ORDER] New order placed: ${orderId} by userId: ${newOrder.userId}`);

    return res.status(201).json({
      message: "Order placed successfully!",
      orderId: newOrder.orderId,
      order: newOrder,
    });
  } catch (err) {
    console.error("Order placement error:", err);
    return res.status(500).json({ message: "Server error placing order." });
  }
});

export default router;
