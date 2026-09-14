// routes/admin.js — Admin API endpoints with proper JWT authentication
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { requireAdmin } from "../middleware/auth.js";
import { adminLimiter, uploadLimiter } from "../middleware/rateLimiter.js";
import { validateProduct } from "../middleware/validate.js";
import { cacheInvalidate } from "../middleware/cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB

// Set up Multer storage with validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed."), false);
    }
    cb(null, true);
  },
});

const router = express.Router();

// Apply admin rate limiter to all admin routes
router.use(adminLimiter);

const dataDir = path.join(__dirname, "../data");

function readJSON(filename) {
  const file = path.join(dataDir, filename);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch (e) { console.error(`Error reading ${filename}:`, e); return []; }
}

function writeJSON(filename, data) {
  const file = path.join(dataDir, filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Image Upload ─────────────────────────────────────────────────────────────
router.post("/upload", requireAdmin, uploadLimiter, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No image uploaded" });
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const imageUrl = `${baseUrl}/public/uploads/${req.file.filename}`;
  res.status(201).json({ message: "Image uploaded successfully", imageUrl, filename: req.file.filename });
});

// Handle multer errors
router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
  }
  if (err.message && err.message.includes("Only")) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
router.get("/stats", requireAdmin, (req, res) => {
  try {
    const users = readJSON("users.json");
    const orders = readJSON("orders.json");
    const flashProducts = readJSON("flashSales.json");
    const exploreProducts = readJSON("products.json");
    const featured = readJSON("featured.json");
    const contacts = readJSON("contactMessages.json");

    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const pendingOrders = orders.filter(o => o.status === "pending").length;
    const deliveredOrders = orders.filter(o => o.status === "delivered").length;
    const cancelledOrders = orders.filter(o => o.status === "cancelled").length;
    const totalProducts = flashProducts.length + exploreProducts.length;

    // Monthly revenue breakdown (last 6 months)
    const monthlyRevenue = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toLocaleString("default", { month: "short" });
      const rev = orders
        .filter(o => {
          const od = new Date(o.createdAt);
          return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
        })
        .reduce((s, o) => s + (Number(o.total) || 0), 0);
      monthlyRevenue.push({ month, revenue: Math.round(rev * 100) / 100 });
    }

    // Top products by order frequency
    const productCount = {};
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        productCount[item.name] = (productCount[item.name] || 0) + (item.quantity || 1);
      });
    });
    const topProducts = Object.entries(productCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({
      totalUsers: users.length,
      totalOrders: orders.length,
      totalProducts,
      totalContacts: contacts.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      flashSalesCount: flashProducts.length,
      exploreCount: exploreProducts.length,
      featuredCount: featured.length,
      monthlyRevenue,
      topProducts,
      recentOrders: orders.slice(-5).reverse(),
      satisfaction: orders.length > 0 ? ((deliveredOrders / orders.length) * 100).toFixed(1) : "0.0",
      conversionRate: users.length > 0 ? ((orders.length / users.length) * 100).toFixed(1) : "0.0",
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// ─── Users Management ─────────────────────────────────────────────────────────
router.get("/users", requireAdmin, (req, res) => {
  const users = readJSON("users.json");
  const safe = users.map(({ password, refreshToken, ...u }) => u);
  res.json(safe);
});

router.delete("/users/:id", requireAdmin, (req, res) => {
  let users = readJSON("users.json");
  const before = users.length;
  users = users.filter(u => String(u.id) !== String(req.params.id));
  if (users.length === before) return res.status(404).json({ message: "User not found" });
  writeJSON("users.json", users);
  res.json({ message: "User deleted" });
});

// ─── Orders Management ────────────────────────────────────────────────────────
router.get("/orders", requireAdmin, (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  let orders = readJSON("orders.json").reverse();
  if (status && status !== "all") orders = orders.filter(o => o.status === status);
  const total = orders.length;
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paginated = orders.slice(start, start + parseInt(limit));
  res.json({ orders: paginated, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

router.patch("/orders/:id/status", requireAdmin, (req, res) => {
  const { status, note } = req.body;
  const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

  let orders = readJSON("orders.json");
  const order = orders.find(o => String(o.id) === String(req.params.id) || String(o.orderId) === String(req.params.id));
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.status = status;
  order.updatedAt = new Date().toISOString();
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({ status, timestamp: new Date().toISOString(), note: note || "" });

  writeJSON("orders.json", orders);
  res.json({ message: "Order status updated", order });
});

router.delete("/orders/:id", requireAdmin, (req, res) => {
  let orders = readJSON("orders.json");
  const before = orders.length;
  orders = orders.filter(o => String(o.id) !== String(req.params.id) && String(o.orderId) !== String(req.params.id));
  if (orders.length === before) return res.status(404).json({ message: "Order not found" });
  writeJSON("orders.json", orders);
  res.json({ message: "Order deleted" });
});

// ─── Flash Sales Products ─────────────────────────────────────────────────────
router.get("/products", requireAdmin, (req, res) => res.json(readJSON("flashSales.json")));

router.post("/products", requireAdmin, validateProduct, (req, res) => {
  const products = readJSON("flashSales.json");
  const newProduct = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  products.push(newProduct);
  writeJSON("flashSales.json", products);
  cacheInvalidate("flash-sales");
  res.status(201).json({ message: "Product added", product: newProduct });
});

router.put("/products/:id", requireAdmin, (req, res) => {
  let products = readJSON("flashSales.json");
  const idx = products.findIndex(p => String(p.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ message: "Product not found" });
  products[idx] = { ...products[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON("flashSales.json", products);
  cacheInvalidate("flash-sales");
  res.json({ message: "Product updated", product: products[idx] });
});

router.delete("/products/:id", requireAdmin, (req, res) => {
  let products = readJSON("flashSales.json");
  const before = products.length;
  products = products.filter(p => String(p.id) !== String(req.params.id));
  if (products.length === before) return res.status(404).json({ message: "Product not found" });
  writeJSON("flashSales.json", products);
  cacheInvalidate("flash-sales");
  res.json({ message: "Product deleted" });
});

// ─── Explore Products (Our Best Oils) ─────────────────────────────────────────
router.get("/explore-products", requireAdmin, (req, res) => res.json(readJSON("products.json")));

router.post("/explore-products", requireAdmin, validateProduct, (req, res) => {
  const data = readJSON("products.json");
  const item = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  data.push(item);
  writeJSON("products.json", data);
  cacheInvalidate("products");
  res.status(201).json({ message: "Added", product: item });
});

router.put("/explore-products/:id", requireAdmin, (req, res) => {
  let data = readJSON("products.json");
  const idx = data.findIndex(p => String(p.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ message: "Not found" });
  data[idx] = { ...data[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON("products.json", data);
  cacheInvalidate("products");
  res.json({ message: "Updated", product: data[idx] });
});

router.delete("/explore-products/:id", requireAdmin, (req, res) => {
  let data = readJSON("products.json");
  data = data.filter(p => String(p.id) !== String(req.params.id));
  writeJSON("products.json", data);
  cacheInvalidate("products");
  res.json({ message: "Deleted" });
});

// ─── Featured / New Arrivals ──────────────────────────────────────────────────
router.get("/featured", requireAdmin, (req, res) => res.json(readJSON("featured.json")));
router.post("/featured", requireAdmin, (req, res) => {
  writeJSON("featured.json", req.body);
  cacheInvalidate("featured");
  res.status(201).json({ message: "Featured updated", product: req.body });
});
router.delete("/featured/:id", requireAdmin, (req, res) => {
  let data = readJSON("featured.json");
  data = data.filter(p => String(p.id) !== String(req.params.id));
  writeJSON("featured.json", data);
  cacheInvalidate("featured");
  res.json({ message: "Deleted" });
});

// ─── Music Banner ─────────────────────────────────────────────────────────────
router.get("/music-banner", requireAdmin, (req, res) => res.json(readJSON("musicBanner.json")));
router.put("/music-banner", requireAdmin, (req, res) => {
  writeJSON("musicBanner.json", req.body);
  res.json({ message: "Music banner updated" });
});

// ─── Banners (Live Banner/Slider) ─────────────────────────────────────────────
router.get("/banners", requireAdmin, (req, res) => res.json(readJSON("banners.json")));
router.put("/banners", requireAdmin, (req, res) => {
  writeJSON("banners.json", req.body);
  cacheInvalidate("banners");
  res.json({ message: "Banners updated" });
});

// ─── About / Our Story ───────────────────────────────────────────────────────
router.get("/about", requireAdmin, (req, res) => res.json(readJSON("about.json")));
router.put("/about", requireAdmin, (req, res) => {
  writeJSON("about.json", req.body);
  cacheInvalidate("about");
  res.json({ message: "About/Story updated" });
});

// ─── Categories ───────────────────────────────────────────────────────────────
router.get("/categories", requireAdmin, (req, res) => res.json(readJSON("categories.json")));
router.put("/categories", requireAdmin, (req, res) => {
  writeJSON("categories.json", req.body);
  cacheInvalidate("categories");
  res.json({ message: "Categories updated" });
});

// ─── Contact Messages ─────────────────────────────────────────────────────────
router.get("/contacts", requireAdmin, (req, res) => {
  res.json(readJSON("contactMessages.json").reverse());
});

router.delete("/contacts/:id", requireAdmin, (req, res) => {
  let contacts = readJSON("contactMessages.json");
  contacts = contacts.filter(c => String(c.id) !== String(req.params.id));
  writeJSON("contactMessages.json", contacts);
  res.json({ message: "Contact deleted" });
});

// ─── Coupons Management ───────────────────────────────────────────────────────
router.get("/coupons", requireAdmin, (req, res) => res.json(readJSON("coupons.json")));

router.post("/coupons", requireAdmin, (req, res) => {
  const coupons = readJSON("coupons.json");
  const { code, discount, type = "percentage", expiresAt, usageLimit, minOrderValue = 0, maxDiscount, description } = req.body;

  if (!code || !discount || !expiresAt) return res.status(400).json({ message: "code, discount and expiresAt are required" });
  if (coupons.find(c => c.code === code.toUpperCase())) return res.status(400).json({ message: "Coupon code already exists" });

  const newCoupon = {
    id: Date.now().toString(),
    code: code.toUpperCase(),
    discount: Number(discount),
    type,
    minOrderValue: Number(minOrderValue),
    maxDiscount: maxDiscount ? Number(maxDiscount) : null,
    expiresAt,
    usageLimit: usageLimit ? Number(usageLimit) : null,
    usedCount: 0,
    isActive: true,
    description: description || "",
    createdAt: new Date().toISOString(),
  };
  coupons.push(newCoupon);
  writeJSON("coupons.json", coupons);
  res.status(201).json({ message: "Coupon created", coupon: newCoupon });
});

router.patch("/coupons/:id", requireAdmin, (req, res) => {
  let coupons = readJSON("coupons.json");
  const idx = coupons.findIndex(c => String(c.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ message: "Coupon not found" });
  coupons[idx] = { ...coupons[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON("coupons.json", coupons);
  res.json({ message: "Coupon updated", coupon: coupons[idx] });
});

router.delete("/coupons/:id", requireAdmin, (req, res) => {
  let coupons = readJSON("coupons.json");
  coupons = coupons.filter(c => String(c.id) !== String(req.params.id));
  writeJSON("coupons.json", coupons);
  res.json({ message: "Coupon deleted" });
});

export default router;
