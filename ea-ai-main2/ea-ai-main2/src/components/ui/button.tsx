import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-design-md disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "border border-border transition-colors",
        destructive:
          "bg-red-50 text-red-700 border border-red-200 transition-colors",
        outline:
          "border border-border transition-colors",
        secondary:
          "border border-border transition-colors",
        ghost:
          "bg-transparent transition-colors",
        link: "underline-offset-4",
      },
      size: {
        default: "h-9 padding-secondary has-[>svg]:px-3",
        sm: "h-8 rounded-design-sm gap-tertiary padding-tertiary has-[>svg]:px-2.5",
        lg: "h-10 rounded-design-md padding-primary has-[>svg]:px-4",
        icon: "size-9",
      },
      attention: {
        primary: "text-primary gap-primary",
        secondary: "text-secondary gap-secondary", 
        tertiary: "text-tertiary gap-tertiary",
        utility: "text-utility gap-utility",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      attention: "secondary",
    },
  }
)

function Button({
  className,
  variant,
  size,
  attention,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  
  const isOutline = variant === 'outline'
  const isGhost = variant === 'ghost'
  const isDefault = !isOutline && !isGhost

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, attention, className }))}
      style={{
        backgroundColor: isGhost ? 'transparent' : 
                        isOutline ? 'transparent' :
                        'var(--primary-blue)',
        borderColor: isGhost ? 'transparent' : 
                     isOutline ? 'var(--color-border)' :
                     'var(--primary-blue)',
        color: isGhost ? undefined : 
               isOutline ? 'var(--color-foreground)' :
               'var(--pure-white)',
        ...((props as any).style || {})
      }}
      onMouseEnter={(e) => {
        if (isDefault && !props.disabled) {
          e.currentTarget.style.backgroundColor = 'var(--color-blue-primary-hover)';
        }
        if ((props as any).onMouseEnter) {
          (props as any).onMouseEnter(e);
        }
      }}
      onMouseLeave={(e) => {
        if (isDefault && !props.disabled) {
          e.currentTarget.style.backgroundColor = 'var(--primary-blue)';
        }
        if ((props as any).onMouseLeave) {
          (props as any).onMouseLeave(e);
        }
      }}
      {...props}
    />
  )
}

export { Button, buttonVariants }
