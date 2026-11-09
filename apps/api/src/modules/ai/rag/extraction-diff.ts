import type { DiffState } from "@infraos/shared-types";

import type { TypedValue } from "./values.js";

/** Read-only comparison of an extracted value with the authoritative record. Informational only: a mismatch is flagged, never resolved. */
export type DiffRecords = {
  project: { id: string; title: string; startDate: Date | null; plannedEndDate: Date | null; budgetMinor: number | null; agencyName: string | null } | null;
  contractor: { id: string; name: string } | null;
  canFinance: boolean;
  canContractor: boolean;
};
export type FieldDiff = { state: DiffState; current: string | null; record: { type: "PROJECT" | "CONTRACTOR"; id: string } | null };

const strip = (s: string): string => s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const sameText = (a: string, b: string): boolean => { const x = strip(a); const y = strip(b); return x === y || (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))); };
const COLOMBO = 5.5 * 3_600_000;
const isoDay = (d: Date): string[] => [d.toISOString().slice(0, 10), new Date(d.getTime() + COLOMBO).toISOString().slice(0, 10)];
const fmtMoney = (minor: number): string => `LKR ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const NO_RECORD: FieldDiff = { state: "NO_RECORD", current: null, record: null };
const NOT_COMPARABLE: FieldDiff = { state: "NOT_COMPARABLE", current: null, record: null };

/** `value` is the reviewed value if there is one (edited), otherwise the first extracted value. Fields with no counterpart are NOT_COMPARABLE. */
export function diffField(key: string, value: TypedValue | null, r: DiffRecords): FieldDiff {
  const p = r.project;
  const projectRec = p ? ({ type: "PROJECT", id: p.id } as const) : null;
  const text = (cur: string | null | undefined, rec: FieldDiff["record"]): FieldDiff => {
    if (!cur) return NO_RECORD;
    if (!value || value.type !== "STRING") return { state: "NOT_COMPARABLE", current: cur, record: rec };
    return { state: sameText(value.text, cur) ? "MATCH" : "DIFFERS", current: cur, record: rec };
  };
  const date = (cur: Date | null | undefined): FieldDiff => {
    if (!cur) return p ? NO_RECORD : NO_RECORD;
    if (!value || value.type !== "DATE") return { state: "NOT_COMPARABLE", current: isoDay(cur)[1]!, record: projectRec };
    return { state: isoDay(cur).includes(value.iso) ? "MATCH" : "DIFFERS", current: isoDay(cur)[1]!, record: projectRec };
  };
  switch (key) {
    case "project_name": return p ? text(p.title, projectRec) : NO_RECORD;
    case "implementing_agency": return p ? text(p.agencyName, projectRec) : NO_RECORD;
    case "commencement_date": return p ? date(p.startDate) : NO_RECORD;
    case "completion_date": return p ? date(p.plannedEndDate) : NO_RECORD;
    case "contractor_name": {
      if (!r.canContractor) return NOT_COMPARABLE; // names of contractors are not shown to roles without contractor.read
      return r.contractor ? text(r.contractor.name, { type: "CONTRACTOR", id: r.contractor.id }) : NO_RECORD;
    }
    case "contract_value": {
      if (!r.canFinance) return NOT_COMPARABLE; // finance values only for finance readers
      if (!p || p.budgetMinor === null) return NO_RECORD;
      if (!value || value.type !== "MONEY") return { state: "NOT_COMPARABLE", current: fmtMoney(p.budgetMinor), record: projectRec };
      return { state: value.currency === "LKR" && value.amountMinor === p.budgetMinor ? "MATCH" : "DIFFERS", current: fmtMoney(p.budgetMinor), record: projectRec };
    }
    default: return NOT_COMPARABLE;
  }
}
