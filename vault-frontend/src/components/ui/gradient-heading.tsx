import React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const headingVariants = cva(
  "tracking-tighter pb-3 bg-clip-text text-transparent font-heading uppercase drop-shadow-[2px_2px_0px_rgba(129,140,248,0.3)]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-t from-indigo to-violet",
        pink: "bg-gradient-to-t from-rose to-[#f0abfc]",
        light: "bg-gradient-to-t from-slate-200 to-white",
        secondary:
          "bg-gradient-to-t from-slate-500 to-slate-700",
        lime: "bg-gradient-to-t from-emerald to-[#6ee7b7] drop-shadow-[2px_2px_0px_rgba(52,211,153,0.3)]",
        cyber: "bg-gradient-to-t from-amber to-[#fcd34d] drop-shadow-[2px_2px_0px_rgba(251,191,36,0.3)]",
        indigo: "bg-gradient-to-t from-indigo to-violet drop-shadow-[2px_2px_0px_rgba(129,140,248,0.3)]",
        emerald: "bg-gradient-to-t from-emerald to-teal drop-shadow-[2px_2px_0px_rgba(52,211,153,0.3)]",
        violet: "bg-gradient-to-t from-violet to-[#c4b5fd] drop-shadow-[2px_2px_0px_rgba(167,139,250,0.3)]",
      },
      size: {
        default: "text-2xl sm:text-3xl lg:text-4xl",
        xxs: "text-base sm:text-lg lg:text-lg",
        xs: "text-lg sm:text-xl lg:text-2xl",
        sm: "text-xl sm:text-2xl lg:text-3xl",
        md: "text-2xl sm:text-3xl lg:text-4xl",
        lg: "text-3xl sm:text-4xl lg:text-5xl",
        xl: "text-4xl sm:text-5xl lg:text-6xl",
        xll: "text-5xl sm:text-6xl lg:text-[5.4rem] lg:leading-[1]",
        xxl: "text-5xl sm:text-6xl lg:text-[6rem] leading-[1]",
        xxxl: "text-5xl sm:text-6xl lg:text-[8rem] leading-[1]",
      },
      weight: {
        default: "font-black",
        thin: "font-thin",
        base: "font-normal",
        semi: "font-semibold",
        bold: "font-bold",
        black: "font-black",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      weight: "default",
    },
  }
)

export interface HeadingProps extends VariantProps<typeof headingVariants> {
  asChild?: boolean
  children: React.ReactNode
  className?: string
}

const GradientHeading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ asChild, variant, weight, size, className, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "h3"
    return (
      <Comp ref={ref} {...props} className={cn("block", className)}>
        <span className={cn(headingVariants({ variant, size, weight }))}>
          {children}
        </span>
      </Comp>
    )
  }
)

GradientHeading.displayName = "GradientHeading"

export type Variant = "default" | "pink" | "light" | "secondary" | "lime" | "cyber" | "indigo" | "emerald" | "violet"
export type Size =
  | "default"
  | "xxs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "xll"
  | "xxl"
  | "xxxl"
export type Weight = "default" | "thin" | "base" | "semi" | "bold" | "black"

export { GradientHeading, headingVariants }
