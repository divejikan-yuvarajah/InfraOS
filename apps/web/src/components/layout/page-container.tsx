import type { ReactNode } from "react";

import { cn } from "cn";

export type PageContainerVariant = "dashboard" | "content" | "form" | "map";

const VARIANT_CLASS: Record<PageContainerVariant, string> = {
  dashboard: "mx-auto w-full max-w-6xl",
  content: "mx-auto w-full max-w-3xl",
  form: "mx-auto w-full max-w-2xl",
  map: "w-full max-w-none",
};

export function PageContainer({
  variant = "dashboard",
  className,
  children,
}: {
  variant?: PageContainerVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-6 md:px-6", VARIANT_CLASS[variant], className)}>
      {children}
    </div>
  );
}
