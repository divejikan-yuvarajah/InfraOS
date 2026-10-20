import Link from "next/link";

import {
  PUBLIC_LOCALE_LABELS,
  PUBLIC_LOCALES,
  publicHomePath,
  publicInfoPath,
  type PublicInfoSlug,
  type PublicLocale,
} from "@/lib/landing/locales";

export function PublicLanguageNav({
  locale,
  label,
  className,
  infoSlug = null,
}: {
  locale: PublicLocale;
  label: string;
  className?: string;
  /** When set, language links stay on the same supporting page (Step 32). */
  infoSlug?: PublicInfoSlug | null;
}) {
  const hrefFor = (item: PublicLocale) =>
    infoSlug ? publicInfoPath(item, infoSlug) : publicHomePath(item);

  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {PUBLIC_LOCALES.map((item) => {
          const current = item === locale;
          return (
            <li key={item}>
              <Link
                href={hrefFor(item)}
                hrefLang={item}
                lang={item}
                aria-current={current ? "true" : undefined}
                className={
                  current
                    ? "type-label text-text-primary underline decoration-infra-orange underline-offset-4"
                    : "type-body-small text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                }
              >
                {PUBLIC_LOCALE_LABELS[item]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
