import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { DashboardSection } from "@/components/DashboardSection";
import { MethodologySection } from "@/components/MethodologySection";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <MethodologySection />
      <DashboardSection />
      <Footer />
    </div>
  );
};

export default Index;
