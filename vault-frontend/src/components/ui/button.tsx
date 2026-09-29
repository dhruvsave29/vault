import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-none text-base font-heading font-black uppercase ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-brutal shadow-brutal-sm hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_rgba(129,140,248,0.12)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none",
  {
    variants: {
      variant: {
        default: "bg-indigo text-void hover:bg-violet hover:text-void border-indigo",
        destructive: "bg-rose text-void hover:bg-rose/80 hover:text-void border-rose",
        outline: "border-brutal bg-surface hover:bg-indigo hover:text-void hover:border-indigo",
        secondary: "bg-violet text-void hover:bg-indigo hover:text-void border-violet",
        ghost: "border-transparent shadow-none hover:bg-indigo-dim hover:border-transparent hover:shadow-none hover:translate-x-0 hover:translate-y-0 text-text-primary",
        link: "text-indigo underline-offset-4 hover:underline shadow-none border-none",
        emerald: "bg-emerald text-void hover:bg-emerald/80 hover:text-void border-emerald",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-10 px-4",
        lg: "h-14 px-8",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
