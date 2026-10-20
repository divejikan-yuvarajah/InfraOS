import { describe, expect, it } from "vitest";

import {
  clampPageSize,
  compareTableValues,
  formatLkrMinor,
  fromApiPage,
  isStaleRequest,
  pageCount,
  parseTableSearchParams,
  PREVIEW_PAGE_SIZES,
  queryMockTablePage,
  serializeTableSearchParams,
  sliceMockPage,
  toApiPage,
} from "./query-state";

describe("table query state", () => {
  it("maps 0-based pages to the 1-based API page", () => {
    expect(toApiPage(0)).toBe(1);
    expect(fromApiPage(1)).toBe(0);
  });

  it("rejects unbounded page sizes", () => {
    expect(clampPageSize(0)).toBe(10);
    expect(clampPageSize(9999)).toBe(10);
    expect(clampPageSize(20)).toBe(20);
    expect(clampPageSize(2, PREVIEW_PAGE_SIZES)).toBe(2);
  });

  it("sorts money as numbers and places nulls last", () => {
    expect(compareTableValues(100, 2500)).toBeLessThan(0);
    expect(compareTableValues(null, 1)).toBeGreaterThan(0);
  });

  it("formats integer minor units without floating conversion", () => {
    expect(formatLkrMinor(1245000000)).toBe("LKR 12,450,000.00");
  });

  it("does not invent a page count when the total is unknown", () => {
    expect(pageCount(undefined, 10)).toBeUndefined();
    expect(pageCount(0, 10)).toBe(0);
    expect(pageCount(21, 10)).toBe(3);
  });

  it("drops stale responses", () => {
    expect(isStaleRequest(1, 2)).toBe(true);
    expect(isStaleRequest(2, 2)).toBe(false);
  });

  it("serializes only allowlisted query keys", () => {
    const params = serializeTableSearchParams({
      pageIndex: 1,
      pageSize: 20,
      sorting: [{ id: "amountMinor", desc: true }],
      filters: [],
      search: "alpha",
    });
    expect(params.get("page")).toBe("2");
    expect(params.get("sort")).toBe("amountMinor");
    expect([...params.keys()].every((key) => ["page", "pageSize", "sort", "dir", "search"].includes(key))).toBe(true);
    expect(parseTableSearchParams(params).pageSize).toBe(20);
  });

  it("returns one server page without implying the full dataset", () => {
    const page = sliceMockPage([1, 2, 3, 4, 5], { pageIndex: 1, pageSize: 2 }, PREVIEW_PAGE_SIZES);
    expect(page.rows).toEqual([3, 4]);
    expect(page.totalCount).toBe(5);
  });

  it("applies search and sort before paginating in the mock server adapter", () => {
    const rows = [
      { id: "a", name: "Alpha corridor", amountMinor: 100 },
      { id: "b", name: "Beta corridor", amountMinor: 300 },
      { id: "c", name: "Gamma corridor", amountMinor: 200 },
    ];
    const page = queryMockTablePage(
      rows,
      {
        pageIndex: 0,
        pageSize: 2,
        sorting: [{ id: "amountMinor", desc: true }],
        filters: [],
        search: "corridor",
      },
      {
        pageSizeOptions: PREVIEW_PAGE_SIZES,
        search: (row, term) => row.name.toLowerCase().includes(term.toLowerCase()),
        sortValue: (row, columnId) => (columnId === "amountMinor" ? row.amountMinor : row.name),
        allowSortIds: new Set(["name", "amountMinor"]),
      },
    );
    expect(page.totalCount).toBe(3);
    expect(page.rows.map((row) => row.id)).toEqual(["b", "c"]);
  });
});
