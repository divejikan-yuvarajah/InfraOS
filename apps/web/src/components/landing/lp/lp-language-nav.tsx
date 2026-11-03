"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PUBLIC_LOCALE_LABELS, PUBLIC_LOCALE_NAV_ORDER, publicHomePath, type PublicLocale } from "@/lib/landing/locales";
import { cn } from "@/lib/utils";

const LOCALE_STORAGE_KEY = "infraos.public.locale";

function persistLocale(locale: PublicLocale) {
  try {
    document.documentElement.lang = locale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage or document access can be blocked in private contexts; URL remains authoritative.
  }
}

/** Route-based language selector: /, /si and /ta. The URL is the persisted choice and drives `lang`. */
export function LpLanguageNav({
  locale,
  label,
  className,
  onNavigate,
}: {
  locale: PublicLocale;
  label: string;
  className?: string;
  onNavigate?: () => void;
}) {
  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  return (
    <nav aria-label={label} className={cn("lp-lang", className)}>
      {PUBLIC_LOCALE_NAV_ORDER.map((item, index) => (
        <span key={item} style={{ display: "contents" }}>
          {index > 0 ? (
            <span className="lp-lang__sep" aria-hidden="true">
              /
            </span>
          ) : null}
          {item === locale ? (
            <span className="lp-lang__item" aria-current="true" lang={item}>
              {PUBLIC_LOCALE_LABELS[item]}
            </span>
          ) : (
            <Link
              href={publicHomePath(item)}
              hrefLang={item}
              lang={item}
              className="lp-lang__item"
              onClick={() => {
                persistLocale(item);
                onNavigate?.();
              }}
            >
              {PUBLIC_LOCALE_LABELS[item]}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

