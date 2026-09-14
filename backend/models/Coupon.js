import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  discount: { type: Number, required: true, min: 1, max: 100 }, // Percentage discount
  type: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
  minOrderValue: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: null }, // Cap for percentage coupons
  expiresAt: { type: Date, required: true },
  usageLimit: { type: Number, default: null }, // null = unlimited
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  description: { type: String, default: "" },
}, { timestamps: true });

// Check if coupon is valid
couponSchema.methods.isValid = function () {
  if (!this.isActive) return { valid: false, reason: "Coupon is inactive" };
  if (this.expiresAt < new Date()) return { valid: false, reason: "Coupon has expired" };
  if (this.usageLimit !== null && this.usedCount >= this.usageLimit) {
    return { valid: false, reason: "Coupon usage limit reached" };
  }
  return { valid: true };
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function (orderTotal) {
  if (orderTotal < this.minOrderValue) {
    return { discountAmount: 0, error: `Minimum order value is ₹${this.minOrderValue}` };
  }
  let discountAmount;
  if (this.type === "percentage") {
    discountAmount = (orderTotal * this.discount) / 100;
    if (this.maxDiscount) discountAmount = Math.min(discountAmount, this.maxDiscount);
  } else {
    discountAmount = Math.min(this.discount, orderTotal);
  }
  return { discountAmount: Math.round(discountAmount * 100) / 100 };
};

export default mongoose.model("Coupon", couponSchema);
