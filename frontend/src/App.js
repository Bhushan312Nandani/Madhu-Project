import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./components/store/store.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            {/* Main pages */}
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<AllProducts />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<Checkout />} />
            {/* Info pages */}
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            {/* Auth pages */}
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            {/* Admin panel */}
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;
