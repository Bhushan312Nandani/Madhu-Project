import express from "express";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";


const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ordersFile = path.join(__dirname, "../data/orders.json");

// Helper: Read orders
const readOrders = () => {
  if (!fs.existsSync(ordersFile)) return [];
  const data = fs.readFileSync(ordersFile, "utf-8") || "[]";
  return JSON.parse(data);
};

// Helper: Write orders
const writeOrders = (orders) => {
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
};

// GET all orders
router.get("/", (req, res) => {
  const orders = readOrders();
  res.json(orders);
});

// POST new order
router.post("/", (req, res) => {
  const { billing, items, paymentMethod, total } = req.body;

  // Basic Validation
  if (
    !billing ||
    !billing.firstName ||
    !billing.streetAddress ||
    !billing.city ||
    !billing.phone ||
    !billing.email ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({ message: "Invalid or incomplete order data" });
  }

  const orders = readOrders();

  const newOrder = {
    id: orders.length + 1,
    billing,
    items,
    paymentMethod: paymentMethod || "cash",
    total,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  orders.push(newOrder);
  writeOrders(orders);

  console.log("New Order Saved:", newOrder.id);

  res.status(201).json({
    message: "Order placed successfully!",
    orderId: newOrder.id,
    order: newOrder,
  });
});

export default router;   // default export
