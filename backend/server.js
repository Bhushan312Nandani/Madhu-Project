import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";

// Route imports
import flashSalesRoutes from "./routes/flashSales.js";
import clockRoutes from "./routes/clock.js";
import categories from "./routes/categories.js";
import Banners from "./routes/banners.js";
import musicBanner from "./routes/musicBanner.js";
import SearchByCategories from "./routes/SearchByCategories.js";
import products from "./routes/products.js";
import featured from "./routes/featured.js";
import footer from "./routes/footer.js";
import about from "./routes/about.js";
import contactRouter from "./routes/contact.js";
import signupRouter from "./routes/SignUp.js";
import loginRouter from "./routes/login.js";
import orderRouter from "./routes/order.js";
import cartRouter from "./routes/cart.js";
import flashTimerRouter from "./routes/flashTimer.js";
import wishlistRouter from "./routes/wishlist.js";
import adminRouter from "./routes/admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
  methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-user-id", "Authorization"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Static files ────────────────────────────────────────────────────────────
app.use("/public", express.static(path.join(__dirname, "public")));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/clock", clockRoutes);
app.use("/api/flash-sales", flashSalesRoutes);
app.use("/api/categories", categories);
app.use("/api/banners", Banners);
app.use("/api/music-banner", musicBanner);
app.use("/api/Seacrh-By-Categories", SearchByCategories);
app.use("/api/products", products);
app.use("/api/featured", featured);
app.use("/api/footer", footer);
app.use("/api/about", about);
app.use("/api/contact", contactRouter);
app.use("/api/signup", signupRouter);
app.use("/api/login", loginRouter);
app.use("/api/orders", orderRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/flash-timer", flashTimerRouter);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.use("/api/admin", adminRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({
  status: "OK",
  message: "MadhuShud Oil Shop API Running",
  version: "2.0.0",
  endpoints: {
    products: "/api/products",
    flashSales: "/api/flash-sales",
    categories: "/api/categories",
    orders: "/api/orders",
    cart: "/api/cart",
    wishlist: "/api/wishlist",
    admin: "/api/admin",
  }
}));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  // Connect to MongoDB (non-blocking - will use JSON fallback if fails)
  await connectDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 MadhuShud Oil Shop Backend Running!`);
    console.log(`📡 API: http://localhost:${PORT}`);
    console.log(`🔧 Admin API: http://localhost:${PORT}/api/admin`);
    console.log(`📊 Health: http://localhost:${PORT}/\n`);
  });
};

startServer();
