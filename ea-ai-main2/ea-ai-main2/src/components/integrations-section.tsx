import { Calendar, ListTodo, Link2 } from 'lucide-react'

export default function IntegrationsSection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl px-6">
                <div className="relative rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                            backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                            backgroundSize: '40px 40px'
                        }}></div>
                    </div>
                    
                    <div className="relative z-10 p-8 md:p-16 space-y-12">
                        {/* Title Section */}
                        <div className="max-w-2xl mx-auto text-center space-y-4">
                            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                <Link2 className="size-4" />
                                <span>Seamless Integrations</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-semibold text-balance">
                                Works With Tools You Already Use
                            </h2>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Already have tasks in Todoist? Calendar events in Google? 
                                <span className="text-foreground font-medium"> Keep them.</span> Miller syncs with both.
                            </p>
                        </div>

                        {/* Integration Cards */}
                        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                            <div className="bg-background/80 backdrop-blur-sm border border-border rounded-2xl p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                                        <ListTodo className="size-6 text-red-500" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">Todoist</div>
                                        <div className="text-xs text-muted-foreground">Task Management</div>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Create, update, complete tasks across all your Todoist projects. 
                                    Miller works within your existing organization.
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="size-1.5 rounded-full bg-green-500"></div>
                                    <span>Two-way sync</span>
                                </div>
                            </div>

                            <div className="bg-background/80 backdrop-blur-sm border border-border rounded-2xl p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <Calendar className="size-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">Google Calendar</div>
                                        <div className="text-xs text-muted-foreground">Time Management</div>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Schedule events, view your calendar, manage appointments. 
                                    Miller understands your availability and time constraints.
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="size-1.5 rounded-full bg-green-500"></div>
                                    <span>Real-time sync</span>
                                </div>
                            </div>
                        </div>

                        {/* Bottom CTA */}
                        <div className="text-center pt-6">
                            <p className="text-sm text-muted-foreground">
                                Don't abandon your current system. <span className="text-foreground font-medium">Miller makes it actually work for you.</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
