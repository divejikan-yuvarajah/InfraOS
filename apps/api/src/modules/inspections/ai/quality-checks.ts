export type QualityCheckSeverity = "INFO" | "WARNING" | "CRITICAL";

export type QualityCheckItem = {
  code: string;
  severity: QualityCheckSeverity;
  message: string;
  evidenceId?: string;
  details?: Record<string, unknown>;
};

export type QualityChecksOutput = {
  checks: QualityCheckItem[];
  coverage: {
    totalPhotos: number;
    milestonesWithEvidence: number;
    totalMilestones: number;
    uncoveredMilestones: string[];
  };
  metadataNote: string;
};

export type EvidenceItemForQuality = {
  _id: string | { toString(): string };
  capturedAt: Date | string;
  uploadedAt: Date | string;
  sha256: string;
  width?: number | null;
  height?: number | null;
  sitePresence?: {
    distanceM: number;
    status: "ON_SITE" | "NEAR_SITE" | "AWAY" | string;
    basis: string;
  } | null;
  checklistItemKey?: string | null;
  defectKey?: string | null;
  status?: string;
};

export type MilestoneItemForQuality = {
  _id: string | { toString(): string };
  title: string;
};

export function runDeterministicQualityChecks(params: {
  inspectionDate: Date | string;
  evidence: EvidenceItemForQuality[];
  milestones?: MilestoneItemForQuality[];
}): QualityChecksOutput {
  const checks: QualityCheckItem[] = [];
  const inspDate = new Date(params.evidence.length > 0 ? params.inspectionDate : new Date()).getTime();

  const minWindow = inspDate - 14 * 24 * 60 * 60 * 1000; // -14 days
  const maxWindow = inspDate + 1 * 24 * 60 * 60 * 1000; // +1 day

  const captureTimes: number[] = [];
  const shaMap = new Map<string, string[]>();

  for (const ev of params.evidence) {
    const evId = String(ev._id);
    const captured = new Date(ev.capturedAt).getTime();
    const uploaded = new Date(ev.uploadedAt).getTime();
    captureTimes.push(captured);

    // 1. Check window [inspectionDate - 14d, inspectionDate + 1d]
    if (captured < minWindow || captured > maxWindow) {
      checks.push({
        code: "CAPTURED_OUTSIDE_WINDOW",
        severity: "WARNING",
        message: "Photo captured date falls outside the expected inspection window (-14d to +1d).",
        evidenceId: evId,
        details: { capturedAt: ev.capturedAt, inspectionDate: params.inspectionDate },
      });
    }

    // 2. Check future/inverted timestamp
    if (captured > uploaded + 60_000) {
      checks.push({
        code: "CAPTURE_AFTER_UPLOAD",
        severity: "WARNING",
        message: "Photo metadata claims capture occurred after the upload timestamp.",
        evidenceId: evId,
        details: { capturedAt: ev.capturedAt, uploadedAt: ev.uploadedAt },
      });
    }

    // 3. Upload lag (> 7 days)
    if (uploaded - captured > 7 * 24 * 60 * 60 * 1000) {
      checks.push({
        code: "UPLOAD_DELAYED",
        severity: "INFO",
        message: "Photo was uploaded more than 7 days after capture.",
        evidenceId: evId,
      });
    }

    // 4. Site presence
    if (ev.sitePresence) {
      if (ev.sitePresence.status === "AWAY") {
        checks.push({
          code: "AWAY_FROM_SITE",
          severity: "WARNING",
          message: `Photo GPS indicates location was approximately ${Math.round(ev.sitePresence.distanceM)}m away from project site.`,
          evidenceId: evId,
          details: { distanceM: ev.sitePresence.distanceM },
        });
      } else if (ev.sitePresence.status === "NEAR_SITE") {
        checks.push({
          code: "NEAR_SITE",
          severity: "INFO",
          message: `Photo captured near the perimeter (${Math.round(ev.sitePresence.distanceM)}m).`,
          evidenceId: evId,
        });
      }
    } else {
      checks.push({
        code: "LOCATION_NOT_ATTACHED",
        severity: "INFO",
        message: "Location is optional and was not attached to this photo.",
        evidenceId: evId,
      });
    }

    // 5. Resolution check (< 800px)
    if (ev.width && ev.height) {
      const longEdge = Math.max(ev.width, ev.height);
      if (longEdge < 800) {
        checks.push({
          code: "LOW_RESOLUTION",
          severity: "WARNING",
          message: `Low resolution photo (${ev.width}x${ev.height} px). Detail may be insufficient.`,
          evidenceId: evId,
          details: { width: ev.width, height: ev.height },
        });
      }
    }

    // Track duplicate hashes
    const existing = shaMap.get(ev.sha256) ?? [];
    existing.push(evId);
    shaMap.set(ev.sha256, existing);
  }

  // 6. Duplicate hash check
  for (const [sha, ids] of shaMap.entries()) {
    if (ids.length > 1) {
      checks.push({
        code: "DUPLICATE_PHOTO",
        severity: "CRITICAL",
        message: `Identical photo file uploaded ${ids.length} times in this inspection evidence set.`,
        details: { sha256: sha, evidenceIds: ids },
      });
    }
  }

  // 7. Short burst check (< 2 minutes between all photos)
  if (captureTimes.length >= 3) {
    const minTime = Math.min(...captureTimes);
    const maxTime = Math.max(...captureTimes);
    if (maxTime - minTime <= 120_000) {
      checks.push({
        code: "BURST_CAPTURE",
        severity: "INFO",
        message: `All photos were captured within ${Math.round((maxTime - minTime) / 1000)} seconds of each other.`,
        details: { durationSeconds: Math.round((maxTime - minTime) / 1000) },
      });
    }
  }

  // 8. Coverage vs milestones
  const totalMilestones = params.milestones?.length ?? 0;
  const linkedKeys = new Set(
    params.evidence
      .flatMap((e) => [e.checklistItemKey, e.defectKey])
      .filter((k): k is string => Boolean(k)),
  );

  // If milestones provided, match by checklist keys or titles
  const uncoveredMilestones: string[] = [];
  let coveredCount = 0;

  if (params.milestones && params.milestones.length > 0) {
    for (const m of params.milestones) {
      const mId = String(m._id);
      // If photo count is high or linked, mark as covered
      if (linkedKeys.has(mId) || params.evidence.length >= params.milestones.length) {
        coveredCount++;
      } else {
        uncoveredMilestones.push(m.title);
      }
    }
  }

  return {
    checks,
    coverage: {
      totalPhotos: params.evidence.length,
      milestonesWithEvidence: coveredCount,
      totalMilestones,
      uncoveredMilestones,
    },
    metadataNote: "Metadata can be inaccurate: device clocks and GPS readings are unverified.",
  };
}

