import { Brain, Sparkles, Zap, BarChart } from 'lucide-react'

export default function BenefitsSection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-12 px-6">
                <div className="relative z-10 grid items-center gap-4 md:grid-cols-2 md:gap-12">
                    <h2 className="text-4xl font-semibold">Your ADHD Brain, Finally Supported</h2>
                    <p className="max-w-sm sm:ml-auto">Four core capabilities that work WITH your brain, not against it. No rigid structure. No forgotten tasks. Just relief.</p>
                </div>
                
                <div className="relative mx-auto grid grid-cols-1 gap-x-3 gap-y-8 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Brain className="size-5 text-primary" />
                            <h3 className="text-base font-semibold">Just Talk, AI Remembers</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            That jumbled mess in your head? Get it ALL out. No categories. No formatting. No decisions yet. 
                            Just type or speak what's swirling around. Your AI assistant holds it so you don't have to. 
                            Remember the last time you finally wrote everything down and felt that weight lift? 
                            That feeling, available anytime, in 60 seconds.
                        </p>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-5 text-primary" />
                            <h3 className="text-base font-semibold">AI Shows You What "Done" Looks Like</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            You type: "Need to deal with mom's birthday thing." AI doesn't guess your details. 
                            Instead, it paints the picture: "Here's what I'm thinking this could look like when it's handled..." 
                            You refine. AI adjusts. The conversation took 90 seconds. That vague mental loop that's been 
                            draining your RAM for days? Now it's a clear destination with a path to get there.
                        </p>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="size-5 text-primary" />
                            <h3 className="text-base font-semibold">Your Entire Life, Distilled to "What Matters Today"</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            You have 87 things on your list. Your ADHD brain sees ALL 87 and shuts down. 
                            Today View shows you 5-8 things. That's it. The stuff that actually needs attention RIGHT NOW. 
                            Check one off? Instant dopamine hit. That green checkmark. That progress feeling. 
                            By 2pm, you've moved 6 things forward. That used to take you a week.
                        </p>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <BarChart className="size-5 text-primary" />
                            <h3 className="text-base font-semibold">Everything Captured, Nothing Forgotten</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            That thing you mentioned 3 weeks ago? AI remembers. That random thought at 11pm? Still there. 
                            Weekly Pulse shows you: what's moving forward, what's stalled, what's waiting on others. 
                            You're not maintaining this list. AI is. That constant background anxiety of "What am I forgetting?" 
                            Gone. Your brain finally believes the system is holding everything.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
