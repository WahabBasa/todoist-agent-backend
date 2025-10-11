"use client";

import FooterSection from "@/components/footer-adapted";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="px-6 py-12 max-w-3xl mx-auto">
        <header className="mb-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-lg">T</span>
          </div>
          <a href="/" className="font-semibold text-xl">TaskAI</a>
        </header>

        <h1 className="text-3xl font-semibold mb-6">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective: 2025-10-11</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">What data we access</h2>
          <p className="text-muted-foreground">We access Google Calendar event metadata and Todoist task/project data strictly to provide requested features like scheduling, task creation, and updates initiated by you.</p>
        </section>

        <section className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold">How we use and store data</h2>
          <p className="text-muted-foreground">Data is used only to perform the actions you request. We follow least-privilege access; we do not sell user data. Limited operational logs may be retained for troubleshooting.</p>
        </section>

        <section className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold">Data retention & deletion</h2>
          <p className="text-muted-foreground">We retain only what is necessary for the app to function. You can request data deletion at any time, and we will remove associated records from our systems.</p>
        </section>

        <section className="space-y-4 mt-8 mb-12">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">Contact us at <a href="mailto:support@example.com" className="underline">support@example.com</a> for privacy questions or deletion requests.</p>
        </section>
      </main>
      
      <FooterSection />
    </div>
  );
}
