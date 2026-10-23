"use client";

import { useEffect, type ReactNode } from "react";

import { bootstrapAuthFromRefresh } from "@/lib/auth/refresh-flight";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void bootstrapAuthFromRefresh();
  }, []);

  return (
    <QueryProvider>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </TooltipProvider>
    </QueryProvider>
  );
}
