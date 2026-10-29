/** Reported physical progress is accepted only while construction is ACTIVE. START stays locked. */
export const PROGRESS_REPORTING_STATUS = "ACTIVE" as const;

/** A lower percentage is a new history row, and the note is the correction reason. */
export const CORRECTION_NOTE_MIN = 12;

export function needsCorrectionNote(currentPercent: number, nextPercent: number): boolean {
  return nextPercent < currentPercent;
}
