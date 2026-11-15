"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ListQueryValue = string | number | undefined;
export type ListQueryRecord = Record<string, ListQueryValue>;

export function useListQueryState<T extends ListQueryRecord>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo(() => {
    const out: Record<string, ListQueryValue> = { ...defaults };
    searchParams.forEach((value, key) => {
      if (typeof defaults[key] === "number") {
        const parsed = Number(value);
        out[key] = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaults[key];
      } else {
        out[key] = value;
      }
    });
    return out as T & { page: number; limit: number; q?: string; status?: string; type?: string };
  }, [searchParams, defaults]);

  const setQuery = useCallback(
    (patch: Partial<T> & { q?: string; status?: string; type?: string; page?: number; limit?: number }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === defaults[key]) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname, defaults],
  );

  const resetQuery = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return { query, setQuery, resetQuery };
}
