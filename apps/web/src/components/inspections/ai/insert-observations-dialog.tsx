"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { insertConfirmedVisionObservations } from "@/lib/inspections/ai/api";
import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { InspectionAiAnalysisView } from "@/lib/inspections/ai/types";
import { reviewableItemsOf } from "@/lib/inspections/ai/view";
import { fill } from "@/lib/inspections/view";

import "@/styles/contractors.css";
import "@/styles/inspections.css";

function InsertObservationsBody({
  inspectionId,
  analysis,
  copy,
  onClose,
  onInserted,
}: {
  inspectionId: string;
  analysis: InspectionAiAnalysisView;
  copy: InspectionAiMessages;
  onClose: () => void;
  onInserted: (texts: string[]) => void;
}) {
  const confirmedItems = useMemo(() => {
    const saved = analysis.inspectorReview?.decisions ?? {};
    return reviewableItemsOf(analysis.result, copy).filter(
      (item) => saved[item.key]?.decision === "CONFIRMED",
    );
  }, [analysis.inspectorReview?.decisions, analysis.result, copy]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => confirmedItems.map((i) => i.key));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleInsert = async () => {
    if (selectedKeys.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await insertConfirmedVisionObservations(
        inspectionId,
        analysis.id,
        selectedKeys,
      );
      const texts = response.insertedObservations.map((x) => x.text);
      toast.success(fill(copy.insertDialog.insertedToast, { n: texts.length }));
      onInserted(texts);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not insert confirmed observations.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ display: "grid", gap: "0.55rem", fontSize: "0.86rem" }}>
        <div style={{ fontWeight: 600 }}>{copy.insertDialog.selectLabel}</div>
        {confirmedItems.map((item) => {
          const checked = selectedKeys.includes(item.key);
          return (
            <label
              key={item.key}
              className="ins-ai-obs"
              data-decision={checked ? "CONFIRMED" : ""}
              style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(item.key)}
                disabled={submitting}
                style={{ marginTop: "0.2rem" }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{item.label}</div>
                <div className="ins-muted" style={{ marginTop: "0.2rem" }}>{item.previewText}</div>
              </div>
            </label>
          );
        })}
        {error ? (
          <p className="ctr-error" role="alert" style={{ margin: 0 }}>{error}</p>
        ) : null}
      </div>

      <DialogFooter className="ctr-row" style={{ gap: "0.5rem", marginTop: "0.6rem" }}>
        <button type="button" className="ctr-btn is-ghost" onClick={onClose} disabled={submitting}>
          {copy.insertDialog.cancel}
        </button>
        <button
          type="button"
          className="ctr-btn is-primary"
          disabled={selectedKeys.length === 0 || submitting}
          onClick={() => void handleInsert()}
        >
          {submitting ? copy.insertDialog.inserting : copy.insertDialog.insertButton}
        </button>
      </DialogFooter>
    </>
  );
}

export function InsertObservationsDialog({
  open,
  inspectionId,
  analysis,
  copy,
  onOpenChange,
  onInserted,
}: {
  open: boolean;
  inspectionId: string;
  analysis: InspectionAiAnalysisView;
  copy: InspectionAiMessages;
  onOpenChange: (open: boolean) => void;
  onInserted: (texts: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl ctr-dialog max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.insertDialog.title}</DialogTitle>
          <DialogDescription>{copy.insertDialog.subtitle}</DialogDescription>
        </DialogHeader>
        {open ? (
          <InsertObservationsBody
            key={analysis.id}
            inspectionId={inspectionId}
            analysis={analysis}
            copy={copy}
            onClose={() => onOpenChange(false)}
            onInserted={onInserted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
