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
        <p className="text-sm text-muted-foreground mb-8">Last Updated: October 18, 2025</p>

        {/* Table of Contents */}
        <nav className="mb-12 p-6 bg-card border border-border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#acceptance" className="hover:text-primary transition-colors">1. Acceptance of Terms</a></li>
            <li><a href="#use-license" className="hover:text-primary transition-colors">2. Use License</a></li>
            <li><a href="#user-accounts" className="hover:text-primary transition-colors">3. User Accounts and Responsibility</a></li>
            <li><a href="#subscriptions" className="hover:text-primary transition-colors">4. Subscriptions and Billing</a></li>
            <li><a href="#refund-policy" className="hover:text-primary transition-colors">5. Refund Policy</a></li>
            <li><a href="#third-party" className="hover:text-primary transition-colors">6. Third-Party Service Data</a></li>
            <li><a href="#acceptable-use" className="hover:text-primary transition-colors">7. Acceptable Use</a></li>
            <li><a href="#account-deletion" className="hover:text-primary transition-colors">8. Account Deletion</a></li>
            <li><a href="#disclaimers" className="hover:text-primary transition-colors">9. Disclaimers and Liability</a></li>
            <li><a href="#contact-terms" className="hover:text-primary transition-colors">10. Contact Us</a></li>
          </ol>
        </nav>

        {/* Section 1: Acceptance */}
        <section id="acceptance" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              By accessing and using Oldowan (the "Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
            <p>
              We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the updated terms.
            </p>
          </div>
        </section>

        {/* Section 2: Use License */}
        <section id="use-license" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">2. Use License</h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable license to use the Service for your personal use.
            </p>
            <p>
              You may not:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Republish the Service content without attribution</li>
              <li>Sell or modify the Service or its content</li>
              <li>Use the Service for any illegal purpose</li>
              <li>Create automated bots or scrapers to extract data</li>
              <li>Reverse engineer or attempt to access source code</li>
            </ul>
          </div>
        </section>

        {/* Section 3: User Accounts */}
        <section id="user-accounts" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">3. User Accounts and Responsibility</h2>
          <div className="space-y-4 text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Account Creation</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You are responsible for maintaining the confidentiality of your account and password</li>
                <li>You agree to accept responsibility for all activities that occur under your account</li>
                <li>You must provide accurate information during registration</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Account Security</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You are responsible for maintaining appropriate safeguards for your account</li>
                <li>We are not liable for unauthorized access to your account if you have been negligent</li>
                <li>Report any unauthorized use immediately to AtheA.hab@gmail.com</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4: Subscriptions and Billing */}
        <section id="subscriptions" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">4. Subscriptions and Billing</h2>
          <div className="space-y-4 text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Paid Plans</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Subscription fees are billed automatically on the date specified in your subscription details</li>
                <li>Charges will recur at the agreed-upon interval until you cancel</li>
                <li>You can cancel your subscription anytime; access continues through the end of your billing period</li>
                <li>Taxes may apply based on your location</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Payment Processing</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All payments are processed securely through a third-party payment provider</li>
                <li>We do not store your full credit card numbers</li>
                <li>Failed payments may result in service suspension</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 5: Refund Policy */}
        <section id="refund-policy" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">5. Refund Policy</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              We aim to be fair and transparent with refund requests while preventing abuse.
            </p>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">When Refunds Are NOT Provided</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Change-of-mind refunds for already-delivered subscription periods</li>
                <li>Refunds for digital features once you have accessed them</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">When Refunds May Be Approved</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Duplicate charges or billing errors</li>
                <li>Unauthorized charges to your account</li>
                <li>Failure to deliver the core Service as documented</li>
                <li>Where not remedied within a reasonable time after you contact support</li>
                <li>Mandatory consumer rights in your jurisdiction (where law requires a refund)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Requesting a Refund</h3>
              <p>
                Email <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a> with:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Your account email address</li>
                <li>Transaction or charge ID</li>
                <li>Reason for refund request</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Refund Processing</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Approved refunds are processed to your original payment method</li>
                <li>Bank posting times vary (typically 5–10 business days)</li>
                <li>We will respond to your refund request within 30 days</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 6: Third-Party Service Data */}
        <section id="third-party" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">6. Third-Party Service Data</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              When you connect Google Calendar, Todoist, or other third-party services to Oldowan:
            </p>

            <ul className="list-disc list-inside space-y-3 ml-4">
              <li>
                <strong>Authorization:</strong> You authorize Oldowan to access your data as permitted by the connected service's scope permissions
              </li>
              <li>
                <strong>Third-Party Terms:</strong> You remain responsible for complying with the terms of service of any connected third-party service
              </li>
              <li>
                <strong>Data Usage:</strong> All connected data is used only to provide the Service. We do not store, backup, or share data from connected services with third parties
              </li>
              <li>
                <strong>Revocation:</strong> You can revoke access anytime in the connected service's settings. Once revoked, we immediately lose access and cannot retrieve your data
              </li>
            </ul>

            <div className="p-4 bg-accent/10 border border-primary/30 rounded-md mt-4">
              <p className="text-sm">
                <strong>Important:</strong> You are responsible for your connected service accounts. We are not liable for any issues arising from your connected services, including data loss, service disruptions, or policy violations on those platforms.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: Acceptable Use */}
        <section id="acceptable-use" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">7. Acceptable Use</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              You agree not to use the Service:
            </p>

            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>For any unlawful purpose or in violation of any applicable law</li>
              <li>To send spam, harassment, or abusive messages</li>
              <li>To export bulk calendar or task data for unauthorized purposes</li>
              <li>To extract data from connected services (Google, Todoist, etc.) for resale or redistribution</li>
              <li>To share your connected app credentials with other users</li>
              <li>To circumvent rate limits, security controls, or access restrictions</li>
              <li>To violate the terms of service of any connected third-party service</li>
              <li>In any way that infringes upon the rights of others or restricts their use and enjoyment</li>
            </ul>

            <div className="p-4 bg-card border border-border rounded-md mt-4">
              <p className="text-sm">
                <strong>Violation Consequences:</strong> We may suspend or terminate your account without notice if you violate these terms. You may be liable for damages resulting from your violations.
              </p>
            </div>
          </div>
        </section>

        {/* Section 8: Account Deletion */}
        <section id="account-deletion" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">8. Account Deletion</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              When you delete your Oldowan account:
            </p>

            <ul className="list-disc list-inside space-y-3 ml-4">
              <li>
                <strong>Your Oldowan Data:</strong> Your account information and conversation history are permanently deleted
              </li>
              <li>
                <strong>Connected App Tokens:</strong> OAuth tokens for Google Calendar, Todoist, and other connected services are revoked
              </li>
              <li>
                <strong>Access Termination:</strong> We immediately stop accessing your connected services
              </li>
              <li>
                <strong>Connected Service Data:</strong> Data retained by Google, Todoist, and other services is governed by their privacy policies, not ours
              </li>
              <li>
                <strong>No Backup Retention:</strong> We do not retain backups of personal or connected data after account deletion
              </li>
              <li>
                <strong>Manual Revocation:</strong> You can optionally revoke access in each connected service's settings for complete security
              </li>
            </ul>

            <div className="p-4 bg-accent/10 border border-primary/30 rounded-md mt-4">
              <p className="text-sm">
                <strong>Important:</strong> Account deletion is permanent. If you reconnect your account, your previous conversation history will not be restored.
              </p>
            </div>
          </div>
        </section>

        {/* Section 9: Disclaimers and Liability */}
        <section id="disclaimers" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">9. Disclaimers and Liability</h2>
          <div className="space-y-4 text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Service "As-Is"</h3>
              <p>
                The Service is provided on an "as-is" and "as-available" basis. To the extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Limitation of Liability</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We are not liable for indirect, incidental, special, or consequential damages</li>
                <li>We are not liable for loss of data, revenue, profits, or business opportunities</li>
                <li>Our total liability shall not exceed the amount you paid us in the past 12 months</li>
                <li>Some jurisdictions do not allow certain liability limitations; in those cases, this limitation applies only to the extent permitted by law</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Guarantee</h3>
              <p>
                We do not guarantee:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Uninterrupted or error-free Service</li>
                <li>That bugs or issues will be fixed immediately</li>
                <li>Accuracy of AI-generated responses</li>
                <li>That all calendar or task operations will succeed (dependent on third-party services)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">User Responsibility</h3>
              <p>
                You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Backing up important data independently</li>
                <li>Understanding AI limitations and verifying important decisions</li>
                <li>Maintaining your connected service accounts</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 10: Contact */}
        <section id="contact-terms" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">10. Contact Us</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              If you have questions about these Terms of Service, please contact us:
            </p>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Email</h3>
              <p>
                <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a>
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Subject Line Suggestions</h3>
              <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                <li>"Terms Question" – for clarifications</li>
                <li>"Billing Issue" – for payment or subscription issues</li>
                <li>"Account Issue" – for account-related questions</li>
              </ul>
            </div>

            <div>
              <p><strong>Response Time:</strong> Within 30 days</p>
            </div>
          </div>
        </section>

        <div className="border-t border-border pt-8 mb-12">
          <p className="text-sm text-muted-foreground text-center">
            These Terms of Service were last updated on October 18, 2025. If you have any questions or concerns, please contact us at{" "}
            <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a>
          </p>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
