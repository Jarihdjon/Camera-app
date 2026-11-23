import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 outline-none focus-visible:ring-4 focus-visible:ring-ring/40 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_6px_0_0_var(--primary-shadow)] hover:brightness-105 active:translate-y-[4px] active:shadow-[0_2px_0_0_var(--primary-shadow)]",
        secondary: "bg-secondary text-secondary-foreground border border-white/10 shadow-[0_6px_0_0_rgba(0,0,0,0.35)] active:translate-y-[4px] active:shadow-[0_2px_0_0_rgba(0,0,0,0.35)]",
        success: "bg-success text-success-foreground shadow-[0_6px_0_0_var(--success-shadow)] active:translate-y-[4px] active:shadow-[0_2px_0_0_var(--success-shadow)]",
        outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-10 rounded-lg px-4 text-sm",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        kid: "min-h-16 rounded-2xl px-7 text-xl",
        icon: "size-10 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
