import Image from "next/image";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Hero from "../components/Hero";
import PlatformDescription from "../components/PlatformDescription";
import RecommendedSection from "../components/RecommendedSection";
import NewSalonsSection from "../components/NewSalonsSection";
import About from "../components/About";
import AppDownloadSection from "../components/AppDownloadSection";
import ProCTASection from "../components/ProCTASection";
import RDV from "../components/Rdv";
import Locations from "../components/Locations";
import Faq from "../components/Faq";
import Testimonials from "../components/Testimonials";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans overflow-x-hidden">
      <Header />
      <Hero />
      <RecommendedSection />
      <NewSalonsSection />
      <PlatformDescription />
      <About />
      <AppDownloadSection />
      <ProCTASection />
      <Locations />
      <Testimonials />
      <Faq />
      <Footer />
    </div>
  );
}
