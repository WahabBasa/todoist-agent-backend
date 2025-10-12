import { BarChart, Bell } from 'lucide-react'

export default function TrackingSection() {
    return (
        <section className="py-16 md:py-32 bg-muted/30">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-12">
                <div className="grid gap-8 md:grid-cols-2 md:gap-12">
                    <div className="space-y-6">
                        <h2 className="text-4xl font-semibold lg:text-5xl">
                            Everything Captured, Nothing Forgotten
                        </h2>
                        
                        <p className="text-lg leading-relaxed">
                            That thing you mentioned 3 weeks ago? <span className="font-semibold">AI remembers.</span>
                        </p>
                        
                        <p className="text-muted-foreground leading-relaxed">
                            That random thought at 11pm? Still there. That "I'll deal with this later" from Tuesday? Tracked.
                        </p>

                        <div className="space-y-6 pt-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <BarChart className="size-5 text-primary" />
                                    <h3 className="text-base font-semibold">Weekly Pulse</h3>
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    See what's moving forward, what's stalled, what's waiting on others. AI shows you: 
                                    "Here's what's alive right now. Here's what needs a nudge."
                                </p>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Bell className="size-5 text-primary" />
                                    <h3 className="text-base font-semibold">Automatic Tracking</h3>
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    You're not maintaining this list. You're not reviewing everything manually. AI does it. 
                                    That constant background anxiety of "What am I forgetting?" Gone.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="rounded-2xl border border-border bg-background p-6 space-y-6">
                            <div>
                                <div className="text-sm font-semibold mb-4">📊 Your Weekly Pulse</div>
                                
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium">Moving Forward</span>
                                            <span className="text-primary font-semibold">3 projects</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-3/4"></div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium">Waiting on Others</span>
                                            <span className="text-amber-500 font-semibold">2 items</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 w-1/4"></div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            • Client feedback (4 days)
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium">Completed This Week</span>
                                            <span className="text-green-500 font-semibold">12 tasks</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Look at that progress! 🎉
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-border">
                                        <div className="text-xs text-muted-foreground">
                                            1 idea captured but not acted on yet
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-xs text-center text-muted-foreground pt-2">
                                Your brain finally believes the system is holding everything
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
