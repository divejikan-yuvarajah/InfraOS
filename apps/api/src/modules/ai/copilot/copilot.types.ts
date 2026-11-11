import type { z } from "zod";
import type {
  CopilotFact,
  CopilotPageType,
  CopilotStepKind,
  CopilotStepStatus,
  CopilotToolResult,
} from "@infraos/shared-types";

export type AuthenticatedActor = {
  userId: string;
  agencyId?: string;
  roleKey?: string;
  permissions?: readonly string[];
};

export type ToolRunContext = {
  requestId: string;
  provenancePool: Set<string>;
  permissions: readonly string[];
};

export type CopilotToolDefinition<TArgs = any> = {
  name: string;
  description: string;
  argsSchema: z.ZodType<TArgs>;
  requires: readonly string[];
  run(actor: AuthenticatedActor, args: TArgs, ctx: ToolRunContext): Promise<CopilotToolResult>;
  link(recordId?: string): string | undefined;
  readOnly: true;
};

export type CopilotPlannerStep = {
  at: Date;
  kind: CopilotStepKind;
  tool?: string;
  status: CopilotStepStatus;
  labelKey: string;
  durationMs: number;
};
