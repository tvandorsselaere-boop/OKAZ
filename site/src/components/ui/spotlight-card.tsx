"use client";

import { HTMLAttributes } from "react";

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
}

export function SpotlightCard({
  className = "",
  children,
  ...props
}: SpotlightCardProps) {
  return (
    <div
      className={`rounded-2xl bg-[var(--card-bg)] border border-[var(--separator)] shadow-[var(--card-shadow)] transition-shadow duration-200 hover:shadow-[var(--card-shadow-hover)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
