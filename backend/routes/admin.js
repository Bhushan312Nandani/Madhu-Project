// routes/admin.js - Admin API endpoints
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`)
});
const upload = multer({ storage });

const router = express.Router();

const dataDir = path.join(__dirname, "../data");

function readJSON(filename) {
  const file = path.join(dataDir, filename);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch (e) { return []; }
}

function writeJSON(filename, data) {
  const file = path.join(dataDir, filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Image Upload ─────────────────────────────────────────────────────────────
router.post("/upload", adminAuth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No image uploaded" });
  const imageUrl = `http://localhost:5000/public/uploads/${req.file.filename}`;
  res.status(201).json({ message: "Image uploaded successfully", imageUrl });
});

// ─── Admin Auth Middleware ────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers.authorization;
  if (token === "Bearer admin-token-madhuoil") return next();
  if (req.query.adminKey === "admin123") return next();
  return res.status(401).json({ message: "Unauthorized" });
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
router.get("/stats", adminAuth, (req, res) => {
  const users = readJSON("users.json");
  const orders = readJSON("orders.json");
  const flashProducts = readJSON("flashSales.json");
  const exploreProducts = readJSON("products.json");
  const featured = readJSON("featured.json");
  const contacts = readJSON("contactMessages.json");

  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const deliveredOrders = orders.filter(o => o.status === "delivered").length;
  const totalProducts = flashProducts.length + exploreProducts.length;

  // Monthly revenue breakdown (last 6 months)
  const monthlyRevenue = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleString("default", { month: "short" });
    const rev = orders
      .filter(o => { const od = new Date(o.createdAt); return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear(); })
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    monthlyRevenue.push({ month, revenue: rev });
  }

  res.json({
    totalUsers: users.length,
    totalOrders: orders.length,
    totalProducts,
    totalContacts: contacts.length,
    totalRevenue: totalRevenue.toFixed(2),
    pendingOrders,
    deliveredOrders,
    flashSalesCount: flashProducts.length,
    exploreCount: exploreProducts.length,
    featuredCount: featured.length,
    monthlyRevenue,
    recentOrders: orders.slice(-5).reverse(),
    satisfaction: orders.length > 0 ? ((deliveredOrders / orders.length) * 100).toFixed(1) : "0.0",
  });
});

// ─── Users Management ─────────────────────────────────────────────────────────
router.get("/users", adminAuth, (req, res) => {
  const users = readJSON("users.json");
  const safe = users.map(({ password, ...u }) => u);
  res.json(safe);
});

router.delete("/users/:id", adminAuth, (req, res) => {
  let users = readJSON("users.json");
  const beforeLen = users.length;
  users = users.filter(u => String(u.id) !== String(req.params.id));
  if (users.length === beforeLen) return res.status(404).json({ message: "User not found" });
  writeJSON("users.json", users);
  res.json({ message: "User deleted" });
});

// ─── Orders Management ────────────────────────────────────────────────────────
router.get("/orders", adminAuth, (req, res) => {
  const orders = readJSON("orders.json");
  res.json(orders.reverse());
});

router.patch("/orders/:id/status", adminAuth, (req, res) => {
  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  let orders = readJSON("orders.json");
  const order = orders.find(o => String(o.id) === String(req.params.id));
  if (!order) return res.status(404).json({ message: "Order not found" });
  order.status = status;
  order.updatedAt = new Date().toISOString();
  writeJSON("orders.json", orders);
  res.json({ message: "Order status updated", order });
});

router.delete("/orders/:id", adminAuth, (req, res) => {
  let orders = readJSON("orders.json");
  const beforeLen = orders.length;
  orders = orders.filter(o => String(o.id) !== String(req.params.id));
  if (orders.length === beforeLen) return res.status(404).json({ message: "Order not found" });
  writeJSON("orders.json", orders);
  res.json({ message: "Order deleted" });
});

// ─── Flash Sales Products ─────────────────────────────────────────────────────
router.get("/products", adminAuth, (req, res) => {
  const products = readJSON("flashSales.json");
  res.json(products);
});

router.post("/products", adminAuth, (req, res) => {
  const products = readJSON("flashSales.json");
  const newProduct = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
  products.push(newProduct);
  writeJSON("flashSales.json", products);
  res.status(201).json({ message: "Product added", product: newProduct });
});

router.put("/products/:id", adminAuth, (req, res) => {
  let products = readJSON("flashSales.json");
  const idx = products.findIndex(p => String(p.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ message: "Product not found" });
  products[idx] = { ...products[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON("flashSales.json", products);
  res.json({ message: "Product updated", product: products[idx] });
});

router.delete("/products/:id", adminAuth, (req, res) => {
  let products = readJSON("flashSales.json");
  const beforeLen = products.length;
  products = products.filter(p => String(p.id) !== String(req.params.id));
  if (products.length === beforeLen) return res.status(404).json({ message: "Product not found" });
  writeJSON("flashSales.json", products);
  res.json({ message: "Product deleted" });
});

// ─── Explore Products (Our Best Oils) ─────────────────────────────────────────
router.get("/explore-products", adminAuth, (req, res) => {
  res.json(readJSON("products.json"));
});
router.post("/explore-products", adminAuth, (req, res) => {
  const data = readJSON("products.json");
  const item = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
  data.push(item);
  writeJSON("products.json", data);
  res.status(201).json({ message: "Added", product: item });
});
router.put("/explore-products/:id", adminAuth, (req, res) => {
  let data = readJSON("products.json");
  const idx = data.findIndex(p => String(p.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ message: "Not found" });
  data[idx] = { ...data[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON("products.json", data);
  res.json({ message: "Updated", product: data[idx] });
});
router.delete("/explore-products/:id", adminAuth, (req, res) => {
  let data = readJSON("products.json");
  data = data.filter(p => String(p.id) !== String(req.params.id));
  writeJSON("products.json", data);
  res.json({ message: "Deleted" });
});

// ─── Featured / New Arrivals ──────────────────────────────────────────────────
router.get("/featured", adminAuth, (req, res) => {
  res.json(readJSON("featured.json"));
});
router.post("/featured", adminAuth, (req, res) => {
  writeJSON("featured.json", req.body);
  res.status(201).json({ message: "Featured updated", product: req.body });
});
router.delete("/featured/:id", adminAuth, (req, res) => {
  let data = readJSON("featured.json");
  data = data.filter(p => String(p.id) !== String(req.params.id));
  writeJSON("featured.json", data);
  res.json({ message: "Deleted" });
});

// ─── Music Banner ─────────────────────────────────────────────────────────────
router.get("/music-banner", adminAuth, (req, res) => {
  res.json(readJSON("musicBanner.json"));
});
router.put("/music-banner", adminAuth, (req, res) => {
  writeJSON("musicBanner.json", req.body);
  res.json({ message: "Music banner updated" });
});

// ─── Banners (Live Banner/Slider) ─────────────────────────────────────────────
router.get("/banners", adminAuth, (req, res) => {
  res.json(readJSON("banners.json"));
});
router.put("/banners", adminAuth, (req, res) => {
  writeJSON("banners.json", req.body);
  res.json({ message: "Banners updated" });
});

// ─── About / Our Story ───────────────────────────────────────────────────────
router.get("/about", adminAuth, (req, res) => {
  res.json(readJSON("about.json"));
});
router.put("/about", adminAuth, (req, res) => {
  writeJSON("about.json", req.body);
  res.json({ message: "About/Story updated" });
});

// ─── Categories ───────────────────────────────────────────────────────────────
router.get("/categories", adminAuth, (req, res) => {
  res.json(readJSON("categories.json"));
});
router.put("/categories", adminAuth, (req, res) => {
  writeJSON("categories.json", req.body);
  res.json({ message: "Categories updated" });
});

// ─── Contact Messages ─────────────────────────────────────────────────────────
router.get("/contacts", adminAuth, (req, res) => {
  const contacts = readJSON("contactMessages.json");
  res.json(contacts.reverse());
});

router.delete("/contacts/:id", adminAuth, (req, res) => {
  let contacts = readJSON("contactMessages.json");
  contacts = contacts.filter(c => String(c.id) !== String(req.params.id));
  writeJSON("contactMessages.json", contacts);
  res.json({ message: "Contact deleted" });
});

export default router;
