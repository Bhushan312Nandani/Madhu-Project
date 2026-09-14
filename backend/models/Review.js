import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 500 },
  verified: { type: Boolean, default: false }, // Verified purchase
  helpful: { type: Number, default: 0 },
  reported: { type: Boolean, default: false },
}, { timestamps: true });

// Prevent duplicate reviews per user per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
