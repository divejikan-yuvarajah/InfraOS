"use client";

import type { ReactNode } from "react";

import { QueryProvider } from "@/components/providers/query-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
