"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { COMMANDS, matchCommands, SHORTCUTS, type Command, type CommandCtx } from "@/lib/inframap/commands";
import type { SearchData, SearchItem } from "@/lib/inframap/inframap-api";
import type { B3Copy } from "@/lib/inframap/inframap-copy-b3";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";

type Row = { kind: "record"; item: SearchItem } | { kind: "command"; command: Command };

/** Ctrl/Cmd-K palette: records (server search) plus every registered command. Each row really runs. */
export default function CommandPalette({ open, onOpenChange, c3, copy, ctx, search, onRecord, queryKey }: {
  open: boolean; onOpenChange: (open: boolean) => void; c3: B3Copy; copy: InframapCopy; ctx: CommandCtx;
  search: (q: string, signal: AbortSignal) => Promise<SearchData>; onRecord: (item: SearchItem) => void; queryKey: readonly unknown[];
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  const records = useQuery({ queryKey: [...queryKey, "palette", debounced], queryFn: ({ signal }) => search(debounced, signal), enabled: open && debounced.length >= 2, staleTime: 15_000, retry: false });

  const commands = useMemo(() => matchCommands(COMMANDS, c3.commands, ctx, q), [ctx, c3.commands, q]);
  const recordRows: Row[] = (records.data?.groups ?? []).flatMap((g) => g.items.slice(0, 4)).slice(0, 8).map((item) => ({ kind: "record", item }));
  const rows: Row[] = [...(debounced.length >= 2 ? recordRows : []), ...commands.map((command): Row => ({ kind: "command", command }))];
  const safeActive = Math.min(active, Math.max(0, rows.length - 1));

  const run = (row: Row | undefined) => {
    if (!row) return;
    onOpenChange(false);
    setQ("");
    if (row.kind === "record") onRecord(row.item); else row.command.run(ctx);
  };
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-row="${safeActive}"]`)?.scrollIntoView({ block: "nearest" }); }, [safeActive]);

  let lastSection = "";
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(""); }}>
      <DialogContent className="im-palette" showCloseButton={false}>
        <DialogTitle className="sr-only">{c3.pal.title}</DialogTitle>
        <DialogDescription className="sr-only">{c3.pal.hint}</DialogDescription>
        <input
          autoFocus role="combobox" aria-expanded="true" aria-controls="im-pal-list" aria-activedescendant={rows.length ? `im-pal-${safeActive}` : undefined} aria-label={c3.pal.title}
          className="im-pal-input" placeholder={c3.pal.placeholder} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(rows.length - 1, safeActive + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, safeActive - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); run(rows[safeActive]); }
          }}
        />
        <ul id="im-pal-list" ref={listRef} role="listbox" aria-label={c3.pal.title} className="im-pal-list">
          {rows.length === 0 ? <li className="rs-help" role="presentation">{c3.pal.empty}</li> : rows.map((row, i) => {
            const section = row.kind === "record" ? c3.pal.records : c3.pal[row.command.section];
            const head = section !== lastSection ? (lastSection = section) : null;
            return (
              <li key={row.kind === "record" ? `r${row.item.layer}${row.item.id}` : row.command.id} role="presentation">
                {head ? <p className="im-legend-h">{head}</p> : null}
                <div id={`im-pal-${i}`} data-row={i} role="option" aria-selected={i === safeActive} className="im-pal-row" onMouseMove={() => setActive(i)} onClick={() => run(row)}>
                  {row.kind === "record"
                    ? <><span>{row.item.title}</span><small>{(copy.layers as Record<string, string>)[row.item.layer] ?? row.item.layer}</small></>
                    : <span>{c3.commands[row.command.id] ?? row.command.id}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="rs-help im-pal-hint">{c3.pal.hint}</p>
      </DialogContent>
    </Dialog>
  );
}


export function ShortcutsHelp({ open, onOpenChange, c3 }: { open: boolean; onOpenChange: (o: boolean) => void; c3: B3Copy }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{c3.keys.title}</DialogTitle>
        <DialogDescription className="sr-only">{c3.keys.title}</DialogDescription>
        <dl className="im-keys">
          {SHORTCUTS.map((s) => <div key={s.id}><dt><kbd>{s.keys}</kbd></dt><dd>{c3.keys.items[s.id]}</dd></div>)}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
