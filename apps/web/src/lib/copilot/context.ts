import { normalizeAppPath } from "@/lib/auth/route-access";

import type { CopilotPageContext } from "./types";

const OID = /^[a-f0-9]{24}$/i;

function pickOid(seg: string | undefined): string | undefined {
  return seg && OID.test(seg) ? seg : undefined;
}

/**
 * Derives structured page context from the current route path.
 * Never puts query params or PII into context; validates 24-hex ObjectIds strictly.
 */
export function deriveCopilotContext(pathname: string): CopilotPageContext {
  const route = normalizeAppPath(pathname || "/");
  const parts = route.split("/").filter(Boolean);
  const root = parts[0] ?? "";

  if (root === "dashboard") {
    return { type: "DASHBOARD", route };
  }

  if (root === "projects") {
    const id = pickOid(parts[1]);
    if (parts[2] === "risk") {
      return { type: "RISK", ...(id ? { recordId: id, projectIdHint: id } : {}), route };
    }
    if (parts[2] === "inspections") {
      return { type: "INSPECTION", ...(id ? { recordId: id, projectIdHint: id } : {}), route };
    }
    return { type: "PROJECT", ...(id ? { recordId: id, projectIdHint: id } : {}), route };
  }

  if (root === "risk") {
    return { type: "RISK", route };
  }

  if (root === "inspections") {
    const id = pickOid(parts[1]);
    return { type: "INSPECTION", ...(id ? { recordId: id } : {}), route };
  }

  if (root === "documents") {
    const id = pickOid(parts[1]);
    return { type: "DOCUMENT", ...(id ? { recordId: id } : {}), route };
  }

  if (root === "assets") {
    const id = pickOid(parts[1]);
    return { type: "ASSET", ...(id ? { recordId: id } : {}), route };
  }

  if (root === "contractors") {
    const id = pickOid(parts[1]);
    return { type: "CONTRACTOR", ...(id ? { recordId: id } : {}), route };
  }

  if (root === "roadsync") {
    if (parts[1] === "conflicts") {
      const id = pickOid(parts[2]);
      return { type: "CONFLICT", ...(id ? { recordId: id } : {}), route };
    }
    return { type: "CONFLICT", route };
  }

  return { type: "OTHER", route };
}

