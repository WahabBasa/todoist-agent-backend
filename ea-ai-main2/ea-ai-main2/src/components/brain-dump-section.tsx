import { Brain } from 'lucide-react'

export default function BrainDumpSection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
                <h2 className="relative z-10 max-w-2xl text-4xl font-semibold lg:text-5xl">
                    Speak your mind. Miller will capture everything.
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 md:gap-12 lg:gap-24">
                    <div className="relative mb-6 sm:mb-0">
                        <div className="bg-muted/30 aspect-76/59 relative rounded-2xl border border-border p-6 flex items-center justify-center">
                            <div className="space-y-4 w-full">
                                <div className="flex items-center gap-3">
                                    <Brain className="size-8 text-primary" />
                                    <div className="text-sm text-muted-foreground">Natural Language Input</div>
                                </div>
                                <div className="space-y-2">
                                    <div className="bg-background border rounded-lg p-3 text-sm">
                                        "mom's birthday thing, fix presentation, dentist appointment maybe?"
                                    </div>
                                    <div className="text-xs text-muted-foreground text-right">↓ AI captures instantly</div>
                                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-1">
                                        <div className="text-xs font-semibold">3 items captured:</div>
                                        <div className="text-xs">✓ Mom's birthday</div>
                                        <div className="text-xs">✓ Presentation</div>
                                        <div className="text-xs">✓ Dentist appointment</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative space-y-6">
                        <p className="text-lg leading-relaxed">
                            That jumbled mess in your head? <span className="font-semibold">Get it ALL out.</span>
                        </p>
                        
                        <p className="text-muted-foreground leading-relaxed">
                            No categories. No formatting. No decisions yet. Just type or speak what's swirling around. 
                            Your AI assistant holds it so you don't have to.
                        </p>

                        <div className="pt-4 border-t border-border">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Brain className="size-4 text-primary" />
                                <span>Zero mental overhead. Just relief.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
