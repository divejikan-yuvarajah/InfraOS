import type { AuthLocale } from "@/lib/auth/types";

const EN = {
  title: "Projects",
  subtitle: "Scoped ProjectTrace drafts and records from the live API.",
  empty: "No projects are visible in your scope.",
  forbidden: "You do not have access to these projects.",
  unavailable: "ProjectTrace is temporarily unavailable.",
  nativeReview: "Sinhala and Tamil copy is a draft pending native review.",
  overview: "Project overview",
};

export type ProjectCopy = typeof EN;

export function getProjectCopy(locale: AuthLocale): ProjectCopy {
  if (locale === "si") {
    return { ...EN, title: "ව්‍යාපෘති", subtitle: "ඔබේ විෂය පථයේ ProjectTrace වාර්තා.", empty: "ඔබේ විෂය පථයේ ව්‍යාපෘති නැත.", forbidden: "මෙම ව්‍යාපෘති වෙත ඔබට ප්‍රවේශය නැත." };
  }
  if (locale === "ta") {
    return { ...EN, title: "திட்டங்கள்", subtitle: "உங்கள் வரம்பில் உள்ள ProjectTrace பதிவுகள்.", empty: "உங்கள் வரம்பில் திட்டங்கள் இல்லை.", forbidden: "இந்த திட்டங்களுக்கு உங்களுக்கு அணுகல் இல்லை." };
  }
  return EN;
}

export function projectListMessage(status: number, copy: ProjectCopy): string {
  if (status === 401 || status === 403) return copy.forbidden;
  return copy.unavailable;
}
