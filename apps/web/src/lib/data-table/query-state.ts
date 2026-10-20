import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";

/** UI page index is 0-based. Step 16 PaginationQuery.page is 1-based. */
export type TableQueryState = {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  filters: ColumnFiltersState;
  search: string;
};

export const DEFAULT_PAGE_SIZES = [10, 20, 50] as const;

/** Dev fixture only — small page size for pagination demos. */
export const PREVIEW_PAGE_SIZES = [2, 10, 20] as const;

const URL_KEYS = new Set(["page", "pageSize", "sort", "dir", "search"]);

export function clampPageSize(
  value: number,
  options: readonly number[] = DEFAULT_PAGE_SIZES,
): number {
  if (!Number.isFinite(value) || value <= 0) return options[0] ?? 10;
  const allowed = options.find((size) => size === value);
  return allowed ?? options[0] ?? 10;
}

export function toApiPage(pageIndex: number): number {
  return Math.max(0, pageIndex) + 1;
}

export function fromApiPage(page: number): number {
  if (!Number.isFinite(page) || page < 1) return 0;
  return Math.floor(page) - 1;
}

export function compareTableValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, { sensitivity: "base", numeric: true });
}

export function formatLkrMinor(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const major = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, "0");
  return `${sign}LKR ${major.toLocaleString("en-LK")}.${cents}`;
}

export function pageCount(totalCount: number | undefined, pageSize: number): number | undefined {
  if (totalCount == null) return undefined;
  if (totalCount <= 0) return 0;
  return Math.ceil(totalCount / pageSize);
}

export function isStaleRequest(requestId: number, latestRequestId: number): boolean {
  return requestId !== latestRequestId;
}

export function parseTableSearchParams(params: URLSearchParams): Partial<TableQueryState> {
  const next: Partial<TableQueryState> = {};
  const page = params.get("page");
  const pageSize = params.get("pageSize");
  const sort = params.get("sort");
  const dir = params.get("dir");
  const search = params.get("search");
  if (page) next.pageIndex = fromApiPage(Number(page));
  if (pageSize) next.pageSize = clampPageSize(Number(pageSize));
  if (sort && /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(sort)) {
    next.sorting = [{ id: sort, desc: dir === "desc" }];
  }
  if (search != null) next.search = search.slice(0, 80);
  return next;
}

export function serializeTableSearchParams(query: TableQueryState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(toApiPage(query.pageIndex)));
  params.set("pageSize", String(clampPageSize(query.pageSize)));
  const sort = query.sorting[0];
  if (sort && /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(sort.id)) {
    params.set("sort", sort.id);
    params.set("dir", sort.desc ? "desc" : "asc");
  }
  if (query.search.trim()) params.set("search", query.search.trim().slice(0, 80));
  for (const key of [...params.keys()]) {
    if (!URL_KEYS.has(key)) params.delete(key);
  }
  return params;
}

export type MockTableQueryOptions<T> = {
  pageSizeOptions?: readonly number[];
  /** When set, applies trimmed case-insensitive search before sort/page. */
  search?: (row: T, term: string) => boolean;
  /** Resolves sortable cell values for allowlisted column ids. */
  sortValue?: (row: T, columnId: string) => unknown;
  allowSortIds?: ReadonlySet<string>;
};

/** Synthetic server adapter: filter → sort → paginate (never re-sort a page slice only). */
export function queryMockTablePage<T>(
  rows: readonly T[],
  query: TableQueryState,
  options: MockTableQueryOptions<T> = {},
): { rows: T[]; totalCount: number; pageIndex: number } {
  const pageSizeOptions = options.pageSizeOptions ?? DEFAULT_PAGE_SIZES;
  const pageSize = clampPageSize(query.pageSize, pageSizeOptions);
  let filtered = [...rows];
  const term = query.search.trim();
  if (term && options.search) {
    filtered = filtered.filter((row) => options.search!(row, term));
  }
  const sort = query.sorting[0];
  if (
    sort &&
    options.sortValue &&
    (!options.allowSortIds || options.allowSortIds.has(sort.id))
  ) {
    filtered.sort((left, right) => {
      const cmp = compareTableValues(
        options.sortValue!(left, sort.id),
        options.sortValue!(right, sort.id),
      );
      return sort.desc ? -cmp : cmp;
    });
  }
  const totalCount = filtered.length;
  const pages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  const pageIndex = pages === 0 ? 0 : Math.min(Math.max(0, query.pageIndex), pages - 1);
  const start = pageIndex * pageSize;
  return {
    rows: filtered.slice(start, start + pageSize),
    totalCount,
    pageIndex,
  };
}

/** Pagination-only helper (full dataset already filtered/sorted). */
export function sliceMockPage<T>(
  rows: readonly T[],
  query: Pick<TableQueryState, "pageIndex" | "pageSize">,
  pageSizeOptions: readonly number[] = DEFAULT_PAGE_SIZES,
): { rows: T[]; totalCount: number } {
  const pageSize = clampPageSize(query.pageSize, pageSizeOptions);
  const start = Math.max(0, query.pageIndex) * pageSize;
  return { rows: rows.slice(start, start + pageSize), totalCount: rows.length };
}
