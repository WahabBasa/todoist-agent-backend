"use client";

import { useEffect } from "react";
import { sendAuthTelemetry } from "@/lib/telemetry";
import HeaderNav from "@/components/header-adapted";
import HeroSection from "@/components/hero-section-adapted";
import BrainDumpSection from "@/components/brain-dump-section";
import OutcomeSection from "@/components/outcome-section";
import FocusSection from "@/components/focus-section";
import CTASection from "@/components/cta-section";
import IntegrationsSection from "@/components/integrations-section";
import FAQSection from "@/components/faq-adapted";
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
      <BrainDumpSection />
      <OutcomeSection />
      <FocusSection />
      <CTASection />
      <IntegrationsSection />
      <FAQSection />
      <FooterSection />
    </div>
  );
}
