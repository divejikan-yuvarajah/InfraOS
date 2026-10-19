# Pagination and filters

Page is **1-indexed**. Default `limit` is 20. Maximum `limit` is 100 (`PAGINATION_DEFAULTS`).

Empty lists use `data: []` with `total: 0`.

Sort fields are allowlisted per route later. Clients must not send MongoDB operators or arbitrary paths.

Stable tie-break, when a list is implemented: `createdAt` then `id`.

Cursor pagination is deferred.

`Update*Request` types omit system fields (`createdBy`, `approvedBy`, `status`, `riskScore`, `financialProgress`). Workflow changes use command types such as `ProjectApprovalCommand` and `ApprovePaymentCommand`.
