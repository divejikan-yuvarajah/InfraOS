"use client";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/feedback/empty-state";

export function AppShellPreview() {
  return (
    <AppShell
      title="Application shell"
      description="Development fixture. Navigation lists only routes that exist. Upcoming modules are not links."
      breadcrumbs={[{ label: "INFRAOS", href: "/" }, { label: "Shell preview" }]}
      showFuturePreview
      variant="dashboard"
    >
      <EmptyState
        title="Shell content slot"
        description="Step 22 empty state renders inside the shell. No signed-in user or agency is shown."
      />
    </AppShell>
  );
}
