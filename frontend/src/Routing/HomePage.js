// src/Routing/HomePage.js
import React from "react";
import TopBar from "../components/utilities/TopBar";
import Header from "../components/utilities/Header";
import Sidebar from '../components/utilities/Sidebar';
import MainBanner from "../components/utilities/MainBanner";
import Arrival from "../components/annouce/Arrival";
import FlashCard from "../components/annouce/FlashCard";
import MusicBanner from "../components/annouce/MusicBanner";
import SearchByCategories from "../components/annouce/SearchByCategories"
import ExploreProducts from"../components/annouce/ExploreProducts";
import Footer from "../components/utilities/Footer"

function HomePage() {
  return (
    <>
      <TopBar/>
      <Header />
      <main className="main-content">
        <Sidebar/>
        <MainBanner/>
      </main>
      <FlashCard/>
      <SearchByCategories/>
      <MusicBanner />
      <ExploreProducts  />
      <Arrival  />
      <Footer/>
    </>
  );
}

export default HomePage;
