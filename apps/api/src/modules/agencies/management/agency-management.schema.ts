import { AGENCY_STATUSES, AGENCY_TYPES, type AgencyStatus, type AgencyType } from "@infraos/shared-types";
import { z } from "zod";

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

const revision = z.number().int().min(0).max(1_000_000);
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

const boundedText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasControlChar(value), "text contains control characters");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !hasControlChar(value), "text contains control characters")
    .nullable()
    .optional();

export const agencyCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9_]+$/)
      .transform((value) => value.toUpperCase()),
    name: boundedText(160),
    type: z.enum(AGENCY_TYPES),
    shortName: optionalText(40),
    description: optionalText(500),
    contactEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).nullable().optional(),
    contactPhone: optionalText(32),
    address: optionalText(240),
    parentAgencyId: objectId.nullable(),
  })
  .strict();

export const agencyMetadataPatchSchema = z
  .object({
    revision,
    name: boundedText(160).optional(),
    shortName: optionalText(40),
    description: optionalText(500),
    contactEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).nullable().optional(),
    contactPhone: optionalText(32),
    address: optionalText(240),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "revision"), { message: "metadata is empty" });

export const agencyReparentSchema = z
  .object({
    revision,
    parentAgencyId: objectId.nullable(),
  })
  .strict();

export const agencyDeactivateSchema = z
  .object({
    revision,
  })
  .strict();

const LIST_KEYS = new Set(["page", "pageSize", "q", "status", "type"]);

export type AgencyListQuery = {
  page: number;
  pageSize: number;
  q: string | null;
  status: AgencyStatus | null;
  type: AgencyType | null;
};

export function parseAgencyListQuery(input: unknown): AgencyListQuery | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!LIST_KEYS.has(key) || key.startsWith("$")) return null;
  }
  const pageRaw = record.page == null || record.page === "" ? "1" : String(record.page);
  const sizeRaw = record.pageSize == null || record.pageSize === "" ? "20" : String(record.pageSize);
  if (!/^\d+$/.test(pageRaw) || !/^\d+$/.test(sizeRaw)) return null;
  const page = Number(pageRaw);
  const pageSize = Number(sizeRaw);
  if (page < 1 || page > 10_000 || pageSize < 1 || pageSize > 25) return null;
  let q: string | null = null;
  if (record.q != null && record.q !== "") {
    q = String(record.q).trim();
    if (q.length > 80 || hasControlChar(q)) return null;
  }
  let status: AgencyStatus | null = null;
  if (record.status != null && record.status !== "") {
    const value = String(record.status);
    if (!AGENCY_STATUSES.includes(value as AgencyStatus)) return null;
    status = value as AgencyStatus;
  }
  let type: AgencyType | null = null;
  if (record.type != null && record.type !== "") {
    const value = String(record.type);
    if (!AGENCY_TYPES.includes(value as AgencyType)) return null;
    type = value as AgencyType;
  }
  return { page, pageSize, q, status, type };
}

export type AgencyCreateInput = z.infer<typeof agencyCreateSchema>;
export type AgencyMetadataPatchInput = z.infer<typeof agencyMetadataPatchSchema>;
export type AgencyReparentInput = z.infer<typeof agencyReparentSchema>;
export type AgencyDeactivateInput = z.infer<typeof agencyDeactivateSchema>;
