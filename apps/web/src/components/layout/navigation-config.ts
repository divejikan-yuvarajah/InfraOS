import type { LucideIcon } from "lucide-react";
import { HomeIcon, LayoutDashboardIcon, MapIcon, RouteIcon } from "lucide-react";

export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon?: LucideIcon;
  group?: string;
  isAvailable: boolean;
};

/** Live links only for routes that exist in this app today. */
export const APP_NAVIGATION: readonly NavigationItem[] = [
  {
    id: "foundation",
    label: "Foundation",
    href: "/",
    icon: HomeIcon,
    group: "Overview",
    isAvailable: true,
  },
] as const;

/** Development preview only — not clickable; not live product routes. */
export const FUTURE_NAVIGATION_PREVIEW: readonly NavigationItem[] = [
  {
    id: "projecttrace",
    label: "ProjectTrace",
    icon: LayoutDashboardIcon,
    group: "Later",
    isAvailable: false,
  },
  {
    id: "roadsync",
    label: "RoadSync",
    icon: RouteIcon,
    group: "Later",
    isAvailable: false,
  },
  {
    id: "inframap",
    label: "InfraMap",
    icon: MapIcon,
    group: "Later",
    isAvailable: false,
  },
];

export function availableNavigation(items: readonly NavigationItem[] = APP_NAVIGATION) {
  return items.filter((item) => item.isAvailable && item.href);
}
