"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { B3Copy } from "@/lib/inframap/inframap-copy-b3";
import { MAX_VIEWS, type SavedView } from "@/lib/inframap/local-store";

/** Saved views (this device only) and the copy-link fallback. Both are plain dialogs so focus trapping and Escape come for free. */
export function SavedViewsDialog({ open, onOpenChange, c3, views, onSave, onApply, onRename, onDelete }: {
  open: boolean; onOpenChange: (o: boolean) => void; c3: B3Copy; views: SavedView[];
  onSave: (name: string) => void; onApply: (v: SavedView) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const s = c3.share;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{s.views}</DialogTitle>
        <DialogDescription>{s.deviceOnly}</DialogDescription>
        <form className="im-views-save" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onSave(name); setName(""); } }}>
          <label className="sr-only" htmlFor="im-view-name">{s.name}</label>
          <input id="im-view-name" className="im-input" value={name} maxLength={60} placeholder={s.name} onChange={(e) => setName(e.target.value)} disabled={views.length >= MAX_VIEWS} />
          <button type="submit" className="rs-btn is-primary" disabled={!name.trim() || views.length >= MAX_VIEWS}>{s.saveAs}</button>
        </form>
        {views.length >= MAX_VIEWS ? <p className="rs-help">{s.limit}</p> : null}
        {views.length === 0 ? <p className="rs-help">{s.empty}</p> : (
          <ul className="im-views">
            {views.map((v) => (
              <li key={v.id}>
                {editing?.id === v.id ? (
                  <form className="im-views-save" onSubmit={(e) => { e.preventDefault(); onRename(v.id, editing.name); setEditing(null); }}>
                    <input className="im-input" aria-label={s.rename} value={editing.name} maxLength={60} autoFocus onChange={(e) => setEditing({ id: v.id, name: e.target.value })} />
                    <button type="submit" className="rs-btn">{s.saveAs}</button>
                  </form>
                ) : (
                  <>
                    <span>{v.name}</span>
                    <button type="button" className="rs-btn" onClick={() => { onApply(v); onOpenChange(false); }}>{s.apply}</button>
                    <button type="button" className="rs-btn" onClick={() => setEditing({ id: v.id, name: v.name })}>{s.rename}</button>
                    <button type="button" className="rs-btn" onClick={() => onDelete(v.id)}>{s.delete}</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function LinkFallbackDialog({ open, onOpenChange, c3, url }: { open: boolean; onOpenChange: (o: boolean) => void; c3: B3Copy; url: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{c3.share.fallbackTitle}</DialogTitle>
        <DialogDescription>{c3.share.fallbackHelp}</DialogDescription>
        <input className="im-input" readOnly value={url} aria-label={c3.share.fallbackTitle} onFocus={(e) => e.currentTarget.select()} autoFocus />
      </DialogContent>
    </Dialog>
  );
}
