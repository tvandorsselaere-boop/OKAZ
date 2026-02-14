"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface LiquidButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

const LiquidButton = forwardRef<HTMLButtonElement, LiquidButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };

    const variantClasses = {
      primary: `
        bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary,#8B5CF6)] text-white font-semibold
        shadow-lg shadow-[var(--accent)]/25
        hover:shadow-xl hover:shadow-[var(--accent)]/30 hover:scale-[1.02] hover:-translate-y-0.5
        active:scale-[0.98]
      `,
      secondary: `
        bg-[var(--bg-secondary)] border border-[var(--separator)]
        text-[var(--text-primary)]
        hover:bg-[var(--bg-tertiary)]
        active:scale-[0.98]
      `,
      ghost: `
        text-[var(--accent)]
        hover:bg-[var(--accent)]/10
        active:scale-[0.98]
      `,
    };

    return (
      <button
        ref={ref}
        className={`
          rounded-2xl font-medium
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${className}
        `}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

LiquidButton.displayName = "LiquidButton";

export { LiquidButton };
