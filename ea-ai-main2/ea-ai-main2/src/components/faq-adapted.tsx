'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function FAQSection() {
    const faqItems = [
        {
            id: 'item-1',
            question: 'How is Miller different?',
            answer: 'Miller does the hard work FOR you. You don\'t categorize, prioritize, or organize anything. Just talk—Miller clarifies vague thoughts into clear outcomes, helps you see what matters today, and tracks everything so nothing slips through. You think out loud, Miller handles the rest.',
        },
        {
            id: 'item-2',
            question: 'What if I forget to check Miller?',
            answer: 'That\'s the point—you won\'t need to "remember" to check it. Brain dump anytime via chat (always accessible). Miller shows you what needs attention without overwhelming lists. Miller nudges you about stalled items ("Been 5 days since you heard from client X"). The system works with you, not against you.',
        },
        {
            id: 'item-3',
            question: 'Can I cancel anytime?',
            answer: 'Yes. Cancel anytime, no questions asked. No annual commitment. No locked-in contracts. Month-to-month. We\'re not trying to trap you. If it doesn\'t work for you, we don\'t deserve your money.',
        },

    ]

    return (
        <section className="py-16 md:py-24">
            <div className="mx-auto max-w-5xl px-4 md:px-6">
                <div className="mx-auto max-w-xl text-center">
                    <h2 className="text-balance text-3xl font-bold md:text-4xl lg:text-5xl">Questions You're Probably Asking</h2>
                    <p className="text-muted-foreground mt-4 text-balance">Here's what you need to know.</p>
                </div>

                <div className="mx-auto mt-12 max-w-2xl">
                    <Accordion
                        type="single"
                        collapsible
                        className="bg-card ring-muted w-full rounded-2xl border px-8 py-3 shadow-sm ring-4 dark:ring-0">
                        {faqItems.map((item) => (
                            <AccordionItem
                                key={item.id}
                                value={item.id}
                                className="border-dashed">
                                <AccordionTrigger className="cursor-pointer text-base hover:no-underline text-left">
                                    {item.question}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <p className="text-base leading-relaxed text-muted-foreground">{item.answer}</p>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>


                </div>
            </div>
        </section>
    )
}
