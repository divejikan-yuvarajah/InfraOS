import React from "react";
import { AlertCircle, Info } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  suffixBadge?: string;
  rightLabelSlot?: React.ReactNode;
  trailingControl?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: string | null;
  errorId?: string;
  compact?: boolean;
}

export const LiquidGlassInput = React.forwardRef<HTMLInputElement, InputProps>(
  function LiquidGlassInput(
    {
      label,
      icon,
      suffixBadge,
      rightLabelSlot,
      trailingControl,
      helperText,
      error,
      errorId,
      compact = false,
      id,
      required,
      className = "",
      ...rest
    },
    ref,
  ) {
    return (
      <div className="auth-login-field space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <label
            htmlFor={id}
            className="mb-0 text-xs font-semibold tracking-tight text-slate-900 sm:text-[13px]"
          >
            {label}{" "}
            {required ? (
              <span className="font-bold text-[#FF5B00]">*</span>
            ) : null}
          </label>
          {rightLabelSlot ? (
            rightLabelSlot
          ) : suffixBadge ? (
            <span className="auth-stitch-mono rounded-full border border-slate-200 bg-[#F2F4F6] px-2.5 py-0.5 text-[10.5px] font-medium text-slate-600">
              {suffixBadge}
            </span>
          ) : null}
        </div>

        <div
          className={`auth-liquid-input-wrap relative flex items-center rounded-2xl border bg-white/85 shadow-2xs backdrop-blur-md transition-all ${
            error
              ? "border-[#8C1F28] ring-2 ring-[#8C1F28]/15 focus-within:border-[#8C1F28] focus-within:ring-2 focus-within:ring-[#8C1F28]/25"
              : "border-slate-200/95 focus-within:border-[#FF5B00] focus-within:ring-2 focus-within:ring-[#FF5B00]/20"
          }`}
        >
          {icon ? (
            <span
              className="pointer-events-none absolute left-3.5 flex items-center justify-center text-slate-400"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={id}
            required={required}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error && errorId ? errorId : undefined}
            className={`${
              compact ? "auth-liquid-input--compact h-12" : "auth-liquid-input h-14"
            } w-full rounded-2xl bg-transparent ${
              icon ? "pl-11" : "pl-4"
            } ${
              trailingControl ? "pr-11" : "pr-4"
            } text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            {...rest}
          />

          {trailingControl ? (
            <div className="absolute right-2.5 flex items-center justify-center">
              {trailingControl}
            </div>
          ) : null}
        </div>

        {error ? (
          <p
            id={errorId}
            className="flex items-center gap-1 pt-0.5 text-[11px] font-medium text-[#8C1F28]"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="flex items-center gap-1 pt-0.5 text-[11px] text-slate-500">
            <Info
              className="h-3 w-3 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <span>{helperText}</span>
          </p>
        ) : null}
      </div>
    );
  },
);

