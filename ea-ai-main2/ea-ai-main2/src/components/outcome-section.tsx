export default function OutcomeSection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl px-6">
                <h2 className="text-4xl font-semibold lg:text-5xl mb-12">
                    No More Uncertainty
                </h2>
                
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <p className="text-xl md:text-2xl leading-relaxed">
                            Know exactly what needs to get done.
                        </p>
                        <p className="text-base text-muted-foreground leading-relaxed">
                            That overwhelming feeling when you don't even know where to start? Miller helps you talk through it. 
                            Go back and forth until the fog clears and you see the actual next step.
                        </p>
                    </div>

                    <div className="border rounded-lg p-6 bg-muted/20">
                        <div className="space-y-3">
                            <div className="bg-background/50 rounded-lg p-3 border-l-2 border-primary">
                                <div className="text-xs font-medium text-muted-foreground mb-1">You</div>
                                <p className="text-sm">
                                    "Need to deal with mom's birthday"
                                </p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-3 border-l-2 border-primary/50">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Miller</div>
                                <p className="text-sm leading-relaxed">
                                    Is this the outcome you're aiming for: You've called mom and confirmed dinner plans for her birthday?
                                </p>
                            </div>
                            <div className="bg-background/50 rounded-lg p-3 border-l-2 border-primary">
                                <div className="text-xs font-medium text-muted-foreground mb-1">You</div>
                                <p className="text-sm">
                                    "Actually just need to figure out if she wants to do something or not"
                                </p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-3 border-l-2 border-primary/50">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Miller</div>
                                <p className="text-sm leading-relaxed">
                                    Got it. So done looks like: You've texted or called mom to ask if she'd like to celebrate her birthday together.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
