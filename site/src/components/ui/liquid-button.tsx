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
        bg-[var(--accent)] text-white font-semibold
        hover:bg-[var(--accent-hover)]
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
          rounded-xl font-medium
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30
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
