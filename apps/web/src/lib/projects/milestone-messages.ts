import type { AuthLocale } from "@/lib/auth/types";

const EN = {
  title: "Milestones",
  nativeReview: "Sinhala and Tamil milestone labels are drafts. A native-language review is still pending.",
  back: "Back to the project overview",
  plannedLabel: "Planned",
  empty: "No milestones yet. Add the first planned milestone when this project is approved or active.",
  readOnly: "You can read milestones in scope. Creating or changing them is not available for this account.",
  notEligible: "Milestones can be added only while the project is approved or active.",
  add: "Add milestone",
  save: "Save milestone",
  saving: "Saving milestone",
  saved: "Milestone saved.",
  updated: "Milestone updated.",
  conflict: "This milestone changed. Reload it before trying again.",
  invalid: "Check the title and planned dates. The end date cannot be before the start.",
  blocked: "This milestone change is not available.",
  unavailable: "Milestones are temporarily unavailable.",
  offline: "You appear to be offline. Nothing new was saved.",
  forbidden: "You do not have access to these milestones.",
  notFound: "This project is outside your scope, or it does not exist.",
  titleField: "Title",
  descriptionField: "Description",
  startField: "Planned start",
  endField: "Planned end",
  progress: "Milestone progress",
  counts: "Counts",
  transition: "Change status",
  working: "Saving status",
  weightBlocked: "Milestone weight is not part of this step.",
  noDelete: "Milestones are not deleted from this workspace.",
  edit: "Edit",
  close: "Close",
  statuses: {
    NOT_STARTED: "Planned",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    DELAYED: "Delayed",
    BLOCKED: "Blocked",
    CANCELLED: "Cancelled",
  },
  actions: {
    START: "Start",
    COMPLETE: "Complete",
    DELAY: "Mark delayed",
    BLOCK: "Mark blocked",
    RESUME: "Resume",
    CANCEL: "Cancel milestone",
  },
};

const SI: typeof EN = {
  ...EN,
  title: "සන්ධිස්ථාන",
  nativeReview: "සිංහල සහ දෙමළ සන්ධිස්ථාන ලේබල කෙටුම්පත්. ස්වදේශීය සමාලෝචනය තවමය.",
  back: "ව්‍යාපෘති දළ විශ්ලේෂණයට",
  add: "සන්ධිස්ථානයක් එක් කරන්න",
  save: "සන්ධිස්ථානය සුරකින්න",
  empty: "තවම සන්ධිස්ථාන නැත.",
  statuses: { ...EN.statuses, NOT_STARTED: "සැලසුම්" },
};

const TA: typeof EN = {
  ...EN,
  title: "மைல்கற்கள்",
  nativeReview: "சிங்களம் மற்றும் தமிழ் மைல்கல் லேபிள்கள் வரைவு. தாய்மொழி மதிப்பாய்வு நிலுவையில் உள்ளது.",
  back: "திட்ட மேலோட்டத்திற்கு",
  add: "மைல்கல்லைச் சேர்",
  save: "மைல்கல்லைச் சேமி",
  empty: "இன்னும் மைல்கற்கள் இல்லை.",
  statuses: { ...EN.statuses, NOT_STARTED: "திட்டமிட்டது" },
};

export function getMilestoneCopy(locale: AuthLocale = "en") {
  if (locale === "si") return SI;
  if (locale === "ta") return TA;
  return EN;
}

export type MilestoneCopy = typeof EN;
