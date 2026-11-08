import type { AuthFailureCode, AuthLocale } from "./types";
import type { RequestedResponsibilityKey } from "./register-schema";

export type AuthLoginCopy = {
  title: string;
  subtitle: string;
  eyebrow: string;
  emailLabel: string;
  emailDomainHint: string;
  emailHelper: string;
  passwordLabel: string;
  showPassword: string;
  hidePassword: string;
  keepActiveLabel: string;
  tlsBadge: string;
  submit: string;
  submitting: string;
  previewBanner: string;
  forgotLink: string;
  backHome: string;
  officialAccessBadge: string;
  newOfficerPrompt: string;
  createAccountLink: string;
  onboardingNotice: string;
  securityFooterText: string;
  dataProtocolLabel: string;
  auditRegisterLabel: string;
  helplineLabel: string;
  corridorStatusPill: string;
  corridorHeadlineLead: string;
  corridorHeadlineAccent: string;
  corridorHeadlineTail: string;
  corridorDescription: string;
  corridorBadgeLocation: string;
  corridorBadgeStatus: string;
  corridorFlowSteps: readonly [string, string, string];
  corridorPillars: readonly [
    { title: string; body: string },
    { title: string; body: string },
    { title: string; body: string },
  ];
  corridorFooter: string;
  errors: Record<AuthFailureCode, string>;
};

export type AuthRegisterCopy = {
  eyebrow: string;
  backToPortal: string;
  backToSignIn: string;
  alreadyHaveAccount: string;
  signInLink: string;
  stepLabels: readonly [string, string, string];
  step1: {
    title: string;
    subtitle: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    emailHelper: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    strengthLabels: readonly [string, string, string, string, string];
    ruleMinLength: string;
    ruleMaxBytes: string;
    ruleAlphanumeric: string;
    ruleComplex: string;
    continueBtn: string;
  };
  step2: {
    title: string;
    subtitle: string;
    organizationLabel: string;
    organizationSearchPlaceholder: string;
    departmentLabel: string;
    departmentPlaceholder: string;
    designationLabel: string;
    designationPlaceholder: string;
    responsibilityLabel: string;
    responsibilityHelper: string;
    responsibilities: Record<RequestedResponsibilityKey, { label: string; description: string }>;
    institutionalNoticeTitle: string;
    institutionalNoticeBody: string;
    previousBtn: string;
    continueBtn: string;
  };
  step3: {
    title: string;
    subtitle: string;
    accountSectionTitle: string;
    organizationSectionTitle: string;
    editBtn: string;
    passwordProtectedMask: string;
    termsCheckboxLabel: string;
    privacyPolicyLink: string;
    accessibilityLink: string;
    submitBtn: string;
    submittingBtn: string;
    previousBtn: string;
  };
  confirmation: {
    badge: string;
    title: string;
    subtitle: string;
    referenceLabel: string;
    statusLabel: string;
    statusValue: string;
    organizationLabel: string;
    nextStepsTitle: string;
    nextSteps: readonly [string, string, string];
    previewModeNote: string;
    returnToSignIn: string;
    returnToPortal: string;
  };
};

const LOGIN_COPY: Record<AuthLocale, AuthLoginCopy> = {
  en: {
    title: "Sign In to InfraOS",
    subtitle:
      "Access your department workspace, coordination grids, and project clearance pipelines.",
    eyebrow: "AUTHORIZED ACCESS ONLY",
    emailLabel: "Work Email Address",
    emailDomainHint: "e.g. RDA, CEB, NWSDB (.gov.lk)",
    emailHelper: "Accredited ministry, statutory board, or licensed contractor domain",
    passwordLabel: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    keepActiveLabel: "Keep active on this secured terminal",
    tlsBadge: "TLS 1.3 FIPS",
    submit: "Sign In to InfraOS",
    submitting: "Verifying Credentials…",
    previewBanner:
      "Sign-in is not connected to a live identity service in this environment.",
    forgotLink: "Forgot password?",
    backHome: "Back to Public Portal",
    officialAccessBadge: "Official G2G Access",
    newOfficerPrompt: "Need an institutional credential?",
    createAccountLink: "Create Account / Request Agency Onboarding",
    onboardingNotice:
      "Registrations require institutional verification under National Infrastructure Coordination Gazette protocols.",
    securityFooterText: "PKI 256-Bit TLS Secured · ISO 27001 Certified G2G",
    dataProtocolLabel: "Data Protocol",
    auditRegisterLabel: "Audit Register",
    helplineLabel: "Helpline: 1919",
    corridorStatusPill: "Spatial Sync Live: E-01 Central Corridor Active",
    corridorHeadlineLead: "One Nation.",
    corridorHeadlineAccent: "Connected",
    corridorHeadlineTail: "Infrastructure.",
    corridorDescription:
      "Access a unified statutory workspace to plan, coordinate, and monitor national capital works across roads, utilities, and telecom assets with geospatial audit clarity.",
    corridorBadgeLocation: "RDA Corridor #4 · Kadawatha–Mirigama Section",
    corridorBadgeStatus: "ZERO PAVEMENT CLASHES",
    corridorFlowSteps: ["Road Networks", "Public Utilities", "Coordinated Permits"],
    corridorPillars: [
      {
        title: "Unified View",
        body: "One central corridor registry for all multi-agency works.",
      },
      {
        title: "Inter-Agency",
        body: "Enforces synchronous digging & conduit sharing.",
      },
      {
        title: "Zero Clashes",
        body: "Spatial conflict engine stops road damage before paving.",
      },
    ],
    corridorFooter: "InfraOS · National Infrastructure Intelligence & Coordination Platform",
    errors: {
      NOT_LIVE:
        "Sign-in cannot complete because no live identity service is configured.",
      VALIDATION: "Enter a valid work email address and password.",
      INVALID_CREDENTIALS:
        "Sign-in could not be completed. Verify your credentials and ensure your institutional account has been approved.",
      SESSION_EXPIRED: "Your session ended. Sign in again to continue.",
      RATE_LIMITED: "Too many sign-in attempts. Wait a moment and try again.",
      UNAVAILABLE: "Sign-in is temporarily unavailable. Try again shortly.",
      NETWORK: "Network error while contacting the identity service.",
      PENDING_APPROVAL:
        "Your account registration is currently pending Super Admin review. You will receive an email once your account has been approved.",
      REJECTED:
        "Your registration request was reviewed and declined. Please contact your organization administrator for details.",
      SUSPENDED:
        "Your institutional account has been suspended. Please contact your system administrator.",
    },
  },
  si: {
    title: "InfraOS වෙත පිවිසෙන්න",
    subtitle:
      "ඔබගේ ආයතනික වැඩබිම, සම්බන්ධීකරණ ජාල සහ ව්‍යාපෘති අනුමත කිරීමේ පද්ධතියට පිවිසෙන්න.",
    eyebrow: "බලයලත් නිල පිවිසුම පමණි",
    emailLabel: "රාජකාරි විද්‍යුත් තැපැල් ලිපිනය",
    emailDomainHint: "උදා: RDA, CEB, NWSDB (.gov.lk)",
    emailHelper: "අනුමත අමාත්‍යාංශ, ව්‍යවස්ථාපිත මණ්ඩල හෝ බලයලත් ආයතනික වසම",
    passwordLabel: "මුරපදය",
    showPassword: "මුරපදය පෙන්වන්න",
    hidePassword: "මුරපදය සඟවන්න",
    keepActiveLabel: "මෙම ආරක්ෂිත පර්යන්තයේ සැසිය සක්‍රීයව තබන්න",
    tlsBadge: "TLS 1.3 FIPS",
    submit: "InfraOS වෙත පිවිසෙන්න",
    submitting: "අක්තපත්‍ර පරීක්ෂා කරමින්…",
    previewBanner:
      "මෙම පරිසරයේ සජීවී හඳුනාගැනීමේ සේවාවක් සම්බන්ධ කර නොමැත.",
    forgotLink: "මුරපදය අමතකද?",
    backHome: "මහජන ද්වාරයට ආපසු",
    officialAccessBadge: "නිල G2G ප්‍රවේශය",
    newOfficerPrompt: "නව ආයතනික ගිණුමක් අවශ්‍යද?",
    createAccountLink: "ගිණුමක් සාදන්න / ආයතනික ප්‍රවේශය ඉල්ලුම් කරන්න",
    onboardingNotice:
      "ජාතික යටිතල පහසුකම් සම්බන්ධීකරණ රෙගුලාසි යටතේ සියලුම ලියාපදිංචි කිරීම් ආයතනික තහවුරු කිරීමට යටත් වේ.",
    securityFooterText: "PKI 256-Bit TLS ආරක්ෂිත · ISO 27001 සහතිකලත් G2G",
    dataProtocolLabel: "දත්ත ප්‍රොටෝකෝලය",
    auditRegisterLabel: "විගණන ලේඛනය",
    helplineLabel: "උපකාරක සේවාව: 1919",
    corridorStatusPill: "සජීවී භූ-සමමුහුර්තකරණය: E-01 මධ්‍යම කොරිඩෝව සක්‍රීයයි",
    corridorHeadlineLead: "එකම දැක්මකින්.",
    corridorHeadlineAccent: "සම්බන්ධිත",
    corridorHeadlineTail: "ජාතික යටිතල පහසුකම්.",
    corridorDescription:
      "මහාමාර්ග, ජල සම්පාදන, විදුලිබල සහ විදුලි සංදේශ ව්‍යාපෘති එකම භූ-තොරතුරු වැඩබිමක සැලසුම් කිරීමට, සම්බන්ධීකරණය කිරීමට සහ අධීක්ෂණය කිරීමට පිවිසෙන්න.",
    corridorBadgeLocation: "RDA කොරිඩෝව #4 · කඩවත–මීරිගම කොටස",
    corridorBadgeStatus: "මාර්ග ගැටුම් ශුන්‍යයි",
    corridorFlowSteps: ["මාර්ග ජාල", "මහජන උපයෝගිතා", "සම්බන්ධීකරණ බලපත්‍ර"],
    corridorPillars: [
      {
        title: "ඒකාබද්ධ දැක්ම",
        body: "සියලුම ආයතනික ව්‍යාපෘති සඳහා එක් මධ්‍යම කොරිඩෝ ලේඛනයක්.",
      },
      {
        title: "අන්තර්-ආයතනික",
        body: "සමගාමී කැණීම් සහ උපයෝගිතා නළ මාර්ග බෙදාගැනීම තහවුරු කරයි.",
      },
      {
        title: "ගැටුම් ශුන්‍යයි",
        body: "මාර්ග ඇතිරීමට පෙර අවකාශීය ගැටුම් කල්තියා හඳුනා ගනී.",
      },
    ],
    corridorFooter: "InfraOS · ජාතික යටිතල පහසුකම් බුද්ධි හා සම්බන්ධීකරණ වේදිකාව",
    errors: {
      NOT_LIVE: "සජීවී හඳුනාගැනීමේ සේවාවක් සකසා නොමැති නිසා පිවිසීම සම්පූර්ණ කළ නොහැක.",
      VALIDATION: "වලංගු විද්‍යුත් තැපැල් ලිපිනයක් සහ මුරපදයක් ඇතුළත් කරන්න.",
      INVALID_CREDENTIALS:
        "පිවිසීම සම්පූර්ණ කළ නොහැක. ඔබගේ තොරතුරු සහ ආයතනික ගිණුම් අනුමැතිය පරීක්ෂා කරන්න.",
      SESSION_EXPIRED: "ඔබගේ සැසිය අවසන් විය. නැවත පිවිසෙන්න.",
      RATE_LIMITED: "උත්සාහයන් වැඩිය. මොහොතකින් නැවත උත්සාහ කරන්න.",
      UNAVAILABLE: "පිවිසීම තාවකාලිකව ලබා ගත නොහැක.",
      NETWORK: "හඳුනාගැනීමේ සේවාව සම්බන්ධ කර ගැනීමේදී ජාල දෝෂයක් ඇති විය.",
      PENDING_APPROVAL:
        "ඔබගේ ලියාපදිංචිය පරිපාලක අනුමැතිය සඳහා රැඳී පවතී. අනුමත වූ පසු ඔබට විද්‍යුත් තැපෑලෙන් දැනුම් දෙනු ලැබේ.",
      REJECTED:
        "ඔබගේ ලියාපදිංචි ඉල්ලීම ප්‍රතික්ෂේප කර ඇත. කරුණාකර ඔබගේ ආයතන පරිපාලක අමතන්න.",
      SUSPENDED:
        "ඔබගේ ගිණුම අත්හිටුවා ඇත. කරුණාකර පද්ධති පරිපාලක අමතන්න.",
    },
  },
  ta: {
    title: "InfraOS இல் உள்நுழைக",
    subtitle:
      "உங்கள் நிறுவன பணியிடம், ஒருங்கிணைப்பு கட்டங்கள் மற்றும் திட்ட அனுமதி வழிமுறைகளை அணுகவும்.",
    eyebrow: "அங்கீகரிக்கப்பட்ட அணுகல் மட்டும்",
    emailLabel: "பணி மின்னஞ்சல் முகவரி",
    emailDomainHint: "எ.கா: RDA, CEB, NWSDB (.gov.lk)",
    emailHelper: "அங்கீகரிக்கப்பட்ட அமைச்சு, சட்டப்பூர்வ சபை அல்லது ஒப்பந்ததாரர் மின்னஞ்சல்",
    passwordLabel: "கடவுச்சொல்",
    showPassword: "கடவுச்சொல்லைக் காட்டு",
    hidePassword: "கடவுச்சொல்லை மறை",
    keepActiveLabel: "இந்த பாதுகாப்பான முனையத்தில் செயல்பாட்டில் வைத்திருக்கவும்",
    tlsBadge: "TLS 1.3 FIPS",
    submit: "InfraOS இல் உள்நுழைக",
    submitting: "சான்றுகள் சரிபார்க்கப்படுகின்றன…",
    previewBanner:
      "இந்த சூழலில் நேரடி அடையாள சேவை இணைக்கப்படவில்லை.",
    forgotLink: "கடவுச்சொல் மறந்துவிட்டதா?",
    backHome: "பொது முகப்புக்குத் திரும்பு",
    officialAccessBadge: "அதிகாரப்பூர்வ G2G அணுகல்",
    newOfficerPrompt: "நிறுவன கணக்கு தேவையா?",
    createAccountLink: "கணக்கை உருவாக்கவும் / நிறுவன அணுகலைக் கோரவும்",
    onboardingNotice:
      "தேசிய உள்கட்டமைப்பு ஒருங்கிணைப்பு விதிகளின் கீழ் அனைத்து பதிவுகளும் நிறுவன சரிபார்ப்புக்கு உட்பட்டவை.",
    securityFooterText: "PKI 256-Bit TLS பாதுகாப்பு · ISO 27001 சான்றளிக்கப்பட்ட G2G",
    dataProtocolLabel: "தரவு நெறிமுறை",
    auditRegisterLabel: "தணிக்கை பதிவேடு",
    helplineLabel: "உதவி எண்: 1919",
    corridorStatusPill: "நேரடி இடஞ்சார்ந்த ஒத்திசைவு: E-01 மத்திய வழித்தடம் செயலில்",
    corridorHeadlineLead: "ஒரே நாடு.",
    corridorHeadlineAccent: "இணைக்கப்பட்ட",
    corridorHeadlineTail: "உள்கட்டமைப்பு.",
    corridorDescription:
      "சாலைகள், குடிநீர், மின்சாரம் மற்றும் தொலைத்தொடர்பு திட்டங்களை ஒரே புவியியல் பணியிடத்தில் திட்டமிட, ஒருங்கிணைக்க மற்றும் கண்காணிக்க அணுகவும்.",
    corridorBadgeLocation: "RDA வழித்தடம் #4 · கடவத்தை–மீரிகம பிரிவு",
    corridorBadgeStatus: "சாலை மோதல்கள் பூஜ்ஜியம்",
    corridorFlowSteps: ["சாலை வலைப்பின்னல்", "பொது பயன்பாடுகள்", "ஒருங்கிணைந்த அனுமதிகள்"],
    corridorPillars: [
      {
        title: "ஒருங்கிணைந்த பார்வை",
        body: "அனைத்து நிறுவன பணிகளுக்கும் ஒரே மத்திய வழித்தட பதிவேடு.",
      },
      {
        title: "நிறுவன இணக்கம்",
        body: "ஒத்திசைவான அகழ்வு மற்றும் குழாய் பகிர்வை உறுதி செய்கிறது.",
      },
      {
        title: "பூஜ்ஜிய மோதல்கள்",
        body: "சாலை அமைப்பதற்கு முன்பே இடஞ்சார்ந்த மோதல்களைத் தடுக்கிறது.",
      },
    ],
    corridorFooter: "InfraOS · தேசிய உள்கட்டமைப்பு நுண்ணறிவு மற்றும் ஒருங்கிணைப்பு தளம்",
    errors: {
      NOT_LIVE: "நேரடி அடையாள சேவை அமைக்கப்படாததால் உள்நுழைவை முடிக்க முடியாது.",
      VALIDATION: "செல்லுபடியாகும் மின்னஞ்சல் முகவரி மற்றும் கடவுச்சொல்லை உள்ளிடவும்.",
      INVALID_CREDENTIALS:
        "உள்நுழைவை முடிக்க முடியவில்லை. உங்கள் சான்றுகள் மற்றும் கணக்கு ஒப்புதலைச் சரிபார்க்கவும்.",
      SESSION_EXPIRED: "உங்கள் அமர்வு முடிந்தது. தொடர மீண்டும் உள்நுழையவும்.",
      RATE_LIMITED: "மிக அதிக முயற்சிகள். சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
      UNAVAILABLE: "உள்நுழைவு தற்காலிகமாக கிடைக்கவில்லை.",
      NETWORK: "அடையாள சேவையைத் தொடர்பு கொள்ளும்போது பிணைய பிழை ஏற்பட்டது.",
      PENDING_APPROVAL:
        "உங்கள் கணக்கு பதிவு நிர்வாகி ஒப்புதலுக்காக நிலுவையில் உள்ளது. அங்கீகரிக்கப்பட்டவுடன் மின்னஞ்சல் அறிவிப்பைப் பெறுவீர்கள்.",
      REJECTED:
        "உங்கள் பதிவு கோரிக்கை நிராகரிக்கப்பட்டது. விவரங்களுக்கு உங்கள் நிறுவன நிர்வாகியைத் தொடர்பு கொள்ளவும்.",
      SUSPENDED:
        "உங்கள் கணக்கு இடைநிறுத்தப்பட்டுள்ளது. கணினி நிர்வாகியைத் தொடர்பு கொள்ளவும்.",
    },
  },
};

const REGISTER_COPY: Record<AuthLocale, AuthRegisterCopy> = {
  en: {
    eyebrow: "INSTITUTIONAL ACCOUNT ONBOARDING",
    backToPortal: "Back to Public Portal",
    backToSignIn: "Back to Sign In",
    alreadyHaveAccount: "Already have an authorized account?",
    signInLink: "Sign In",
    stepLabels: ["Account Details", "Organization & Access", "Review & Confirm"],
    step1: {
      title: "Get Started with InfraOS",
      subtitle: "Create your account to begin the institutional access process.",
      fullNameLabel: "Full Name",
      fullNamePlaceholder: "e.g. Eng. Dinesh Senanayake",
      emailLabel: "Work Email Address",
      emailPlaceholder: "officer@organization.gov.lk",
      emailHelper: "Use your official ministry, authority, municipal, or accredited agency email.",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimum 8 characters (up to 72 UTF-8 bytes)",
      confirmPasswordLabel: "Confirm Password",
      confirmPasswordPlaceholder: "Re-enter your password",
      strengthLabels: ["Enter password", "Weak", "Fair", "Good", "Strong"],
      ruleMinLength: "At least 8 characters",
      ruleMaxBytes: "Within 72 UTF-8 byte cryptographic limit",
      ruleAlphanumeric: "Contains both letters and numbers",
      ruleComplex: "Includes uppercase/lowercase mix or symbol",
      continueBtn: "Continue to Organization & Access",
    },
    step2: {
      title: "Tell us about your organization",
      subtitle:
        "Select your affiliated institution and specify your operational responsibility for verification.",
      organizationLabel: "Organization / Institution",
      organizationSearchPlaceholder: "Filter statutory agencies (e.g. RDA, NWSDB, CEB, UDA)…",
      departmentLabel: "Department / Division",
      departmentPlaceholder: "e.g. Expressway Corridor Planning Division",
      designationLabel: "Professional Designation",
      designationPlaceholder: "e.g. Chief Civil Engineer / GIS Coordinator",
      responsibilityLabel: "Requested Access Responsibility",
      responsibilityHelper:
        "Recorded as request metadata for your agency administrator. Does not automatically grant system roles.",
      responsibilities: {
        PROJECT_MANAGEMENT: {
          label: "Infrastructure Project Management",
          description: "Capital works planning, milestone scheduling, and corridor submissions.",
        },
        AGENCY_COORDINATION: {
          label: "Agency Coordination",
          description: "Cross-utility RoadSync deconfliction and shared right-of-way clearances.",
        },
        ENGINEERING_OPERATIONS: {
          label: "Engineering / Technical Operations",
          description: "Field engineering, spatial alignment review, and technical compliance.",
        },
        PROJECT_MONITORING: {
          label: "Project Monitoring",
          description: "Physical and financial progress tracking across regional corridors.",
        },
        INSTITUTIONAL_ADMIN: {
          label: "Institutional Administration",
          description: "Departmental governance and statutory reporting oversight.",
        },
        OTHER_AUTHORIZED: {
          label: "Other Authorized Responsibility",
          description: "Accredited research, inspection, or contracted technical support.",
        },
      },
      institutionalNoticeTitle: "Institutional Verification Policy",
      institutionalNoticeBody:
        "Account creation does not automatically provide access to institutional projects or protected infrastructure information. Access is granted according to the platform's verification and approval process.",
      previousBtn: "Previous Step",
      continueBtn: "Review Account Request",
    },
    step3: {
      title: "Review and Confirm",
      subtitle:
        "Verify your personal and institutional details before submitting your request for statutory review.",
      accountSectionTitle: "01 · Personal & Security Credentials",
      organizationSectionTitle: "02 · Institutional Affiliation & Scope",
      editBtn: "Edit",
      passwordProtectedMask: "•••••••••••• (Encrypted on submission)",
      termsCheckboxLabel:
        "I confirm that the institutional information provided is accurate and I agree to the InfraOS platform governance rules,",
      privacyPolicyLink: "Privacy & Data Protection Notice",
      accessibilityLink: "Accessibility & Statutory Standards",
      submitBtn: "Submit Account Request",
      submittingBtn: "Submitting Institutional Request…",
      previousBtn: "Back to Organization Details",
    },
    confirmation: {
      badge: "REQUEST RECORDED · PENDING VERIFICATION",
      title: "Account Request Submitted for Institutional Review",
      subtitle:
        "Your registration details have been securely recorded with status PENDING. No active workspace session or privileged role is granted until your agency administrator verifies your credentials.",
      referenceLabel: "Verification Reference",
      statusLabel: "Account Status",
      statusValue: "PENDING INSTITUTIONAL APPROVAL",
      organizationLabel: "Target Institution",
      nextStepsTitle: "What happens next?",
      nextSteps: [
        "Your Work Email and Professional Designation are queued for verification by your designated Agency Administrator.",
        "Role and corridor scope permissions are assigned strictly after statutory authorization.",
        "Once verified and activated, you can sign in using your Work Email and password at the InfraOS Sign In portal.",
      ],
      previewModeNote:
        "Preview Environment Note: Live identity persistence is not enabled in this preview build; this confirmation demonstrates the non-privileged pending approval workflow.",
      returnToSignIn: "Proceed to Sign In",
      returnToPortal: "Return to Public Portal",
    },
  },
  si: {
    eyebrow: "ආයතනික ගිණුම් ලියාපදිංචිය",
    backToPortal: "මහජන ද්වාරයට ආපසු",
    backToSignIn: "පිවිසුමට ආපසු",
    alreadyHaveAccount: "දැනටමත් බලයලත් ගිණුමක් තිබේද?",
    signInLink: "පිවිසෙන්න",
    stepLabels: ["ගිණුම් විස්තර", "ආයතනය සහ වගකීම්", "සමාලෝචනය සහ තහවුරු කිරීම"],
    step1: {
      title: "InfraOS සමඟ ආරම්භ කරන්න",
      subtitle: "ආයතනික ප්‍රවේශ ක්‍රියාවලිය ආරම්භ කිරීමට ඔබගේ ගිණුම සාදන්න.",
      fullNameLabel: "සම්පූර්ණ නම",
      fullNamePlaceholder: "උදා: ඉංජිනේරු දිනේෂ් සේනානායක",
      emailLabel: "රාජකාරි විද්‍යුත් තැපැල් ලිපිනය",
      emailPlaceholder: "officer@organization.gov.lk",
      emailHelper: "ඔබගේ නිල අමාත්‍යාංශ, අධිකාරි හෝ ආයතනික විද්‍යුත් තැපෑල භාවිතා කරන්න.",
      passwordLabel: "මුරපදය",
      passwordPlaceholder: "අවම අක්ෂර 8 (උපරිම UTF-8 බයිට් 72)",
      confirmPasswordLabel: "මුරපදය තහවුරු කරන්න",
      confirmPasswordPlaceholder: "මුරපදය නැවත ඇතුළත් කරන්න",
      strengthLabels: ["මුරපදය ඇතුළත් කරන්න", "දුර්වලයි", "සාමාන්‍යයි", "හොඳයි", "ශක්තිමත්"],
      ruleMinLength: "අවම වශයෙන් අක්ෂර 8ක්",
      ruleMaxBytes: "UTF-8 බයිට් 72 සීමාව තුළ",
      ruleAlphanumeric: "අකුරු සහ ඉලක්කම් දෙකම අඩංගු වේ",
      ruleComplex: "ලොකු/කුඩා අකුරු හෝ විශේෂ සංකේතයක් අඩංගු වේ",
      continueBtn: "ආයතනික විස්තර වෙත යන්න",
    },
    step2: {
      title: "ඔබගේ ආයතනය පිළිබඳව සඳහන් කරන්න",
      subtitle: "ඔබ අනුබද්ධ ආයතනය සහ තහවුරු කිරීම සඳහා ඉල්ලුම් කරන රාජකාරි වගකීම තෝරන්න.",
      organizationLabel: "ආයතනය / දෙපාර්තමේන්තුව",
      organizationSearchPlaceholder: "ආයතනය සොයන්න (උදා: RDA, NWSDB, CEB, UDA)…",
      departmentLabel: "අංශය / කොට්ඨාසය",
      departmentPlaceholder: "උදා: අධිවේගී මාර්ග සැලසුම් අංශය",
      designationLabel: "නිල තනතුර",
      designationPlaceholder: "උදා: ප්‍රධාන සිවිල් ඉංජිනේරු",
      responsibilityLabel: "ඉල්ලුම් කරන ප්‍රවේශ වගකීම",
      responsibilityHelper:
        "ආයතනික පරිපාලකගේ පරීක්ෂාව සඳහා පමණක් සටහන් වේ. ස්වයංක්‍රීයව පද්ධති බලතල ලබා නොදේ.",
      responsibilities: {
        PROJECT_MANAGEMENT: {
          label: "යටිතල පහසුකම් ව්‍යාපෘති කළමනාකරණය",
          description: "ව්‍යාපෘති සැලසුම් කිරීම, පියවර කාලසටහන් සහ ඉදිරිපත් කිරීම්.",
        },
        AGENCY_COORDINATION: {
          label: "අන්තර්-ආයතනික සම්බන්ධීකරණය",
          description: "RoadSync ගැටුම් නිරාකරණය සහ උපයෝගිතා අනුමැතීන්.",
        },
        ENGINEERING_OPERATIONS: {
          label: "ඉංජිනේරු සහ තාක්ෂණික මෙහෙයුම්",
          description: "ක්ෂේත්‍ර ඉංජිනේරු කටයුතු සහ භූ-තාක්ෂණික පරීක්ෂාවන්.",
        },
        PROJECT_MONITORING: {
          label: "ව්‍යාපෘති ප්‍රගති අධීක්ෂණය",
          description: "භෞතික සහ මූල්‍ය ප්‍රගති වාර්තා පසුవిපරම.",
        },
        INSTITUTIONAL_ADMIN: {
          label: "ආයතනික පරිපාලනය",
          description: "දෙපාර්තමේන්තු පාලන සහ නිල වාර්තා අධීක්ෂණය.",
        },
        OTHER_AUTHORIZED: {
          label: "වෙනත් බලයලත් වගකීම්",
          description: "පරීක්ෂණ, පර්යේෂණ හෝ ගිවිසුම්ගත තාක්ෂණික සහාය.",
        },
      },
      institutionalNoticeTitle: "ආයතනික තහවුරු කිරීමේ ප්‍රතිපත්තිය",
      institutionalNoticeBody:
        "ගිණුමක් නිර්මාණය කිරීමෙන් ආයතනික ව්‍යාපෘති හෝ ආරක්ෂිත යටිතල පහසුකම් තොරතුරු සඳහා ස්වයංක්‍රීයව ප්‍රවේශය හිමි නොවේ. වේදිකාවේ තහවුරු කිරීමේ සහ අනුමත කිරීමේ ක්‍රියාවලියට අනුව ප්‍රවේශය ලබා දෙනු ලැබේ.",
      previousBtn: "පෙර පියවර",
      continueBtn: "ඉල්ලීම සමාලෝචනය කරන්න",
    },
    step3: {
      title: "සමාලෝචනය කර තහවුරු කරන්න",
      subtitle: "නිල අනුමැතිය සඳහා යොමු කිරීමට පෙර ඔබගේ පුද්ගලික සහ ආයතනික තොරතුරු පරීක්ෂා කරන්න.",
      accountSectionTitle: "01 · පුද්ගලික සහ ආරක්ෂක තොරතුරු",
      organizationSectionTitle: "02 · ආයතනික අනුබද්ධතාවය සහ වගකීම",
      editBtn: "සංස්කරණය",
      passwordProtectedMask: "•••••••••••• (යොමු කිරීමේදී සංකේතනය කෙරේ)",
      termsCheckboxLabel:
        "ඉදිරිපත් කර ඇති ආයතනික තොරතුරු නිවැරදි බවත් InfraOS පාලන රෙගුලාසිවලට එකඟ වන බවත් තහවුරු කරමි:",
      privacyPolicyLink: "පෞද්ගලිකත්ව සහ දත්ත ආරක්ෂණ නිවේදනය",
      accessibilityLink: "ප්‍රවේශ්‍යතා සහ නිල ප්‍රමිතීන්",
      submitBtn: "ගිණුම් ඉල්ලීම යොමු කරන්න",
      submittingBtn: "ආයතනික ඉල්ලීම යොමු කරමින්…",
      previousBtn: "ආයතනික විස්තර වෙත ආපසු",
    },
    confirmation: {
      badge: "ඉල්ලීම සටහන් විය · අනුමැතිය අපේක්ෂාවෙන්",
      title: "ගිණුම් ඉල්ලීම ආයතනික සමාලෝචනය සඳහා යොමු කරන ලදී",
      subtitle:
        "ඔබගේ ලියාපදිංචි ඉල්ලීම PENDING තත්ත්වය යටතේ ආරක්ෂිතව සටහන් කර ඇත. ආයතනික පරිපාලක විසින් තහවුරු කරන තෙක් කිසිදු සක්‍රීය සැසියක් හෝ බලතලයක් ලබා නොදේ.",
      referenceLabel: "තහවුරු කිරීමේ අංකය",
      statusLabel: "ගිණුම් තත්ත්වය",
      statusValue: "ආයතනික අනුමැතිය අපේක්ෂාවෙන් (PENDING)",
      organizationLabel: "අදාළ ආයතනය",
      nextStepsTitle: "මීළඟ පියවර කුමක්ද?",
      nextSteps: [
        "ඔබගේ රාජකාරි විද්‍යුත් තැපෑල සහ තනතුර ආයතනික පරිපාලකගේ තහවුරු කිරීම සඳහා යොමු කෙරේ.",
        "නිල අනුමැතියෙන් පසුව පමණක් ඔබට අදාළ භූමිකාව සහ අවසරයන් පවරනු ලැබේ.",
        "ගිණුම සක්‍රීය කළ පසු InfraOS පිවිසුම් පිටුව හරහා ඔබගේ වැඩබිමට පිවිසිය හැක.",
      ],
      previewModeNote:
        "පෙරදසුන් සටහන: මෙම පෙරදසුන් පරිසරයේ සජීවී දත්ත ගබඩාව සක්‍රීය කර නොමැත; මෙය ආරක්ෂිත අනුමත කිරීමේ ක්‍රියාවලිය පෙන්නුම් කරයි.",
      returnToSignIn: "පිවිසුම් පිටුවට යන්න",
      returnToPortal: "මහජන ද්වාරයට ආපසු යන්න",
    },
  },
  ta: {
    eyebrow: "நிறுவன கணக்கு பதிவு",
    backToPortal: "பொது முகப்புக்குத் திரும்பு",
    backToSignIn: "உள்நுழைவுக்குத் திரும்பு",
    alreadyHaveAccount: "ஏற்கனவே அங்கீகரிக்கப்பட்ட கணக்கு உள்ளதா?",
    signInLink: "உள்நுழைக",
    stepLabels: ["கணக்கு விவரங்கள்", "நிறுவனம் & அணுகல்", "சரிபார்த்து உறுதிப்படுத்துக"],
    step1: {
      title: "InfraOS உடன் தொடங்குங்கள்",
      subtitle: "நிறுவன அணுகல் செயல்முறையைத் தொடங்க உங்கள் கணக்கை உருவாக்கவும்.",
      fullNameLabel: "முழு பெயர்",
      fullNamePlaceholder: "எ.கா: பொறி. தினேஷ் சேனநாயக்க",
      emailLabel: "பணி மின்னஞ்சல் முகவரி",
      emailPlaceholder: "officer@organization.gov.lk",
      emailHelper: "உங்கள் அதிகாரப்பூர்வ அமைச்சு, சபை அல்லது நிறுவன மின்னஞ்சலைப் பயன்படுத்தவும்.",
      passwordLabel: "கடவுச்சொல்",
      passwordPlaceholder: "குறைந்தது 8 எழுத்துக்கள் (அதிகபட்சம் 72 UTF-8 பைட்டுகள்)",
      confirmPasswordLabel: "கடவுச்சொல்லை உறுதிப்படுத்துக",
      confirmPasswordPlaceholder: "கடவுச்சொல்லை மீண்டும் உள்ளிடவும்",
      strengthLabels: ["கடவுச்சொல்லை உள்ளிடவும்", "பலவீனமானது", "சுமாரானது", "நல்லது", "வலுவானது"],
      ruleMinLength: "குறைந்தது 8 எழுத்துக்கள்",
      ruleMaxBytes: "72 UTF-8 பைட் வரம்பிற்குள்",
      ruleAlphanumeric: "எழுத்துக்கள் மற்றும் எண்கள் இரண்டும் உள்ளன",
      ruleComplex: "பெரிய/சிறிய எழுத்துக்கள் அல்லது குறியீடு உள்ளது",
      continueBtn: "நிறுவன விவரங்களுக்குத் தொடரவும்",
    },
    step2: {
      title: "உங்கள் நிறுவனத்தைப் பற்றி கூறவும்",
      subtitle: "உங்கள் நிறுவனத்தைத் தேர்ந்தெடுத்து சரிபார்ப்புக்கான பணிப் பொறுப்பைக் குறிப்பிடவும்.",
      organizationLabel: "நிறுவனம் / அதிகாரசபை",
      organizationSearchPlaceholder: "நிறுவனங்களைத் தேடுங்கள் (எ.கா: RDA, NWSDB, CEB, UDA)…",
      departmentLabel: "துறை / பிரிவு",
      departmentPlaceholder: "எ.கா: அதிவேக நெடுஞ்சாலை திட்டமிடல் பிரிவு",
      designationLabel: "பதவிப் பெயர்",
      designationPlaceholder: "எ.கா: தலைமை சிவில் பொறியாளர்",
      responsibilityLabel: "கோரப்படும் அணுகல் பொறுப்பு",
      responsibilityHelper:
        "நிறுவன நிர்வாகியின் சரிபார்ப்புக்காக மட்டுமே பதிவு செய்யப்படுகிறது. தானாகவே அதிகாரங்களை வழங்காது.",
      responsibilities: {
        PROJECT_MANAGEMENT: {
          label: "உள்கட்டமைப்பு திட்ட மேலாண்மை",
          description: "மூலதனப் பணிகள் திட்டமிடல் மற்றும் மைல்கல் சமர்ப்பிப்புகள்.",
        },
        AGENCY_COORDINATION: {
          label: "நிறுவன ஒருங்கிணைப்பு",
          description: "RoadSync மோதல் தீர்வு மற்றும் குழாய் வழித்தட அனுமதிகள்.",
        },
        ENGINEERING_OPERATIONS: {
          label: "பொறியியல் / தொழில்நுட்ப செயல்பாடுகள்",
          description: "களப் பொறியியல் மற்றும் இடஞ்சார்ந்த சீரமைப்பு ஆய்வு.",
        },
        PROJECT_MONITORING: {
          label: "திட்ட கண்காணிப்பு",
          description: "இயற்பியல் மற்றும் நிதி முன்னேற்ற கண்காணிப்பு.",
        },
        INSTITUTIONAL_ADMIN: {
          label: "நிறுவன நிர்வாகம்",
          description: "துறைசார் நிர்வாகம் மற்றும் அறிக்கை மேற்பார்வை.",
        },
        OTHER_AUTHORIZED: {
          label: "பிற அங்கீகரிக்கப்பட்ட பொறுப்பு",
          description: "ஆய்வு, ஆராய்ச்சி அல்லது ஒப்பந்த தொழில்நுட்ப ஆதரவு.",
        },
      },
      institutionalNoticeTitle: "நிறுவன சரிபார்ப்புக் கொள்கை",
      institutionalNoticeBody:
        "கணக்கை உருவாக்குவது நிறுவனத் திட்டங்கள் அல்லது பாதுகாக்கப்பட்ட உள்கட்டமைப்புத் தகவல்களுக்கான அணுகலைத் தானாக வழங்காது. தளத்தின் சரிபார்ப்பு மற்றும் ஒப்புதல் செயல்முறைக்கு ஏற்ப அணுகல் வழங்கப்படுகிறது.",
      previousBtn: "முந்தைய படி",
      continueBtn: "கோரிக்கையை மதிப்பாய்வு செய்க",
    },
    step3: {
      title: "மதிப்பாய்வு செய்து உறுதிப்படுத்துக",
      subtitle:
        "சட்டப்பூர்வ ஆய்வுக்கு சமர்ப்பிக்கும் முன் உங்கள் தனிப்பட்ட மற்றும் நிறுவன விவரங்களைச் சரிபார்க்கவும்.",
      accountSectionTitle: "01 · தனிப்பட்ட & பாதுகாப்பு விவரங்கள்",
      organizationSectionTitle: "02 · நிறுவன இணைப்பு & பொறுப்பு",
      editBtn: "திருத்து",
      passwordProtectedMask: "•••••••••••• (சமர்ப்பிக்கும் போது மறைகுறியாக்கப்படும்)",
      termsCheckboxLabel:
        "வழங்கப்பட்ட நிறுவனத் தகவல்கள் துல்லியமானவை என்பதை உறுதிப்படுத்தி InfraOS நடைமுறை விதிகளுக்கு உடன்படுகிறேன்:",
      privacyPolicyLink: "தனியுரிமை & தரவு பாதுகாப்பு அறிக்கை",
      accessibilityLink: "அணுகல்தன்மை & தரநிலைகள்",
      submitBtn: "கணக்கு கோரிக்கையை சமர்ப்பிக்கவும்",
      submittingBtn: "நிறுவன கோரிக்கை சமர்ப்பிக்கப்படுகிறது…",
      previousBtn: "நிறுவன விவரங்களுக்குத் திரும்பு",
    },
    confirmation: {
      badge: "கோரிக்கை பதிவு செய்யப்பட்டது · சரிபார்ப்பில் உள்ளது",
      title: "கணக்கு கோரிக்கை நிறுவன ஆய்வுக்கு சமர்ப்பிக்கப்பட்டது",
      subtitle:
        "உங்கள் பதிவு விவரங்கள் PENDING நிலையில் பாதுகாப்பாகப் பதிவு செய்யப்பட்டுள்ளன. உங்கள் நிறுவன நிர்வாகி சரிபார்க்கும் வரை எந்தவொரு பணியிட அமர்வும் வழங்கப்படாது.",
      referenceLabel: "சரிபார்ப்பு குறிப்பு எண்",
      statusLabel: "கணக்கு நிலை",
      statusValue: "நிறுவன ஒப்புதலுக்காகக் காத்திருக்கிறது (PENDING)",
      organizationLabel: "நிறுவனம்",
      nextStepsTitle: "அடுத்த கட்டம் என்ன?",
      nextSteps: [
        "உங்கள் பணி மின்னஞ்சல் மற்றும் பதவி நிறுவன நிர்வாகியின் சரிபார்ப்புக்காக வரிசையில் வைக்கப்பட்டுள்ளது.",
        "சட்டப்பூர்வ அங்கீகாரத்திற்குப் பிறகே பங்கு மற்றும் வழித்தட அனுமதிகள் வழங்கப்படும்.",
        "கணக்கு செயல்படுத்தப்பட்டதும், InfraOS உள்நுழைவு பக்கம் வழியாக உள்நுழையலாம்.",
      ],
      previewModeNote:
        "முன்னோட்டக் குறிப்பு: இந்த முன்னோட்டச் சூழலில் நேரடி அடையாளச் சேவை இயக்கப்படவில்லை; இது பாதுகாப்பான ஒப்புதல் செயல்முறையைக் காட்டுகிறது.",
      returnToSignIn: "உள்நுழைவு பக்கத்திற்குச் செல்லவும்",
      returnToPortal: "பொது முகப்புக்குத் திரும்பு",
    },
  },
};

export function getAuthLoginCopy(locale: AuthLocale): AuthLoginCopy {
  return LOGIN_COPY[locale] ?? LOGIN_COPY.en;
}

export function getAuthRegisterCopy(locale: AuthLocale): AuthRegisterCopy {
  return REGISTER_COPY[locale] ?? REGISTER_COPY.en;
}

export type AuthForgotCopy = {
  title: string;
  subtitle: string;
  demoNotice: string;
  emailLabel: string;
  submit: string;
  submitting: string;
  accepted: string;
  unavailable: string;
  retry: string;
  privacy: string;
  backToLogin: string;
  nativeReview: string;
};

export type AuthResetCopy = {
  title: string;
  subtitle: string;
  passwordLabel: string;
  submit: string;
  submitting: string;
  reset: string;
  rejected: string;
  unavailable: string;
  missing: string;
  tooShort: string;
  tooLong: string;
  privacy: string;
  backToLogin: string;
  nativeReview: string;
};

const FORGOT_EN: AuthForgotCopy = {
  title: "Reset your password",
  subtitle: "University GovTech demonstration workspace. Not an official government portal.",
  demoNotice:
    "If a matching staff account can sign in, recovery instructions are prepared. This demo does not send live email until a mail provider is approved.",
  emailLabel: "Work email",
  submit: "Request reset",
  submitting: "Requesting…",
  accepted:
    "If an account can be recovered, instructions will be sent. This page cannot confirm whether an address is registered.",
  unavailable: "Recovery is temporarily unavailable. Try again shortly.",
  retry: "Try again",
  privacy:
    "We do not tell you whether this address exists, is verified, or is active. Do not share recovery links.",
  backToLogin: "Back to sign in",
  nativeReview: "Sinhala and Tamil copy is draft until native review.",
};

const FORGOT_SI: AuthForgotCopy = {
  ...FORGOT_EN,
  title: "මුරපදය යළි සකසන්න",
  subtitle: "විශ්වවිද්‍යා GovTech ආදර්ශනයකි. නිල රජයේ දොරටුවක් නොවේ.",
  emailLabel: "වැඩ ඊමේල්",
  submit: "යළි සැකසීම ඉල්ලන්න",
  submitting: "ඉල්ලමින්…",
  backToLogin: "පිවිසීමට ආපසු",
  nativeReview: "සිංහල/දෙමළ පිටපත් native review සඳහා draft.",
};

const FORGOT_TA: AuthForgotCopy = {
  ...FORGOT_EN,
  title: "கடவுச்சொல்லை மீட்டமை",
  subtitle: "University GovTech demo. Official government portal அல்ல.",
  submit: "மீட்டமைப்பு கோரிக்கை",
  submitting: "அனுப்புகிறது…",
  backToLogin: "உள்நுழைவுக்குத் திரும்பு",
  nativeReview: "Sinhala/Tamil copy native review pending.",
};

const RESET_EN: AuthResetCopy = {
  title: "Choose a new password",
  subtitle: "University GovTech demonstration workspace. Not an official government portal.",
  passwordLabel: "New password",
  submit: "Update password",
  submitting: "Updating…",
  reset: "Your password was updated. Sign in with the new password. This does not sign you in.",
  rejected: "This reset link could not be used. Request a new one.",
  unavailable: "Password reset is temporarily unavailable. You can try again.",
  missing: "This page needs a reset link. Request a new one from sign in.",
  tooShort: "Use at least 8 characters.",
  tooLong: "Use at most 72 bytes.",
  privacy: "The reset link is removed from the address bar. It is not stored in this browser.",
  backToLogin: "Back to sign in",
  nativeReview: "Sinhala and Tamil copy is draft until native review.",
};

const RESET_SI: AuthResetCopy = {
  ...RESET_EN,
  title: "නව මුරපදයක් තෝරන්න",
  passwordLabel: "නව මුරපදය",
  submit: "මුරපදය යාවත්කාලීන කරන්න",
  backToLogin: "පිවිසීමට ආපසු",
  nativeReview: "සිංහල/දෙමළ පිටපත් native review සඳහා draft.",
};

const RESET_TA: AuthResetCopy = {
  ...RESET_EN,
  title: "புதிய கடவுச்சொல்",
  passwordLabel: "புதிய கடவுச்சொல்",
  submit: "கடவுச்சொல்லை புதுப்பி",
  backToLogin: "உள்நுழைவுக்குத் திரும்பு",
  nativeReview: "Sinhala/Tamil copy native review pending.",
};

export function getAuthForgotCopy(locale: AuthLocale): AuthForgotCopy {
  if (locale === "si") return FORGOT_SI;
  if (locale === "ta") return FORGOT_TA;
  return FORGOT_EN;
}

export function getAuthResetCopy(locale: AuthLocale): AuthResetCopy {
  if (locale === "si") return RESET_SI;
  if (locale === "ta") return RESET_TA;
  return RESET_EN;
}

export type AuthAccessCopy = {
  checking: string;
  workspaceTitle: string;
  workspaceBody: string;
  previewTitle: string;
  previewBody: string;
  retryTitle: string;
  retryBody: string;
  retry: string;
  signOut: string;
  publicSite: string;
  nativeReview: string;
};

const ACCESS_EN: AuthAccessCopy = {
  checking: "Checking your session.",
  workspaceTitle: "Workspace shell",
  workspaceBody:
    "Operational modules are not available yet. This page only confirms an authenticated session.",
  previewTitle: "Sign-in is not live in this build",
  previewBody:
    "This workspace stays hidden until a non-production live session is available. No private records are shown.",
  retryTitle: "The workspace could not be checked",
  retryBody:
    "The authentication service did not respond. Your session was not signed out. Try again.",
  retry: "Try again",
  signOut: "Sign out",
  publicSite: "Public site",
  nativeReview:
    "Staff workspace copy is English. Sinhala and Tamil staff pages are not available yet.",
};

export function getAuthAccessCopy(): AuthAccessCopy {
  return ACCESS_EN;
}
