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
        <p className="text-sm text-muted-foreground mb-8">Last Updated: October 18, 2025</p>

        {/* Table of Contents */}
        <nav className="mb-12 p-6 bg-card border border-border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#who-we-are" className="hover:text-primary transition-colors">1. Who We Are</a></li>
            <li><a href="#information-we-collect" className="hover:text-primary transition-colors">2. What Information We Collect</a></li>
            <li><a href="#how-we-use" className="hover:text-primary transition-colors">3. How We Use Your Information</a></li>
            <li><a href="#third-parties" className="hover:text-primary transition-colors">4. Who Gets Your Data</a></li>
            <li><a href="#oauth-scopes" className="hover:text-primary transition-colors">5. OAuth Scopes and Connected Services</a></li>
            <li><a href="#data-storage" className="hover:text-primary transition-colors">6. Data Storage Policy</a></li>
            <li><a href="#google-calendar" className="hover:text-primary transition-colors">7. Google Calendar - Special Section</a></li>
            <li><a href="#revocation" className="hover:text-primary transition-colors">8. How to Disconnect Connected Services</a></li>
            <li><a href="#policy-changes" className="hover:text-primary transition-colors">9. Policy Changes</a></li>
            <li><a href="#contact" className="hover:text-primary transition-colors">10. Contact Us</a></li>
          </ol>
        </nav>

        {/* Section 1: Who We Are */}
        <section id="who-we-are" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">1. Who We Are</h2>
          <div className="space-y-3 text-muted-foreground">
            <p><strong>Company Name:</strong> Oldowan</p>
            <p><strong>What We Do:</strong> We provide an AI-powered executive assistant that helps you manage tasks, schedule events, and stay organized.</p>
            <p><strong>Contact:</strong> <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a></p>
            <p><strong>Effective Date:</strong> October 18, 2025</p>
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
                <li>Payment information if you upgrade to a paid plan (we don't store full card numbers)</li>
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
            <p>We use a small number of trusted service providers to run the app. We keep this list minimal and share only what is necessary.</p>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Services We Use to Run the App</h3>
              <ul className="space-y-3 ml-4">
                <li>
                  <strong>Our hosting and database provider:</strong> Stores your data securely. We limit access to what is needed for the app to work.
                </li>
                <li>
                  <strong>Our authentication provider:</strong> Handles secure login and account sessions.
                </li>
                <li>
                  <strong>Our AI service:</strong> Generates replies to your messages and helps draft content. We send only the minimum context needed to answer your request and do not allow use for advertising or model training.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Services You Choose to Connect</h3>
              <ul className="space-y-3 ml-4">
                <li>
                  <strong>Google Calendar:</strong> When you authorize us, we can read your calendar and create or change events you request.
                  <ul className="list-disc list-inside mt-1 ml-4 text-sm">
                    <li>We do not store Google Calendar event content. We only keep the tokens needed to connect your account, and we protect those tokens at rest.</li>
                    <li>Privacy policy: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">policies.google.com/privacy</a></li>
                  </ul>
                </li>
                <li>
                  <strong>Todoist:</strong> When you connect it, we can read and create tasks you request.
                  <ul className="list-disc list-inside mt-1 ml-4 text-sm">
                    <li>We do not store Todoist task content. We fetch tasks on-demand for AI analysis and discard them after use.</li>
                    <li>Privacy policy: <a href="https://doist.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">doist.com/privacy</a></li>
                  </ul>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Payment Processing</h3>
              <p>Payments are processed securely through a third-party payment provider. We do not store your full credit card numbers.</p>
            </div>
          </div>
        </section>

        {/* Section 5: OAuth Scopes */}
        <section id="oauth-scopes" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">5. OAuth Scopes and Connected Services</h2>
          
          <div className="space-y-6 text-muted-foreground">
            <p className="text-sm bg-accent/10 p-3 rounded border border-primary/30">
              When you connect your Google Calendar or Todoist accounts, we request specific permissions (called "scopes") to perform actions on your behalf. Below explains exactly what we request and why.
            </p>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Google Calendar Scopes</h3>
              <div className="space-y-4">
                <div className="p-4 bg-card border border-border rounded-md">
                  <p className="font-semibold text-foreground mb-1">calendar.events</p>
                  <p className="text-sm mb-2"><strong>Classification:</strong> Restricted scope</p>
                  <p className="text-sm mb-2"><strong>What it allows:</strong> Create, read, edit, and delete calendar events</p>
                  <p className="text-sm"><strong>Why we need it:</strong> So the AI assistant can schedule meetings, update events, and avoid calendar conflicts when you request it</p>
                </div>
                <div className="p-4 bg-card border border-border rounded-md">
                  <p className="font-semibold text-foreground mb-1">calendar.readonly</p>
                  <p className="text-sm mb-2"><strong>Classification:</strong> Restricted scope</p>
                  <p className="text-sm mb-2"><strong>What it allows:</strong> Read your calendar events and free/busy times (no write access)</p>
                  <p className="text-sm"><strong>Why we need it:</strong> To check your availability before suggesting meeting times and avoid scheduling conflicts</p>
                </div>
                <div className="p-4 bg-card border border-border rounded-md">
                  <p className="font-semibold text-foreground mb-1">calendar.settings.readonly</p>
                  <p className="text-sm mb-2"><strong>Classification:</strong> Restricted scope</p>
                  <p className="text-sm mb-2"><strong>What it allows:</strong> Read your timezone and calendar format preferences</p>
                  <p className="text-sm"><strong>Why we need it:</strong> To display suggested times in your timezone and respect your calendar preferences</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Todoist Scopes</h3>
              <div className="space-y-4">
                <div className="p-4 bg-card border border-border rounded-md">
                  <p className="font-semibold text-foreground mb-1">data:read_write</p>
                  <p className="text-sm mb-2"><strong>What it allows:</strong> Read and modify your tasks, projects, sections, and labels</p>
                  <p className="text-sm"><strong>Why we need it:</strong> So the AI can understand your task structure and help organize your work</p>
                </div>
                <div className="p-4 bg-card border border-border rounded-md">
                  <p className="font-semibold text-foreground mb-1">task:add</p>
                  <p className="text-sm mb-2"><strong>What it allows:</strong> Create new tasks</p>
                  <p className="text-sm"><strong>Why we need it:</strong> So the AI can create tasks when you ask it to add something to your to-do list</p>
                </div>
                <div className="p-4 bg-card border border-border rounded-md">
                  <p className="font-semibold text-foreground mb-1">data:delete</p>
                  <p className="text-sm mb-2"><strong>What it allows:</strong> Delete tasks and projects</p>
                  <p className="text-sm"><strong>Why we need it:</strong> So the AI can remove completed or cancelled tasks when you request it</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-accent/10 border border-primary/30 rounded-md">
              <h3 className="text-lg font-semibold text-foreground mb-2">How We Use This Data</h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>All requested data is fetched on-demand from Google Calendar or Todoist</li>
                <li>We use it only to pass to the AI assistant for analysis and to display results to you</li>
                <li>Immediately after use, this data is discarded and not retained</li>
                <li>No calendar events, tasks, or personal data are stored in our database</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 6: Data Storage Policy */}
        <section id="data-storage" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">6. Data Storage Policy</h2>
          
          <div className="space-y-6 text-muted-foreground">
            <div className="p-4 bg-accent/10 border-2 border-primary/30 rounded-lg">
              <h3 className="text-lg font-semibold text-foreground mb-3">We DO NOT Store</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your calendar events from Google Calendar</li>
                <li>Your task lists from Todoist</li>
                <li>Your contact information from connected services</li>
                <li>Your email data or personal files</li>
                <li>Any sensitive data from connected services</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">How Connected Data is Handled</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Session Data:</strong> Fetched in real-time during your conversation, then immediately discarded</li>
                <li><strong>OAuth Tokens:</strong> Stored securely to maintain the connection; deleted when you disconnect</li>
                <li><strong>Conversation Logs:</strong> Your chat messages are stored to show your conversation history</li>
                <li><strong>Usage Analytics:</strong> We may log basic anonymized metrics (e.g., "user connected Google Calendar") but never specific event or task details</li>
              </ul>
            </div>

            <div className="p-4 bg-card border border-border rounded-md">
              <h3 className="text-lg font-semibold text-foreground mb-2">Why This Matters</h3>
              <p>By not storing your connected data, we minimize risk and ensure your sensitive information stays where it belongs—in your own Google Calendar and Todoist accounts. This design also means:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Your data is never included in backups</li>
                <li>We cannot sell it, analyze it, or share it with third parties</li>
                <li>You have complete control—disconnect anytime with immediate effect</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 7: Google Calendar - HIGHLIGHTED */}
        <section id="google-calendar" className="mb-12 scroll-mt-24">
          <div className="p-6 bg-accent/10 border-2 border-primary/30 rounded-lg space-y-4">
            <h2 className="text-2xl font-semibold">7. Google Calendar - Special Section</h2>
            
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

              <div className="p-4 bg-card border border-border rounded-md space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Scopes We Request</h3>
                <ul className="list-disc list-inside ml-4">
                  <li><code>https://www.googleapis.com/auth/calendar.events</code> – lets us create or change events when you ask</li>
                  <li><code>https://www.googleapis.com/auth/calendar.readonly</code> – lets us read your calendars to avoid conflicts</li>
                  <li><code>https://www.googleapis.com/auth/calendar.settings.readonly</code> – lets us read your time zone and calendar settings</li>
                </ul>
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

              <div className="p-4 bg-card border border-border rounded-md space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Limited Use Commitments</h3>
                <ul className="list-disc list-inside ml-4">
                  <li>We use your Google Calendar data only to provide features you asked for and that are visible in the app.</li>
                  <li>We do not sell your Google data or use it for ads, retargeting, or interest‑based advertising.</li>
                  <li>We do not allow humans to read your Google data unless you ask for support, we need to investigate abuse or security issues, or the law requires it.</li>
                  <li>We do not combine your Google Calendar data with unrelated personal data to identify you, except as needed to deliver the features you requested.</li>
                </ul>
              </div>

              <div className="p-4 bg-card border border-border rounded-md space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Data Handling & Storage for Google Data</h3>
                <ul className="list-disc list-inside ml-4">
                  <li><strong>No Event Storage:</strong> We do not store event details from your Google Calendar in our database. We fetch them when needed during your session and immediately discard them after use.</li>
                  <li><strong>Token Protection:</strong> We only store the OAuth tokens and minimal identifiers needed to connect your account. These tokens are protected and encrypted at rest.</li>
                  <li><strong>Disconnection:</strong> If you disconnect Google Calendar in the app, we delete the stored tokens and stop access. You can also revoke access at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">myaccount.google.com/permissions</a>.</li>
                </ul>
              </div>

              <div className="p-4 bg-card border border-border rounded-md space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Subprocessors</h3>
                <p>To complete your requests (for example, to draft a meeting), we may send the minimum calendar context needed to our AI service to generate a response. That service is not allowed to use your data for advertising or training and can only use it to provide the requested result.</p>
              </div>

              <div className="p-4 bg-card border border-border rounded-md space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Transfers in Business Transactions</h3>
                <p>If there is a merger, acquisition, or sale of assets, we will ask for your clear permission before transferring any Google Calendar data. If you do not give permission, we will delete that Google data instead of transferring it.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8: Revocation Instructions */}
        <section id="revocation" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">8. How to Disconnect Connected Services</h2>
          
          <div className="space-y-6 text-muted-foreground">
            <p className="text-sm bg-accent/10 p-3 rounded border border-primary/30">
              You have complete control over which services you connect. You can disconnect anytime, and we'll immediately stop accessing your data.
            </p>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Disconnect from Within Oldowan</h3>
              <div className="space-y-4">
                <div className="p-4 bg-card border border-border rounded-md">
                  <h4 className="font-semibold text-foreground mb-2">Google Calendar</h4>
                  <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
                    <li>Go to Settings in the app</li>
                    <li>Click on "Connected Apps" or "Integrations"</li>
                    <li>Find Google Calendar</li>
                    <li>Click "Disconnect" or "Remove"</li>
                    <li>Confirm the disconnection</li>
                  </ol>
                  <p className="text-xs mt-3">Effect: Immediate. We delete your calendar tokens and stop accessing Google Calendar.</p>
                </div>

                <div className="p-4 bg-card border border-border rounded-md">
                  <h4 className="font-semibold text-foreground mb-2">Todoist</h4>
                  <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
                    <li>Go to Settings in the app</li>
                    <li>Click on "Connected Apps" or "Integrations"</li>
                    <li>Find Todoist</li>
                    <li>Click "Disconnect" or "Remove"</li>
                    <li>Confirm the disconnection</li>
                  </ol>
                  <p className="text-xs mt-3">Effect: Immediate. We delete your Todoist tokens and stop accessing your tasks.</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Additional Revocation via Third-Party Services</h3>
              <div className="space-y-4">
                <div className="p-4 bg-card border border-border rounded-md">
                  <h4 className="font-semibold text-foreground mb-2">Revoke Google Calendar Access</h4>
                  <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
                    <li>Go to <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">myaccount.google.com</a></li>
                    <li>Click "Security" in the left sidebar</li>
                    <li>Scroll down to "Your apps and websites"</li>
                    <li>Find "Oldowan" in the list</li>
                    <li>Click it, then click "Remove Access"</li>
                  </ol>
                  <p className="text-xs mt-3">Effect: Google immediately revokes our access. We can no longer read or modify your calendar.</p>
                </div>

                <div className="p-4 bg-card border border-border rounded-md">
                  <h4 className="font-semibold text-foreground mb-2">Revoke Todoist Access</h4>
                  <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
                    <li>Go to <a href="https://todoist.com/settings" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">todoist.com/settings</a></li>
                    <li>Click "Integrations" or "Connected Apps"</li>
                    <li>Find "Oldowan" in the list</li>
                    <li>Click "Disconnect" or the trash icon</li>
                  </ol>
                  <p className="text-xs mt-3">Effect: Todoist immediately revokes our access. We can no longer read or modify your tasks.</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-accent/10 border border-primary/30 rounded-md">
              <h3 className="text-lg font-semibold text-foreground mb-2">What Happens When You Disconnect</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We immediately delete your OAuth tokens</li>
                <li>We stop all access to that service's data</li>
                <li>No residual data remains in our system</li>
                <li>You can reconnect anytime by going through authorization again</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 9: Policy Changes */}
        <section id="policy-changes" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">9. Policy Changes</h2>
          
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

        {/* Section 10: Contact */}
        <section id="contact" className="space-y-4 mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">10. Contact Us</h2>
          
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
            This privacy policy was last updated on October 18, 2025. If you have any questions or concerns, please contact us at{" "}
            <a href="mailto:AtheA.hab@gmail.com" className="text-primary underline hover:text-primary/80">AtheA.hab@gmail.com</a>
          </p>
        </div>
      </main>
      
      <FooterSection />
    </div>
  );
}
