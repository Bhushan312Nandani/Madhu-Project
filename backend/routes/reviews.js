// routes/reviews.js — Product Reviews
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { validateReview } from "../middleware/validate.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { cacheMiddleware, cacheInvalidate } from "../middleware/cache.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reviewsFile = path.join(__dirname, "../data/reviews.json");
if (!fs.existsSync(reviewsFile)) fs.writeFileSync(reviewsFile, JSON.stringify([], null, 2), "utf8");

function readReviews() {
  try { return JSON.parse(fs.readFileSync(reviewsFile, "utf-8") || "[]"); }
  catch { return []; }
}

function writeReviews(data) {
  fs.writeFileSync(reviewsFile, JSON.stringify(data, null, 2), "utf8");
}

// GET reviews for a product (with cache)
router.get("/product/:productId", optionalAuth, apiLimiter, cacheMiddleware("reviews", 60), (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10, sort = "newest" } = req.query;

  let reviews = readReviews().filter(r => String(r.productId) === String(productId) && !r.reported);

  // Sort
  if (sort === "newest") reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (sort === "oldest") reviews.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  else if (sort === "highest") reviews.sort((a, b) => b.rating - a.rating);
  else if (sort === "lowest") reviews.sort((a, b) => a.rating - b.rating);
  else if (sort === "helpful") reviews.sort((a, b) => (b.helpful || 0) - (a.helpful || 0));

  const total = reviews.length;
  const avgRating = total > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : 0;

  // Rating distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });

  // Paginate
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paginated = reviews.slice(start, start + parseInt(limit));

  res.json({
    reviews: paginated,
    total,
    avgRating: parseFloat(avgRating),
    distribution,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
  });
});

// POST submit a review (requires auth)
router.post("/", requireAuth, validateReview, apiLimiter, (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const reviews = readReviews();

    // Check if user already reviewed this product
    const existing = reviews.find(r => String(r.productId) === String(productId) && String(r.userId) === String(req.user.id));
    if (existing) return res.status(400).json({ message: "You have already reviewed this product." });

    const newReview = {
      id: Date.now().toString(),
      productId: String(productId),
      userId: String(req.user.id),
      userName: req.user.name || "Anonymous",
      rating: parseInt(rating),
      comment,
      verified: false,
      helpful: 0,
      reported: false,
      createdAt: new Date().toISOString(),
    };

    reviews.push(newReview);
    writeReviews(reviews);
    cacheInvalidate("reviews");

    return res.status(201).json({ message: "Review submitted!", review: newReview });
  } catch (err) {
    console.error("Review error:", err);
    return res.status(500).json({ message: "Server error submitting review." });
  }
});

// POST mark a review as helpful
router.post("/:id/helpful", optionalAuth, (req, res) => {
  const reviews = readReviews();
  const review = reviews.find(r => String(r.id) === String(req.params.id));
  if (!review) return res.status(404).json({ message: "Review not found" });
  review.helpful = (review.helpful || 0) + 1;
  writeReviews(reviews);
  cacheInvalidate("reviews");
  res.json({ message: "Marked as helpful", helpful: review.helpful });
});

// DELETE own review
router.delete("/:id", requireAuth, (req, res) => {
  let reviews = readReviews();
  const review = reviews.find(r => String(r.id) === String(req.params.id));
  if (!review) return res.status(404).json({ message: "Review not found" });
  if (String(review.userId) !== String(req.user.id) && req.user.role !== "admin") {
    return res.status(403).json({ message: "You can only delete your own reviews." });
  }
  reviews = reviews.filter(r => String(r.id) !== String(req.params.id));
  writeReviews(reviews);
  cacheInvalidate("reviews");
  res.json({ message: "Review deleted" });
});

export default router;
