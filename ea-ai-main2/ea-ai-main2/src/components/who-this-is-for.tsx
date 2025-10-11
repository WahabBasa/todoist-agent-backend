import { Check } from 'lucide-react'

export default function WhoThisIsFor() {
    const painPoints = [
        "You've tried 12+ productivity apps (Todoist, Notion, TickTick... the list goes on)",
        "They work great—for 3 days, then you forget to check them",
        "You have 47 browser tabs open as \"reminders\"",
        "Sunday nights = panic scrolling through messages wondering what you forgot",
        "Your partner/boss says \"you'd forget your head if it wasn't attached\"",
        "You KNOW what you need to do, you just... can't make yourself do it consistently"
    ]

    const whyDifferent = [
        "No rigid structure to forget about",
        "AI handles the \"thinking about thinking\" part",
        "Natural language—just talk like you're texting a friend",
        "Dopamine-friendly quick wins throughout the day",
        "Integrates with tools you already half-use (Todoist, Google Calendar)"
    ]

    return (
        <section className="py-16 md:py-32 bg-muted/30">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-12">
                <h2 className="relative z-10 max-w-2xl text-4xl font-semibold lg:text-5xl">
                    Built for Working Professionals with ADHD Brains
                </h2>
                
                <div className="grid gap-8 md:grid-cols-2 md:gap-12">
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <p className="text-lg font-medium">You're smart. Capable. Successful even. But...</p>
                            
                            <div className="space-y-3">
                                {painPoints.map((point, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <Check className="size-5 text-primary flex-shrink-0 mt-0.5" />
                                        <p className="text-muted-foreground text-sm leading-relaxed">{point}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-border">
                            <p className="text-base leading-relaxed">
                                <span className="font-semibold">Sound familiar?</span> That's not laziness. 
                                That's not lack of willpower.
                            </p>
                            <p className="text-muted-foreground mt-2 leading-relaxed">
                                That's your ADHD brain trying to use tools built for neurotypical brains.
                            </p>
                        </div>
                    </div>

                    <div className="relative space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-2xl font-semibold">TaskAI is different.</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                We're built specifically for how YOUR brain works:
                            </p>
                            
                            <div className="space-y-3 pt-2">
                                {whyDifferent.map((reason, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <div className="size-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                                        <p className="text-sm leading-relaxed">{reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-6">
                            <div className="p-6 rounded-lg border border-primary/20 bg-primary/5">
                                <p className="text-sm leading-relaxed italic">
                                    "Finally, a tool that doesn't make me feel broken for having ADHD. 
                                    It actually works WITH how my brain operates."
                                </p>
                                <p className="text-xs text-muted-foreground mt-3">
                                    — Working professional who's tried everything
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
