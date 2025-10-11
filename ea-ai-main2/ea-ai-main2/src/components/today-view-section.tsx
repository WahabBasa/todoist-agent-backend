import { Eye, Zap, Target, RefreshCw } from 'lucide-react'

export default function TodayViewSection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-12">
                <div className="mx-auto max-w-2xl space-y-6 text-center">
                    <h2 className="text-balance text-4xl font-semibold lg:text-5xl">
                        Your Entire Life, Distilled to "What Matters Today"
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        You have 87 things on your list. Your ADHD brain sees ALL 87 and shuts down. 
                        <span className="text-foreground font-medium"> Today View shows you 5-8 things. That's it.</span>
                    </p>
                </div>
                
                <div className="rounded-2xl border border-border bg-muted/30 p-6 md:p-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold">Today's Focus</div>
                                <div className="text-xs text-muted-foreground">5 items that need attention</div>
                            </div>
                            <div className="text-xs text-muted-foreground">Friday, Oct 11</div>
                        </div>
                        
                        <div className="space-y-2">
                            {[
                                { title: "Call mom about birthday dinner", time: "Before 6pm", urgent: true },
                                { title: "Review presentation slides", time: "Meeting at 2pm", urgent: true },
                                { title: "Dentist appointment - schedule", time: "Due this week", urgent: false },
                                { title: "Reply to client email", time: "Sent 2 days ago", urgent: false },
                                { title: "Grocery shopping", time: "Quick win", urgent: false }
                            ].map((task, index) => (
                                <div key={index} className={`bg-background border rounded-lg p-3 flex items-center gap-3 ${task.urgent ? 'border-primary/30' : ''}`}>
                                    <input type="checkbox" className="size-4" />
                                    <div className="flex-1">
                                        <div className="text-sm">{task.title}</div>
                                        <div className="text-xs text-muted-foreground">{task.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="pt-2 text-xs text-center text-muted-foreground">
                            82 other items safely tucked away until they matter
                        </div>
                    </div>
                </div>

                <div className="relative mx-auto grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Eye className="size-5 text-primary" />
                            <h3 className="text-sm font-semibold">Reduces Overwhelm</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            5-8 things, not 87. Your brain can actually process this.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="size-5 text-primary" />
                            <h3 className="text-sm font-semibold">Dopamine Hits</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Green checkmarks. Progress feeling. That momentum your ADHD brain craves.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Target className="size-5 text-primary" />
                            <h3 className="text-sm font-semibold">Smart Prioritization</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            AI surfaces what's urgent, what's quick wins, what's been waiting too long.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <RefreshCw className="size-5 text-primary" />
                            <h3 className="text-sm font-semibold">Adaptive Focus</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Changes throughout the day as you complete tasks and new priorities emerge.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
