import mongoose from "mongoose";
import type { QuickFactsDto } from "@infraos/shared-types";
import type { AuthenticatedActor } from "./copilot.types.js";
import { Project } from "../../projects/models/project.model.js";
import { Milestone } from "../../projects/models/milestone.model.js";
import { ProgressVerification } from "../../inspections/models/progress-verification.model.js";
import { Inspection } from "../../inspections/models/inspection.model.js";
import { RiskAssessment } from "../../risk/models/risk-assessment.model.js";

type CacheEntry = {
  expiresAt: number;
  data: QuickFactsDto;
};

const quickFactsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function getQuickFacts(
  actor: AuthenticatedActor,
  projectId?: string,
): Promise<QuickFactsDto> {
  const cacheKey = `${actor.userId}:${projectId || "portfolio"}`;
  const cached = quickFactsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const now = new Date();
  const agencyId = actor.roleKey === "SUPER_ADMIN" ? undefined : actor.agencyId;

  // Single project view
  if (projectId) {
    const isOid = mongoose.Types.ObjectId.isValid(projectId);
    const project = await Project.findOne(
      isOid ? { _id: projectId } : { projectCode: projectId }
    ).lean();

    if (!project) {
      const emptyDto: QuickFactsDto = {
        asOf: now.toISOString(),
        links: [{ label: "All Projects", route: "/projects" }],
      };
      return emptyDto;
    }

    if (agencyId && project.agencyId && project.agencyId.toString() !== agencyId) {
      const deniedDto: QuickFactsDto = {
        asOf: now.toISOString(),
        links: [{ label: "All Projects", route: "/projects" }],
      };
      return deniedDto;
    }

    const pId = project._id;
    const [milestones, latestVerif, latestInsp, risk] = await Promise.all([
      Milestone.find({ projectId: pId }).lean(),
      ProgressVerification.findOne({ projectId: pId, status: "ACTIVE" }).sort({ asOf: -1 }).lean(),
      Inspection.findOne({ projectId: pId }).sort({ inspectionDate: -1 }).lean(),
      RiskAssessment.findOne({ projectId: pId }).sort({ createdAt: -1 }).lean(),
    ]);

    const overdueMilestonesCount = milestones.filter((m) => m.plannedEnd < now && m.progress < 100).length;

    const riskIndicators = (risk?.indicators ?? []).slice(0, 3).map((ind) => ({
      code: ind.code,
      label: ind.code,
      level: ind.severity,
    }));

    const hasFinancePerm = actor.permissions?.some((p) => ["finance.read", "payment.read", "budget.read"].includes(p)) || actor.roleKey === "SUPER_ADMIN";

    const dto: QuickFactsDto = {
      projectId: pId.toString(),
      asOf: now.toISOString(),
      status: project.status,
      progressReported: project.physicalProgress ?? 0,
      progressVerified: latestVerif ? latestVerif.verifiedPercent : undefined,
      progressBasis: latestVerif ? "VERIFIED" : "REPORTED",
      financialPercent: project.financialProgress ?? 0,
      physicalPercent: project.physicalProgress ?? 0,
      financialBudgetMinor: hasFinancePerm ? project.budget?.amountMinor : undefined,
      riskLevel: (risk?.overallLevel || project.riskLevel) ?? undefined,
      riskIndicators,
      openConflictsCount: 0,
      overdueMilestonesCount,
      latestInspection: latestInsp
        ? {
            outcome: latestInsp.status,
            date: latestInsp.inspectionDate ? new Date(latestInsp.inspectionDate).toLocaleDateString() : undefined,
            verifiedPercent: latestInsp.physicalProgress ?? undefined,
          }
        : undefined,
      overdueMaintenanceCount: 0,
      links: [
        { label: "View Project", route: `/projects/${pId}` },
        { label: "Inspections", route: `/inspections?projectId=${pId}` },
        { label: "Risk Profile", route: `/risk/${pId}` },
      ],
    };

    quickFactsCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: dto });
    return dto;
  }

  // Portfolio view
  const query: Record<string, any> = {};
  if (agencyId) query.agencyId = new mongoose.Types.ObjectId(agencyId);

  const [projectCount, riskyCount] = await Promise.all([
    Project.countDocuments(query),
    Project.countDocuments({ ...query, riskLevel: { $in: ["HIGH", "CRITICAL"] } }),
  ]);

  const portfolioDto: QuickFactsDto = {
    asOf: now.toISOString(),
    status: `${projectCount} active projects in portfolio`,
    riskLevel: riskyCount > 0 ? "HIGH" : "LOW",
    riskIndicators: [
      { code: "PORTFOLIO_RISK", label: "Risky Projects", level: `${riskyCount} projects` },
    ],
    links: [
      { label: "Projects Dashboard", route: "/projects" },
      { label: "Risk Center", route: "/risk" },
    ],
  };

  quickFactsCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: portfolioDto });
  return portfolioDto;
}
