"use client";

import { useEffect, type ReactNode } from "react";

import { AiStatusProvider } from "@/components/ai-admin/ai-status-provider";
import { RouteAccessGuard } from "@/components/auth/route-access-guard";
import { CopilotProvider } from "@/components/copilot/copilot-provider";
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
        <AiStatusProvider>
          <CopilotProvider>
            <RouteAccessGuard>{children}</RouteAccessGuard>
          </CopilotProvider>
        </AiStatusProvider>
        <Toaster richColors closeButton position="top-right" />
      </TooltipProvider>
    </QueryProvider>
  );
}
