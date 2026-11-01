import Link from "next/link";
import type { ReactNode } from "react";
import { CircleDashedIcon, EyeOffIcon, FlaskConicalIcon, MegaphoneIcon, ReceiptIcon, type LucideIcon } from "lucide-react";

import {
  dualProgress,
  HONESTY_COPY,
  lifecycleRail,
  statusNode,
  statusText,
  type HonestyKind,
  type NodeShape,
  type StatusDomain,
} from "@/lib/design/site-plan";

import "@/styles/site-plan.css";

/* ---------- StatusNode: route-line node shape ---------- */

const SHAPES: Record<NodeShape, ReactNode> = {
  dash: <path d="M3 7h8" strokeWidth="2.5" strokeLinecap="round" />,
  ring: <circle cx="7" cy="7" r="4.25" strokeWidth="2" fill="none" />,
  half: (
    <>
      <circle cx="7" cy="7" r="4.25" strokeWidth="2" fill="none" />
      <path d="M7 2.75a4.25 4.25 0 0 1 0 8.5Z" fill="currentColor" stroke="none" />
    </>
  ),
  filled: <circle cx="7" cy="7" r="5" fill="currentColor" stroke="none" />,
  diamond: <path d="M7 1.5 12.5 7 7 12.5 1.5 7Z" fill="currentColor" stroke="none" />,
  check: (
    <>
      <circle cx="7" cy="7" r="5.5" fill="currentColor" stroke="none" />
      <path d="m4.6 7.1 1.7 1.7 3.2-3.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cross: (
    <>
      <circle cx="7" cy="7" r="4.25" strokeWidth="2" fill="none" />
      <path d="m5 5 4 4M9 5l-4 4" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
};

/** Decorative: always rendered next to a text label. */
export function StatusNode({ domain, status }: { domain: StatusDomain; status: string }) {
  const node = statusNode(domain, status);
  return (
    <svg className="sp-node" data-tone={node.tone} viewBox="0 0 14 14" stroke="currentColor" aria-hidden="true" focusable="false">
      {SHAPES[node.shape]}
    </svg>
  );
}

/** Status chip: node shape + tone + text. The label is the accessible name. */
export function StatusChip({ domain, status, label }: { domain: StatusDomain; status: string; label?: string }) {
  return (
    <span className="sp-chip" data-tone={statusNode(domain, status).tone}>
      <StatusNode domain={domain} status={status} />
      {label ?? statusText(status)}
    </span>
  );
}

/* ---------- HonestyChip ---------- */

const HONESTY_ICONS: Record<HonestyKind, LucideIcon> = {
  provisional: ReceiptIcon,
  reported: MegaphoneIcon,
  unavailable: CircleDashedIcon,
  withheld: EyeOffIcon,
  demo: FlaskConicalIcon,
};

export function HonestyChip({ kind, label }: { kind: HonestyKind; label?: string }) {
  const Icon = HONESTY_ICONS[kind];
  const copy = HONESTY_COPY[kind];
  return (
    <span className="sp-honesty" data-kind={kind} title={copy.hint}>
      <Icon aria-hidden="true" />
      {label ?? copy.label}
      <span className="mc-sr">: {copy.hint}</span>
    </span>
  );
}

/* ---------- LifecycleRail ---------- */

export function LifecycleRail({ status, labels }: { status: string; labels?: Partial<Record<string, string>> }) {
  const rail = lifecycleRail(status);
  const name = (s: string) => labels?.[s] ?? statusText(s);
  return (
    <div>
      <ol className="sp-rail" aria-label="Project lifecycle">
        {rail.steps.map((step) => (
          <li key={step.status} className="sp-rail-step" data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
            <span className="sp-rail-dot" aria-hidden="true" />
            <span>
              {name(step.status)}
              <span className="mc-sr">{step.state === "done" ? " (passed)" : step.state === "current" ? " (current stage)" : " (not reached)"}</span>
            </span>
          </li>
        ))}
      </ol>
      {rail.branch ? (
        <p className="sp-rail-branch">
          <StatusChip domain="project" status={rail.branch} label={name(rail.branch)} />
          <span>{rail.terminated ? "Lifecycle ended here." : "Off the main path."}</span>
        </p>
      ) : null}
    </div>
  );
}

/* ---------- DualProgress ---------- */

export function DualProgress({ physical, financial, names }: { physical: number | null | undefined; financial: number | null | undefined; names?: { physical?: string; financial?: string } }) {
  const tracks = dualProgress(physical, financial);
  return (
    <div className="sp-progress">
      {tracks.map((t) => {
        const title = t.kind === "physical" ? (names?.physical ?? "Physical progress") : (names?.financial ?? "Financial progress");
        return (
          <div key={t.kind}>
            <div className="sp-track-head">
              <span className="sp-track-name">{title}</span>
              <span className="sp-track-value">
                {t.value === null ? "—" : `${t.value}%`}
                <HonestyChip kind={t.honesty} />
              </span>
            </div>
            <div
              className="sp-track"
              data-kind={t.kind}
              data-unavailable={t.value === null ? "true" : undefined}
              role={t.value === null ? undefined : "progressbar"}
              aria-label={t.value === null ? undefined : `${title}: ${t.label}`}
              aria-valuemin={t.value === null ? undefined : 0}
              aria-valuemax={t.value === null ? undefined : 100}
              aria-valuenow={t.value ?? undefined}
            >
              {t.value !== null ? <div className="sp-track-fill" style={{ width: `${t.value}%` }} /> : <span className="mc-sr">{t.label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- FactsList ---------- */

export type Fact = { label: string; value: ReactNode | null | undefined; missing?: string };

export function FactsList({ facts, label }: { facts: Fact[]; label?: string }) {
  return (
    <dl className="sp-facts" aria-label={label}>
      {facts.map((f) => {
        const missing = f.value === null || f.value === undefined || f.value === "";
        return (
          <div key={f.label} className="sp-fact">
            <dt>{f.label}</dt>
            <dd data-missing={missing ? "true" : undefined}>{missing ? (f.missing ?? "Not provided") : f.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ---------- ContextBar: breadcrumb + scope + as-of + actions ---------- */

export type Crumb = { label: string; href?: string };

export function ContextBar({ crumbs, scope, asOf, actions }: { crumbs: Crumb[]; scope?: string | null; asOf?: string | null; actions?: ReactNode }) {
  return (
    <div className="sp-context">
      <nav aria-label="Breadcrumb" style={{ minWidth: 0 }}>
        <ol className="sp-crumbs">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${c.label}-${i}`} style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                {c.href && !last ? <Link href={c.href}>{c.label}</Link> : <span aria-current={last ? "page" : undefined}>{c.label}</span>}
                {!last ? <span className="sp-crumb-sep" aria-hidden="true">/</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      {scope || asOf || actions ? (
        <div className="sp-context-meta">
          {scope ? <span className="sp-scope">{scope}</span> : null}
          {asOf ? <span className="sp-asof">As of {asOf}</span> : null}
          {actions ? <span className="sp-actions">{actions}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
