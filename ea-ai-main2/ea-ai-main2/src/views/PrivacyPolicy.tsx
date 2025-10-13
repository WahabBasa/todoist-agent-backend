"use client";

import FooterSection from "@/components/footer-adapted";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="px-6 py-12 max-w-4xl mx-auto">
        <header className="mb-8 flex items-center gap-2">
          <div className="w-17 h-17 flex items-center justify-center">
            <img src="/oldowan-logo.png" alt="Oldowan" className="w-17 h-17 object-contain" />
          </div>
          <a href="/" className="font-semibold text-xl hover:text-primary transition-colors">Oldowan</a>
        </header>

        <h1 className="text-3xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last Updated: October 13, 2025</p>

        {/* Table of Contents */}
        <nav className="mb-12 p-6 bg-card border border-border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#who-we-are" className="hover:text-primary transition-colors">1. Who We Are</a></li>
            <li><a href="#information-we-collect" className="hover:text-primary transition-colors">2. What Information We Collect</a></li>
            <li><a href="#how-we-use" className="hover:text-primary transition-colors">3. How We Use Your Information</a></li>
            <li><a href="#third-parties" className="hover:text-primary transition-colors">4. Who Gets Your Data</a></li>
            <li><a href="#google-calendar" className="hover:text-primary transition-colors">5. Google Calendar - Special Section</a></li>
            <li><a href="#data-security" className="hover:text-primary transition-colors">6. How We Protect Your Data</a></li>
            <li><a href="#data-retention" className="hover:text-primary transition-colors">7. How Long We Keep Your Data</a></li>
            <li><a href="#your-rights" className="hover:text-primary transition-colors">8. Your Rights</a></li>
            <li><a href="#cookies" className="hover:text-primary transition-colors">9. Cookies</a></li>
            <li><a href="#international" className="hover:text-primary transition-colors">10. International Users</a></li>
            <li><a href="#children" className="hover:text-primary transition-colors">11. Children's Privacy</a></li>
            <li><a href="#policy-changes" className="hover:text-primary transition-colors">12. Policy Changes</a></li>
            <li><a href="#data-sharing" className="hover:text-primary transition-colors">13. When We Share Data</a></li>
            <li><a href="#contact" className="hover:text-primary transition-colors">14. Contact Us</a></li>
          </ol>
        </nav>

        {/* Section 1: Who We Are */}
        <section id="who-we-are" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">1. Who We Are</h2>
          <div className="space-y-3 text-muted-foreground">
            <p><strong>Company Name:</strong> Oldowan</p>
            <p><strong>What We Do:</strong> We provide an AI-powered executive assistant that helps you manage tasks, schedule events, and stay organized.</p>
            <p><strong>Contact:</strong> <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a></p>
            <p><strong>Effective Date:</strong> October 13, 2025</p>
            <p>We are the data controller for your personal information. This means we decide how and why your data is processed.</p>
          </div>
        </section>

        {/* Section 2: Information We Collect */}
        <section id="information-we-collect" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">2. What Information We Collect</h2>
          
          <div className="space-y-6 text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Information You Give Us</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your name, email address, and password when you create an account</li>
                <li>Your Google profile information (name, email, profile picture) if you sign in with Google</li>
                <li>Messages you type to the AI assistant</li>
                <li>Tasks and calendar events you want to create</li>
                <li>Payment information if you upgrade (processed securely by Stripe - we don't store card numbers)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Information We Collect Automatically</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your device type and web browser</li>
                <li>When you use the app and what features you use</li>
                <li>Your IP address and general location (country/city level)</li>
                <li>Technical logs for troubleshooting</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Information from Services You Connect</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Google Calendar:</strong> Event titles, descriptions, times, dates, locations, and attendees</li>
                <li><strong>Todoist:</strong> Your tasks, projects, sections, labels, and comments (when you connect your account)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">AI Conversation Data</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>What you ask the AI assistant</li>
                <li>What the AI responds</li>
                <li>Actions the AI takes on your behalf (like creating a task or scheduling an event)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: How We Use Your Information */}
        <section id="how-we-use" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
          
          <div className="space-y-6 text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">What We Do</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Make the AI assistant work and respond to your requests</li>
                <li>Create tasks in Todoist when you ask</li>
                <li>Schedule, update, or delete calendar events when you request it</li>
                <li>Remember your preferences and settings</li>
                <li>Fix problems and improve the app</li>
                <li>Keep your account secure and prevent fraud</li>
                <li>Provide customer support when you need help</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">What We DON'T Do</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>❌ Sell your data to anyone</li>
                <li>❌ Show you ads based on your data</li>
                <li>❌ Train AI models on your conversations or personal data</li>
                <li>❌ Share your data with other companies without your permission</li>
                <li>❌ Use your data for purposes you didn't agree to</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4: Third Parties */}
        <section id="third-parties" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">4. Who Gets Your Data</h2>
          
          <div className="space-y-6 text-muted-foreground">
            <p>We use trusted third-party services to run our app. Here's who has access to what:</p>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Services We Use to Run the App</h3>
              <ul className="space-y-3 ml-4">
                <li>
                  <strong>Convex:</strong> Stores your data securely in the United States
                </li>
                <li>
                  <strong>Clerk:</strong> Handles secure login and authentication
                </li>
                <li>
                  <strong>Anthropic (Claude AI):</strong> Powers the AI conversations
                  <ul className="list-disc list-inside mt-1 ml-4 text-sm">
                    <li>Your messages are sent to Anthropic to generate AI responses</li>
                    <li>They don't use your data to train their AI models</li>
                    <li>Privacy policy: <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">anthropic.com/privacy</a></li>
                  </ul>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Services You Choose to Connect</h3>
              <ul className="space-y-3 ml-4">
                <li>
                  <strong>Google Calendar:</strong> When you authorize us, we can read and create calendar events
                  <ul className="list-disc list-inside mt-1 ml-4 text-sm">
                    <li>Privacy policy: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">policies.google.com/privacy</a></li>
                  </ul>
                </li>
                <li>
                  <strong>Todoist:</strong> When you connect it, we can read and create tasks
                  <ul className="list-disc list-inside mt-1 ml-4 text-sm">
                    <li>Privacy policy: <a href="https://doist.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">doist.com/privacy</a></li>
                  </ul>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Payment Processing</h3>
              <p><strong>Stripe:</strong> Processes payments securely (if you upgrade to a paid plan). We don't store your credit card numbers - Stripe handles that securely.</p>
            </div>
          </div>
        </section>

        {/* Section 5: Google Calendar - HIGHLIGHTED */}
        <section id="google-calendar" className="mb-12 scroll-mt-24">
          <div className="p-6 bg-accent/10 border-2 border-primary/30 rounded-lg space-y-4">
            <h2 className="text-2xl font-semibold">5. Google Calendar - Special Section</h2>
            
            <div className="space-y-6 text-muted-foreground">
              <div className="p-4 bg-card border border-border rounded-md">
                <p className="font-semibold text-foreground mb-2">Important Compliance Statement:</p>
                <p className="text-sm">
                  Oldowan's use and transfer of information received from Google APIs adheres to the{" "}
                  <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                    Google API Services User Data Policy
                  </a>, including the Limited Use requirements.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">What We Access from Your Google Calendar</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Event titles and descriptions</li>
                  <li>When events start and end (dates and times)</li>
                  <li>Who's invited to events</li>
                  <li>Where events are located</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">How We Use Your Calendar Data</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Create new calendar events when you ask the AI</li>
                  <li>Read your schedule to avoid conflicts when scheduling</li>
                  <li>Set reminders based on your events</li>
                  <li>Update or delete events when you request it</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">What We DON'T Do with Calendar Data</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>❌ We don't sell it to advertisers or anyone else</li>
                  <li>❌ We don't use it for marketing or showing ads</li>
                  <li>❌ We don't train AI models on your calendar events</li>
                  <li>❌ We don't let anyone read your calendar except:</li>
                  <ul className="list-disc list-inside mt-1 ml-8 text-sm">
                    <li>When you ask for customer support and give permission</li>
                    <li>If required by law (court order, subpoena)</li>
                    <li>To prevent fraud or abuse</li>
                  </ul>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">You're in Control</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>You can disconnect Google Calendar anytime in your account settings</li>
                  <li>When you disconnect, we delete your calendar tokens and stop accessing your calendar</li>
                  <li>You can revoke access through your Google Account settings at any time</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Data Security */}
        <section id="data-security" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">6. How We Protect Your Data</h2>
          
          <div className="space-y-3 text-muted-foreground">
            <p>We take security seriously and use industry-standard practices:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>All data is encrypted when traveling over the internet (HTTPS/TLS)</li>
              <li>Data is encrypted when stored in our database</li>
              <li>We use secure authentication (Clerk) to protect your account</li>
              <li>Only authorized systems can access your data</li>
              <li>We regularly monitor for security issues</li>
              <li>OAuth 2.0 security for third-party integrations</li>
            </ul>
            <p className="italic mt-4">
              <strong>Reality check:</strong> No system is 100% secure. While we use industry-standard practices to protect your information, we cannot guarantee absolute security. We continuously work to improve our security measures.
            </p>
          </div>
        </section>

        {/* Section 7: Data Retention */}
        <section id="data-retention" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">7. How Long We Keep Your Data</h2>
          
          <div className="space-y-3 text-muted-foreground">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>While you have an account:</strong> We keep your data so the app works properly</li>
              <li><strong>After you delete your account:</strong> All data permanently deleted within 90 days</li>
              <li><strong>Backups:</strong> Encrypted backups kept for 90 days for disaster recovery</li>
              <li><strong>When you disconnect an integration:</strong> Access tokens deleted immediately</li>
              <li><strong>Chat history:</strong> Kept until you manually delete conversations</li>
              <li><strong>Technical logs:</strong> Kept for 30-90 days for troubleshooting and security</li>
              <li><strong>Legal requirements:</strong> Data may be kept longer if required by law</li>
            </ul>
          </div>
        </section>

        {/* Section 8: Your Rights */}
        <section id="your-rights" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">8. Your Rights</h2>
          
          <div className="space-y-6 text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Everyone Can:</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>See what data we have about you</li>
                <li>Export your chat history and data</li>
                <li>Delete your account and all associated data</li>
                <li>Disconnect Google Calendar or Todoist anytime</li>
                <li>Ask us to fix incorrect information</li>
                <li>Email us with questions about your data</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">If You're in Europe (GDPR Rights):</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Right to access your personal data</li>
                <li>Right to correct inaccurate data</li>
                <li>Right to delete your data ("right to be forgotten")</li>
                <li>Right to download your data in a portable format</li>
                <li>Right to object to how we process your data</li>
                <li>Right to restrict processing</li>
                <li>Right to complain to your country's data protection authority</li>
              </ul>
              <p className="mt-2">Data transfers from EU/UK to the US are protected by Standard Contractual Clauses approved by the European Commission.</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">If You're in California (CCPA Rights):</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Right to know what personal information we collect</li>
                <li>Right to delete your personal information</li>
                <li>Right to opt-out of data sales (we don't sell data, so this doesn't apply)</li>
                <li>Right to non-discrimination for exercising your privacy rights</li>
              </ul>
            </div>

            <div className="p-4 bg-card border border-border rounded-md">
              <h3 className="text-lg font-semibold text-foreground mb-2">To Exercise Your Rights:</h3>
              <p>Email us at <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a> with the subject "Privacy Request"</p>
              <p className="mt-2">We'll respond within 30 days after verifying your identity.</p>
            </div>
          </div>
        </section>

        {/* Section 9: Cookies */}
        <section id="cookies" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">9. Cookies</h2>
          
          <div className="space-y-4 text-muted-foreground">
            <p>We only use essential cookies that are required for the app to work:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Session cookies:</strong> Keep you logged in (required for the app to work)</li>
              <li><strong>Authentication cookies:</strong> Secure login managed by Clerk</li>
            </ul>
            <p className="font-semibold mt-4 text-foreground">We DON'T use:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>❌ Advertising cookies</li>
              <li>❌ Tracking cookies</li>
              <li>❌ Analytics cookies</li>
              <li>❌ Third-party marketing cookies</li>
            </ul>
          </div>
        </section>

        {/* Section 10: International Users */}
        <section id="international" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">10. International Users</h2>
          
          <div className="space-y-3 text-muted-foreground">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Our servers are located in the United States</li>
              <li>If you access our services from outside the US, your data will be transferred to and processed in the US</li>
              <li>For European and UK users: Data transfers comply with GDPR requirements using Standard Contractual Clauses</li>
              <li>We ensure adequate safeguards for all international data transfers</li>
            </ul>
          </div>
        </section>

        {/* Section 11: Children */}
        <section id="children" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">11. Children's Privacy</h2>
          
          <div className="space-y-3 text-muted-foreground">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Our app is not designed for or directed at children under 13 years of age</li>
              <li>We do not knowingly collect personal information from children under 13</li>
              <li>If you're a parent or guardian and believe your child has provided us with information, please contact us immediately</li>
              <li>We will promptly delete any child's data if we discover it</li>
              <li>We comply with the Children's Online Privacy Protection Act (COPPA)</li>
            </ul>
          </div>
        </section>

        {/* Section 12: Policy Changes */}
        <section id="policy-changes" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">12. Policy Changes</h2>
          
          <div className="space-y-3 text-muted-foreground">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>We may update this privacy policy from time to time</li>
              <li>If we make significant changes, we'll notify you via email or in-app notification</li>
              <li>Check the "Last Updated" date at the top of this page</li>
              <li>Continuing to use the app after changes means you accept the updated policy</li>
              <li>We encourage you to review this policy periodically</li>
            </ul>
          </div>
        </section>

        {/* Section 13: Data Sharing */}
        <section id="data-sharing" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">13. When We Share Data</h2>
          
          <div className="space-y-3 text-muted-foreground">
            <p>We may share your information only in these specific situations:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Legal requirements:</strong> When required by law, court order, subpoena, or government request</li>
              <li><strong>Protect rights:</strong> To enforce our terms of service, investigate violations, or stop fraud</li>
              <li><strong>Safety:</strong> To protect the safety of you, other users, or the public from harm</li>
              <li><strong>Business transfer:</strong> If we sell the company or merge with another company (we'll notify you first)</li>
              <li><strong>With your permission:</strong> Any other time you explicitly say it's okay</li>
            </ul>
            <p className="mt-4">We will notify you about legal data requests unless prohibited by law.</p>
          </div>
        </section>

        {/* Section 14: Contact */}
        <section id="contact" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">14. Contact Us</h2>
          
          <div className="space-y-4 text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Privacy Questions:</h3>
              <p>Email: <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a></p>
              <p className="text-sm">Subject: "Privacy Inquiry"</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Data Requests (Access, Delete, Correct):</h3>
              <p>Email: <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a></p>
              <p className="text-sm">Subject: "Privacy Request"</p>
            </div>

            <div>
              <p><strong>Response Time:</strong> Within 30 days</p>
            </div>

            <div className="p-4 bg-card border border-border rounded-md mt-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">For EU/UK Users:</h3>
              <p>You have the right to lodge a complaint with your local supervisory authority if you believe we are not complying with data protection laws.</p>
            </div>
          </div>
        </section>

        <div className="border-t border-border pt-8 mb-12">
          <p className="text-sm text-muted-foreground text-center">
            This privacy policy was last updated on October 13, 2025. If you have any questions or concerns, please contact us at{" "}
            <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a>
          </p>
        </div>
      </main>
      
      <FooterSection />
    </div>
  );
}
