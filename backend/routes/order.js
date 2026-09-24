// routes/order.js — Prisma (PostgreSQL) with JSON fallback
import express from "express";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { optionalAuth } from "../middleware/auth.js";
import { validateOrder } from "../middleware/validate.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { dbMode } from "../config/db.js";
import prisma from "../lib/prisma.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ordersFile = path.join(__dirname, "../data/orders.json");
const couponsFile = path.join(__dirname, "../data/coupons.json");

const readFile = (file) => {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf-8") || "[]"); } catch { return []; }
};
const writeFile = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
if (!fs.existsSync(ordersFile)) writeFile(ordersFile, []);

// ─── GET orders for current user ─────────────────────────────────────────────
router.get("/", optionalAuth, apiLimiter, async (req, res) => {
  const userId = req.user?.id || req.headers["x-user-id"] || req.query.userId;

  if (dbMode === "postgres" && userId && userId !== "guest") {
    try {
      const orders = await prisma.order.findMany({
        where: { userId },
        include: {
          items: { include: { product: { select: { name: true, mainImage: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(orders.map(normalizeOrder));
    } catch (err) {
      console.error("[Orders] GET:", err.message);
      return res.status(500).json({ message: "Failed to fetch orders" });
    }
  }

  // JSON fallback
  const orders = readFile(ordersFile);
  if (!userId || userId === "guest") return res.json([]);
  return res.json(orders.filter(o => String(o.userId) === String(userId)).reverse());
});

// ─── GET single order ─────────────────────────────────────────────────────────
router.get("/:orderId", optionalAuth, apiLimiter, async (req, res) => {
  const { orderId } = req.params;

  if (dbMode === "postgres") {
    try {
      const order = await prisma.order.findFirst({
        where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
        include: { items: true },
      });
      if (!order) return res.status(404).json({ message: "Order not found" });
      return res.json(normalizeOrder(order));
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch order" });
    }
  }

  const orders = readFile(ordersFile);
  const order = orders.find(o => o.orderId === orderId || String(o.id) === String(orderId));
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.json(order);
});

// ─── POST new order ───────────────────────────────────────────────────────────
router.post("/", optionalAuth, validateOrder, async (req, res) => {
  try {
    const { billing, items, paymentMethod, couponCode, discount = 0, notes } = req.body;
    const total = Number(req.body.total ?? req.body.totalPKR ?? req.body.subtotalPKR ?? 0);
    const userId = req.user?.id || req.headers["x-user-id"];
    const orderNumber = "ORD-" + uuidv4().split("-")[0].toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity || 1), 0);

    if (dbMode === "postgres") {
      try {
        let user = null;
        if (userId && userId !== "guest") {
          user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
        }
        if (!user) {
          user = await prisma.user.findUnique({ where: { email: "guest@madhushud.com" } }).catch(() => null);
          if (!user) {
            user = await prisma.user.create({
              data: {
                email: "guest@madhushud.com",
                name: "Guest Shopper",
                phone: "03000000000",
                password: "GUEST_ACCOUNT_LOCK",
                role: "USER",
              }
            }).catch(() => null);
          }
        }

        if (user) {
          const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
              data: {
                orderNumber,
                userId: user.id,
                shippingAddress: billing,
                paymentMethod: paymentMethod || "COD",
                subtotal: Math.round(subtotal * 100) / 100,
                discount: Number(discount) || 0,
                couponCode: couponCode || null,
                total: Number(total),
                currency: "PKR",
                notes: notes || "",
                status: "PENDING",
                items: {
                  create: items.map(item => ({
                    productId: item.productId || item.id,
                    name: item.name,
                    image: item.image || item.images?.[0] || null,
                    price: Number(item.price),
                    quantity: Number(item.quantity || 1),
                    total: Number(item.price) * Number(item.quantity || 1),
                  })),
                },
              },
              include: { items: true },
            });

            // Decrement stock & increment soldCount
            for (const item of items) {
              const pid = item.productId || item.id;
              if (pid) {
                await tx.product.update({
                  where: { id: pid },
                  data: {
                    stock: { decrement: Number(item.quantity || 1) },
                    soldCount: { increment: Number(item.quantity || 1) },
                  },
                }).catch(() => {});
              }
            }

            // Handle coupon usage
            if (couponCode) {
              await tx.coupon.updateMany({
                where: { code: couponCode.toUpperCase(), isActive: true },
                data: { usedCount: { increment: 1 } },
              }).catch(() => {});
            }

            return newOrder;
          });

          // Also backup to orders.json
          try {
            const orders = readFile(ordersFile);
            orders.push({
              id: orders.length + 1,
              orderId: orderNumber,
              userId: userId || "guest",
              billing, items, paymentMethod: paymentMethod || "COD",
              subtotal, total: Number(total), status: "pending",
              createdAt: new Date().toISOString()
            });
            writeFile(ordersFile, orders);
          } catch {}

          console.log(`[ORDER] ✅ ${order.orderNumber} — PKR ${total} (${user.name})`);
          return res.status(201).json({
            message: "Order placed successfully!",
            orderId: order.orderNumber,
            order: normalizeOrder(order),
          });
        }
      } catch (pgErr) {
        console.warn("[ORDER] Postgres write failed, using JSON fallback:", pgErr.message);
      }
    }

    // JSON fallback
    const orders = readFile(ordersFile);
    const newOrder = {
      id: orders.length + 1, orderId: orderNumber,
      userId: userId || "guest", billing, items,
      paymentMethod: paymentMethod || "cash",
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Number(discount) || 0,
      couponCode: couponCode || null,
      shippingCost: 0, total: Number(total),
      status: "pending", notes: notes || "",
      statusHistory: [{ status: "pending", timestamp: new Date().toISOString(), note: "Order placed" }],
      createdAt: new Date().toISOString(),
    };

    if (couponCode) {
      const coupons = readFile(couponsFile);
      const idx = coupons.findIndex(c => c.code === couponCode.toUpperCase());
      if (idx !== -1) { coupons[idx].usedCount = (coupons[idx].usedCount || 0) + 1; writeFile(couponsFile, coupons); }
    }

    orders.push(newOrder);
    writeFile(ordersFile, orders);
    console.log(`[ORDER] New order placed: ${orderNumber}`);

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

// Normalize order for frontend
function normalizeOrder(o) {
  return {
    id: o.id,
    orderId: o.orderNumber || o.id,
    orderNumber: o.orderNumber,
    userId: o.userId,
    status: o.status?.toLowerCase() || "pending",
    paymentStatus: o.paymentStatus?.toLowerCase() || "pending",
    paymentMethod: o.paymentMethod,
    billing: o.shippingAddress,
    shippingAddress: o.shippingAddress,
    items: (o.items || []).map(i => ({
      id: i.productId,
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      total: Number(i.total),
      image: i.image,
    })),
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    shippingCost: Number(o.shippingCost),
    total: Number(o.total),
    couponCode: o.couponCode,
    notes: o.notes,
    trackingNumber: o.trackingNumber,
    createdAt: o.createdAt,
  };
}

export default router;
