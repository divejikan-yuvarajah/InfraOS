import { z } from "zod";

import { CORRECTION_NOTE_MIN } from "./progress-policy";

export const progressFormSchema = z.object({
  percentage: z.number().int().min(0).max(100),
  note: z.string().trim().min(1).max(2000),
}).strict();

export function progressNoteReady(currentPercent: number, nextPercent: number, note: string): boolean {
  const trimmed = note.trim();
  if (trimmed.length < 1 || trimmed.length > 2000 || trimmed.includes("$")) return false;
  if (nextPercent < currentPercent) return trimmed.length >= CORRECTION_NOTE_MIN;
  return true;
}
