"use client";

import { useState } from "react";

import type { Copy } from "@/lib/finance/messages";
import { percentFromBp } from "@/lib/finance/money";
import type { PortfolioRow } from "@/lib/finance/types";
import { fill, quadrantPoints, spendingAhead, type QuadrantPoint } from "@/lib/finance/view";

const W = 420, H = 330, L = 40, R = 14, T = 12, B = 34;
const px = (v: number) => L + (v / 100) * (W - L - R);
const py = (v: number) => H - B - (v / 100) * (H - T - B);

/**
 * Spend-vs-progress quadrant: x = physical progress, y = financial progress, diagonal = parity. Solid dots rest on verified progress, hollow
 * dots on reported progress nobody has verified. A project without a progress figure is not plotted. Keyboard: each dot is focusable and the
 * arrow keys move between dots in plot order; Enter or Space selects.
 */
export function SpendQuadrant({ rows, copy, onSelect, selectedId }: { rows: PortfolioRow[]; copy: Copy; onSelect: (id: string) => void; selectedId: string | null }) {
  const points = quadrantPoints(rows).sort((a, b) => a.x - b.x || a.y - b.y);
  const [focus, setFocus] = useState<QuadrantPoint | null>(null);
  const refs = new Map<string, SVGGElement | null>();
  if (points.length === 0) return <p className="ctr-small" role="status">{copy.dashboard.quadrant.empty}</p>;
  const move = (index: number, dir: 1 | -1) => { const next = points[(index + dir + points.length) % points.length]!; refs.get(next.id)?.focus(); };
  const color = (p: QuadrantPoint) => (p.severity === "HIGH" ? "var(--infra-maroon)" : p.severity === "MEDIUM" ? "var(--infra-yellow-text)" : "var(--infra-text)");
  return (
    <div>
      <svg className="fin-quadrant" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={copy.dashboard.quadrant.title}>
        <polygon points={`${px(0)},${py(10)} ${px(90)},${py(100)} ${px(0)},${py(100)}`} fill="var(--infra-maroon)" opacity="0.07"><title>{copy.dashboard.quadrant.ahead}</title></polygon>
        <line x1={px(0)} y1={py(0)} x2={px(100)} y2={py(100)} stroke="currentColor" strokeDasharray="5 4" opacity="0.45"><title>{copy.dashboard.quadrant.parity}</title></line>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}><line x1={px(t)} y1={py(0)} x2={px(t)} y2={py(0) + 4} stroke="currentColor" opacity="0.4" /><text x={px(t)} y={py(0) + 15} textAnchor="middle">{t}%</text><text x={L - 6} y={py(t) + 3} textAnchor="end">{t}%</text></g>
        ))}
        <line x1={px(0)} y1={py(0)} x2={px(100)} y2={py(0)} stroke="currentColor" opacity="0.4" /><line x1={px(0)} y1={py(0)} x2={px(0)} y2={py(100)} stroke="currentColor" opacity="0.4" />
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle">{copy.dashboard.quadrant.x}</text>
        <text x={10} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 10 ${(T + H - B) / 2})`}>{copy.dashboard.quadrant.y}</text>
        {points.map((p, i) => {
          const label = fill(copy.dashboard.quadrant.point, { code: p.code, fin: percentFromBp(Math.round(p.y * 100)), phys: percentFromBp(Math.round(p.x * 100)) }) + ` · ${copy.basis[p.basis]}`;
          return (
            <g key={p.id} ref={(el) => { refs.set(p.id, el); }} className="fin-dot" tabIndex={0} role="button" aria-label={label} aria-pressed={selectedId === p.id}
              onClick={() => onSelect(p.id)} onFocus={() => setFocus(p)} onMouseEnter={() => setFocus(p)} onBlur={() => setFocus(null)} onMouseLeave={() => setFocus(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); move(i, 1); }
                else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); move(i, -1); }
                else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id); }
              }}>
              <circle className="ring" cx={px(p.x)} cy={py(p.y)} r="11" fill="transparent" stroke={selectedId === p.id ? "var(--infra-orange-text)" : "transparent"} strokeWidth="2.5" />
              <circle cx={px(p.x)} cy={py(p.y)} r="6.5" fill={p.basis === "VERIFIED_INSPECTION" ? color(p) : "#fff"} stroke={color(p)} strokeWidth="2.5" />
              <title>{label}</title>
            </g>
          );
        })}
      </svg>
      <div className="fin-legend" aria-hidden="false">
        <span><i className="is-solid" />{copy.dashboard.quadrant.verifiedDot}</span><span><i />{copy.dashboard.quadrant.reportedDot}</span><span>┄ {copy.dashboard.quadrant.parity}</span><span>▨ {copy.dashboard.quadrant.ahead}</span>
      </div>
      <p className="ctr-small" role="status" aria-live="polite">{focus ? `${focus.code} — ${focus.title}${spendingAhead(focus) ? ` · ${copy.dashboard.quadrant.ahead}` : ""}` : copy.dashboard.quadrant.keyboard}</p>
    </div>
  );
}
