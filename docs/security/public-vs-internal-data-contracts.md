# Public versus internal contracts

`PublicProjectDto` exposes id, code, title, type, status, and locality.

It does not expose budget, payments, staff emails, document text, storage keys, or risk model prompts.

`CitizenIssueReceiptDto` exposes the reporter's own receipt. It does not expose other citizens, photos, or internal assignment notes.

`SafeUserDto` and `CurrentUserDto` omit `passwordHash` and refresh `tokenHash`.

`AuditLogSummaryDto` is an authorized summary. Raw before/after snapshots stay in the audit model.

`ProjectDocumentDto` has no `storageKey` or signed URL.

Permission arrays on `CurrentUserDto` are display and client-hint data. The server still checks role, agency, assignment, and state.
