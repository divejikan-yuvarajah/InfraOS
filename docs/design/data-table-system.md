# Data table system (Step 21)

`DataTable` in `apps/web/src/components/data-table/data-table.tsx` uses TanStack Table v8 and the Step 19 `Table` primitives.

## Modes

- **Client:** sorting, global search, and pagination run on the full array passed in. Suitable for small bounded lists.
- **Server:** `manualSorting`, `manualFiltering`, and `manualPagination` are on. The table does not re-sort the current page as if it were the full dataset. The parent owns `TableQueryState` and passes one page plus `totalCount` or `hasNextPage`.

Page index is **0-based** in the UI. Step 16 `PaginationQuery.page` is **1-based** (`toApiPage`).

## Money and dates

Sort and transport money as integer `amountMinor`. Display with `formatLkrMinor`. Do not sort formatted currency strings.

## Security

Row selection and hidden columns are not authorization. Server sort and filter fields must be allowlisted later. URL helpers only emit `page`, `pageSize`, `sort`, `dir`, and `search`.

No new API routes.
