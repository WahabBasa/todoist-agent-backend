"use client";
import FooterSection from "@/components/footer-adapted";
import { Check } from "lucide-react";

export function Pricing() {
  const plan = {
    name: "Miller Pro",
    price: "$20",
    period: "per month",
    description: "Everything you need to stay on top of your work",
    features: [
      "Unlimited brain dumps (capture chaos anytime)",
      "Conversational AI that clarifies your thoughts",
      "Planning mode to organize your week",
      "Reviewing mode to reflect on progress",
      "Quick pulse on current work",
      "Todoist + Google Calendar sync",
    ],
    cta: "Get Started",
    ctaLink: "/#auth"
  };







  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-17 h-17 flex items-center justify-center">
            <img src="/oldowan-logo.png" alt="Oldowan" className="w-17 h-17 object-contain" />
          </div>
          <span className="font-semibold text-xl">Oldowan</span>
        </a>
        <nav className="hidden md:flex gap-6 items-center">
          <a href="/#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">Features</a>
          <a href="/resources" className="text-sm text-muted-foreground hover:text-primary transition-colors">Resources</a>
          <a href="/#auth" className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">Get Started</a>
        </nav>
      </header>

      <main className="px-6 pb-12">
        {/* Hero Section */}
        <section className="pt-12 pb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-semibold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground">
            Everything you need to stay on top of your work.
          </p>
        </section>

        {/* Pricing Card */}
        <section className="mb-20 max-w-xl mx-auto">
          <div className="relative p-8 rounded-lg border border-primary shadow-lg shadow-primary/10 bg-card">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
              All Features Included
            </div>
            
            <div className="text-center mb-8">
              <h3 className="text-3xl font-semibold mb-3">{plan.name}</h3>
              <div className="mb-3">
                <span className="text-5xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-xl ml-2">/ {plan.period}</span>
              </div>
              <p className="text-muted-foreground">{plan.description}</p>
            </div>

            <a 
              href={plan.ctaLink}
              className="block w-full py-4 px-6 rounded-lg font-semibold text-center mb-8 transition-colors bg-primary text-primary-foreground hover:opacity-90 text-lg"
            >
              {plan.cta}
            </a>

            <div className="space-y-3">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>


      </main>

      <FooterSection />
    </div>
  );
}
