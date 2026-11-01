import { EventEmitter } from "node:events";

/**
 * Internal RoadSync events. `workRequestSubmitted` / `workRequestCancelled` are consumed by detection;
 * `roadsyncDetectionCompleted` is a forward hook for Steps 70+ and has no subscribers yet.
 */
export const roadsyncEvents = new EventEmitter();
export type AssessmentCompletedEvent = {
  requestId: string;
  conflictCandidateIds: string[];
  counts: { conflicts: number; opportunities: number; advisories: number };
  maxBand: string | null;
  riskIndex: number;
};
export type DetectionCompletedEvent = { requestId: string; candidateIds: string[]; counts: { nearby: number; candidates: number; agencies: number; truncated: boolean } };
