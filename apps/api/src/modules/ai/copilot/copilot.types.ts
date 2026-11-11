import type { z } from "zod";
import type {
  CopilotStepKind,
  CopilotStepStatus,
  CopilotToolResult,
} from "@infraos/shared-types";

export type AuthenticatedActor = {
  userId: string;
  agencyId?: string;
  roleId?: string;
  roleKey?: string;
  credentialEpoch?: number;
  permissions?: readonly string[];
};

export type ToolRunContext = {
  requestId: string;
  provenancePool: Set<string>;
  permissions: readonly string[];
};

export type CopilotToolDefinition<TArgs = Record<string, unknown>> = {
  name: string;
  description: string;
  argsSchema: z.ZodType<TArgs>;
  requires: readonly string[];
  run(actor: AuthenticatedActor, args: TArgs, ctx: ToolRunContext): Promise<CopilotToolResult>;
  link(recordId?: string): string | undefined;
  readOnly: true;
};

export function defineCopilotTool<TSchema extends z.ZodType<Record<string, unknown>>>(def: {
  name: string;
  description: string;
  argsSchema: TSchema;
  requires: readonly string[];
  run(actor: AuthenticatedActor, args: z.infer<TSchema>, ctx: ToolRunContext): Promise<CopilotToolResult>;
  link(recordId?: string): string | undefined;
  readOnly: true;
}): CopilotToolDefinition<Record<string, unknown>> {
  return {
    name: def.name,
    description: def.description,
    argsSchema: def.argsSchema as z.ZodType<Record<string, unknown>>,
    requires: def.requires,
    link: def.link,
    readOnly: def.readOnly,
    run(actor, rawArgs, ctx) {
      const parsed = def.argsSchema.parse(rawArgs);
      return def.run(actor, parsed, ctx);
    },
  };
}

export type CopilotPlannerStep = {
  at: Date;
  kind: CopilotStepKind;
  tool?: string;
  status: CopilotStepStatus;
  labelKey: string;
  durationMs: number;
};
