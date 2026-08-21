import { CallToAction } from "@/components/landing/CallToAction";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { ScrollShowcase } from "@/components/landing/ScrollShowcase";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <ScrollShowcase />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  );
}
