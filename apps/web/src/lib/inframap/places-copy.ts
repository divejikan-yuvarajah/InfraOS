import type { AuthLocale } from "@/lib/auth/types";

/**
 * Display names for the 9 provinces and 25 districts. The canonical English names are what the API stores and matches;
 * these are display-only. Sinhala and Tamil forms are the standard administrative spellings, flagged for native review.
 */
const SI: Record<string, string> = {
  "Western Province": "බස්නාහිර පළාත", "Central Province": "මධ්‍යම පළාත", "Southern Province": "දකුණු පළාත", "Northern Province": "උතුරු පළාත", "Eastern Province": "නැගෙනහිර පළාත",
  "North Western Province": "වයඹ පළාත", "North Central Province": "උතුරු මැද පළාත", "Uva Province": "ඌව පළාත", "Sabaragamuwa Province": "සබරගමුව පළාත",
  Colombo: "කොළඹ", Gampaha: "ගම්පහ", Kalutara: "කළුතර", Kandy: "මහනුවර", Matale: "මාතලේ", "Nuwara Eliya": "නුවරඑළිය", Galle: "ගාල්ල", Matara: "මාතර", Hambantota: "හම්බන්තොට",
  Jaffna: "යාපනය", Kilinochchi: "කිලිනොච්චි", Mannar: "මන්නාරම", Vavuniya: "වවුනියාව", Mullaitivu: "මුලතිව්", Batticaloa: "මඩකලපුව", Ampara: "අම්පාර", Trincomalee: "ත්‍රිකුණාමලය",
  Kurunegala: "කුරුණෑගල", Puttalam: "පුත්තලම", Anuradhapura: "අනුරාධපුර", Polonnaruwa: "පොලොන්නරුව", Badulla: "බදුල්ල", Monaragala: "මොණරාගල", Ratnapura: "රත්නපුර", Kegalle: "කෑගල්ල",
};
const TA: Record<string, string> = {
  "Western Province": "மேல் மாகாணம்", "Central Province": "மத்திய மாகாணம்", "Southern Province": "தெற்கு மாகாணம்", "Northern Province": "வடக்கு மாகாணம்", "Eastern Province": "கிழக்கு மாகாணம்",
  "North Western Province": "வட மேல் மாகாணம்", "North Central Province": "வட மத்திய மாகாணம்", "Uva Province": "ஊவா மாகாணம்", "Sabaragamuwa Province": "சப்பிரகமுவ மாகாணம்",
  Colombo: "கொழும்பு", Gampaha: "கம்பஹா", Kalutara: "களுத்துறை", Kandy: "கண்டி", Matale: "மாத்தளை", "Nuwara Eliya": "நுவரெலியா", Galle: "காலி", Matara: "மாத்தறை", Hambantota: "அம்பாந்தோட்டை",
  Jaffna: "யாழ்ப்பாணம்", Kilinochchi: "கிளிநொச்சி", Mannar: "மன்னார்", Vavuniya: "வவுனியா", Mullaitivu: "முல்லைத்தீவு", Batticaloa: "மட்டக்களப்பு", Ampara: "அம்பாறை", Trincomalee: "திருகோணமலை",
  Kurunegala: "குருநாகல்", Puttalam: "புத்தளம்", Anuradhapura: "அனுராதபுரம்", Polonnaruwa: "பொலன்னறுவை", Badulla: "பதுளை", Monaragala: "மொனராகலை", Ratnapura: "இரத்தினபுரி", Kegalle: "கேகாலை",
};

export const placeName = (canonical: string, locale: AuthLocale): string => (locale === "si" ? SI[canonical] : locale === "ta" ? TA[canonical] : undefined) ?? canonical;
export const PLACE_TRANSLATIONS = { si: SI, ta: TA } as const;
