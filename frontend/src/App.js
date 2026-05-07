import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./Routing/HomePage"
import About from "./components/about_us/About";
import Contact from "./components/contactUs/Contact";
import Signup from "./components/Login/Signup";
import Login from "./components/Login/Login.js";
import NotFound from "./components/404_error/NotFound";
import ProductDetails from "./components/product/ProductDetails.js";
import Checkout from "./components/billing/Checkout.js";
import Wishlist from "./components/wishlist/Wishlis.js";
import CartPage from "./components/cart/CartPage.js"

import { Provider } from "react-redux";
import { store } from "./components/store/store.js";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient()

function App() {

  return (
    <>
        {/* <Provider store={store}>
      <QueryClientProvider client={queryClient}> */}
    <Router>
      <Routes>
        {/* Default route: Homepage */}
        <Route path="/" element={<HomePage />} />
          {/* Agar user galat URL likhe toh Homepage pe bhej do */}
        <Route path="*" element={<NotFound />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/cart" element={<CartPage/>} />
        <Route path="//checkout" element={<Checkout />} />
                {/* About Us */}
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login  />} />
      </Routes>
    </Router>

    {/* </QueryClientProvider>
    </Provider> */}
</>
  );
}

export default App;
