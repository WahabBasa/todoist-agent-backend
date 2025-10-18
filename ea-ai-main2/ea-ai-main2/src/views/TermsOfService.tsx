"use client";

import FooterSection from "@/components/footer-adapted";

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="px-6 py-12 max-w-4xl mx-auto">
        <header className="mb-8 flex items-center gap-2">
          <div className="w-17 h-17 flex items-center justify-center">
            <img src="/oldowan-logo.png" alt="Oldowan" className="w-17 h-17 object-contain" />
          </div>
          <a href="/" className="font-semibold text-xl hover:text-primary transition-colors">Oldowan</a>
        </header>

        <h1 className="text-3xl font-semibold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective date: October 18, 2025</p>
        <p className="text-base text-muted-foreground mb-12">
          Clear terms for using Oldowan, covering accounts, billing, acceptable use, and refunds in line with payment processor and platform policies.
        </p>

        {/* Accounts and Access */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Accounts and Access</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Provide accurate information and maintain account security</li>
            <li>You are responsible for all activity under your account</li>
            <li>Integrations (e.g., Google OAuth) require explicit consent and can be revoked at any time in the provider's settings</li>
          </ul>
        </section>

        {/* Subscriptions and Billing */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Subscriptions and Billing</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Paid plans are billed via a third-party payment provider</li>
            <li>Charges recur per your selected interval until cancelled. Cancellation stops future renewals; access continues through the end of the current period</li>
            <li>Taxes may apply based on your location</li>
          </ul>
        </section>

        {/* Refund Policy */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Refund Policy</h2>
          <p className="text-muted-foreground mb-4">
            We aim to be fair while preventing abuse and staying compliant with our payment processor and applicable platform policies:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>No change-of-mind refunds for already-delivered subscription periods or digital features once accessed</li>
            <li>Refunds may be approved for duplicate charges, unauthorized charges, billing errors, or failure to deliver the core Service as documented, where not remedied within a reasonable time after you contact support</li>
            <li>Mandatory consumer rights in your jurisdiction are not affected; where law requires a refund, we will comply</li>
            <li>Approved refunds are processed to the original payment method; bank posting times vary (typically 5–10 business days)</li>
            <li>To request a review, email <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a> with your account email, charge ID, and details</li>
          </ul>
        </section>

        {/* Acceptable Use */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Acceptable Use</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>No spam, abusive content, or unlawful activity</li>
            <li>Respect third-party terms (e.g., Google, email providers)</li>
            <li>Do not attempt to circumvent rate limits or security controls</li>
          </ul>
        </section>

        {/* Data and Privacy */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Data and Privacy</h2>
          <p className="text-muted-foreground">
            Our <a href="/privacy" className="text-primary underline hover:text-primary/80">Privacy Policy</a> explains how we collect, use, and share information, including Google OAuth, connected services, and payment processing.
          </p>
        </section>

        {/* Integrations */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Integrations</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>You authorize us to access your connected services via OAuth scopes</li>
            <li>You remain responsible for complying with the terms of any connected service</li>
            <li>We do not store data from connected services after use</li>
            <li>Revoke access anytime via the provider's settings; we immediately lose access</li>
          </ul>
        </section>

        {/* Termination */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Termination</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>We may suspend or terminate access for violations of these Terms or legal requirements</li>
            <li>You may cancel at any time from your account or by contacting support</li>
            <li>Upon deletion, your Oldowan data is permanently deleted; connected service data follows their policies</li>
          </ul>
        </section>

        {/* Disclaimers and Liability */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Disclaimers and Liability</h2>
          <p className="text-muted-foreground mb-4">
            The Service is provided "as is" to the extent permitted by law. We are not liable for indirect or consequential damages. Some jurisdictions do not allow certain limitations; where applicable, protections apply to the maximum extent permitted.
          </p>
          <p className="text-muted-foreground">
            You are responsible for backing up important data independently and understanding AI limitations before relying on AI-generated responses for critical decisions.
          </p>
        </section>

        {/* Changes to Terms */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Changes to Terms</h2>
          <p className="text-muted-foreground">
            We may update these Terms. Material changes will be notified via the Service or email. Continued use after an update constitutes acceptance.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-4 mb-12">
          <h2 className="text-2xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            For questions about these Terms or billing issues, contact <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a>.
          </p>
        </section>

        <div className="border-t border-border pt-8 mb-12">
          <p className="text-sm text-muted-foreground text-center">
            Last updated October 18, 2025
          </p>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
