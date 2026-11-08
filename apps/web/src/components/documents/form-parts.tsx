"use client";

import { useState } from "react";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_GROUPS, DOCUMENT_LIMITS } from "@infraos/shared-types";

import type { Copy } from "@/lib/documents/messages";

/** Grouped category list. `suggested` only marks a badge; the user always confirms. `inspectorOnly` narrows to what the registry endpoint returned for the role. */
export function CategoryPicker({ value, onChange, copy, suggested, allowed, disabled }: { value: string; onChange: (key: string) => void; copy: Copy; suggested?: string; allowed?: string[]; disabled?: boolean }) {
  return (
    <div className="dt-catgrid" role="radiogroup" aria-label={copy.wizard.classify.category}>
      {DOCUMENT_CATEGORY_GROUPS.map((g) => {
        const cats = DOCUMENT_CATEGORIES.filter((c) => c.group === g && (!allowed || allowed.includes(c.key)));
        if (!cats.length) return null;
        return (
          <fieldset key={g}><legend>{(copy.group as Record<string, string>)[g]}</legend>
            {cats.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={value === c.key} disabled={disabled} className="dt-pill" onClick={() => onChange(c.key)}>
                {(copy.category as Record<string, string>)[c.key]}{suggested === c.key ? <span className="dt-suggest">{copy.wizard.classify.suggested}</span> : null}
              </button>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

/** Enter or comma adds a tag (lowercased, unique, max 40 chars, max 15). Backspace on an empty box removes the last one. */
export function TagsInput({ value, onChange, copy, id, disabled }: { value: string[]; onChange: (tags: string[]) => void; copy: Copy; id?: string; disabled?: boolean }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().slice(0, 40);
    if (!t || value.includes(t) || value.length >= DOCUMENT_LIMITS.maxTags) { setText(""); return; }
    onChange([...value, t]); setText("");
  };
  return (
    <div className="dt-tags">
      {value.map((t) => <span key={t} className="dt-chip-x">#{t}<button type="button" disabled={disabled} aria-label={`${copy.common.remove}: ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button></span>)}
      <input id={id} value={text} disabled={disabled} maxLength={40} aria-label={copy.wizard.classify.tags} onChange={(e) => setText(e.target.value.replace(",", ""))} onBlur={() => add(text)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(text); } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1)); }} />
    </div>
  );
}
