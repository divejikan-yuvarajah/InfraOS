"use client";

import { useState } from "react";
import { TableIcon, ScatterChartIcon } from "lucide-react";
import type { RiskScatterItemDto } from "@/lib/risk/types";
import {
  DEFAULT_SCATTER_PADDING,
  getAxisTicks,
  getDiagonalLinePath,
  getFinancialAheadPolygonPoints,
  scaleX,
  scaleY,
} from "@/lib/risk/chart-math";
import { LEVEL_CONFIG } from "@/lib/risk/view";

const SVG_WIDTH = 640;
const SVG_HEIGHT = 440;

export function FinVsPhysChart({
  points,
  onSelectProject,
  className = "",
}: {
  points?: RiskScatterItemDto[];
  onSelectProject: (projectId: string) => void;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<RiskScatterItemDto | null>(null);

  const data = points ?? [];
  const xTicks = getAxisTicks(SVG_WIDTH, true, DEFAULT_SCATTER_PADDING);
  const yTicks = getAxisTicks(SVG_HEIGHT, false, DEFAULT_SCATTER_PADDING);
  const diagonalPath = getDiagonalLinePath(SVG_WIDTH, SVG_HEIGHT, DEFAULT_SCATTER_PADDING);
  const shadedPoints = getFinancialAheadPolygonPoints(SVG_WIDTH, SVG_HEIGHT, DEFAULT_SCATTER_PADDING);

  return (
    <div
      className={`rounded-lg border border-border bg-surface p-4 shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Financial vs Physical Progress Map
          </h3>
          <p className="text-xs text-text-muted">
            Highlights potential expenditure lead anomalies where disbursements outpace site work.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((t) => !t)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-container-low focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={showTable ? "Switch to scatter view" : "Switch to accessible table view"}
        >
          {showTable ? (
            <>
              <ScatterChartIcon className="size-3.5" aria-hidden="true" />
              <span>Scatter View</span>
            </>
          ) : (
            <>
              <TableIcon className="size-3.5" aria-hidden="true" />
              <span>Table Alternative</span>
            </>
          )}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-left text-xs border-collapse">
            <caption className="sr-only">Financial and physical progress for active projects</caption>
            <thead>
              <tr className="border-b border-border bg-surface-container-low/50 font-semibold text-text-secondary">
                <th scope="col" className="p-2">Project Code</th>
                <th scope="col" className="p-2">Title</th>
                <th scope="col" className="p-2 text-right">Physical %</th>
                <th scope="col" className="p-2 text-right">Financial %</th>
                <th scope="col" className="p-2">Gap (Fin - Phys)</th>
                <th scope="col" className="p-2">Risk Level</th>
                <th scope="col" className="p-2">Basis</th>
                <th scope="col" className="p-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.map((p) => {
                const gap = p.financialPct - p.physicalPct;
                return (
                  <tr key={p.projectId} className="hover:bg-surface-container-low/40">
                    <td className="p-2 font-mono font-medium">{p.projectCode}</td>
                    <td className="p-2 truncate max-w-[200px]" title={p.title}>
                      {p.title}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">{p.physicalPct}%</td>
                    <td className="p-2 text-right font-mono tabular-nums">{p.financialPct}%</td>
                    <td
                      className={`p-2 font-mono tabular-nums ${
                        gap > 15 ? "text-rose-600 font-bold" : gap > 0 ? "text-amber-600" : "text-text-muted"
                      }`}
                    >
                      {gap > 0 ? `+${gap}%` : `${gap}%`}
                    </td>
                    <td className="p-2">
                      <span className="font-semibold text-[11px]">{p.level}</span>
                    </td>
                    <td className="p-2 text-text-muted text-[11px]">{p.basis}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => onSelectProject(p.projectId)}
                        className="text-infra-orange hover:underline font-medium"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-auto select-none overflow-visible"
            role="img"
            aria-label="Scatter plot of financial progress versus physical progress"
          >
            {/* Shaded "Financial ahead" polygon */}
            <polygon
              points={shadedPoints}
              fill="rgba(249, 115, 22, 0.06)"
              stroke="none"
            />
            <text
              x={scaleX(15, SVG_WIDTH, DEFAULT_SCATTER_PADDING)}
              y={scaleY(80, SVG_HEIGHT, DEFAULT_SCATTER_PADDING)}
              className="fill-orange-700/40 text-[11px] font-medium pointer-events-none select-none italic dark:fill-orange-400/40"
            >
              Financial Ahead Zone (Risk Exposure)
            </text>

            {/* Grid Lines */}
            {xTicks.map((t) => (
              <line
                key={`x-grid-${t.value}`}
                x1={t.coord}
                y1={DEFAULT_SCATTER_PADDING.top}
                x2={t.coord}
                y2={SVG_HEIGHT - DEFAULT_SCATTER_PADDING.bottom}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="2,2"
              />
            ))}
            {yTicks.map((t) => (
              <line
                key={`y-grid-${t.value}`}
                x1={DEFAULT_SCATTER_PADDING.left}
                y1={t.coord}
                x2={SVG_WIDTH - DEFAULT_SCATTER_PADDING.right}
                y2={t.coord}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="2,2"
              />
            ))}

            {/* Parity Diagonal Line (Fin% = Phys%) */}
            <path
              d={diagonalPath}
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />

            {/* Ticks and Axis Labels */}
            {xTicks.map((t) => (
              <text
                key={`x-label-${t.value}`}
                x={t.coord}
                y={SVG_HEIGHT - DEFAULT_SCATTER_PADDING.bottom + 18}
                textAnchor="middle"
                className="fill-text-secondary text-[10px] font-mono"
              >
                {t.value}%
              </text>
            ))}
            {yTicks.map((t) => (
              <text
                key={`y-label-${t.value}`}
                x={DEFAULT_SCATTER_PADDING.left - 10}
                y={t.coord + 3}
                textAnchor="end"
                className="fill-text-secondary text-[10px] font-mono"
              >
                {t.value}%
              </text>
            ))}

            <text
              x={SVG_WIDTH / 2}
              y={SVG_HEIGHT - 10}
              textAnchor="middle"
              className="fill-text-primary text-xs font-medium"
            >
              Physical Site Progress (%) →
            </text>

            <text
              x={14}
              y={SVG_HEIGHT / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${SVG_HEIGHT / 2})`}
              className="fill-text-primary text-xs font-medium"
            >
              Financial Disbursement (%) →
            </text>

            {/* Data Points */}
            {data.map((pt) => {
              const cx = scaleX(pt.physicalPct, SVG_WIDTH, DEFAULT_SCATTER_PADDING);
              const cy = scaleY(pt.financialPct, SVG_HEIGHT, DEFAULT_SCATTER_PADDING);
              const config = LEVEL_CONFIG[pt.level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.LOW;
              const isVerified = pt.basis === "VERIFIED";

              return (
                <g
                  key={pt.projectId}
                  tabIndex={0}
                  role="button"
                  aria-label={`${pt.projectCode}: ${pt.title}, Physical: ${pt.physicalPct}%, Financial: ${pt.financialPct}%, Level: ${pt.level}`}
                  onClick={() => onSelectProject(pt.projectId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectProject(pt.projectId);
                    }
                  }}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="cursor-pointer focus:outline-none"
                >
                  {/* Outer halo */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hoveredPoint?.projectId === pt.projectId ? 9 : 6}
                    fill={isVerified ? config.hex : "white"}
                    stroke={config.hex}
                    strokeWidth={isVerified ? 1.5 : 2.5}
                    className="transition-all duration-150 hover:brightness-110 drop-shadow-2xs"
                  />
                  {/* Center glyph indicator if critical/high */}
                  {pt.level === "CRITICAL" ? (
                    <polygon
                      points={`${cx},${cy - 3.5} ${cx + 3.5},${cy} ${cx},${cy + 3.5} ${cx - 3.5},${cy}`}
                      fill="white"
                      className="pointer-events-none"
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>

          {/* Tooltip on hover */}
          {hoveredPoint ? (
            <div
              className="pointer-events-none absolute z-20 rounded-md border border-border bg-surface p-2 shadow-lg text-xs space-y-0.5 max-w-xs"
              style={{
                left: `${scaleX(hoveredPoint.physicalPct, SVG_WIDTH, DEFAULT_SCATTER_PADDING)}px`,
                top: `${scaleY(hoveredPoint.financialPct, SVG_HEIGHT, DEFAULT_SCATTER_PADDING) - 70}px`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="flex items-center justify-between gap-2 font-mono font-bold text-infra-orange">
                <span>{hoveredPoint.projectCode}</span>
                <span className="text-[10px] text-text-muted">{hoveredPoint.basis}</span>
              </div>
              <p className="truncate text-text-primary font-medium">{hoveredPoint.title}</p>
              <div className="flex items-center gap-3 text-[11px] text-text-secondary">
                <span>Phys: {hoveredPoint.physicalPct}%</span>
                <span>Fin: {hoveredPoint.financialPct}%</span>
                <span className="font-semibold text-text-primary">{hoveredPoint.level}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-text-secondary">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-emerald-500" /> Low
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-amber-500" /> Moderate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-orange-500" /> High
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-rose-600" /> Critical
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-slate-700" /> Verified Basis
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full border border-slate-700 bg-white" /> Reported Basis
          </span>
        </div>
      </div>
    </div>
  );
}
