import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: String,
  size: String,
});

const billingSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: String,
  streetAddress: { type: String, required: true },
  apartment: String,
  city: { type: String, required: true },
  state: String,
  zipCode: String,
  phone: { type: String, required: true },
  email: { type: String, required: true },
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  userId: { type: String, default: "guest" },
  billing: billingSchema,
  items: [orderItemSchema],
  paymentMethod: { type: String, default: "cash", enum: ["cash", "card", "upi", "bank_transfer"] },
  subtotal: { type: Number },
  discount: { type: Number, default: 0 },
  couponCode: { type: String, default: null },
  shippingCost: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"],
    default: "pending",
  },
  trackingNumber: { type: String, default: null },
  estimatedDelivery: { type: Date, default: null },
  notes: { type: String },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String,
  }],
}, { timestamps: true });

// Auto-generate a UUID-based orderId
orderSchema.pre("save", function (next) {
  if (!this.orderId) {
    this.orderId = "ORD-" + uuidv4().split("-")[0].toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
  }
  if (!this.subtotal) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
  // Push to status history when created
  if (this.isNew) {
    this.statusHistory = [{ status: this.status, timestamp: new Date(), note: "Order placed" }];
  }
  next();
});

export default mongoose.model("Order", orderSchema);