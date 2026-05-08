import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: String,
  name: String,
  price: Number,
  quantity: Number,
  image: String,
  size: String,
});

const billingSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  streetAddress: String,
  apartment: String,
  city: String,
  phone: String,
  email: String,
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  userId: { type: String, default: "guest" },
  billing: billingSchema,
  items: [orderItemSchema],
  paymentMethod: { type: String, default: "cash" },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
    default: "pending"
  },
  notes: { type: String },
}, { timestamps: true });

// Auto-generate orderId
orderSchema.pre("save", function (next) {
  if (!this.orderId) {
    this.orderId = "ORD-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  }
  next();
});

export default mongoose.model("Order", orderSchema);