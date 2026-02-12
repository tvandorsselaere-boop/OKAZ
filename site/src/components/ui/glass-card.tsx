"use client";

import { HTMLAttributes, forwardRef } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hover" | "bordered";
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const baseClasses =
      "bg-[var(--card-bg)]/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-[var(--card-shadow)]";

    const variantClasses = {
      default: "",
      hover:
        "transition-shadow duration-200 hover:shadow-[var(--card-shadow-hover)]",
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
