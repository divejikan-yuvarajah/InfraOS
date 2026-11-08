"use client";

import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { fetchProjects } from "@/lib/projects/api";
import type { Copy } from "@/lib/documents/messages";
import { useDocKeys } from "@/lib/documents/session";

/** Scope-limited project typeahead: the projects endpoint only returns what the signed-in user may read. */
export function ProjectPicker({ value, label, onChange, copy, disabled, id }: { value: string; label: string; onChange: (id: string, label: string) => void; copy: Copy; disabled?: boolean; id?: string }) {
  const { key } = useDocKeys();
  const listId = useId();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 250); return () => clearTimeout(t); }, [text]);
  const res = useQuery({ queryKey: key("projects", q), enabled: open && !value, queryFn: () => fetchProjects({ page: 1, limit: 8, ...(q ? { q } : {}) }), staleTime: 30_000 });
  if (value) {
    return (
      <span className="dt-chip-x">
        <span>{label}</span>
        <button type="button" aria-label={`${copy.common.clear}: ${label}`} disabled={disabled} onClick={() => { onChange("", ""); setText(""); }}><XIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem" }} /></button>
      </span>
    );
  }
  const projects = res.data?.projects ?? [];
  return (
    <div style={{ position: "relative" }}>
      <input id={id} className="ctr-input" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off" disabled={disabled} placeholder={copy.dashboard.filters.typeToSearch}
        value={text} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setText(e.target.value); setOpen(true); }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      {open ? (
        <ul id={listId} role="listbox" className="ins-menu-list" style={{ left: 0, right: "auto", width: "100%", margin: 0, listStyle: "none" }}>
          {res.isPending ? <li role="status" className="ins-muted" style={{ padding: "0.5rem" }}>{copy.common.loading}</li> : null}
          {!res.isPending && !projects.length ? <li className="ins-muted" style={{ padding: "0.5rem" }}>{copy.wizard.link.noResults}</li> : null}
          {projects.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button type="button" style={{ width: "100%" }} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(p.id, `${p.projectCode} ${p.title}`); setOpen(false); }}>{p.projectCode} · {p.title}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
