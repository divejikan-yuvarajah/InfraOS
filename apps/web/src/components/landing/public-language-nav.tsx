import { PublicLanguageNavClient } from "@/components/landing/public-language-nav-client";
import type { PublicInfoSlug, PublicLocale } from "@/lib/landing/locales";

export function PublicLanguageNav({
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
  return (
    <PublicLanguageNavClient
      locale={locale}
      label={label}
      className={className}
      infoSlug={infoSlug}
    />
  );
}
