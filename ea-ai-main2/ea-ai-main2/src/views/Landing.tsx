"use client";

import { useEffect } from "react";
import { sendAuthTelemetry } from "@/lib/telemetry";
import HeaderNav from "@/components/header-adapted";
import HeroSection from "@/components/hero-section-adapted";
import FeaturesSection from "@/components/features-9-adapted";
import FooterSection from "@/components/footer-adapted";

export function Landing() {
  useEffect(() => {
    try {
      const ref = document.referrer || "";
      const hasClerkParams = window.location.search.includes("__clerk") || window.location.hash.includes("__clerk");
      if (!hasClerkParams && (ref.includes("accounts.google.com") || ref.includes("clerk"))) {
        sendAuthTelemetry("bounce", {
          referrer: ref,
          search: window.location.search,
          hash: window.location.hash,
        });
      }
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeaderNav />
      <HeroSection />
      <FeaturesSection />
      <FooterSection />
    </div>
  );
}
