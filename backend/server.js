import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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
import wishlistRouter from "./routes/wishlist.js";




const app = express();
app.use(cors());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-user-id"], // << important if you keep custom header
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// API routes
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

// Contact router
app.use("/api/contact", contactRouter);
app.use("/api/signup", signupRouter);
app.use("/login", loginRouter);




app.use("/api/orders", orderRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);

app.get("/", (req, res) => res.send("API Running"));

app.listen(5000, () => console.log("Server running on port 5000"));
