import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 hover:shadow-indigo-600/35 active:scale-[0.98]",
        destructive:
          "bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-500 hover:shadow-rose-600/35 active:scale-[0.98]",
        emerald:
          "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 hover:shadow-emerald-600/35 active:scale-[0.98]",
        amber:
          "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400 hover:shadow-amber-500/35 active:scale-[0.98]",
        glass:
          "backdrop-blur-md bg-white/10 dark:bg-slate-800/40 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-slate-800/70 text-foreground active:scale-[0.98]",
        outline:
          "border border-slate-300/80 dark:border-slate-800 bg-background/50 backdrop-blur-sm hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-foreground active:scale-[0.98]",
        secondary:
          "bg-slate-200/80 dark:bg-slate-800/80 text-foreground hover:bg-slate-300/80 dark:hover:bg-slate-700/80 active:scale-[0.98]",
        ghost: "hover:bg-slate-200/50 dark:hover:bg-slate-800/60 hover:text-foreground",
        link: "text-indigo-500 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };