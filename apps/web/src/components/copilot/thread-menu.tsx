"use client";

import { HistoryIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import { formatDateTime } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";
import type { CopilotMessages } from "@/lib/copilot/messages";
import type { CopilotThreadSummaryDto } from "@/lib/copilot/types";

export function ThreadMenu({
  threads,
  activeThreadId,
  loading,
  copy,
  locale,
  onOpenMenu,
  onNewChat,
  onSelectThread,
  onDeleteThread,
}: {
  threads: readonly CopilotThreadSummaryDto[];
  activeThreadId?: string;
  loading: boolean;
  copy: CopilotMessages;
  locale: AuthLocale;
  onOpenMenu: () => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
}) {
  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (open) onOpenMenu();
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="cop-icon-btn"
          aria-label={copy.header.menuAria}
          title={copy.header.menuAria}
        >
          <HistoryIcon aria-hidden="true" style={{ width: "1rem", height: "1rem" }} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[60] min-w-[270px] max-w-[340px] max-h-[65vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg text-slate-900"
        >
          <DropdownMenu.Item
            onSelect={() => onNewChat()}
            className="flex items-center gap-2 rounded px-2.5 py-2 text-xs font-semibold hover:bg-slate-100 cursor-pointer outline-none"
          >
            <PlusIcon aria-hidden="true" style={{ width: "0.95rem", height: "0.95rem" }} />
            <span>{copy.header.newChat}</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-[1px] bg-slate-200" />
          <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {copy.header.historyHeading}
          </div>

          {loading ? (
            <div className="px-2.5 py-3 text-xs text-slate-500">...</div>
          ) : threads.length === 0 ? (
            <div className="px-2.5 py-3 text-xs text-slate-500">{copy.header.emptyHistory}</div>
          ) : (
            threads.map((th) => (
              <div
                key={th.threadId}
                className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-100"
                style={
                  activeThreadId === th.threadId
                    ? { background: "#fff4ed", borderLeft: "2px solid var(--infra-orange)" }
                    : undefined
                }
              >
                <DropdownMenu.Item
                  onSelect={() => onSelectThread(th.threadId)}
                  className="flex-1 min-w-0 px-1.5 py-1.5 text-left cursor-pointer outline-none"
                >
                  <div className="truncate text-xs font-semibold">{th.title}</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {copy.header.turnsCount.replace("{n}", String(th.turnsCount))} ·{" "}
                    {formatDateTime(th.lastAt, locale)}
                  </div>
                </DropdownMenu.Item>
                <button
                  type="button"
                  className="cop-icon-btn"
                  aria-label={`${copy.header.deleteThread}: ${th.title}`}
                  title={copy.header.deleteThread}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(th.threadId);
                  }}
                >
                  <Trash2Icon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem" }} />
                </button>
              </div>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
