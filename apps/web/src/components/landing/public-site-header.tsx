import Link from "next/link";

import { InfraosMark } from "@/components/landing/infraos-mark";
import { PublicLanguageNav } from "@/components/landing/public-language-nav";
import { PublicMobileNav } from "@/components/landing/public-mobile-nav";
import { publicHomePath, type PublicLocale } from "@/lib/landing/locales";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { getPublicHeaderNavLinks, resolvePublicNavHref } from "@/lib/landing/navigation";
import type { PublicInfoSlug } from "@/lib/landing/locales";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const linkClass = cn(
    "public-motion-interactive rounded-md px-3 py-2 type-body-small text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    className,
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={linkClass}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={linkClass}>
      {label}
    </Link>
  );
}

export function PublicSiteHeader({
  locale,
  copy,
  infoSlug = null,
}: {
  locale: PublicLocale;
  copy: PublicLandingCopy;
  infoSlug?: PublicInfoSlug | null;
}) {
  const links = getPublicHeaderNavLinks(copy, locale).map((item) => ({
    ...item,
    href: resolvePublicNavHref(locale, item.href),
  }));

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-surface">
      <div className="border-b border-border bg-background">
        <div className="container-dashboard gutter-page flex flex-wrap items-center justify-between gap-2 border-s-[3px] border-s-link py-2 ps-4">
          <p className="type-caption text-text-muted">{copy.demoBanner}</p>
          <PublicLanguageNav
            locale={locale}
            label={copy.languageNavLabel}
            infoSlug={infoSlug}
          />
        </div>
      </div>
      <div className="container-dashboard gutter-page flex min-h-14 items-center gap-4 py-2">
        <Link
          href={publicHomePath(locale)}
          className="type-label shrink-0 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={copy.homeLinkLabel}
        >
          <span className="inline-flex items-center gap-2">
            <InfraosMark className="size-8 shrink-0" />
            <span>
              INFRA<span className="text-link">OS</span>
            </span>
          </span>
        </Link>

        <nav
          aria-label={copy.primaryNavLabel}
          className="ml-auto hidden items-center gap-1 lg:flex"
        >
          {links.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <PublicMobileNav
          links={links}
          copy={copy}
          locale={locale}
          infoSlug={infoSlug}
          className="ml-auto lg:hidden"
        />
      </div>
    </header>
  );
}
