# Feedback and async states (Step 22)

Reusable presentation components in `apps/web/src/components/feedback/` for loading, empty, error and success UI across future feature modules.

## Taxonomy

| Visual | When | Component |
|--------|------|-----------|
| Initial load | No data yet | `ContentSkeleton` or `LoadingState` |
| Refreshing | Data exists, refetch in flight | `AsyncContent` with `isRefreshing` (keeps children) |
| Empty dataset | Successful fetch, zero rows | `EmptyState` (`variant="empty"`) |
| No results | Filters/search applied, zero matches | `EmptyState` (`variant="no-results"`) |
| Forbidden / not found | Authoritative API codes | `EmptyState` or `ErrorStateFromPresentation` |
| Recoverable error | Network, 5xx, 429, conflict | `ErrorState` with caller `onRetry` |
| Success | Caller-confirmed operation | `SuccessState` or Step 19 Toast |
| Field validation | `VALIDATION_ERROR` | **Step 20** form fields — `AsyncContent` renders nothing for `validation-delegate` |

## API error mapping

Pure helpers in `apps/web/src/lib/api/error-presentation.ts` map Step 16 `ApiFailure` and transport `ApiError` to safe titles/descriptions. Raw server messages, stacks, tokens and internal IDs are never shown.

## Next.js boundaries

- Route `loading.tsx` uses `LoadingState` (server-safe).
- Optional `AsyncContent` is a client helper; pages pass explicit flags/callbacks — no hidden fetches.
- Dedicated 403/404/500 route pages remain Step 161.

## Security

UI states are not authorization. Retry handlers must re-run caller-supplied query/refetch only — no automatic mutation retries.
