"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import {
  APP_NAVIGATION,
  FUTURE_NAVIGATION_PREVIEW,
  type NavigationItem,
} from "@/components/layout/navigation-config";

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly NavigationItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = Boolean(item.href && pathname === item.href);
        if (!item.isAvailable || !item.href) {
          return (
            <li key={item.id}>
              <span className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 type-body-small text-text-muted">
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                <span className="min-w-0">{item.label}</span>
                <span className="ml-auto type-caption">Coming later</span>
              </span>
            </li>
          );
        }
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md border-l-2 px-3 py-2 type-body-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active
                  ? "border-infra-orange bg-status-pending-bg font-medium text-text-primary"
                  : "border-transparent text-text-secondary hover:bg-muted",
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
              <span className="min-w-0">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppSidebar({
  showFuturePreview = false,
  onNavigate,
}: {
  showFuturePreview?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = showFuturePreview
    ? [...APP_NAVIGATION, ...FUTURE_NAVIGATION_PREVIEW]
    : APP_NAVIGATION;

  return (
    <nav aria-label="Primary" className="grid gap-4 p-4">
      <p className="type-caption text-text-muted">Navigation</p>
      <NavList items={items} pathname={pathname} onNavigate={onNavigate} />
    </nav>
  );
}
