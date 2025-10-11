export default function FooterSection() {
    const links = [
        { title: 'Resources', href: '/resources' },
        { title: 'Pricing', href: '/pricing' },
        { title: 'Privacy', href: '/privacy' },
        { title: 'Terms', href: '#terms' },
        { title: 'Contact', href: 'mailto:support@example.com' },
    ]

    return (
        <footer className="py-16 md:py-32 border-t border-border">
            <div className="mx-auto max-w-5xl px-6">
                <a
                    href="/"
                    aria-label="go home"
                    className="mx-auto block size-fit">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center mx-auto">
                        <span className="text-primary-foreground font-semibold text-xl">T</span>
                    </div>
                </a>

                <div className="my-8 flex flex-wrap justify-center gap-6 text-sm">
                    {links.map((link, index) => (
                        <a
                            key={index}
                            href={link.href}
                            className="text-muted-foreground hover:text-primary block duration-150">
                            <span>{link.title}</span>
                        </a>
                    ))}
                </div>
                
                <span className="text-muted-foreground block text-center text-sm"> © {new Date().getFullYear()} TaskAI, All rights reserved</span>
            </div>
        </footer>
    )
}
