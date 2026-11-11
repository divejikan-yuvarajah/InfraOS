"use client";

import { HelpCircleIcon, ShieldAlertIcon } from "lucide-react";

import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";

import { fill } from "@/lib/inspections/view";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function UncertaintyPanel({
  cannotBeDetermined,
  questionsForInspector,
  droppedStatements,
  copy,
}: {
  cannotBeDetermined: string[];
  questionsForInspector: string[];
  droppedStatements?: number;
  copy: InspectionAiMessages;
}) {
  return (
    <section className="ins-panel" aria-label={copy.results.cannotDetermineTitle}>
      <h4 className="ins-h" style={{ marginBottom: "0.45rem" }}>{copy.results.cannotDetermineTitle}</h4>
      {cannotBeDetermined.length > 0 ? (
        <ul style={{ margin: "0 0 0.65rem", paddingInlineStart: "1.25rem", display: "grid", gap: "0.25rem", fontSize: "0.87rem" }}>
          {cannotBeDetermined.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {questionsForInspector.length > 0 ? (
        <div style={{ marginTop: "0.5rem" }}>
          <h5 className="ctr-row" style={{ margin: "0 0 0.35rem", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
            <HelpCircleIcon aria-hidden="true" style={{ width: "0.95rem", height: "0.95rem" }} />
            <span>{copy.results.questionsTitle}</span>
          </h5>
          <ul style={{ margin: 0, paddingInlineStart: "1.25rem", display: "grid", gap: "0.25rem", fontSize: "0.86rem" }}>
            {questionsForInspector.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {droppedStatements && droppedStatements > 0 ? (
        <div
          className="ctr-row"
          role="note"
          style={{ gap: "0.4rem", marginTop: "0.6rem", fontSize: "0.82rem", color: "#92400e" }}
        >
          <ShieldAlertIcon aria-hidden="true" style={{ width: "0.95rem", height: "0.95rem", flex: "none" }} />
          <span>{fill(copy.results.droppedNote, { n: droppedStatements })}</span>
        </div>
      ) : null}
    </section>
  );
}
