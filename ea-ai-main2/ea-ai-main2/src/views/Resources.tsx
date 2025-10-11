"use client";

import FooterSection from "@/components/footer-adapted";
import { CheckCircle2, Calendar, ListTodo, MessageSquare, Zap } from "lucide-react";

export function Resources() {
  const features = [
    {
      icon: MessageSquare,
      title: "Natural Language AI",
      description: "Simply describe what you need in plain English. The AI understands context and intent."
    },
    {
      icon: ListTodo,
      title: "Todoist Integration",
      description: "Seamlessly create, update, and manage tasks across your Todoist projects."
    },
    {
      icon: Calendar,
      title: "Google Calendar Sync",
      description: "Schedule events, view your calendar, and manage appointments effortlessly."
    },
    {
      icon: Zap,
      title: "Smart Automation",
      description: "AI learns your patterns and suggests optimizations for your workflow."
    }
  ];

  const usageGuides = [
    {
      title: "Creating Tasks",
      description: "Try: 'Create a task to review project proposal by Friday' or 'Add buy groceries to my personal project'"
    },
    {
      title: "Managing Calendar",
      description: "Try: 'Schedule a team meeting tomorrow at 2pm' or 'Show me my calendar for next week'"
    },
    {
      title: "Project Organization",
      description: "Try: 'Create a new project called Marketing Campaign' or 'List all tasks in my Work project'"
    },
    {
      title: "Smart Updates",
      description: "Try: 'Complete the task about client presentation' or 'Postpone all tasks until next Monday'"
    }
  ];

  const faqs = [
    {
      question: "How do I connect my integrations?",
      answer: "Go to Settings → Connected Apps, then click 'Connect' next to Google Calendar or Todoist. You'll be guided through a secure OAuth flow."
    },
    {
      question: "What AI commands can I use?",
      answer: "Use natural language! The AI understands tasks, calendar events, projects, priorities, and due dates. Just describe what you need."
    },
    {
      question: "Is my data secure?",
      answer: "Yes. We use industry-standard OAuth 2.0 for integrations. Your data is encrypted and we never sell or share it with third parties."
    },
    {
      question: "Can I disconnect integrations?",
      answer: "Absolutely. Go to Settings → Connected Apps and click 'Disconnect' for any integration. Your local data remains intact."
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
          <a href="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Pricing</a>
          <a href="/#auth" className="text-sm text-primary font-medium">Get Started</a>
        </nav>
      </header>

      <main className="px-6 pb-12 max-w-5xl mx-auto">
        {/* Hero Section */}
        <section className="pt-12 pb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-semibold mb-4">Getting Started with TaskAI</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know to master AI-powered task management and boost your productivity.
          </p>
        </section>

        {/* Features Overview */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-8 text-center">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
                <feature.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Usage Guide */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-8 text-center">How to Use TaskAI</h2>
          <div className="space-y-6">
            {usageGuides.map((guide, index) => (
              <div key={index} className="p-6 rounded-lg border border-border bg-card">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-primary font-semibold text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{guide.title}</h3>
                    <p className="text-sm text-muted-foreground italic">{guide.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Setup Instructions */}
        <section className="mb-16 p-8 rounded-lg border border-border bg-card">
          <h2 className="text-2xl font-semibold mb-6">Quick Setup</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">1. Sign up or log in</p>
                <p className="text-sm text-muted-foreground">Create your account using Google sign-in for instant access.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">2. Connect your apps</p>
                <p className="text-sm text-muted-foreground">Go to Settings and connect Google Calendar and/or Todoist.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">3. Start chatting</p>
                <p className="text-sm text-muted-foreground">Describe what you need in natural language - the AI handles the rest.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-8 text-center">Frequently Asked Questions</h2>
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
        <section className="text-center py-12 px-6 rounded-lg border border-border bg-card">
          <h2 className="text-2xl font-semibold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">Join thousands of users managing their tasks smarter with AI.</p>
          <a 
            href="/#auth" 
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Start Using TaskAI
          </a>
        </section>
      </main>

      <FooterSection />
    </div>
  );
}
