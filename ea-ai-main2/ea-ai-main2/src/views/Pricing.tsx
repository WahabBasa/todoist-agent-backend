"use client";

import React from "react";
import FooterSection from "@/components/footer-adapted";
import { Check } from "lucide-react";

export function Pricing() {
  const plan = {
    name: "TaskAI Pro",
    price: "$15",
    period: "per month",
    description: "Everything you need for powerful AI-driven task management",
    features: [
      "100 AI messages per day",
      "Advanced task automation",
      "AI-powered planning & draft plans",
      "Google Calendar & Todoist integrations",
      "Calendar intelligence",
      "Email support",
      "SSO & advanced security"
    ],
    cta: "Get Started",
    ctaLink: "/#auth"
  };



  const faqs = [
    {
      question: "How does billing work?",
      answer: "You'll be charged $15/month on a recurring basis. Cancel anytime from your account settings."
    },
    {
      question: "Can I cancel anytime?",
      answer: "Absolutely. You can cancel your subscription at any time from your account settings. No long-term commitment required."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, Mastercard, Amex) and PayPal."
    },
    {
      question: "Do you offer discounts for annual billing?",
      answer: "Yes! Pay annually and save 20% on your subscription. Contact us for annual billing options."
    }
  ];



  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-lg">T</span>
          </div>
          <span className="font-semibold text-xl">TaskAI</span>
        </a>
        <nav className="hidden md:flex gap-6">
          <a href="/#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">Features</a>
          <a href="/resources" className="text-sm text-muted-foreground hover:text-primary transition-colors">Resources</a>
          <a href="/#auth" className="text-sm text-primary font-medium">Get Started</a>
        </nav>
      </header>

      <main className="px-6 pb-12">
        {/* Hero Section */}
        <section className="pt-12 pb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-semibold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground">
            One plan with everything you need to manage tasks with AI.
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



        {/* FAQ Section */}
        <section className="mb-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-semibold mb-8 text-center">Pricing FAQs</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details key={index} className="group p-6 rounded-lg border border-border bg-card">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  {faq.question}
                  <span className="ml-4 text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-sm text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center py-12 px-6 rounded-lg border border-border bg-card max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Ready to supercharge your productivity?</h2>
          <p className="text-muted-foreground mb-6">Join hundreds of professionals using AI to manage their tasks smarter.</p>
          <a 
            href="/#auth" 
            className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
        </section>
      </main>

      <FooterSection />
    </div>
  );
}
