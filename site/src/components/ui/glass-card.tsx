"use client";

import { HTMLAttributes, forwardRef } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hover" | "bordered";
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const baseClasses =
      "backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl shadow-2xl";

    const variantClasses = {
      default: "",
      hover:
        "transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_30px_rgba(99,102,241,0.3)]",
      bordered:
        "border-2 border-[var(--primary)]/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]",
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
