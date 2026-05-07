import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Head from "../components/utilities/Head";
import TopBar from "../components/utilities/TopBar";
import Header from "../components/utilities/Header";
import Sidebar from '../components/utilities/Sidebar';
import MainBanner from "../components/utilities/MainBanner";
import Arrival from "../components/annouce/Arrival";
import FlashCard from "../components/annouce/FlashCard";
import FlashSale from "../components/annouce/FlashSales";
import MusicBanner from "../components/annouce/MusicBanner";
import SearchByCategories from "../components/annouce/SearchByCategories"
import ExploreProducts from"../components/annouce/ExploreProducts";
import Footer from "../components/utilities/Footer"
import React, { useState } from "react";
import { useEffect } from "react";

import { useFlashSales, useProducts, useFeatured, useMusicBanner}  from "../components/store/useApi";



function HomePage() {

    const flashSales = useFlashSales();
  const products = useProducts();
  const featured = useFeatured();
  const musicBanner = useMusicBanner();

  if (flashSales.isLoading || products.isLoading || featured.isLoading || musicBanner.isLoading) {
    return <div>Loading...</div>;
  }


  return (
    
<>
<Head />
          <TopBar/>
          <Header />
          <main class="main-content">
          <Sidebar/>
          <MainBanner/>
          </main>
          <FlashCard/>
<FlashSale 
  data={flashSales.data} 
  countdownData={musicBanner.data?.countdown} 
/>

          <SearchByCategories/>
          <MusicBanner />
          <ExploreProducts  />
          <Arrival  />
          <Footer/>

</>
  );
}

export default HomePage;
