"use client";

import { InfoIcon } from "lucide-react";

import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";

import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function AiLimitations({ copy }: { copy: InspectionAiMessages }) {
  return (
    <section className="ins-panel" aria-label={copy.limitations.title}>
      <h4 className="ctr-row" style={{ gap: "0.4rem", margin: "0 0 0.5rem", fontSize: "0.92rem", fontWeight: 600 }}>
        <InfoIcon aria-hidden="true" style={{ width: "1rem", height: "1rem", flex: "none" }} />
        <span>{copy.limitations.title}</span>
      </h4>
      <ul style={{ margin: 0, paddingInlineStart: "1.25rem", display: "grid", gap: "0.3rem", fontSize: "0.84rem" }}>
        {copy.limitations.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
