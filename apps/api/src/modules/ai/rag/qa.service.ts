import mongoose from "mongoose";
import type { z } from "zod";

import { capsOf, docContext, loadDocument, needPerm } from "../../documents/document.common.js";
import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { RagFlow } from "./http.js";
import { buildInteractionDto } from "./interaction.dto.js";
import { AiInteraction } from "./interaction.model.js";
import type { feedbackBody, scopePreviewQuery, threadsQuery } from "./rag.schema.js";
import { resolveScope } from "./scope.js";
import { truncate } from "./text.js";

const oid = (v: string) => new mongoose.Types.ObjectId(v);
type Actor = NonNullable<Express.Request["actor"]>;
const mine = (actor: Actor) => ({ userId: oid(actor.userId) });

/** All history is private to the author: every query is keyed by the caller's own user id. Admins never read other people's questions. */
export async function listThreads(actor: Actor, q: z.infer<typeof threadsQuery>) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  const rows = await AiInteraction.aggregate<{ _id: string; title: string; lastAt: Date; count: number; mode: string }>([
    { $match: mine(actor) }, { $sort: { createdAt: 1 } },
    { $group: { _id: "$threadId", title: { $first: "$question" }, lastAt: { $max: "$createdAt" }, count: { $sum: 1 }, mode: { $first: "$scope.mode" } } },
    ...(q.cursor ? [{ $match: { lastAt: { $lt: new Date(q.cursor) } } }] : []), { $sort: { lastAt: -1 } }, { $limit: q.limit + 1 },
  ]);
  const page = rows.slice(0, q.limit);
  return { data: { items: page.map((r) => ({ threadId: r._id, title: truncate(r.title, 80), lastAt: r.lastAt.toISOString(), count: r.count, mode: r.mode })), nextCursor: rows.length > q.limit ? page[page.length - 1]!.lastAt.toISOString() : null } };
}

export async function getThread(actor: Actor, threadId: string) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  const rows = await AiInteraction.find({ ...mine(actor), threadId }).sort({ createdAt: 1 }).limit(60);
  if (!rows.length) throw new RagFlow(404, "NOT_FOUND");
  return { data: { threadId, items: await Promise.all(rows.map((r) => buildInteractionDto(d, r, { excerpts: true }))) } };
}

export async function getInteraction(actor: Actor, id: string) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  if (!/^[a-f0-9]{24}$/.test(id)) throw new RagFlow(404, "NOT_FOUND");
  const row = await AiInteraction.findOne({ _id: oid(id), ...mine(actor) });
  if (!row) throw new RagFlow(404, "NOT_FOUND"); // someone else's interaction is indistinguishable from a missing one
  return { data: await buildInteractionDto(d, row, { excerpts: true }) };
}

export async function submitFeedback(actor: Actor, id: string, body: z.infer<typeof feedbackBody>, requestId: string) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  if (!/^[a-f0-9]{24}$/.test(id)) throw new RagFlow(404, "NOT_FOUND");
  const r = await AiInteraction.updateOne({ _id: oid(id), ...mine(actor) }, { $set: { feedback: { rating: body.rating, ...(body.reason ? { reason: body.reason } : {}), ...(body.comment ? { comment: body.comment } : {}) } } });
  if (r.matchedCount !== 1) throw new RagFlow(404, "NOT_FOUND");
  await writeAiAudit(undefined, { action: "ai.feedback_submitted", resourceType: "SYSTEM", resourceId: id, agencyId: actor.agencyId, actorUserId: actor.userId, status: body.rating, requestId }).catch(() => undefined);
  return { data: { saved: true } };
}

export async function deleteThread(actor: Actor, threadId: string | null, requestId: string) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  const r = await AiInteraction.deleteMany({ ...mine(actor), ...(threadId ? { threadId } : {}) });
  if (threadId && r.deletedCount === 0) throw new RagFlow(404, "NOT_FOUND");
  await writeAiAudit(undefined, { action: "ai.interaction_deleted", resourceType: "SYSTEM", resourceId: new mongoose.Types.ObjectId(), agencyId: actor.agencyId, actorUserId: actor.userId, status: "DELETED", reason: `count:${r.deletedCount}`, requestId }).catch(() => undefined);
  return { data: { deleted: r.deletedCount } };
}

/** What a scope would search, without any text: counts, the reasons documents are not searchable, and a short preview of searchable titles. */
export async function scopePreview(actor: Actor, q: z.infer<typeof scopePreviewQuery>) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  const s = await resolveScope(d, { mode: q.mode, documentIds: q.documentIds, projectId: q.projectId });
  return { data: { ...s.coverage, notAiReady: s.notReady.slice(0, 20), searchable: [...s.docs.values()].slice(0, 20).map((x) => ({ id: x.id, title: x.title, docNo: x.docNo, category: x.category })) } };
}

/** Source viewer: the cited chunk plus its neighbours, only for readers who may also download the document (same policy as the Batch 09 chunk preview). */
export async function chunkContext(actor: Actor, documentId: string, chunkId: string) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  needPerm(d.ctx, "document.download");
  const doc = await loadDocument(d, documentId);
  if (!capsOf(d, doc).canDownload) throw new RagFlow(404, "NOT_FOUND");
  const indexed = doc.aiIndex?.indexedVersionNo;
  const center = await DocumentChunk.findOne({ chunkId, documentId: doc._id, status: "ACTIVE" }).select("chunkIndex versionNo").lean();
  if (!center || !indexed || center.versionNo !== indexed) throw new RagFlow(404, "NOT_FOUND");
  const rows = await DocumentChunk.find({ documentId: doc._id, versionNo: indexed, status: "ACTIVE", chunkIndex: { $in: [center.chunkIndex - 1, center.chunkIndex, center.chunkIndex + 1] } }).select("+content chunkId chunkIndex pageStart pageEnd section").sort({ chunkIndex: 1 }).lean();
  return { data: { documentId, docNo: doc.docNo ?? null, title: doc.title ?? null, category: doc.category ?? null, versionNo: indexed, previewable: doc.mimeType === "application/pdf",
    chunks: rows.map((r) => ({ chunkId: r.chunkId, chunkIndex: r.chunkIndex, isCited: r.chunkId === chunkId, pageStart: r.pageStart ?? null, pageEnd: r.pageEnd ?? null, section: r.section ?? null, text: truncate((r as unknown as { content: string }).content ?? "", 1500) })) } };
}
