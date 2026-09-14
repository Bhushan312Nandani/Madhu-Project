import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import morgan from "morgan";
import helmet from "helmet";
import connectDB from "./config/db.js";
import { getCacheStats, cacheClear } from "./middleware/cache.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

// ─── Route imports ───────────────────────────────────────────────────────────
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
import reviewsRouter from "./routes/reviews.js";
import couponRouter from "./routes/coupon.js";
import currencyRouter from "./routes/currency.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV !== "production";

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000", "https://via.placeholder.com", "https://images.unsplash.com"],
      connectSrc: ["'self'", "http://localhost:5000", "http://localhost:3000"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS with proper whitelist ───────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (
        allowedOrigins.includes(origin) ||
        hostname.endsWith(".vercel.app") ||
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
    } catch {
      if (allowedOrigins.includes(origin)) return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error(`CORS policy: origin ${origin} not allowed.`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-user-id", "Authorization", "X-Requested-With"],
}));

// ─── General Middleware ───────────────────────────────────────────────────────
app.use(compression()); // Gzip all responses
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ─── Request Logging ──────────────────────────────────────────────────────────
if (isDev) {
  app.use(morgan("dev")); // Colorful, concise dev logging
} else {
  app.use(morgan("combined")); // Full Apache-style logs for production
}

// ─── Trust Proxy (for rate limiting behind reverse proxies) ──────────────────
app.set("trust proxy", 1);

// ─── Security headers for all routes ─────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ─── Static files ────────────────────────────────────────────────────────────
app.use("/public", express.static(path.resolve(__dirname, "public"), {
  maxAge: isDev ? 0 : "7d",
  etag: true,
}));
app.use("/images", express.static(path.resolve(__dirname, "public/images"), {
  maxAge: isDev ? 0 : "30d",
  etag: true,
}));
app.use("/uploads", express.static(path.resolve(__dirname, "public/uploads"), {
  maxAge: isDev ? 0 : "30d",
}));

// ─── Apply general API rate limiter ──────────────────────────────────────────
app.use("/api/", apiLimiter);

// ─── Public API Routes (cached) ───────────────────────────────────────────────
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

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.use("/api/signup", signupRouter);
app.use("/api/login", loginRouter);

// ─── User Routes ──────────────────────────────────────────────────────────────
app.use("/api/orders", orderRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/flash-timer", flashTimerRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/coupon", couponRouter);
app.use("/api/currency", currencyRouter);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.use("/api/admin", adminRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const uptime = process.uptime();
  const cacheStats = getCacheStats();
  res.json({
    status: "OK",
    message: "MadhuShud Oil Shop API is running",
    version: "3.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    timestamp: new Date().toISOString(),
    cache: cacheStats,
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    },
  });
});

// Cache management endpoint (admin only in production)
app.delete("/api/cache", (req, res) => {
  if (!isDev) {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
  }
  cacheClear();
  res.json({ message: "Cache cleared successfully" });
});

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({
  status: "OK",
  message: "MadhuShud Oil Shop API v3.0",
  docs: "/api/health",
  endpoints: {
    products: "/api/products",
    flashSales: "/api/flash-sales",
    categories: "/api/categories",
    orders: "/api/orders",
    cart: "/api/cart",
    wishlist: "/api/wishlist",
    reviews: "/api/reviews",
    coupon: "/api/coupon/validate",
    admin: "/api/admin",
    health: "/api/health",
  }
}));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({ message: "CORS error: Origin not allowed" });
  }
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    message: isDev ? err.message : "Internal Server Error",
    ...(isDev && { stack: err.stack }),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`\n🚀 MadhuShud Oil Shop Backend v3.0`);
    console.log(`📡 API:    http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔧 Admin:  http://localhost:${PORT}/api/admin`);
    console.log(`🌍 Env:    ${process.env.NODE_ENV || "development"}`);
    console.log(`🔒 Security: Helmet ✓ | CORS ✓ | Rate Limiting ✓ | Cache ✓\n`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log("✅ HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("⚠️  Forced shutdown after timeout.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    console.error("💥 Uncaught Exception:", err);
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error("💥 Unhandled Rejection:", reason);
  });
};

startServer();
