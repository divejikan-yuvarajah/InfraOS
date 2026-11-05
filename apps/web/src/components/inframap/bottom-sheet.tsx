"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { snapHeights, snapTo, type Snap } from "@/lib/inframap/sheet-math";

/**
 * Accessible bottom sheet with three snap points (peek / half / full). Dragging starts only from the handle and header, so
 * the content can scroll without fighting the sheet. Release snaps by velocity, tapping the backdrop collapses to peek,
 * Escape closes, focus moves in on open and returns on close, and body scroll is locked only at full height. Safe-area
 * insets are respected and reduced motion removes the animation (see CSS).
 */
type Props = {
  open: boolean; snap: Snap; onSnap: (s: Snap) => void; onClose: () => void;
  title: string; closeLabel: string; handleLabel: string; header?: ReactNode; children: ReactNode; className?: string;
};

export function BottomSheet({ open, snap, onSnap, onClose, title, closeLabel, handleLabel, header, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const [drag, setDrag] = useState<number | null>(null);
  const gesture = useRef<{ startY: number; startH: number; lastY: number; lastT: number; velocity: number } | null>(null);

  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // Focus in on open, back to the opener on close.
  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => { returnTo.current?.focus?.(); };
  }, [open]);

  // Body scroll is locked only while the sheet is full.
  useEffect(() => {
    if (!open || snap !== "full") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, snap]);

  if (!open) return null;
  const heights = snapHeights(vh);
  const height = drag ?? heights[snap];

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture.current = { startY: e.clientY, startH: heights[snap], lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
  };
  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dt = Math.max(1, e.timeStamp - g.lastT);
    g.velocity = (g.lastY - e.clientY) / dt;
    g.lastY = e.clientY; g.lastT = e.timeStamp;
    setDrag(Math.max(40, Math.min(heights.full, g.startH + (g.startY - e.clientY))));
  };
  const up = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || drag === null) { setDrag(null); return; }
    const h = drag;
    setDrag(null);
    if (h < heights.peek * 0.55 && g.velocity <= 0) { onClose(); return; }
    onSnap(snapTo(h, g.velocity, vh));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key === "Tab" && snap === "full" && ref.current) {
      const f = [...ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return (
    <>
      {snap !== "peek" ? <div className="im-sheet-backdrop" aria-hidden="true" onClick={() => onSnap("peek")} /> : null}
      <div ref={ref} className={`im-sheet ${className ?? ""}`} role="dialog" aria-modal={snap === "full"} aria-label={title} tabIndex={-1} data-snap={snap} data-dragging={drag !== null} style={{ height }} onKeyDown={onKey}>
        <div className="im-sheet-grip" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <button type="button" className="im-sheet-handle" aria-label={handleLabel} onClick={() => onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek")}><span aria-hidden="true" /></button>
          <div className="im-sheet-head"><strong>{title}</strong>{header}<button type="button" className="im-x" aria-label={closeLabel} onClick={onClose}><XIcon aria-hidden="true" /></button></div>
        </div>
        <div className="im-sheet-body" data-scroll={snap !== "peek"}>{children}</div>
      </div>
    </>
  );
}
