'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

export default function InteractiveDemo() {
    const [showDemo, setShowDemo] = useState(false)

    const demoResponse = {
        tasks: [
            {
                title: "MOM'S BIRTHDAY",
                outcome: "You've connected with your mom about her birthday, she feels appreciated, any plans are confirmed.",
                path: "Likely a call to check what she wants to do, or confirming dinner arrangements."
            },
            {
                title: "FIX PRESENTATION",
                outcome: "Your presentation is ready to deliver confidently - content polished, delivery rehearsed.",
                path: "Could be updating content, practicing, or getting feedback."
            },
            {
                title: "DENTIST",
                outcome: "Your 6-month cleaning is scheduled and on your calendar.",
                path: "Call the office to book an appointment."
            }
        ]
    }

    return (
        <section className="py-16 md:py-24 bg-background" id="demo">
            <div className="mx-auto max-w-4xl px-6">
                <div className="text-center space-y-6">
                    <h2 className="text-3xl md:text-4xl font-semibold">
                        Try It Right Now <span className="text-muted-foreground">(60 Seconds)</span>
                    </h2>
                    
                    <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Think about the 3 most chaotic things on your mind right now. 
                        The stuff that's been buzzing in the background all day.
                    </p>

                    {!showDemo && (
                        <div className="pt-4">
                            <div className="relative">
                                <textarea
                                    className="w-full min-h-32 p-4 rounded-lg border border-border bg-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    placeholder="e.g., mom's birthday thing, fix that presentation, dentist appointment maybe?"
                                    disabled
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/90 rounded-lg backdrop-blur-sm">
                                    <Button
                                        onClick={() => setShowDemo(true)}
                                        size="lg"
                                        className="gap-2"
                                    >
                                        <Sparkles className="size-4" />
                                        Show Me What "Done" Looks Like
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showDemo && (
                        <div className="pt-6 space-y-6 text-left">
                            <Card className="p-6 bg-muted/30 border-primary/20">
                                <p className="text-sm text-muted-foreground mb-4 italic">
                                    You typed: "mom's birthday thing, fix that presentation, dentist appointment maybe?"
                                </p>
                                
                                <div className="space-y-6">
                                    <p className="font-semibold flex items-center gap-2">
                                        <Sparkles className="size-4 text-primary" />
                                        Let me paint what "handled" looks like for each:
                                    </p>

                                    {demoResponse.tasks.map((task, index) => (
                                        <div key={index} className="pl-4 border-l-2 border-primary/30 space-y-2">
                                            <h4 className="font-semibold text-sm">{index + 1}. {task.title}</h4>
                                            <div className="space-y-1 text-sm">
                                                <p>
                                                    <span className="text-muted-foreground">Done looks like:</span>{' '}
                                                    <span>{task.outcome}</span>
                                                </p>
                                                <p>
                                                    <span className="text-muted-foreground">Path there:</span>{' '}
                                                    <span>{task.path}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <Button variant="outline" size="sm" className="text-xs h-7">
                                                    Refine
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                                                    <span>Looks right</span>
                                                    <span className="text-primary">✓</span>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    <p className="text-sm text-muted-foreground pt-2">
                                        How'd I do? Click 'Refine' on any that need tweaking.
                                    </p>
                                </div>
                            </Card>

                            <div className="text-center pt-4 space-y-4">
                                <p className="text-base italic text-muted-foreground leading-relaxed">
                                    Feel that? That tiny bit of relief? That's TaskAI working with your ADHD brain.
                                </p>
                                <p className="text-lg font-semibold">
                                    Now imagine that feeling, every single day, for everything on your mind.
                                </p>
                                <Button
                                    onClick={() => window.location.href = '/#auth'}
                                    size="lg"
                                    className="mt-4"
                                >
                                    Start Your Brain Dump →
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
