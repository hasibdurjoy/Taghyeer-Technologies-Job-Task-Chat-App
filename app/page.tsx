import type { Metadata } from "next";

import { CallToAction } from "@/components/landing/CallToAction";
import { Features } from "@/components/landing/Features";
import { FloatingChatProvider } from "@/components/landing/FloatingChatProvider";
import { Hero } from "@/components/landing/Hero";
import { ScrollShowcase } from "@/components/landing/ScrollShowcase";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

// Title, description, keywords and Open Graph all come from the root layout —
// this *is* the root route, so its defaults are the landing page's own tags.
// Only the canonical URL is route-specific.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function LandingPage() {
  return (
    <FloatingChatProvider>
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
    </FloatingChatProvider>
  );
}
