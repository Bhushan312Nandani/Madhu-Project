import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  price: { type: Number, required: true },
  oldPrice: { type: Number },
  discount: { type: String },
  images: [{ type: String }],
  image: { type: String },
  category: { type: String, default: "General" },
  sizes: [{ type: String }],
  stock: { type: String, default: "In Stock" },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("Product", productSchema);
