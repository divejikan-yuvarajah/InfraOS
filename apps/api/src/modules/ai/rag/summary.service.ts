import { z } from "zod";
import { AI_LANGUAGES, SUMMARY_TEMPLATE_KEYS } from "@infraos/shared-types";

import { aiReadiness, artifactDto, getArtifact, listArtifacts, requestArtifact } from "./artifact.service.js";

export const summaryBody = z.object({ template: z.enum(SUMMARY_TEMPLATE_KEYS), language: z.enum(AI_LANGUAGES).default("en"), regenerate: z.boolean().optional() }).strict();
type Actor = NonNullable<Express.Request["actor"]>;

export const listSummaries = (actor: Actor, docId: string) => listArtifacts(actor, docId, "SUMMARY");

export async function createSummary(actor: Actor, docId: string, body: z.infer<typeof summaryBody>, requestId: string) {
  const r = await requestArtifact(actor, docId, { kind: "SUMMARY", template: body.template, language: body.language, regenerate: body.regenerate }, requestId);
  return { status: r.status, data: artifactDto(r.artifact, r.doc.currentVersionNo ?? null, { result: r.artifact.status === "READY" }) };
}

export async function readSummary(actor: Actor, docId: string, artifactId: string) {
  const { doc, row } = await getArtifact(actor, docId, artifactId, "SUMMARY");
  return { data: { ...artifactDto(row, doc.currentVersionNo ?? null, { result: row.status === "READY" || row.status === "STALE" }), readiness: aiReadiness(doc) } };
}
