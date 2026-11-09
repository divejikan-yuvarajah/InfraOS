import { z } from "zod";

import { docContext, needPerm } from "../../documents/document.common.js";
import { AiUsageRecord } from "../usage.model.js";
import { AiInteraction } from "./interaction.model.js";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00.000Z`)) && new Date(`${s}T00:00:00.000Z`).toISOString().startsWith(s), "not a real date");
export const qualityQuery = z.object({ from: day.optional(), to: day.optional() }).strict();
type Actor = NonNullable<Express.Request["actor"]>;

/**
 * Aggregates only (ai.manage). Real numbers over a date range, scoped to the viewer's agencies (platform scope for super admins).
 * Never returns a question, answer, citation, user id or document: nothing here can identify what anyone asked.
 */
export async function qualityAggregates(actor: Actor, q: z.infer<typeof qualityQuery>) {
  const d = await docContext(actor);
  needPerm(d.ctx, "ai.manage");
  const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
  const from = q.from ? new Date(`${q.from}T00:00:00.000Z`) : new Date(to.getTime() - 30 * 86_400_000);
  const agencyFilter = d.viewer.scopeKind === "platform" ? {} : { agencyId: { $in: d.ctx.agencyObjectIds } };
  const range = { createdAt: { $gte: from, $lte: to }, ...agencyFilter };

  const [byStatus, fb, ev, lat, tokens] = await Promise.all([
    AiInteraction.aggregate<{ _id: string; n: number }>([{ $match: range }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    AiInteraction.aggregate<{ _id: string; n: number }>([{ $match: { ...range, feedback: { $exists: true } } }, { $group: { _id: "$feedback.rating", n: { $sum: 1 } } }]),
    AiInteraction.aggregate<{ v: number; t: number }>([{ $match: { ...range, "evidence.quotesTotal": { $gt: 0 } } }, { $group: { _id: null, v: { $sum: "$evidence.quotesVerified" }, t: { $sum: "$evidence.quotesTotal" } } }]),
    AiInteraction.aggregate<{ avg: number }>([{ $match: { ...range, latencyMs: { $exists: true } } }, { $group: { _id: null, avg: { $avg: "$latencyMs" } } }]),
    AiUsageRecord.aggregate<{ _id: string | null; input: number; output: number; n: number }>([{ $match: { kind: "CHAT", ...range } }, { $group: { _id: "$purpose", input: { $sum: "$inputTokens" }, output: { $sum: "$outputTokens" }, n: { $sum: 1 } } }]),
  ]);
  const count = (s: string) => byStatus.find((x) => x._id === s)?.n ?? 0;
  const questions = byStatus.reduce((n, x) => n + x.n, 0);
  const rate = (n: number) => (questions ? Math.round((n / questions) * 1000) / 10 : null);
  const helpful = fb.find((x) => x._id === "HELPFUL")?.n ?? 0;
  const notHelpful = fb.find((x) => x._id === "NOT_HELPFUL")?.n ?? 0;
  return {
    data: {
      from: from.toISOString(), to: to.toISOString(), questions,
      rates: { answered: rate(count("ANSWERED")), partial: rate(count("PARTIAL")), insufficientEvidence: rate(count("INSUFFICIENT_EVIDENCE")), passagesOnly: rate(count("PASSAGES_ONLY")), failed: rate(count("FAILED")) },
      counts: { answered: count("ANSWERED"), partial: count("PARTIAL"), insufficientEvidence: count("INSUFFICIENT_EVIDENCE"), passagesOnly: count("PASSAGES_ONLY"), failed: count("FAILED") },
      fallbacks: count("PASSAGES_ONLY"),
      feedback: { helpful, notHelpful, helpfulRatio: helpful + notHelpful ? Math.round((helpful / (helpful + notHelpful)) * 1000) / 10 : null },
      citationVerificationRate: ev[0] && ev[0].t > 0 ? Math.round((ev[0].v / ev[0].t) * 1000) / 10 : null,
      averageLatencyMs: lat[0] ? Math.round(lat[0].avg) : null,
      tokensByPurpose: tokens.map((t) => ({ purpose: t._id ?? "OTHER", inputTokens: t.input, outputTokens: t.output, requests: t.n })),
    },
  };
}
