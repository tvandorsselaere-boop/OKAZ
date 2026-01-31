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
        bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--primary)]
        bg-[length:200%_100%]
        text-white font-semibold
        hover:bg-[position:100%_0]
        hover:shadow-[0_0_30px_rgba(99,102,241,0.6)]
        active:scale-[0.98]
        relative overflow-hidden
      `,
      secondary: `
        bg-white/5 border border-white/10
        text-white backdrop-blur-sm
        hover:bg-white/10 hover:border-white/20
        active:scale-[0.98]
      `,
      ghost: `
        text-[var(--primary)]
        hover:bg-[var(--primary)]/10
        active:scale-[0.98]
      `,
    };

    return (
      <button
        ref={ref}
        className={`
          relative rounded-xl font-medium
          transition-all duration-300
          focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:scale-[1.02]
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${className}
        `}
        disabled={disabled}
        {...props}
      >
        {variant === "primary" && (
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
        )}
        <span className="relative z-10">{children}</span>
      </button>
    );
  }
);

LiquidButton.displayName = "LiquidButton";

export { LiquidButton };
