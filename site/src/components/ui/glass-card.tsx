"use client";

import { HTMLAttributes, forwardRef } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hover" | "bordered";
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const baseClasses =
      "bg-[var(--card-bg)]/80 backdrop-blur-2xl border border-white/15 dark:border-white/8 rounded-2xl shadow-[var(--card-shadow)]";

    const variantClasses = {
      default: "",
      hover:
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-[var(--card-shadow-hover)] hover:scale-[1.02] hover:-translate-y-0.5",
      bordered:
        "border-2 border-[var(--accent)]/20",
    };

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
