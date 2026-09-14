import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./components/store/store.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import { ToastProvider } from "./components/utilities/Toast.js";
import { CurrencyProvider } from "./context/CurrencyContext.js";
import ErrorBoundary from "./components/utilities/ErrorBoundary.js";
import ProtectedRoute from "./components/utilities/ProtectedRoute.js";

import HomePage from "./Routing/HomePage";
import About from "./components/about_us/About";
import Contact from "./components/contactUs/Contact";
import Signup from "./components/Login/Signup";
import Login from "./components/Login/Login.js";
import NotFound from "./components/404_error/NotFound";
import ProductDetails from "./components/product/ProductDetails.js";
import AllProducts from "./components/product/AllProducts.js";
import Checkout from "./components/billing/Checkout.js";
import Wishlist from "./components/wishlist/Wishlis.js";
import CartPage from "./components/cart/CartPage.js";
import AdminPage from "./components/admin/AdminPage.js";
import ProfilePage from "./components/user/ProfilePage.js";
import OrdersPage from "./components/user/OrdersPage.js";

// ─── QueryClient with professional defaults ───────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ─── Scroll Restoration on Route Change ──────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

// ─── SEO Meta Tag Manager ─────────────────────────────────────────────────────
function MetaManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const pageMeta = {
      "/":         { title: "MadhuShud Oil Shop — Premium Natural Oils", description: "Discover premium, pure natural oils. Flash sales, best oils, free shipping on all orders." },
      "/products": { title: "All Products — MadhuShud Oil Shop", description: "Browse our complete collection of pure natural oils." },
      "/about":    { title: "Our Story — MadhuShud Oil Shop", description: "Learn about our commitment to purity and quality." },
      "/contact":  { title: "Contact Us — MadhuShud Oil Shop", description: "Get in touch with our team." },
      "/cart":     { title: "Your Cart — MadhuShud Oil Shop", description: "Review your selected items before checkout." },
      "/checkout": { title: "Checkout — MadhuShud Oil Shop", description: "Secure checkout for your order." },
      "/wishlist": { title: "Wishlist — MadhuShud Oil Shop", description: "Your saved products." },
      "/profile":  { title: "My Profile — MadhuShud Oil Shop", description: "Manage your account and preferences." },
      "/orders":   { title: "My Orders — MadhuShud Oil Shop", description: "Track your order history." },
      "/login":    { title: "Sign In — MadhuShud Oil Shop", description: "Sign in to your account." },
      "/signup":   { title: "Create Account — MadhuShud Oil Shop", description: "Join MadhuShud to enjoy exclusive offers." },
      "/admin":    { title: "Admin Panel — MadhuShud Oil Shop", description: "Manage store content and orders." },
    };
    const meta = pageMeta[pathname] || pageMeta["/"];
    document.title = meta.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", meta.description);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = meta.description;
      document.head.appendChild(m);
    }
  }, [pathname]);

  return null;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <MetaManager />
      <Routes>
        {/* Main pages */}
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<AllProducts />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        {/* Auth pages — redirect to home if already logged in */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        {/* User pages — protected */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout />} />

        {/* Admin panel — admin only */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute adminOnly>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <CurrencyProvider>
              <Router>
                <AppRoutes />
              </Router>
            </CurrencyProvider>
          </ToastProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
