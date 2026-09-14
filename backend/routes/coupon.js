// routes/coupon.js — Coupon validation for checkout
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const couponsFile = path.join(__dirname, "../data/coupons.json");
if (!fs.existsSync(couponsFile)) fs.writeFileSync(couponsFile, JSON.stringify([], null, 2), "utf8");

function readCoupons() {
  try { return JSON.parse(fs.readFileSync(couponsFile, "utf-8") || "[]"); }
  catch { return []; }
}

// POST /api/coupon/validate — Validate a coupon code
router.post("/validate", apiLimiter, (req, res) => {
  try {
    const { code, orderTotal = 0 } = req.body;
    if (!code) return res.status(400).json({ message: "Coupon code is required" });

    const coupons = readCoupons();
    const coupon = coupons.find(c => c.code === code.toUpperCase().trim() && c.isActive);

    if (!coupon) return res.status(404).json({ valid: false, message: "Invalid coupon code." });

    // Check expiry
    if (new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ valid: false, message: "This coupon has expired." });
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ valid: false, message: "This coupon has reached its usage limit." });
    }

    // Check minimum order value
    if (Number(orderTotal) < (coupon.minOrderValue || 0)) {
      return res.status(400).json({
        valid: false,
        message: `Minimum order value for this coupon is ₹${coupon.minOrderValue}.`,
      });
    }

    // Calculate discount
    let discountAmount;
    if (coupon.type === "fixed") {
      discountAmount = Math.min(Number(coupon.discount), Number(orderTotal));
    } else {
      discountAmount = (Number(orderTotal) * Number(coupon.discount)) / 100;
      if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    }
    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalTotal = Math.max(0, Math.round((Number(orderTotal) - discountAmount) * 100) / 100);

    return res.json({
      valid: true,
      message: `Coupon applied! You save ₹${discountAmount}.`,
      coupon: {
        code: coupon.code,
        discount: coupon.discount,
        type: coupon.type,
        description: coupon.description,
      },
      discountAmount,
      finalTotal,
    });
  } catch (err) {
    console.error("Coupon validate error:", err);
    return res.status(500).json({ message: "Server error validating coupon." });
  }
});

// GET /api/coupon/active — Get all active public coupons (for display)
router.get("/active", (req, res) => {
  const coupons = readCoupons()
    .filter(c => c.isActive && new Date(c.expiresAt) > new Date())
    .map(({ usedCount, usageLimit, id, ...safe }) => safe);
  res.json(coupons);
});

export default router;
