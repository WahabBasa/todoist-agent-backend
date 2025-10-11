export default function FocusSection() {
    return (
        <section className="py-16 md:py-32 bg-muted/30">
            <div className="mx-auto max-w-5xl px-6">
                <h2 className="text-4xl font-semibold lg:text-5xl mb-12">
                    Always Stay on Top of Things
                </h2>
                
                <div className="grid md:grid-cols-2 gap-12 items-start">
                    <div className="space-y-6">
                        <p className="text-xl md:text-2xl leading-relaxed">
                            Ask Miller anything about your work.
                        </p>
                        <p className="text-base text-muted-foreground leading-relaxed">
                            No digging through lists. No second-guessing what you forgot. Just ask and get instant clarity on what's happening, what's waiting, and what's done.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* Example Query 1 */}
                        <div className="border rounded-lg p-4 bg-background">
                            <div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary mb-3">
                                <p className="text-sm">
                                    "How does my week look?"
                                </p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-3 border-l-2 border-primary/50">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    You have 3 urgent items today, 5 things due this week, and 2 items waiting on others. Your Tuesday is packed.
                                </p>
                            </div>
                        </div>

                        {/* Example Query 2 */}
                        <div className="border rounded-lg p-4 bg-background">
                            <div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary mb-3">
                                <p className="text-sm">
                                    "What's been done this week?"
                                </p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-3 border-l-2 border-primary/50">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    You completed 12 tasks including the client proposal, team presentation, and dentist appointment.
                                </p>
                            </div>
                        </div>

                        {/* Example Query 3 */}
                        <div className="border rounded-lg p-4 bg-background">
                            <div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary mb-3">
                                <p className="text-sm">
                                    "What's pending?"
                                </p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-3 border-l-2 border-primary/50">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    2 items: Waiting on feedback from Sarah (4 days) and invoice payment from Acme Corp (sent last Monday).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
