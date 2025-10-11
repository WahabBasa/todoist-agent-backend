export default function FooterSection() {
    const links = [
        { title: 'Resources', href: '/resources' },
        { title: 'Pricing', href: '/pricing' },
        { title: 'Privacy', href: '/privacy' },
        { title: 'Contact', href: 'mailto:AtheA.hab@gmail.com' },
    ]

    return (
        <footer className="py-16 md:py-32 border-t border-border">
            <div className="mx-auto max-w-5xl px-6">
                <a
                    href="/"
                    aria-label="go home"
                    className="mx-auto block size-fit">
                    <div className="w-22 h-22 flex items-center justify-center mx-auto">
                        <img src="/oldowan-logo.png" alt="Oldowan" className="w-22 h-22 object-contain" />
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
                
                <span className="text-muted-foreground block text-center text-sm"> © {new Date().getFullYear()} Oldowan, All rights reserved</span>
            </div>
        </footer>
    )
}
