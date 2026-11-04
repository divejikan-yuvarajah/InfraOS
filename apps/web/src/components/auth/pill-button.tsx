import React from "react";

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  compact?: boolean;
}

export function PillButton({
  children,
  compact = false,
  className = "",
  type = "button",
  ...rest
}: PillButtonProps) {
  return (
    <button
      type={type}
      className={`${
        compact ? "auth-pill-btn--compact h-12" : "auth-pill-btn h-14"
      } relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-full border border-white/20 bg-[#FF5B00] px-6 text-sm font-bold tracking-wide text-white shadow-md shadow-[#FF5B00]/20 transition-all duration-200 hover:bg-[#E05000] hover:shadow-[0_14px_30px_-5px_rgba(255,91,0,0.45)] focus-visible:ring-2 focus-visible:ring-[#FF5B00] focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65 sm:text-base ${className}`}
      {...rest}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30"
        aria-hidden="true"
      />
      {children}
    </button>
  );
}

