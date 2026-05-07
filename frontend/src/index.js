import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from "react-redux";
import store from "./components/store/store";
import './index.css';
import "./public/stylesheet/FlashSales.css";
import "./public/stylesheet/arrival.css";
import "./public/stylesheet/feature.css";
import "./public/stylesheet/banner-music.css";
import './public/stylesheet/style.css';
import './public/stylesheet/about.css';
import './public/stylesheet/product.css';
import './public/stylesheet/bill.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(


  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>

);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
