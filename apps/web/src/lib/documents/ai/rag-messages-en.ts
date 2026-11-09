/** English source dictionary for document Q&A, summaries and extraction (Phase 10 Batch 10). si and ta keep the identical key tree (checked by a test). Stored data, quotes and model answers are never translated. */
export const en = {
  nav: { workspace: "AI Documents", ask: "Ask AI", summary: "Summary", extract: "Extract", askAboutDoc: "Ask AI about this document", askAboutProject: "Ask about this project's documents" },
  workspace: {
    title: "AI Document Workspace", subtitle: "Ask questions, summarise and extract facts from documents you can read. Every answer shows its sources.", modeAsk: "Ask", modeSummarize: "Summarize", modeExtract: "Extract",
    needOne: "Choose exactly one AI-ready document for this mode.", newConversation: "New conversation", history: "History", sources: "Sources", chat: "Chat", unavailable: "AI is temporarily unavailable. You can still browse documents and see what would be searched.",
    notConfigured: "AI is not configured on this server.", forbidden: "Your role cannot use AI documents.", conversation: "Conversation", emptyTitle: "Ask a question about your documents", emptyBody: "Answers come only from the documents in your scope and always cite them.",
  },
  scope: {
    title: "Scope", thisDocument: "This document", selected: "Selected documents", project: "A project", all: "All my documents", searching: "Searching {n} of {total} documents", notSearchable: "{m} not searchable yet",
    truncated: "Only the newest 500 documents are searched.", pickDocs: "Choose documents (up to 20)", search: "Search by title or number", noDocs: "No documents match.", pickProject: "Choose a project", notReadyList: "Not searchable yet", openAiTab: "Open AI processing",
    disabled: "Not searchable", none: "Nothing is in scope.", selectedCount: "{n} selected", clear: "Clear",
    reason: { QUEUED: "Queued", PROCESSING: "Processing", FAILED: "Failed", SCANNED: "Scanned — no text", UNSUPPORTED: "Unsupported", NOT_PROCESSED: "Not processed", EXCLUDED: "Excluded from AI", SENSITIVE: "Sensitive" },
  },
  composer: {
    placeholder: "Ask about the selected documents…", send: "Send", stop: "Stop", language: "Answer language", auto: "Auto", hint: "Enter to send, Shift+Enter for a new line", counter: "{n} / 600", searching: "Searching documents and drafting an answer…", elapsed: "{s} s",
    disabledNoScope: "Choose what to search first.", disabledUnavailable: "AI is unavailable right now.", disabledBudget: "The daily AI budget is used up. It resets tomorrow.", disabledRate: "Too many questions. Try again in {s} s.", label: "Your question",
  },
  suggested: {
    title: "Suggested questions", contractValue: "What is the contract value?", completionDate: "What is the completion date?", liquidatedDamages: "What are the liquidated damages for delay?", paymentTerms: "What are the payment terms?",
    retention: "How much is retained from each payment?", findings: "What were the main findings?", severeDeficiencies: "Which deficiencies are rated high?", recommendedActions: "What actions are recommended?", progressSummary: "What progress was reported?",
    delays: "What delays or risks are reported?", nextSteps: "What are the next steps?", approvedBy: "Who approved this?", conditions: "What conditions apply?", approvalDate: "When was this approved?", totalBudget: "What is the total budget?",
    keyFigures: "Which key figures are stated?", summary: "What is this document about?", keyDates: "Which dates are mentioned?", obligations: "What are the main obligations?",
  },
  answer: {
    status: { ANSWERED: "Answered", PARTIAL: "Partly verified", INSUFFICIENT_EVIDENCE: "Insufficient evidence", PASSAGES_ONLY: "Relevant passages only", FAILED: "Failed", BLOCKED_BY_POLICY: "Blocked by policy" },
    aiLabel: "AI-generated", disclaimer: "AI can make mistakes — verify against the cited sources.", sources: "Sources", you: "You", ai: "AI",
    evidence: { title: "Evidence", VERIFIED: "All quotes verified", PARTIAL: "Some notes", NONE: "No supporting evidence", quotes: "Quotes verified: {v} of {t}", figures: "Not found in the cited text: {list}", removed: "Unsupported statements removed: {n}", coverage: "Searched {s} of {t} documents", flagged: "{n} passages were excluded as unsafe", redactions: "{n} personal identifiers were masked before sending", redactedNote: "Quotes show masked text where personal identifiers were removed.", missing: "Not found in the sources" },
    about: { title: "About this answer", model: "Model", prompt: "Prompt version", latency: "Time", tokens: "Tokens" },
    copy: "Copy", copied: "Copied", regenerate: "Regenerate", regenerateTitle: "Regenerate this answer?", regenerateBody: "This asks the model again and uses the daily AI budget.", retry: "Try again", helpful: "Helpful", notHelpful: "Not helpful", followUp: "Ask a follow-up",
    feedbackReason: "What was wrong?", reasons: { WRONG: "Wrong answer", MISSING_SOURCE: "Missing source", OUTDATED: "Outdated", UNCLEAR: "Unclear", OTHER: "Other" }, feedbackThanks: "Thanks for the feedback.",
    sourceUpdated: "A cited document changed since this answer. Ask again to refresh.", quoteUnverified: "Excerpt not verified", page: "Page {n}", pages: "Pages {a}–{b}", noPage: "No page numbers", section: "Section", version: "v{n}", viewInContext: "View in context",
    sourceStatus: { CURRENT: "Current", UPDATED: "Updated since", ARCHIVED: "Archived", NO_LONGER_ACCESSIBLE: "No longer accessible" }, neighbor: "Neighbouring passage",
    passagesLabel: "AI answer unavailable — relevant passages only", passagesHelp: "These are passages from your documents. They are not an answer.", insufficientTitle: "Not enough evidence in these documents", insufficientBody: "The searched documents do not contain a clear answer. Nothing was generated.",
    searchedDocs: "Searched {s} of {t} documents.", related: "Related but not conclusive", relatedHelp: "These passages are close to your question but do not answer it.", broaden: "Try a wider scope or check that the documents are processed.",
    cite: "Source {n}", openSource: "Open source {n}", citeNone: "No citations", expand: "Show", collapse: "Hide",
    errors: { AI_UNAVAILABLE: "AI is unavailable. Try again later.", AI_TIMEOUT: "The AI took too long.", AI_BUDGET_EXCEEDED: "The daily AI budget is used up.", AI_RATE_LIMITED: "Too many requests. Wait a moment.", AI_INVALID_OUTPUT: "The AI returned an unusable result.", SCOPE_EMPTY: "Nothing to search in this scope.", FORBIDDEN_SCOPE: "You cannot search that scope.", generic: "Something went wrong." },
  },
  viewer: { title: "Source", empty: "Select a citation to see its source.", previous: "Previous source", next: "Next source", openAtPage: "Open page {n} in preview", noPageNote: "This format has no page numbers. The section is shown instead.", unavailable: "This source is not available to you.", loading: "Loading source…", cited: "Cited passage", close: "Close", openDocument: "Open document", redacted: "Personal identifiers may be masked in answers." },
  history: { title: "History", empty: "No conversations yet.", delete: "Delete", deleteAll: "Delete all", deleteConfirm: "Delete this conversation?", deleteAllConfirm: "Delete all your conversations?", retention: "Conversations are kept for 90 days and visible only to you.", open: "Open", count: "{n} messages", deleted: "Deleted", more: "Load more" },
  summary: {
    title: "Summary", subtitle: "Generate a cited summary of this document.", chooseTemplate: "Choose a summary type", suggested: "Suggested", language: "Language", generate: "Generate", regenerate: "Regenerate", regenerateBody: "This creates a new summary and uses the daily AI budget.",
    notReady: "This document is not AI-ready yet, so it cannot be summarised.", progress: { QUEUED: "Waiting to start", MAP: "Summarising part {done} of {total}", REDUCE: "Combining the parts", READY: "Ready" }, failed: "The summary could not be created", retry: "Try again",
    coverage: "Covers pages {a}–{b}", coverageChunks: "Used {used} of {total} sections", truncated: "Truncated: only part of the document is covered.", stale: "A newer version of this document exists. Regenerate to refresh.", copy: "Copy", download: "Download .txt", copied: "Copied",
    noItems: "Nothing found for this section.", dateCol: "Date", noDate: "No date stated", existing: "Earlier summaries", open: "Open", warnings: { TRUNCATED: "Only part of the document is covered.", REDACTED: "Personal identifiers were masked.", FLAGGED_CONTENT_EXCLUDED: "Some passages were excluded as unsafe.", UNVERIFIED_FIGURES: "Some figures could not be matched to the text.", UNSUPPORTED_REMOVED: "Unsupported statements were removed." },
    template: {
      EXECUTIVE: "Executive summary", KEY_POINTS: "Key points", CONTRACT: "Contract summary", INSPECTION: "Inspection summary", PROJECT_REPORT: "Project report summary", KEY_DATES: "Key dates",
      EXECUTIVE_HELP: "A short overview with the main highlights.", KEY_POINTS_HELP: "Up to ten bullet points.", CONTRACT_HELP: "Parties, value, dates, obligations, payment, penalties and risks.", INSPECTION_HELP: "Findings by severity, deficiencies and actions.", PROJECT_REPORT_HELP: "Progress, milestones, issues and next steps.", KEY_DATES_HELP: "Every dated item with its source.",
    },
    section: {
      overview: "Overview", highlights: "Highlights", points: "Key points", parties: "Parties", scope: "Subject and scope", value: "Contract value", dates: "Key dates", period: "Contract period", obligations: "Obligations", payment: "Payment terms", retention: "Retention and security",
      penalties: "Penalties and damages", termination: "Termination", risks: "Notable risks", findings: "Findings", deficiencies: "Deficiencies", actions: "Recommended actions", followups: "Follow-ups", progress: "Progress", milestones: "Milestones", issues: "Issues and risks", nextSteps: "Next steps",
    },
  },
  extract: {
    title: "Extract", subtitle: "Pull structured facts from this document for review.", banner: "AI-extracted values are suggestions. Project, finance, contractor and inspection records are not changed here.", chooseTemplate: "Choose what to extract",
    run: "Run extraction", runAgain: "Run again", runAgainBody: "This creates new results and uses the daily AI budget. Your earlier review is kept with the earlier results.", notReady: "This document is not AI-ready yet.", progress: "Extracting…", failed: "The extraction could not be completed", retry: "Try again",
    column: { field: "Field", value: "Extracted value", evidence: "Evidence", record: "Current record", actions: "Review" }, strength: { STRONG: "Strong", WEAK: "Weak", NONE: "None" }, status: { FOUND: "Found", NOT_FOUND: "Not found", AMBIGUOUS: "Ambiguous" },
    diff: { MATCH: "Matches", DIFFERS: "Differs", NO_RECORD: "No record", NOT_COMPARABLE: "Not comparable" }, group: { found: "Found", ambiguous: "Needs a decision", missing: "Not found" },
    reason: { MODEL_NOT_FOUND: "Not stated in the document", VALUE_NOT_IN_SOURCE: "The value was not in the cited text, so it was discarded", QUOTE_NOT_VERIFIED: "The quote could not be verified", CONFLICTING_VALUES: "The document gives conflicting values", AMBIGUOUS_DATE: "Could be read in more than one way", NOT_NORMALISED: "Kept as written; it could not be read as a typed value" },
    readings: "Could be {a} or {b}", accept: "Accept", edit: "Edit", reject: "Reject", reset: "Reset", copy: "Copy value", copied: "Copied", openRecord: "Open {type}", record: { PROJECT: "project", CONTRACTOR: "contractor" }, decided: { PENDING: "To review", ACCEPTED: "Accepted", EDITED: "Edited", REJECTED: "Rejected" },
    acceptStrong: "Accept all strong matches", acceptStrongBody: "Accepts every found value with strong evidence that does not contradict the current record.", acceptNone: "No strong matches to accept.", reviewProgress: "{d} of {t} reviewed", reviewed: "Review complete", readOnly: "You can view these results. Reviewing needs permission to edit this document.",
    editTitle: "Edit value", editHelp: "Enter the value as it should be recorded.", invalid: "This value is not valid for this field.", save: "Save", saved: "Review saved", stale: "These results changed. Reload and try again.",
    apply: { button: "Apply to document metadata", title: "Apply to document metadata", body: "Only DocTrace's own fields are changed. Project, finance, contractor and inspection records are not touched.", before: "Before", after: "After", empty: "Accept or edit a value that maps to a document field first.", confirm: "Apply", done: "Document metadata updated", field: { reference: "Reference", documentDate: "Document date", expiresAt: "Expiry date", title: "Title" }, none: "—" },
    template: {
      PROJECT_BASICS: "Project basics", CONTRACT_KEY_TERMS: "Contract key terms", FINANCIAL_FIGURES: "Financial figures", MILESTONES: "Milestones", OBLIGATIONS: "Obligations", APPROVAL_DETAILS: "Approval details", INSPECTION_FINDINGS: "Inspection findings", RISKS_ISSUES: "Risks and issues",
    },
    field: {
      project_name: "Project name", locations: "Locations", implementing_agency: "Implementing agency", contractor_name: "Contractor", contract_number: "Contract number", contract_value: "Contract value", contract_date: "Contract date", commencement_date: "Commencement date",
      completion_date: "Completion date", defects_liability_period: "Defects liability period", retention_percent: "Retention", performance_security: "Performance security", liquidated_damages: "Liquidated damages", payment_terms: "Payment terms", amounts: "Amounts",
      milestones: "Milestones", obligations: "Obligations", approving_authority: "Approving authority", reference_number: "Reference number", approval_date: "Approval date", conditions: "Conditions", findings: "Findings", risks: "Risks and issues",
    },
  },
  quality: { title: "AI quality", period: "Last {n} days", questions: "Questions", answered: "Answered", partial: "Partly verified", insufficient: "Insufficient evidence", passages: "Passages only", failed: "Failed", helpful: "Helpful ratio", citations: "Citation verification", latency: "Average time", tokens: "Tokens by purpose", none: "No data yet", purpose: { QA: "Questions", SUMMARY_MAP: "Summary (parts)", SUMMARY_REDUCE: "Summary (combine)", EXTRACTION: "Extraction", OTHER: "Other" }, note: "Counts only. No questions or answers are shown here." },
  common: { loading: "Loading", retry: "Retry", close: "Close", cancel: "Cancel", working: "Working…", confirm: "Confirm", none: "—", error: "Something went wrong. Try again.", forbidden: "You do not have access to this.", offline: "You appear to be offline.", open: "Open", search: "Search", more: "More", back: "Back", version: "Version" },
};
export type RagCopy = typeof en;
