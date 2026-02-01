import HeroSection from "@/components/sections/HeroSection";
import ProductShowcaseSection from "@/components/sections/ProductShowcaseSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import OrderFormSection from "@/components/sections/OrderFormSection";
import FAQQuickSection from "@/components/sections/FAQQuickSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <ProductShowcaseSection />
      <OrderFormSection />
      <HowItWorksSection />
      <FAQQuickSection />
      <TestimonialsSection />
    </>
  );
}
