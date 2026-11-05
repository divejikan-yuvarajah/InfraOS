import type { LayerKey } from "@/lib/inframap/inframap";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { getWorkRequestCopy } from "@/lib/roadsync/work-request-copy";

type Locale = "en" | "si" | "ta";

/** Translated label for a filter value or legend id. Stored data (titles, agency names, numbers) is never translated. */
export function valueLabel(layer: LayerKey, value: string, copy: InframapCopy, locale: Locale): string {
  if (value === "overdue" || value === "1") return copy.values.overdue!;
  if (copy.values2[value]) return copy.values2[value]!;
  if (copy.values[value]) return copy.values[value]!;
  if (layer === "conflicts") return (getAssessmentCopy(locale).bands as Record<string, string>)[value] ?? value;
  if (layer === "roadworks") return getWorkRequestCopy(locale).list.statuses[value] ?? value;
  return copy.projectStatus[value] ?? value.replace(/_/g, " ").toLowerCase();
}
