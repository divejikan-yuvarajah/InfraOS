"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AuthLocale } from "@/lib/auth/types";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { EMPTY_UF } from "@/lib/inframap/filters-state";
import { fetchSearch } from "@/lib/inframap/inframap-api";
import { fetchProjects } from "@/lib/projects/api";
import { fetchWorkRequests } from "@/lib/roadsync/api";
import { fetchRecords } from "@/lib/roadsync/conflict-records-api";

type CategoryFilter = "ALL" | "PROJECTS" | "WORK_REQUESTS" | "CONFLICTS" | "ASSETS" | "COMMANDS";

type PaletteEntry = {
  id: string;
  section: "COMMANDS" | "CONFLICTS" | "PROJECTS" | "WORK_REQUESTS" | "ASSETS";
  title: string;
  subtitle: string;
  code?: string;
  badgeText?: string;
  badgeTone?: "critical" | "active" | "pending" | "success" | "neutral";
  nodeGlyph?: "●" | "○" | "◆" | "✓";
  materialIcon: string;
  shortcut?: string[];
  href?: string;
  onSelect?: () => void;
};

const PALETTE_COPY: Record<
  AuthLocale,
  {
    placeholder: string;
    clear: string;
    allResults: string;
    projects: string;
    workRequests: string;
    conflicts: string;
    assets: string;
    commands: string;
    telemetryLive: string;
    telemetrySearching: string;
    sectionCommands: string;
    sectionConflicts: string;
    sectionProjects: string;
    sectionWorkRequests: string;
    sectionAssets: string;
    noMatchesTitle: string;
    noMatchesBody: string;
    navigate: string;
    execute: string;
    cycleFilter: string;
    scopePrefix: string;
  }
> = {
  en: {
    placeholder: "Search projects, work requests, chainage conflicts, assets, or run a command...",
    clear: "Clear",
    allResults: "All Results",
    projects: "Projects",
    workRequests: "Work Requests",
    conflicts: "Spatial Conflicts",
    assets: "Assets & Utilities",
    commands: "Quick Commands",
    telemetryLive: "Telemetry Index: Live",
    telemetrySearching: "Searching registry...",
    sectionCommands: "Direct Operational Commands",
    sectionConflicts: "Spatial Conflicts (RoadSync)",
    sectionProjects: "Infrastructure Projects & Corridors",
    sectionWorkRequests: "Excavation & Work Requests",
    sectionAssets: "Assets & Utility Nodes",
    noMatchesTitle: "No matching telemetry records or commands",
    noMatchesBody: "Try searching by project code, road corridor, chainage, conflict status, or command keyword.",
    navigate: "Navigate",
    execute: "Execute / Open",
    cycleFilter: "Cycle Filter",
    scopePrefix: "Scope",
  },
  si: {
    placeholder: "ව්‍යාපෘති, වැඩ ඉල්ලීම්, ගැටුම්, වත්කම් හෝ විධාන සොයන්න...",
    clear: "මකන්න",
    allResults: "සියලුම ප්‍රතිඵල",
    projects: "ව්‍යාපෘති",
    workRequests: "වැඩ ඉල්ලීම්",
    conflicts: "අවකාශීය ගැටුම්",
    assets: "වත්කම් සහ උපයෝගිතා",
    commands: "ක්ෂණික විධාන",
    telemetryLive: "දත්ත සුචිය: සජීවී",
    telemetrySearching: "සොයමින් පවතී...",
    sectionCommands: "සෘජු මෙහෙයුම් විධාන",
    sectionConflicts: "අවකාශීය ගැටුම් (RoadSync)",
    sectionProjects: "යටිතල පහසුකම් ව්‍යාපෘති",
    sectionWorkRequests: "වැඩ ඉල්ලීම්",
    sectionAssets: "වත්කම් සහ උපයෝගිතා",
    noMatchesTitle: "ගැළපෙන වාර්තා හෝ විධාන හමු නොවීය",
    noMatchesBody: "ව්‍යාපෘති කේතය, මාර්ගය, හෝ විධාන නාමය අනුව නැවත සොයන්න.",
    navigate: "ගමන් කරන්න",
    execute: "විවෘත කරන්න",
    cycleFilter: "පෙරහන මාරු කරන්න",
    scopePrefix: "විෂය පථය",
  },
  ta: {
    placeholder: "திட்டங்கள், பணி கோரிக்கைகள், முரண்பாடுகள், சொத்துகள் அல்லது கட்டளைகளைத் தேடுக...",
    clear: "அழி",
    allResults: "அனைத்து முடிவுகள்",
    projects: "திட்டங்கள்",
    workRequests: "பணி கோரிக்கைகள்",
    conflicts: "இடஞ்சார்ந்த முரண்பாடுகள்",
    assets: "சொத்துகள் & பயன்பாடுகள்",
    commands: "விரைவு கட்டளைகள்",
    telemetryLive: "தரவு குறியீடு: நேரலை",
    telemetrySearching: "தேடுகிறது...",
    sectionCommands: "நேரடி செயல்பாட்டு கட்டளைகள்",
    sectionConflicts: "இடஞ்சார்ந்த முரண்பாடுகள் (RoadSync)",
    sectionProjects: "உள்கட்டமைப்பு திட்டங்கள்",
    sectionWorkRequests: "பணி கோரிக்கைகள்",
    sectionAssets: "சொத்துகள் & பயன்பாடுகள்",
    noMatchesTitle: "பொருந்தும் பதிவுகள் அல்லது கட்டளைகள் இல்லை",
    noMatchesBody: "திட்டக் குறியீடு, சாலை அல்லது கட்டளைச் சொல் மூலம் மீண்டும் தேடவும்.",
    navigate: "நகர்த்த",
    execute: "திற / இயக்கு",
    cycleFilter: "வடிகட்டியை மாற்று",
    scopePrefix: "வரம்பு",
  },
};

const FILTER_ORDER: CategoryFilter[] = ["ALL", "PROJECTS", "WORK_REQUESTS", "CONFLICTS", "ASSETS", "COMMANDS"];

export function GlobalCommandPalette({
  open,
  onOpenChange,
  epoch,
  hasToken,
  scopeLabel,
  roleLabel,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  epoch: number;
  hasToken: boolean;
  scopeLabel: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [locale, setLocale] = useWorkspaceLocale();
  const copy = PALETTE_COPY[locale];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => {
        setActiveIndex(0);
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    let lastGAt = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (!open && !inEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === "g") {
          lastGAt = Date.now();
        } else if (Date.now() - lastGAt < 900) {
          if (e.key.toLowerCase() === "r") {
            e.preventDefault();
            router.push("/roadsync/conflicts");
            lastGAt = 0;
          } else if (e.key.toLowerCase() === "m") {
            e.preventDefault();
            router.push("/inframap");
            lastGAt = 0;
          } else if (e.key.toLowerCase() === "n") {
            e.preventDefault();
            router.push("/notifications");
            lastGAt = 0;
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, router]);

  const inframapSearchQuery = useQuery({
    queryKey: ["command-palette", "inframap-search", epoch, trimmedQuery],
    queryFn: () =>
      fetchSearch({
        q: trimmedQuery,
        scope: "all",
        bbox: null,
        uf: EMPTY_UF,
      }),
    enabled: open && hasToken && trimmedQuery.length >= 2,
    staleTime: 15_000,
    retry: false,
  });

  const recentProjectsQuery = useQuery({
    queryKey: ["command-palette", "projects", epoch, trimmedQuery],
    queryFn: () =>
      fetchProjects({
        page: 1,
        limit: 5,
        ...(trimmedQuery.length >= 2 ? { q: trimmedQuery } : {}),
      }),
    enabled: open && hasToken,
    staleTime: 30_000,
    retry: false,
  });

  const recentConflictsQuery = useQuery({
    queryKey: ["command-palette", "conflicts", epoch, trimmedQuery],
    queryFn: () => {
      const p = new URLSearchParams({ page: "1", limit: "4" });
      if (trimmedQuery.length >= 2) p.set("q", trimmedQuery);
      return fetchRecords(p.toString());
    },
    enabled: open && hasToken,
    staleTime: 30_000,
    retry: false,
  });

  const recentWorkRequestsQuery = useQuery({
    queryKey: ["command-palette", "work-requests", epoch, trimmedQuery],
    queryFn: () => {
      const p = new URLSearchParams({ page: "1", limit: "4" });
      if (trimmedQuery.length >= 2) p.set("q", trimmedQuery);
      return fetchWorkRequests(p.toString());
    },
    enabled: open && hasToken,
    staleTime: 30_000,
    retry: false,
  });

  const operationalCommands = useMemo<PaletteEntry[]>(() => {
    const nextLocale: AuthLocale = locale === "en" ? "si" : locale === "si" ? "ta" : "en";
    const all: PaletteEntry[] = [
      {
        id: "cmd-roadsync-radar",
        section: "COMMANDS",
        title: "Go to RoadSync Conflict Radar",
        subtitle: "Coordination Intelligence > Spatial & Temporal Overlaps",
        materialIcon: "radar",
        shortcut: ["G", "then", "R"],
        href: "/roadsync/conflicts",
      },
      {
        id: "cmd-new-work-request",
        section: "COMMANDS",
        title: "Create New Excavation / Work Request",
        subtitle: "Project Operations > RoadSync Corridor Permit Filing",
        materialIcon: "add_road",
        shortcut: ["⌘", "N"],
        href: "/roadsync/work-requests/new",
      },
      {
        id: "cmd-open-inframap",
        section: "COMMANDS",
        title: "Open InfraMap GIS Corridor Explorer",
        subtitle: "Coordination Intelligence > National Multi-Layer Spatial Map",
        materialIcon: "map",
        shortcut: ["G", "then", "M"],
        href: "/inframap",
      },
      {
        id: "cmd-new-project",
        section: "COMMANDS",
        title: "Register New Capital Infrastructure Project",
        subtitle: "Project Operations > Capital Registry & Lifecycle Entry",
        materialIcon: "create_new_folder",
        shortcut: ["⇧", "⌘", "P"],
        href: "/projects/new",
      },
      {
        id: "cmd-notifications",
        section: "COMMANDS",
        title: "Open Full Notifications & Dispatch Alerts",
        subtitle: "Personal Workspace > Real-Time Governance & Conflict Stream",
        materialIcon: "notifications_active",
        shortcut: ["G", "then", "N"],
        href: "/notifications",
      },
      {
        id: "cmd-switch-locale",
        section: "COMMANDS",
        title: `Switch Workspace Language (Current: ${locale.toUpperCase()} → ${nextLocale.toUpperCase()})`,
        subtitle: "Personal Workspace > Trilingual Interface Toggle (EN / සිංහල / தமிழ்)",
        materialIcon: "translate",
        shortcut: ["⇧", "⌘", "L"],
        onSelect: () => {
          setLocale(nextLocale);
          onOpenChange(false);
        },
      },
    ];
    if (!trimmedQuery) return all.slice(0, 4);
    const qLower = trimmedQuery.toLowerCase();
    return all.filter(
      (c) =>
        c.title.toLowerCase().includes(qLower) ||
        c.subtitle.toLowerCase().includes(qLower),
    );
  }, [locale, setLocale, onOpenChange, trimmedQuery]);

  const conflictEntries = useMemo<PaletteEntry[]>(() => {
    const searchGroup = inframapSearchQuery.data?.groups.find(
      (g) => g.layer === "conflicts",
    );
    if (trimmedQuery.length >= 2 && searchGroup && searchGroup.items.length > 0) {
      return searchGroup.items.slice(0, 5).map((c) => ({
        id: `conflict-${c.id}`,
        section: "CONFLICTS" as const,
        code: c.badge ?? "CONFLICT",
        title: c.title,
        subtitle: c.subtitle ?? `Status: ${c.status ?? "open"}`,
        badgeText: c.badge ?? "Mediate",
        badgeTone: "critical",
        nodeGlyph: "◆",
        materialIcon: "warning",
        href: `/roadsync/conflicts/${c.id}`,
      }));
    }

    const fromList = recentConflictsQuery.data?.items ?? [];
    return fromList
      .filter((c) => {
        if (!trimmedQuery) return true;
        const qLower = trimmedQuery.toLowerCase();
        return (
          c.conflictNo.toLowerCase().includes(qLower) ||
          c.parties.a.title.toLowerCase().includes(qLower) ||
          c.parties.b.title.toLowerCase().includes(qLower) ||
          c.severity.band.toLowerCase().includes(qLower)
        );
      })
      .slice(0, 4)
      .map((c) => ({
        id: `conflict-${c.id}`,
        section: "CONFLICTS" as const,
        code: c.conflictNo,
        title: `${c.parties.a.title} × ${c.parties.b.title}`,
        subtitle: `Band: ${c.severity.band.toUpperCase()} (${c.severity.score}) • Status: ${c.status.replace(/_/g, " ")}`,
        badgeText: c.severity.band.toUpperCase(),
        badgeTone:
          c.severity.band === "critical" || c.severity.band === "high"
            ? "critical"
            : "pending",
        nodeGlyph: "◆",
        materialIcon: "warning",
        href: `/roadsync/conflicts/${c.id}`,
      }));
  }, [inframapSearchQuery.data, recentConflictsQuery.data, trimmedQuery]);

  const projectEntries = useMemo<PaletteEntry[]>(() => {
    const searchGroup = inframapSearchQuery.data?.groups.find(
      (g) => g.layer === "projects",
    );
    if (trimmedQuery.length >= 2 && searchGroup && searchGroup.items.length > 0) {
      return searchGroup.items.slice(0, 5).map((p) => ({
        id: `project-${p.id}`,
        section: "PROJECTS" as const,
        code: p.badge ?? undefined,
        title: p.title,
        subtitle: p.subtitle ?? "National Infrastructure Project",
        badgeText: (p.status ?? "ACTIVE").replace(/_/g, " "),
        badgeTone: p.status === "ACTIVE" ? "active" : "neutral",
        nodeGlyph:
          p.status === "COMPLETED"
            ? "✓"
            : p.status === "ACTIVE"
              ? "●"
              : "○",
        materialIcon: "assignment",
        href: `/projects/${p.id}`,
      }));
    }

    const fromList = recentProjectsQuery.data?.projects ?? [];
    return fromList
      .filter((p) => {
        if (!trimmedQuery) return true;
        const qLower = trimmedQuery.toLowerCase();
        return (
          p.title.toLowerCase().includes(qLower) ||
          p.projectCode.toLowerCase().includes(qLower) ||
          (p.agencyCode ?? "").toLowerCase().includes(qLower)
        );
      })
      .slice(0, 5)
      .map((p) => ({
        id: `project-${p.id}`,
        section: "PROJECTS" as const,
        code: p.projectCode,
        title: p.title,
        subtitle: `Lead: ${p.agencyCode ?? "Assigned Agency"} • Type: ${p.projectType.replace(/_/g, " ")}`,
        badgeText: p.status.replace(/_/g, " "),
        badgeTone:
          p.status === "ACTIVE"
            ? "active"
            : p.status === "COMPLETED"
              ? "success"
              : "neutral",
        nodeGlyph:
          p.status === "COMPLETED"
            ? "✓"
            : p.status === "ACTIVE"
              ? "●"
              : "○",
        materialIcon: "assignment",
        href: `/projects/${p.id}`,
      }));
  }, [inframapSearchQuery.data, recentProjectsQuery.data, trimmedQuery]);

  const workRequestEntries = useMemo<PaletteEntry[]>(() => {
    const searchGroup = inframapSearchQuery.data?.groups.find(
      (g) => g.layer === "roadworks",
    );
    if (trimmedQuery.length >= 2 && searchGroup && searchGroup.items.length > 0) {
      return searchGroup.items.slice(0, 4).map((w) => ({
        id: `wr-${w.id}`,
        section: "WORK_REQUESTS" as const,
        code: w.badge ?? undefined,
        title: w.title,
        subtitle: w.subtitle ?? "Corridor Work Request",
        badgeText: (w.status ?? "PLANNED").replace(/_/g, " "),
        badgeTone: w.status === "APPROVED" ? "success" : "pending",
        nodeGlyph: w.status === "APPROVED" ? "✓" : "○",
        materialIcon: "edit_road",
        href: `/roadsync/work-requests/${w.id}`,
      }));
    }

    const fromList = recentWorkRequestsQuery.data?.workRequests ?? [];
    return fromList
      .filter((w) => {
        if (!trimmedQuery) return true;
        const qLower = trimmedQuery.toLowerCase();
        return (
          (w.projectTitle ?? "").toLowerCase().includes(qLower) ||
          (w.referenceNo ?? "").toLowerCase().includes(qLower) ||
          w.workType.toLowerCase().includes(qLower)
        );
      })
      .slice(0, 4)
      .map((w) => ({
        id: `wr-${w.id}`,
        section: "WORK_REQUESTS" as const,
        code: w.referenceNo ?? w.projectCode ?? "WR",
        title: w.projectTitle ?? w.workType.replace(/_/g, " "),
        subtitle: `${w.workType.replace(/_/g, " ")} • ${w.agencyName ?? "Corridor"}`,
        badgeText: w.status.replace(/_/g, " "),
        badgeTone: w.status === "APPROVED" ? "success" : "pending",
        nodeGlyph: w.status === "APPROVED" ? "✓" : "○",
        materialIcon: "edit_road",
        href: `/roadsync/work-requests/${w.id}`,
      }));
  }, [inframapSearchQuery.data, recentWorkRequestsQuery.data, trimmedQuery]);

  const assetEntries = useMemo<PaletteEntry[]>(() => {
    const searchGroup = inframapSearchQuery.data?.groups.find(
      (g) => g.layer === "assets" || g.layer === "utilities",
    );
    if (!searchGroup) return [];
    return searchGroup.items.slice(0, 4).map((a) => ({
      id: `asset-${a.id}`,
      section: "ASSETS" as const,
      code: a.badge ?? undefined,
      title: a.title,
      subtitle: a.subtitle ?? "Registered Infrastructure Asset",
      badgeText: (a.status ?? "ACTIVE").replace(/_/g, " "),
      badgeTone: "neutral",
      nodeGlyph: "○",
      materialIcon: "inventory_2",
      href: `/assets/${a.id}`,
    }));
  }, [inframapSearchQuery.data]);

  const visibleSections = useMemo(() => {
    const sections: { key: PaletteEntry["section"]; label: string; items: PaletteEntry[] }[] = [];
    if ((category === "ALL" || category === "COMMANDS") && operationalCommands.length > 0) {
      sections.push({ key: "COMMANDS", label: copy.sectionCommands, items: operationalCommands });
    }
    if ((category === "ALL" || category === "CONFLICTS") && conflictEntries.length > 0) {
      sections.push({ key: "CONFLICTS", label: copy.sectionConflicts, items: conflictEntries });
    }
    if ((category === "ALL" || category === "PROJECTS") && projectEntries.length > 0) {
      sections.push({ key: "PROJECTS", label: copy.sectionProjects, items: projectEntries });
    }
    if ((category === "ALL" || category === "WORK_REQUESTS") && workRequestEntries.length > 0) {
      sections.push({ key: "WORK_REQUESTS", label: copy.sectionWorkRequests, items: workRequestEntries });
    }
    if ((category === "ALL" || category === "ASSETS") && assetEntries.length > 0) {
      sections.push({ key: "ASSETS", label: copy.sectionAssets, items: assetEntries });
    }
    return sections;
  }, [
    category,
    operationalCommands,
    conflictEntries,
    projectEntries,
    workRequestEntries,
    assetEntries,
    copy,
  ]);

  const flatEntries = useMemo(
    () => visibleSections.flatMap((s) => s.items),
    [visibleSections],
  );

  const safeActiveIndex = flatEntries.length > 0 ? Math.min(activeIndex, flatEntries.length - 1) : 0;

  const executeEntry = (entry: PaletteEntry) => {
    if (entry.onSelect) {
      entry.onSelect();
      return;
    }
    if (entry.href) {
      onOpenChange(false);
      router.push(entry.href);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatEntries.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatEntries.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatEntries.length > 0) {
        setActiveIndex((prev) => (prev - 1 + flatEntries.length) % flatEntries.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatEntries[safeActiveIndex];
      if (target) executeEntry(target);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const currentIdx = FILTER_ORDER.indexOf(category);
      const nextIdx = e.shiftKey
        ? (currentIdx - 1 + FILTER_ORDER.length) % FILTER_ORDER.length
        : (currentIdx + 1) % FILTER_ORDER.length;
      setCategory(FILTER_ORDER[nextIdx] ?? "ALL");
      setActiveIndex(0);
    }
  };

  if (!open) return null;

  const isSearching =
    inframapSearchQuery.isFetching ||
    recentProjectsQuery.isFetching ||
    recentConflictsQuery.isFetching ||
    recentWorkRequestsQuery.isFetching;

  let runningFlatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] sm:pt-[8vh] px-4 bg-primary/60 backdrop-blur-[6px]"
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette and Search"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-[780px] bg-surface-container-lowest rounded border border-outline-variant/40 shadow-modal flex flex-col overflow-hidden max-h-[84vh]">
        {/* Top Accent Line: The Infrastructure Thread */}
        <div className="h-[3px] w-full bg-gradient-to-r from-primary-container via-secondary to-secondary-container shrink-0" />

        {/* 1. TOP COMMAND INPUT BAR */}
        <div className="relative flex items-center h-16 px-5 bg-surface-container-lowest border-b border-outline-variant/25 shrink-0">
          <span className="material-symbols-outlined text-secondary text-[22px] mr-3.5 select-none">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={copy.placeholder}
            className="w-full bg-transparent text-on-surface font-title-md text-[16px] placeholder:text-outline focus:outline-none pr-28 tabular-nums"
          />

          {/* Input Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {query.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveIndex(0);
                    inputRef.current?.focus();
                  }}
                  className="text-label-sm font-label-sm uppercase text-outline hover:text-on-surface px-2 py-1 rounded hover:bg-surface-container-low transition-colors"
                >
                  {copy.clear}
                </button>
                <div className="h-4 w-[1px] bg-outline-variant/30" />
              </>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-1.5 py-0.5 text-[11px] font-bold font-mono text-on-surface-variant bg-surface-container-low border border-outline-variant/40 rounded shadow-2xs hover:bg-surface-container transition-colors"
            >
              ESC
            </button>
          </div>
        </div>

        {/* 2. CATEGORY FILTER PILLS / TABS */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-surface-container-low/60 border-b border-outline-variant/20 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5" role="tablist">
            {(
              [
                { id: "ALL", label: copy.allResults, count: flatEntries.length },
                { id: "PROJECTS", label: copy.projects, count: projectEntries.length },
                { id: "WORK_REQUESTS", label: copy.workRequests, count: workRequestEntries.length },
                { id: "CONFLICTS", label: copy.conflicts, count: conflictEntries.length, isAlert: conflictEntries.length > 0 },
                { id: "ASSETS", label: copy.assets, count: assetEntries.length },
                { id: "COMMANDS", label: copy.commands, count: operationalCommands.length },
              ] as const
            ).map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setCategory(tab.id);
                    setActiveIndex(0);
                    inputRef.current?.focus();
                  }}
                  className={
                    active
                      ? "px-2.5 py-1 rounded text-label-sm font-label-sm uppercase bg-primary-container text-white flex items-center gap-1.5 shadow-2xs"
                      : "px-2.5 py-1 rounded text-label-sm font-label-sm uppercase text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1.5"
                  }
                >
                  <span>{tab.label}</span>
                  <span
                    className={
                      active
                        ? "text-[10px] px-1 rounded bg-white/15 text-primary-fixed tabular-nums"
                        : "isAlert" in tab && tab.isAlert
                          ? "text-[10px] px-1 rounded bg-error-container text-on-error-container font-bold tabular-nums"
                          : "text-[10px] text-outline tabular-nums"
                    }
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-outline font-medium shrink-0 ml-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSearching ? "bg-secondary-container animate-ping" : "bg-emerald-600"
              }`}
            />
            <span>{isSearching ? copy.telemetrySearching : copy.telemetryLive}</span>
          </div>
        </div>

        {/* 3. SCROLLABLE RESULTS CANVAS */}
        <div className="flex-1 overflow-y-auto palette-scroll divide-y divide-outline-variant/20 bg-surface-container-lowest">
          {visibleSections.length === 0 ? (
            <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-surface-container-low border border-outline-variant/30 flex items-center justify-center text-outline mb-3">
                <span className="material-symbols-outlined text-[24px]">manage_search</span>
              </div>
              <p className="font-title-md text-title-md text-on-surface font-semibold">
                {copy.noMatchesTitle}
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-md">
                {copy.noMatchesBody}
              </p>
            </div>
          ) : (
            visibleSections.map((section) => (
              <div key={section.key} className="p-3">
                <div className="px-2.5 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-label-sm font-label-sm uppercase text-outline tracking-wider">
                      {section.label}
                    </span>
                    {section.key === "COMMANDS" && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest border border-dashed border-outline-variant text-on-surface-variant rounded-xs">
                        [ CORE-01.18 ]
                      </span>
                    )}
                  </div>
                  {section.key === "CONFLICTS" && (
                    <span className="text-[11px] font-semibold text-error flex items-center gap-1">
                      <span className="text-[10px]">◆</span> Live Spatial Matrix
                    </span>
                  )}
                </div>

                <div
                  className={
                    section.key === "PROJECTS" || section.key === "WORK_REQUESTS"
                      ? "relative pl-4 space-y-1 before:content-[''] before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-[1.5px] before:bg-outline-variant/50"
                      : "space-y-1"
                  }
                >
                  {section.items.map((item) => {
                    runningFlatIndex += 1;
                    const idx = runningFlatIndex;
                    const isSelected = idx === safeActiveIndex;
                    const isConflict = item.section === "CONFLICTS";

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => executeEntry(item)}
                        className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded transition-colors group ${
                          isSelected
                            ? isConflict
                              ? "bg-error-container/35 border border-error/30 border-l-[3px] border-l-error"
                              : "bg-secondary-fixed/40 border border-secondary/30 border-l-[3px] border-l-secondary"
                            : isConflict
                              ? "bg-error-container/15 hover:bg-error-container/35 border border-transparent hover:border-error/20"
                              : "hover:bg-surface-container-low border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                              isConflict
                                ? "bg-error text-white shadow-2xs"
                                : isSelected
                                  ? "bg-secondary text-white shadow-2xs"
                                  : "bg-surface-container text-on-surface-variant group-hover:text-on-surface"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {item.materialIcon}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.code && (
                                <span
                                  className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                                    isConflict
                                      ? "bg-error-container text-on-error-container"
                                      : "bg-surface-container-high text-on-surface"
                                  }`}
                                >
                                  {item.code}
                                </span>
                              )}
                              <span className="font-title-md text-[13.5px] font-semibold text-on-surface truncate">
                                {item.title}
                              </span>
                            </div>
                            <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5 mt-0.5 truncate">
                              <span>{item.subtitle}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {item.badgeText && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                item.badgeTone === "critical"
                                  ? "bg-error text-white"
                                  : item.badgeTone === "active"
                                    ? "bg-secondary-fixed text-on-secondary-fixed border border-secondary/20"
                                    : item.badgeTone === "success"
                                      ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                                      : "bg-surface-container-high text-on-surface-variant"
                              }`}
                            >
                              {item.nodeGlyph && <span className="text-[9px]">{item.nodeGlyph}</span>}
                              {item.badgeText}
                            </span>
                          )}
                          {item.shortcut && (
                            <div className="hidden sm:flex items-center gap-1">
                              {item.shortcut.map((key, kIdx) =>
                                key === "then" ? (
                                  <span key={kIdx} className="text-[10px] text-outline">
                                    then
                                  </span>
                                ) : (
                                  <kbd
                                    key={kIdx}
                                    className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-container-lowest border border-outline-variant/50 rounded text-on-surface shadow-2xs"
                                  >
                                    {key}
                                  </kbd>
                                ),
                              )}
                            </div>
                          )}
                          <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-on-surface">
                            keyboard_return
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 4. STICKY COMMAND PALETTE FOOTER */}
        <div className="bg-surface-container-low border-t border-outline-variant/30 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-container-lowest border border-outline-variant/50 rounded text-on-surface shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-container-lowest border border-outline-variant/50 rounded text-on-surface shadow-2xs">
                ↓
              </kbd>
              <span className="font-medium">{copy.navigate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-container-lowest border border-outline-variant/50 rounded text-on-surface shadow-2xs">
                ⏎
              </kbd>
              <span className="font-medium">{copy.execute}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-container-lowest border border-outline-variant/50 rounded text-on-surface shadow-2xs">
                TAB
              </kbd>
              <span className="font-medium">{copy.cycleFilter}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-outline font-medium">
              {copy.scopePrefix}:{" "}
              <strong className="text-on-surface font-semibold">{scopeLabel}</strong> ({roleLabel})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
