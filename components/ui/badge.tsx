import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-all backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 dark:text-indigo-300 shadow-sm shadow-indigo-500/10",
        indigo:
          "border-indigo-500/30 bg-indigo-500/15 text-indigo-400 dark:text-indigo-300 shadow-sm shadow-indigo-500/10",
        emerald:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 dark:text-emerald-300 shadow-sm shadow-emerald-500/10",
        success:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 dark:text-emerald-300 shadow-sm shadow-emerald-500/10",
        amber:
          "border-amber-500/30 bg-amber-500/15 text-amber-400 dark:text-amber-300 shadow-sm shadow-amber-500/10",
        warning:
          "border-amber-500/30 bg-amber-500/15 text-amber-400 dark:text-amber-300 shadow-sm shadow-amber-500/10",
        crimson:
          "border-rose-500/40 bg-rose-500/20 text-rose-400 dark:text-rose-300 shadow-md shadow-rose-500/20 animate-pulse",
        allergy:
          "border-rose-500/50 bg-rose-600/30 text-rose-200 dark:text-rose-100 shadow-lg shadow-rose-600/30 font-bold uppercase tracking-widest animate-pulse",
        destructive:
          "border-rose-500/30 bg-rose-500/15 text-rose-400 dark:text-rose-300 shadow-sm shadow-rose-500/10",
        secondary:
          "border-slate-700/50 bg-slate-800/40 text-slate-300 hover:bg-slate-800/60",
        outline:
          "border-slate-700/60 text-foreground bg-transparent hover:bg-slate-800/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };