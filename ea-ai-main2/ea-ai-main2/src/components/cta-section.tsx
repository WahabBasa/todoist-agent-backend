import { Button } from '@/components/ui/button'
import { ArrowRight, Check } from 'lucide-react'

export default function CTASection() {
    const features = [
        "Unlimited brain dumps (capture chaos anytime)",
        "Conversational AI that clarifies your thoughts",
        "Planning mode to organize your week",
        "Reviewing mode to reflect on progress",
        "Quick pulse on current work",
        "Todoist + Google Calendar sync",
    ]

    return (
        <section className="py-16 md:py-24">
            <div className="mx-auto max-w-3xl px-6">
                <div className="relative rounded-2xl border border-primary shadow-lg shadow-primary/10 bg-card p-6 md:p-8 text-center overflow-hidden">
                    {/* "All Features Included" badge */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                        All Features Included
                    </div>
                    
                    <div className="relative z-10 space-y-6">
                        <div className="space-y-4">
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-balance">
                                Ready to Get Started?
                            </h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                Start using Miller today and finally feel in control of your work.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-center mb-2">
                                <span className="text-5xl font-bold">$20</span>
                                <span className="text-muted-foreground text-xl ml-2">/ month</span>
                            </div>
                        </div>

                        <Button 
                            asChild
                            size="lg"
                            className="gap-2 px-8 text-lg w-full sm:w-auto">
                            <a href="/auth">
                                Get Started Now
                                <ArrowRight className="size-4" />
                            </a>
                        </Button>

                        <div className="pt-6 space-y-3 max-w-md mx-auto">
                            {features.map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-left">
                                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                    <span className="text-sm">{feature}</span>
                                </div>
                            ))}
                        </div>

                        <p className="text-sm text-muted-foreground pt-4">
                            Cancel anytime • No contracts
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
