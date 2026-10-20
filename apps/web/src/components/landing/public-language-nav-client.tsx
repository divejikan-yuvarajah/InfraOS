"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import {
  PUBLIC_LOCALE_LABELS,
  PUBLIC_LOCALE_NAV_ORDER,
  publicHomePath,
  publicInfoPath,
  type PublicInfoSlug,
  type PublicLocale,
} from "@/lib/landing/locales";

function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getHashSnapshot() {
  return window.location.hash;
}

function getServerHashSnapshot() {
  return "";
}

/** Language links preserve URL hash when switching locale on the same page type. */
export function PublicLanguageNavClient({
  locale,
  label,
  className,
  infoSlug = null,
}: {
  locale: PublicLocale;
  label: string;
  className?: string;
  infoSlug?: PublicInfoSlug | null;
}) {
  const hash = useSyncExternalStore(subscribeToHash, getHashSnapshot, getServerHashSnapshot);

  const hrefFor = (item: PublicLocale) => {
    const base = infoSlug ? publicInfoPath(item, infoSlug) : publicHomePath(item);
    if (!infoSlug && hash) return `${base}${hash}`;
    return base;
  };

  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {PUBLIC_LOCALE_NAV_ORDER.map((item) => {
          const current = item === locale;
          return (
            <li key={item} className="relative">
              {current ? (
                <span
                  className="type-label text-text-primary underline decoration-infra-orange decoration-2 underline-offset-4"
                  aria-current="true"
                  lang={item}
                >
                  {PUBLIC_LOCALE_LABELS[item]}
                </span>
              ) : (
                <Link
                  href={hrefFor(item)}
                  hrefLang={item}
                  lang={item}
                  className="public-motion-interactive type-body-small text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {PUBLIC_LOCALE_LABELS[item]}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
