import type mongoose from "mongoose";

import { Candidate } from "./models/candidate.model.js";

type Oid = mongoose.Types.ObjectId;

/** Live count of active candidate pairs per request, used for list badges and the hasCandidates filter. */
export async function candidateCounts(requestIds: Oid[]): Promise<Map<string, number>> {
  if (!requestIds.length) return new Map();
  const rows = await Candidate.aggregate<{ _id: Oid; n: number }>([
    { $match: { status: "active", isCandidate: true, $or: [{ aType: "work_request", aId: { $in: requestIds } }, { bType: "work_request", bId: { $in: requestIds } }] } },
    { $project: { ids: [{ $cond: [{ $eq: ["$aType", "work_request"] }, "$aId", null] }, { $cond: [{ $eq: ["$bType", "work_request"] }, "$bId", null] }] } },
    { $unwind: "$ids" },
    { $match: { ids: { $in: requestIds } } },
    { $group: { _id: "$ids", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}
export async function requestIdsWithCandidates(): Promise<Oid[]> {
  const [a, b] = await Promise.all([
    Candidate.distinct("aId", { status: "active", isCandidate: true, aType: "work_request" }),
    Candidate.distinct("bId", { status: "active", isCandidate: true, bType: "work_request" }),
  ]);
  return [...a, ...b] as Oid[];
}
