import type { CopilotFact } from "@infraos/shared-types";

const MONGO_ID_REGEX = /\b[a-f0-9]{24}\b/gi;
const PROJECT_CODE_REGEX = /\bINF-[A-Z0-9_-]+\b/gi;
const INSPECTION_CODE_REGEX = /\bINS-\d{4}-\d{6}\b/gi;
const ASSET_CODE_REGEX = /\bAST-[A-Z0-9_-]+\b/gi;

/**
 * Extracts all candidate entity identifiers from free text.
 */
export function extractIdsFromText(text: string): string[] {
  if (!text) return [];
  const ids: string[] = [];

  const mongoMatches = text.match(MONGO_ID_REGEX);
  if (mongoMatches) ids.push(...mongoMatches);

  const projectMatches = text.match(PROJECT_CODE_REGEX);
  if (projectMatches) ids.push(...projectMatches);

  const inspectionMatches = text.match(INSPECTION_CODE_REGEX);
  if (inspectionMatches) ids.push(...inspectionMatches);

  const assetMatches = text.match(ASSET_CODE_REGEX);
  if (assetMatches) ids.push(...assetMatches);

  return ids;
}

/**
 * Adds IDs found in user prompt, page context, or tool output facts to the provenance pool.
 */
export function addToProvenancePool(
  pool: Set<string>,
  data: {
    message?: string;
    pageContextRecordId?: string;
    facts?: CopilotFact[];
  },
): void {
  if (data.pageContextRecordId) {
    pool.add(data.pageContextRecordId);
    pool.add(data.pageContextRecordId.toLowerCase());
  }

  if (data.message) {
    for (const id of extractIdsFromText(data.message)) {
      pool.add(id);
      pool.add(id.toLowerCase());
    }
  }

  if (data.facts) {
    for (const fact of data.facts) {
      if (fact.ref?.id) {
        pool.add(fact.ref.id);
        pool.add(fact.ref.id.toLowerCase());
      }
      if (typeof fact.value === "string") {
        for (const id of extractIdsFromText(fact.value)) {
          pool.add(id);
          pool.add(id.toLowerCase());
        }
      }
    }
  }
}

const ID_KEY_PATTERNS = [
  /id$/i,
  /projectid$/i,
  /inspectionid$/i,
  /assetid$/i,
  /contractorid$/i,
  /documentid$/i,
  /recordid$/i,
];

/**
 * Validates that any identifier passed to a tool exists in the provenance pool.
 * Unprovenanced IDs are denied to prevent prompt-injection probing.
 */
export function validateArgsProvenance(
  args: Record<string, unknown>,
  pool: Set<string>,
): { valid: boolean; unprovenancedId?: string } {
  for (const [key, val] of Object.entries(args)) {
    if (typeof val === "string" && val.length > 0) {
      const isIdKey = ID_KEY_PATTERNS.some((p) => p.test(key));
      const looksLikeId = /^[a-f0-9]{24}$/i.test(val) || /^INF-[A-Z0-9_-]+$/i.test(val);

      if (isIdKey || looksLikeId) {
        const matches = pool.has(val) || pool.has(val.toLowerCase());
        if (!matches) {
          return { valid: false, unprovenancedId: val };
        }
      }
    }
  }

  return { valid: true };
}
