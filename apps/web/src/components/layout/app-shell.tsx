import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/breadcrumbs";
import { PageContainer, type PageContainerVariant } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export function AppShell({
  children,
  title,
  description,
  breadcrumbs = [],
  variant = "dashboard",
  contextLabel,
  showFuturePreview = false,
  actions,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  breadcrumbs?: readonly BreadcrumbItem[];
  variant?: PageContainerVariant;
  contextLabel?: string;
  showFuturePreview?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-lg border border-border bg-background">
      <a
        href="#shell-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        Skip to shell content
      </a>
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
          <AppSidebar showFuturePreview={showFuturePreview} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader contextLabel={contextLabel} showFuturePreview={showFuturePreview} />
          <div
            id="shell-main"
            role="region"
            aria-label={title}
            className="min-w-0 flex-1 overflow-x-hidden scroll-mt-16 outline-none"
            tabIndex={-1}
          >
            <PageContainer variant={variant}>
              <Breadcrumbs items={breadcrumbs} />
              <PageHeader title={title} description={description} actions={actions} />
              {children}
            </PageContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
