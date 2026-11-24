import mongoose from "mongoose";
import { z } from "zod";
import type { CopilotFact } from "@infraos/shared-types";
import { defineCopilotTool, type AuthenticatedActor, type CopilotToolDefinition } from "./copilot.types.js";
import { Project } from "../../projects/models/project.model.js";
import { Milestone } from "../../projects/models/milestone.model.js";
import { ProgressVerification } from "../../inspections/models/progress-verification.model.js";
import { Inspection } from "../../inspections/models/inspection.model.js";
import { RiskAssessment } from "../../risk/models/risk-assessment.model.js";
import { Document } from "../../documents/models/document.model.js";
import { ConflictRecord } from "../../roadsync/models/conflict-record.model.js";
import { Asset } from "../../assets/models/asset.model.js";
import { Contractor } from "../../contractors/models/contractor.model.js";
import { ProjectPayment } from "../../finance/models/project-payment.model.js";
import { askQuestion } from "../rag/rag.service.js";

/** Truncates untrusted free-text user fields to <= 120 chars */
function sanitizeFreeText(text?: string | null): string {
  if (!text) return "";
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

/** Escapes user-provided search strings before constructing Mongo $regex queries */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Check whether actor has permission to view an agency's data */
function canAccessAgency(actor: AuthenticatedActor, targetAgencyId?: string | mongoose.Types.ObjectId): boolean {
  if (actor.roleKey === "SUPER_ADMIN") return true;
  if (!targetAgencyId || !actor.agencyId) return false;
  return targetAgencyId.toString() === actor.agencyId;
}

export const COPILOT_TOOLS: Record<string, CopilotToolDefinition<Record<string, unknown>>> = {
  list_projects: defineCopilotTool({
    name: "list_projects",
    description: "List accessible infrastructure projects in the user's agency (or across all agencies for SUPER_ADMIN), optionally filtered by status (e.g. ACTIVE, DELAYED, APPROVED, ON_HOLD, SUBMITTED, DRAFT, COMPLETED) or district.",
    argsSchema: z.object({
      status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED", "REJECTED", "CANCELLED"]).optional(),
      district: z.string().trim().max(80).optional(),
      agencyId: z.string().optional(),
      limit: z.number().int().min(1).max(15).default(10),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/projects/${id}/overview` : "/projects"),
    async run(actor, args, _ctx) {
      const agencyId = actor.roleKey === "SUPER_ADMIN" ? args.agencyId : actor.agencyId;
      if (actor.roleKey !== "SUPER_ADMIN" && (!agencyId || !mongoose.Types.ObjectId.isValid(agencyId))) {
        return {
          status: "OK",
          facts: [{ id: "T.f1", label: "projects_list", value: "No accessible projects found in agency scope.", ref: { type: "Project", id: "", label: "Projects Directory" }, basis: "RECORDED" }],
        };
      }
      const baseQuery: mongoose.FilterQuery<Record<string, unknown>> = {};
      if (agencyId) {
        if (!mongoose.Types.ObjectId.isValid(agencyId)) {
          return {
            status: "OK",
            facts: [{ id: "T.f1", label: "projects_list", value: "No accessible projects found in agency scope.", ref: { type: "Project", id: "", label: "Projects Directory" }, basis: "RECORDED" }],
          };
        }
        baseQuery.agencyId = new mongoose.Types.ObjectId(agencyId);
      }
      const query: mongoose.FilterQuery<Record<string, unknown>> = { ...baseQuery };
      if (args.status) query.status = args.status;
      if (args.district) query["location.district"] = { $regex: escapeRegex(args.district), $options: "i" };

      const [totalCount, projects] = await Promise.all([
        Project.countDocuments(query),
        Project.find(query)
          .sort({ updatedAt: -1 })
          .limit(args.limit ?? 10)
          .select("_id projectCode title status projectType physicalProgress riskLevel location.district")
          .lean(),
      ]);

      if (projects.length === 0) {
        const label = args.status ? `${args.status} projects` : "projects";
        const allInScope = args.status
          ? await Project.find(baseQuery).sort({ updatedAt: -1 }).limit(8).select("_id projectCode title status physicalProgress riskLevel").lean()
          : [];
        if (allInScope.length > 0) {
          const facts: CopilotFact[] = [
            {
              id: "T.f1",
              label: "projects_count",
              value: `0 ${args.status} projects found; ${allInScope.length} project(s) exist in other statuses in scope`,
              ref: { type: "Project", id: "", label: "Projects Directory" },
              basis: "RECORDED",
            },
          ];
          allInScope.forEach((p, idx) => {
            facts.push({
              id: `T.f${idx + 2}`,
              label: "project_summary_row",
              value: `${p.projectCode}: ${p.title} (${p.status}, ${p.physicalProgress ?? 0}% reported progress${p.riskLevel ? `, risk: ${p.riskLevel}` : ""})`,
              ref: { type: "Project", id: p._id.toString(), label: p.projectCode },
              basis: "RECORDED",
            });
          });
          return { status: "OK", facts };
        }
        return {
          status: "OK",
          facts: [{ id: "T.f1", label: "projects_list", value: `No ${label} found in scope.`, ref: { type: "Project", id: "", label: "Projects Directory" }, basis: "RECORDED" }],
        };
      }

      const facts: CopilotFact[] = [
        {
          id: "T.f1",
          label: "projects_count",
          value: `${totalCount} ${args.status ? `${args.status} ` : ""}project(s) in scope (showing ${projects.length})`,
          ref: { type: "Project", id: "", label: "Projects Directory" },
          basis: "RECORDED",
        },
      ];
      let factIdx = 2;
      for (const p of projects) {
        const riskPart = p.riskLevel ? `, risk: ${p.riskLevel}` : "";
        const distPart = p.location?.district ? `, ${p.location.district}` : "";
        facts.push({
          id: `T.f${factIdx++}`,
          label: "project_summary_row",
          value: `${p.projectCode}: ${p.title} (${p.status}, ${p.physicalProgress ?? 0}% reported progress${riskPart}${distPart})`,
          ref: { type: "Project", id: p._id.toString(), label: p.projectCode },
          basis: "RECORDED",
        });
      }
      return { status: "OK", facts };
    },
  }),

  search_projects: defineCopilotTool({
    name: "search_projects",
    description: "Search projects by title, project code, or status within permitted agency scope.",
    argsSchema: z.object({
      q: z.string().trim().min(1).max(100).optional(),
      status: z.string().optional(),
      agencyId: z.string().optional(),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/projects/${id}/overview` : "/projects"),
    async run(actor, args, _ctx) {
      const agencyId = actor.roleKey === "SUPER_ADMIN" ? args.agencyId : actor.agencyId;
      if (actor.roleKey !== "SUPER_ADMIN" && (!agencyId || !mongoose.Types.ObjectId.isValid(agencyId))) {
        return { status: "OK", facts: [{ id: "T.f1", label: "search_results", value: `No projects found matching "${args.q || args.status || ""}"` }] };
      }
      const query: mongoose.FilterQuery<Record<string, unknown>> = {};
      if (agencyId) {
        if (!mongoose.Types.ObjectId.isValid(agencyId)) {
          return { status: "OK", facts: [{ id: "T.f1", label: "search_results", value: `No projects found matching "${args.q || args.status || ""}"` }] };
        }
        query.agencyId = new mongoose.Types.ObjectId(agencyId);
      }
      if (args.status) query.status = args.status;

      if (args.q) {
        const pattern = escapeRegex(args.q);
        query.$or = [
          { title: { $regex: pattern, $options: "i" } },
          { projectCode: { $regex: pattern, $options: "i" } },
        ];
      }

      const projects = await Project.find(query).sort({ updatedAt: -1 }).limit(8).lean();
      const facts: CopilotFact[] = [];
      let factIdx = 1;

      for (const p of projects) {
        facts.push({
          id: `T.f${factIdx++}`,
          label: "project_found",
          value: `${p.projectCode}: ${p.title} (${p.status}, ${p.physicalProgress ?? 0}% reported progress)`,
          ref: { type: "Project", id: p._id.toString(), label: p.projectCode },
          basis: "RECORDED",
        });
      }

      if (facts.length === 0) {
        return { status: "OK", facts: [{ id: "T.f1", label: "search_results", value: `No projects found matching "${args.q || args.status || ""}"` }] };
      }

      return { status: "OK", facts };
    },
  }),

  get_project_summary: defineCopilotTool({
    name: "get_project_summary",
    description: "Get key project metadata: status, reported physical progress, verified progress with basis, manager and milestones summary.",
    argsSchema: z.object({
      projectId: z.string().trim().min(1).max(50),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/projects/${id}/overview` : "/projects"),
    async run(actor, args, _ctx) {
      const isOid = mongoose.Types.ObjectId.isValid(args.projectId);
      const project = await Project.findOne(
        isOid ? { _id: args.projectId } : { projectCode: args.projectId }
      ).lean();

      if (!project || !canAccessAgency(actor, project.agencyId)) {
        return { status: "NOT_FOUND", facts: [{ id: "T.f1", label: "error", value: "Project not found or outside agency scope" }] };
      }

      const pId = project._id;
      const milestones = await Milestone.find({ projectId: pId }).lean();
      const latestVerif = await ProgressVerification.findOne({ projectId: pId, status: "ACTIVE" }).sort({ asOf: -1 }).lean();

      const totalMilestones = milestones.length;
      const now = new Date();
      const delayedMilestones = milestones.filter((m) => m.plannedEnd < now && m.progress < 100).length;

      const facts: CopilotFact[] = [
        {
          id: "T.f1",
          label: "project_code",
          value: project.projectCode,
          ref: { type: "Project", id: pId.toString(), label: project.projectCode },
          basis: "RECORDED",
        },
        {
          id: "T.f2",
          label: "title",
          value: project.title,
          ref: { type: "Project", id: pId.toString(), label: project.projectCode },
          basis: "RECORDED",
        },
        {
          id: "T.f3",
          label: "status",
          value: project.status,
          ref: { type: "Project", id: pId.toString(), label: project.projectCode },
          basis: "RECORDED",
        },
        {
          id: "T.f4",
          label: "reported_progress",
          value: project.physicalProgress ?? 0,
          unit: "%",
          ref: { type: "Project", id: pId.toString(), label: project.projectCode },
          basis: "REPORTED",
        },
      ];

      let factIdx = 5;
      if (latestVerif) {
        facts.push({
          id: `T.f${factIdx++}`,
          label: "verified_progress",
          value: latestVerif.verifiedPercent,
          unit: "%",
          asOf: latestVerif.asOf?.toISOString(),
          ref: { type: "ProgressVerification", id: latestVerif._id.toString(), label: `Verif-${latestVerif.verifiedPercent}%` },
          basis: "VERIFIED",
        });
      }

      facts.push({
        id: `T.f${factIdx++}`,
        label: "total_milestones",
        value: totalMilestones,
        ref: { type: "Project", id: pId.toString(), label: project.projectCode },
        basis: "RECORDED",
      });

      facts.push({
        id: `T.f${factIdx++}`,
        label: "delayed_milestones",
        value: delayedMilestones,
        ref: { type: "Project", id: pId.toString(), label: project.projectCode },
        basis: "RECORDED",
      });

      if (project.description) {
        facts.push({
          id: `T.f${factIdx++}`,
          label: "description",
          value: sanitizeFreeText(project.description),
          ref: { type: "Project", id: pId.toString(), label: project.projectCode },
          basis: "REPORTED",
          untrusted: true,
        });
      }

      return { status: "OK", primaryRecordId: pId.toString(), facts };
    },
  }),

  get_project_milestones: defineCopilotTool({
    name: "get_project_milestones",
    description: "Get milestone list for a project with planned dates and progress.",
    argsSchema: z.object({
      projectId: z.string().trim().min(1).max(50),
      filter: z.enum(["all", "delayed", "upcoming"]).default("all"),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/projects/${id}/milestones` : "/projects"),
    async run(actor, args, _ctx) {
      const isOid = mongoose.Types.ObjectId.isValid(args.projectId);
      const project = await Project.findOne(
        isOid ? { _id: args.projectId } : { projectCode: args.projectId }
      ).select("_id agencyId projectCode").lean();

      if (!project || !canAccessAgency(actor, project.agencyId)) {
        return { status: "NOT_FOUND", facts: [{ id: "T.f1", label: "error", value: "Project not found or outside agency scope" }] };
      }

      const milestones = await Milestone.find({ projectId: project._id }).sort({ plannedEnd: 1 }).lean();
      const now = new Date();
      let filtered = milestones;
      if (args.filter === "delayed") {
        filtered = milestones.filter((m) => m.plannedEnd < now && m.progress < 100);
      } else if (args.filter === "upcoming") {
        filtered = milestones.filter((m) => m.plannedStart > now);
      }

      const facts: CopilotFact[] = [];
      let factIdx = 1;
      for (const m of filtered.slice(0, 10)) {
        facts.push({
          id: `T.f${factIdx++}`,
          label: `milestone_${m.title}`,
          value: `Progress: ${m.progress}% | Status: ${m.status} | Due: ${m.plannedEnd ? new Date(m.plannedEnd).toLocaleDateString() : "N/A"}`,
          ref: { type: "Milestone", id: m._id.toString(), label: m.title },
          basis: "RECORDED",
        });
      }

      if (facts.length === 0) {
        facts.push({ id: "T.f1", label: "milestones", value: `No ${args.filter} milestones found for project` });
      }

      return { status: "OK", primaryRecordId: project._id.toString(), facts };
    },
  }),

  get_project_finance_summary: defineCopilotTool({
    name: "get_project_finance_summary",
    description: "Get financial progress and budget details for a project. Money amounts are redacted without finance permission.",
    argsSchema: z.object({
      projectId: z.string().trim().min(1).max(50),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/projects/${id}/finance` : "/projects"),
    async run(actor, args, ctx) {
      const isOid = mongoose.Types.ObjectId.isValid(args.projectId);
      const project = await Project.findOne(
        isOid ? { _id: args.projectId } : { projectCode: args.projectId }
      ).lean();

      if (!project || !canAccessAgency(actor, project.agencyId)) {
        return { status: "NOT_FOUND", facts: [{ id: "T.f1", label: "error", value: "Project not found or outside agency scope" }] };
      }

      const hasFinancePerm =
        ctx.permissions.some((p) =>
          ["finance.budget.read", "finance.payment.read", "finance.expense.read", "finance.read", "payment.read", "budget.read"].includes(p),
        ) || actor.roleKey === "SUPER_ADMIN";

      const facts: CopilotFact[] = [
        {
          id: "T.f1",
          label: "financial_progress",
          value: project.financialProgress ?? 0,
          unit: "%",
          ref: { type: "Project", id: project._id.toString(), label: project.projectCode },
          basis: "RECORDED",
        },
        {
          id: "T.f2",
          label: "physical_progress",
          value: project.physicalProgress ?? 0,
          unit: "%",
          ref: { type: "Project", id: project._id.toString(), label: project.projectCode },
          basis: "REPORTED",
        },
      ];

      if (hasFinancePerm) {
        const budgetRupees = (project.budget?.amountMinor ?? 0) / 100;
        const payments = await ProjectPayment.find({ projectId: project._id }).select("amount.amountMinor status").lean();
        const paidMinor = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + (p.amount?.amountMinor ?? 0), 0);
        const pendingMinor = payments.filter((p) => p.status === "PENDING" || p.status === "APPROVED").reduce((sum, p) => sum + (p.amount?.amountMinor ?? 0), 0);
        facts.push({
          id: "T.f3",
          label: "budget",
          value: budgetRupees,
          unit: "LKR",
          ref: { type: "Project", id: project._id.toString(), label: project.projectCode },
          basis: "RECORDED",
        });
        facts.push({
          id: "T.f4",
          label: "paid_payments",
          value: paidMinor / 100,
          unit: "LKR",
          ref: { type: "Project", id: project._id.toString(), label: project.projectCode },
          basis: "RECORDED",
        });
        facts.push({
          id: "T.f5",
          label: "pending_payments",
          value: pendingMinor / 100,
          unit: "LKR",
          ref: { type: "Project", id: project._id.toString(), label: project.projectCode },
          basis: "RECORDED",
        });
      } else {
        facts.push({
          id: "T.f3",
          label: "budget",
          value: "[REDACTED - Requires finance permission]",
          redacted: true,
          ref: { type: "Project", id: project._id.toString(), label: project.projectCode },
          basis: "RECORDED",
        });
      }

      return { status: "OK", primaryRecordId: project._id.toString(), facts };
    },
  }),

  get_project_risk: defineCopilotTool({
    name: "get_project_risk",
    description: "Get latest risk intelligence assessment (level, top indicators with calculated evidence, recommendations).",
    argsSchema: z.object({
      projectId: z.string().trim().min(1).max(50),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/projects/${id}/risk` : "/risk"),
    async run(actor, args, _ctx) {
      const isOid = mongoose.Types.ObjectId.isValid(args.projectId);
      const project = await Project.findOne(
        isOid ? { _id: args.projectId } : { projectCode: args.projectId }
      ).select("_id agencyId projectCode riskLevel riskScore").lean();

      if (!project || !canAccessAgency(actor, project.agencyId)) {
        return { status: "NOT_FOUND", facts: [{ id: "T.f1", label: "error", value: "Project not found or outside agency scope" }] };
      }

      const assessment = await RiskAssessment.findOne({ projectId: project._id }).sort({ createdAt: -1 }).lean();

      if (!assessment) {
        return {
          status: "OK",
          facts: [
            {
              id: "T.f1",
              label: "risk_status",
              value: "No risk assessment has been performed yet for this project",
              ref: { type: "Project", id: project._id.toString(), label: project.projectCode },
              basis: "RECORDED",
            },
          ],
        };
      }

      const overallScore = assessment.overallIndex ?? assessment.overallRisk ?? 0;

      const createdAtValue = (assessment as { createdAt?: Date }).createdAt;
      const facts: CopilotFact[] = [
        {
          id: "T.f1",
          label: "overall_risk_level",
          value: assessment.overallLevel,
          asOf: createdAtValue ? createdAtValue.toISOString() : undefined,
          ref: { type: "RiskAssessment", id: assessment._id.toString(), label: `Risk-${assessment.overallLevel}` },
          basis: "RECORDED",
        },
        {
          id: "T.f2",
          label: "overall_risk_score",
          value: overallScore,
          ref: { type: "RiskAssessment", id: assessment._id.toString(), label: `Score-${overallScore}` },
          basis: "RECORDED",
        },
      ];

      let factIdx = 3;
      const topIndicators = (assessment.indicators ?? []).slice(0, 3);
      for (const ind of topIndicators) {
        facts.push({
          id: `T.f${factIdx++}`,
          label: `risk_indicator_${ind.code}`,
          value: `${ind.code}: ${ind.severity} (points: ${ind.points}). ${ind.explainKey || ""}`,
          ref: { type: "RiskAssessment", id: assessment._id.toString(), label: ind.code },
          basis: "RECORDED",
        });
      }

      return { status: "OK", primaryRecordId: project._id.toString(), facts };
    },
  }),

  list_risky_projects: defineCopilotTool({
    name: "list_risky_projects",
    description: "List projects flagged with HIGH or CRITICAL risk in the agency.",
    argsSchema: z.object({
      level: z.enum(["HIGH", "CRITICAL"]).optional(),
      agencyId: z.string().optional(),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/projects/${id}/risk` : "/risk"),
    async run(actor, args, _ctx) {
      const agencyId = actor.roleKey === "SUPER_ADMIN" ? args.agencyId : actor.agencyId;
      if (actor.roleKey !== "SUPER_ADMIN" && (!agencyId || !mongoose.Types.ObjectId.isValid(agencyId))) {
        return { status: "OK", facts: [{ id: "T.f1", label: "risky_projects", value: "No high or critical risk projects found in scope." }] };
      }
      const levels = args.level ? [args.level] : ["HIGH", "CRITICAL"];
      const query: mongoose.FilterQuery<Record<string, unknown>> = {
        riskLevel: { $in: levels },
      };
      if (agencyId) {
        if (!mongoose.Types.ObjectId.isValid(agencyId)) {
          return { status: "OK", facts: [{ id: "T.f1", label: "risky_projects", value: "No high or critical risk projects found in scope." }] };
        }
        query.agencyId = new mongoose.Types.ObjectId(agencyId);
      }

      const projects = await Project.find(query).sort({ riskScore: -1, updatedAt: -1 }).limit(8).lean();
      const facts: CopilotFact[] = [];
      let factIdx = 1;

      for (const p of projects) {
        facts.push({
          id: `T.f${factIdx++}`,
          label: "risky_project",
          value: `${p.projectCode}: ${p.title} (${p.riskLevel} risk, score: ${p.riskScore ?? 0}, status: ${p.status})`,
          ref: { type: "Project", id: p._id.toString(), label: p.projectCode },
          basis: "RECORDED",
        });
      }

      if (facts.length === 0) {
        const assessQuery: mongoose.FilterQuery<Record<string, unknown>> = { overallLevel: { $in: levels } };
        if (agencyId) assessQuery.agencyId = new mongoose.Types.ObjectId(agencyId);
        const assessments = await RiskAssessment.find(assessQuery).sort({ createdAt: -1 }).limit(8).lean();
        const projIds = [...new Set(assessments.map((a) => a.projectId?.toString()).filter(Boolean))];
        if (projIds.length > 0) {
          const fallbackProjects = await Project.find({ _id: { $in: projIds } }).select("_id projectCode title status").lean();
          const byId = new Map(fallbackProjects.map((p) => [p._id.toString(), p]));
          for (const a of assessments) {
            const p = byId.get(a.projectId?.toString() ?? "");
            if (!p) continue;
            facts.push({
              id: `T.f${factIdx++}`,
              label: "risky_project",
              value: `${p.projectCode}: ${p.title} (${a.overallLevel} risk, score: ${a.overallIndex ?? a.overallRisk ?? 0}, status: ${p.status})`,
              ref: { type: "Project", id: p._id.toString(), label: p.projectCode },
              basis: "RECORDED",
            });
          }
        }
      }

      if (facts.length === 0) {
        facts.push({ id: "T.f1", label: "risky_projects", value: "No high or critical risk projects found in scope." });
      }

      return { status: "OK", facts };
    },
  }),

  get_inspection_summary: defineCopilotTool({
    name: "get_inspection_summary",
    description: "Get latest inspection findings for a project: outcome, measured progress, defects count, and AI-assist notes.",
    argsSchema: z.object({
      projectId: z.string().trim().min(1).max(50),
    }).strict(),
    requires: ["inspection.read"],
    readOnly: true,
    link: (id) => (id ? `/inspections/${id}` : "/inspections"),
    async run(actor, args, _ctx) {
      const isOid = mongoose.Types.ObjectId.isValid(args.projectId);
      const project = await Project.findOne(
        isOid ? { _id: args.projectId } : { projectCode: args.projectId }
      ).select("_id agencyId projectCode").lean();

      if (!project || !canAccessAgency(actor, project.agencyId)) {
        return { status: "NOT_FOUND", facts: [{ id: "T.f1", label: "error", value: "Project not found or outside agency scope" }] };
      }

      const inspection = await Inspection.findOne({ projectId: project._id })
        .sort({ inspectionDate: -1 })
        .lean();

      if (!inspection) {
        return { status: "OK", facts: [{ id: "T.f1", label: "inspection", value: "No inspections found for this project." }] };
      }

      const defectsCount = inspection.report?.defects?.length ?? 0;
      const hasAiAssist = (inspection.aiAssistRefs?.length ?? 0) > 0;

      const facts: CopilotFact[] = [
        {
          id: "T.f1",
          label: "inspection_no",
          value: inspection.inspectionNo || "N/A",
          ref: { type: "Inspection", id: inspection._id.toString(), label: inspection.inspectionNo || "Inspection" },
          basis: "RECORDED",
        },
        {
          id: "T.f2",
          label: "status",
          value: inspection.status,
          ref: { type: "Inspection", id: inspection._id.toString(), label: inspection.inspectionNo || "Inspection" },
          basis: "RECORDED",
        },
        {
          id: "T.f3",
          label: "inspection_date",
          value: inspection.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString() : "N/A",
          asOf: inspection.inspectionDate?.toISOString(),
          ref: { type: "Inspection", id: inspection._id.toString(), label: inspection.inspectionNo || "Inspection" },
          basis: "RECORDED",
        },
        {
          id: "T.f4",
          label: "defects_count",
          value: defectsCount,
          ref: { type: "Inspection", id: inspection._id.toString(), label: inspection.inspectionNo || "Inspection" },
          basis: "RECORDED",
        },
      ];

      if (inspection.report?.measuredProgress != null) {
        facts.push({
          id: "T.f5",
          label: "measured_progress",
          value: inspection.report.measuredProgress,
          unit: "%",
          ref: { type: "Inspection", id: inspection._id.toString(), label: inspection.inspectionNo || "Inspection" },
          basis: "REPORTED",
        });
      }

      if (hasAiAssist) {
        facts.push({
          id: "T.f6",
          label: "ai_assist_notice",
          value: "includes AI-assisted observations (inspector-confirmed)",
          ref: { type: "Inspection", id: inspection._id.toString(), label: inspection.inspectionNo || "Inspection" },
          basis: "RECORDED",
        });
      }

      return { status: "OK", primaryRecordId: inspection._id.toString(), facts };
    },
  }),

  get_roadsync_conflicts: defineCopilotTool({
    name: "get_roadsync_conflicts",
    description: "Get open RoadSync utility / road spatial conflicts for a project or agency.",
    argsSchema: z.object({
      projectId: z.string().trim().optional(),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/roadsync/conflicts/${id}` : "/roadsync/conflicts"),
    async run(actor, args, _ctx) {
      const query: mongoose.FilterQuery<Record<string, unknown>> = {
        status: { $nin: ["closed", "dismissed", "resolved"] },
      };
      if (actor.roleKey !== "SUPER_ADMIN") {
        if (!actor.agencyId || !mongoose.Types.ObjectId.isValid(actor.agencyId)) {
          return { status: "OK", facts: [{ id: "T.f1", label: "roadsync_conflicts", value: "0 active spatial coordination conflicts identified in scope." }] };
        }
        query.agencyIds = new mongoose.Types.ObjectId(actor.agencyId);
      }
      if (args.projectId && mongoose.Types.ObjectId.isValid(args.projectId)) {
        const pid = new mongoose.Types.ObjectId(args.projectId);
        query.$or = [{ aId: pid }, { bId: pid }];
      }

      const conflicts = await ConflictRecord.find(query).sort({ createdAt: -1 }).limit(8).lean();
      if (conflicts.length === 0) {
        return {
          status: "OK",
          facts: [
            {
              id: "T.f1",
              label: "roadsync_conflicts",
              value: "0 active spatial coordination conflicts identified for project/agency",
              basis: "RECORDED",
            },
          ],
        };
      }

      const facts: CopilotFact[] = conflicts.map((c, idx) => {
        const sev = (c.severity as { current?: { band?: string } } | undefined)?.current?.band ?? "unknown";
        const dist = c.district ? `, ${c.district}` : "";
        return {
          id: `T.f${idx + 1}`,
          label: "roadsync_conflict",
          value: `${c.conflictNo} (${c.recordType}, severity: ${sev}, status: ${c.status}${dist})`,
          ref: { type: "RoadsyncConflict", id: c._id.toString(), label: c.conflictNo },
          basis: "RECORDED",
        };
      });
      return { status: "OK", facts };
    },
  }),

  get_contractor_performance: defineCopilotTool({
    name: "get_contractor_performance",
    description: "Get contractor summary and standing indicators by contractor ID or registration number.",
    argsSchema: z.object({
      contractorId: z.string().trim().min(1).max(50),
    }).strict(),
    requires: ["contractor.read"],
    readOnly: true,
    link: (id) => (id ? `/contractors/${id}` : "/contractors"),
    async run(actor, args, _ctx) {
      const isOid = mongoose.Types.ObjectId.isValid(args.contractorId);
      const contractor = await Contractor.findOne(
        isOid ? { _id: args.contractorId } : { registrationNumber: args.contractorId.toUpperCase() },
      ).lean();

      if (!contractor || (contractor.registeredByAgencyId && !canAccessAgency(actor, contractor.registeredByAgencyId))) {
        return { status: "NOT_FOUND", facts: [{ id: "T.f1", label: "error", value: "Contractor not found or outside agency scope" }] };
      }

      const facts: CopilotFact[] = [
        {
          id: "T.f1",
          label: "contractor_standing",
          value: `${contractor.name} (${contractor.registrationNumber}): status ${contractor.status}${contractor.category ? `, ${contractor.category}` : ""}`,
          ref: { type: "Contractor", id: contractor._id.toString(), label: contractor.registrationNumber },
          basis: "RECORDED",
        },
      ];
      if (contractor.riskLevel) {
        facts.push({
          id: "T.f2",
          label: "contractor_risk_level",
          value: contractor.riskLevel,
          ref: { type: "Contractor", id: contractor._id.toString(), label: contractor.registrationNumber },
          basis: "RECORDED",
        });
      }
      return { status: "OK", primaryRecordId: contractor._id.toString(), facts };
    },
  }),

  get_asset_summary: defineCopilotTool({
    name: "get_asset_summary",
    description: "Get asset metadata and operational condition by asset ID or asset number.",
    argsSchema: z.object({
      assetId: z.string().trim().min(1).max(50),
    }).strict(),
    requires: ["asset.read"],
    readOnly: true,
    link: (id) => (id ? `/assets/${id}` : "/assets"),
    async run(actor, args, _ctx) {
      const isOid = mongoose.Types.ObjectId.isValid(args.assetId);
      const asset = await Asset.findOne(
        isOid ? { _id: args.assetId } : { assetNo: args.assetId.toUpperCase() },
      ).lean();

      if (!asset || !canAccessAgency(actor, asset.agencyId)) {
        return { status: "NOT_FOUND", facts: [{ id: "T.f1", label: "error", value: "Asset not found or outside agency scope" }] };
      }

      const facts: CopilotFact[] = [
        {
          id: "T.f1",
          label: "asset_status",
          value: `${asset.assetNo || asset._id.toString()}: ${asset.name} (${asset.assetType}, status: ${asset.operationalStatus}, condition: ${asset.condition})`,
          ref: { type: "Asset", id: asset._id.toString(), label: asset.assetNo || asset.name },
          basis: "RECORDED",
        },
      ];
      if (asset.nextMaintenanceAt) {
        facts.push({
          id: "T.f2",
          label: "next_maintenance",
          value: new Date(asset.nextMaintenanceAt).toISOString().slice(0, 10),
          asOf: new Date(asset.nextMaintenanceAt).toISOString(),
          ref: { type: "Asset", id: asset._id.toString(), label: asset.assetNo || asset.name },
          basis: "RECORDED",
        });
      }
      return { status: "OK", primaryRecordId: asset._id.toString(), facts };
    },
  }),

  list_assets: defineCopilotTool({
    name: "list_assets",
    description: "List assets requiring maintenance or attention in agency.",
    argsSchema: z.object({
      filter: z.enum(["overdueMaintenance", "attention"]).default("attention"),
    }).strict(),
    requires: ["asset.read"],
    readOnly: true,
    link: (id) => (id ? `/assets/${id}` : "/assets"),
    async run(actor, args, _ctx) {
      const query: mongoose.FilterQuery<Record<string, unknown>> = {};
      if (actor.roleKey !== "SUPER_ADMIN") {
        if (!actor.agencyId || !mongoose.Types.ObjectId.isValid(actor.agencyId)) {
          return { status: "OK", facts: [{ id: "T.f1", label: "asset_list", value: "No assets found in agency scope." }] };
        }
        query.agencyId = new mongoose.Types.ObjectId(actor.agencyId);
      }
      const now = new Date();
      if (args.filter === "overdueMaintenance") {
        query.nextMaintenanceAt = { $lt: now };
      } else {
        query.$or = [
          { condition: { $in: ["POOR", "CRITICAL"] } },
          { nextMaintenanceAt: { $lt: now } },
        ];
      }

      const assets = await Asset.find(query).sort({ nextMaintenanceAt: 1 }).limit(8).lean();
      if (assets.length === 0) {
        return {
          status: "OK",
          facts: [
            {
              id: "T.f1",
              label: "asset_list",
              value: "No assets currently overdue for critical maintenance",
              basis: "RECORDED",
            },
          ],
        };
      }

      const facts: CopilotFact[] = assets.map((a, idx) => ({
        id: `T.f${idx + 1}`,
        label: "asset_attention",
        value: `${a.assetNo || a._id.toString()}: ${a.name} (${a.assetType}, condition: ${a.condition}, status: ${a.operationalStatus})`,
        ref: { type: "Asset", id: a._id.toString(), label: a.assetNo || a.name },
        basis: "RECORDED",
      }));
      return { status: "OK", facts };
    },
  }),

  search_documents: defineCopilotTool({
    name: "search_documents",
    description: "Search documents in DocTrace by title or document number.",
    argsSchema: z.object({
      q: z.string().trim().min(1).max(100),
      projectId: z.string().optional(),
    }).strict(),
    requires: ["document.read"],
    readOnly: true,
    link: (id) => (id ? `/documents/${id}` : "/documents"),
    async run(actor, args, _ctx) {
      const agencyId = actor.agencyId;
      if (actor.roleKey !== "SUPER_ADMIN" && (!agencyId || !mongoose.Types.ObjectId.isValid(agencyId))) {
        return { status: "OK", facts: [{ id: "T.f1", label: "search_results", value: `No documents found matching "${args.q}"` }] };
      }
      const pattern = escapeRegex(args.q);
      const query: mongoose.FilterQuery<Record<string, unknown>> = {
        $or: [
          { title: { $regex: pattern, $options: "i" } },
          { docNo: { $regex: pattern, $options: "i" } },
        ],
        deletedAt: null,
      };
      if (agencyId && mongoose.Types.ObjectId.isValid(agencyId)) {
        query.agencyId = new mongoose.Types.ObjectId(agencyId);
      }
      if (args.projectId && mongoose.Types.ObjectId.isValid(args.projectId)) {
        query.projectId = new mongoose.Types.ObjectId(args.projectId);
      }

      const docs = await Document.find(query).limit(5).lean();
      const facts: CopilotFact[] = [];
      let factIdx = 1;

      for (const d of docs) {
        facts.push({
          id: `T.f${factIdx++}`,
          label: "document_found",
          value: `${d.docNo || "DOC"}: ${d.title}`,
          ref: { type: "Document", id: d._id.toString(), label: d.title },
          basis: "RECORDED",
        });
      }

      if (facts.length === 0) {
        facts.push({ id: "T.f1", label: "search_results", value: `No documents found matching "${args.q}"` });
      }

      return { status: "OK", facts };
    },
  }),

  ask_documents: defineCopilotTool({
    name: "ask_documents",
    description: "Ask a specific question across indexed project documents using RAG.",
    argsSchema: z.object({
      question: z.string().trim().min(3).max(600),
      projectId: z.string().optional(),
    }).strict(),
    requires: ["document.ask"],
    readOnly: true,
    link: (id) => (id ? `/documents/${id}` : "/documents/ai"),
    async run(actor, args, ctx) {
      try {
        const result = await askQuestion(
          {
            userId: actor.userId,
            agencyId: actor.agencyId ?? "",
            roleId: actor.roleId ?? "",
            roleKey: actor.roleKey ?? "STAFF",
            credentialEpoch: actor.credentialEpoch ?? 1,
          },
          {
            question: args.question,
            scope: args.projectId ? { mode: "PROJECT", projectId: args.projectId } : { mode: "ALL" },
          },
          ctx.requestId,
        );

        const answerText = result.interaction?.answer?.text || "No relevant document passages verified.";
        const firstCite = result.interaction?.citations?.[0];
        return {
          status: "OK",
          facts: [
            {
              id: "T.f1",
              label: "DOC_ANSWER",
              value: answerText,
              ...(firstCite?.documentId ? { ref: { type: "Document", id: String(firstCite.documentId), label: firstCite.title || firstCite.docNo || "Document" } } : {}),
              basis: "VERIFIED",
            },
          ],
        };
      } catch {
        return {
          status: "UNAVAILABLE",
          facts: [
            {
              id: "T.f1",
              label: "DOC_ANSWER",
              value: "Document Q&A service is currently unavailable.",
              basis: "RECORDED",
            },
          ],
        };
      }
    },
  }),

  get_quick_facts: defineCopilotTool({
    name: "get_quick_facts",
    description: "Get deterministic snapshot of a project without invoking LLM models.",
    argsSchema: z.object({
      projectId: z.string().trim().min(1).max(50),
    }).strict(),
    requires: ["project.read"],
    readOnly: true,
    link: (id) => (id ? `/projects/${id}/overview` : "/projects"),
    async run(actor, args, ctx) {
      return COPILOT_TOOLS.get_project_summary!.run(actor, args, ctx);
    },
  }),
};
