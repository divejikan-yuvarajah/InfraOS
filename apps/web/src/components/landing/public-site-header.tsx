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
    "public-motion-interactive rounded-md px-3 py-2 type-body-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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
    <header className="public-rescue-header sticky top-0 z-[var(--z-sticky)]">
      <div className="border-b border-white/10">
        <div className="container-dashboard gutter-page flex flex-wrap items-center justify-between gap-2 py-2">
          <p className="type-caption text-slate-400">{copy.demoBanner}</p>
          <PublicLanguageNav
            locale={locale}
            label={copy.languageNavLabel}
            infoSlug={infoSlug}
            className="[&_a]:text-slate-300 [&_a:hover]:text-white [&_span[aria-current]]:text-white [&_span[aria-current]]:decoration-[#FF5B00]"
          />
        </div>
      </div>
      <div className="container-dashboard gutter-page flex min-h-[3.75rem] items-center gap-4 py-2">
        <Link
          href={publicHomePath(locale)}
          className="public-rescue-wordmark shrink-0 text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FEB600]"
          aria-label={copy.homeLinkLabel}
        >
          <span className="inline-flex items-center gap-3">
            <InfraosMark className="size-10 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>
                INFRA<span className="text-[#FF5B00]">OS</span>
              </span>
              <span className="type-caption font-normal tracking-normal text-slate-400">
                {copy.hero.eyebrow}
              </span>
            </span>
          </span>
        </Link>

        <nav
          aria-label={copy.primaryNavLabel}
          className="ml-auto hidden items-center gap-1 lg:flex"
        >
          {links.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              className="text-slate-300 hover:text-white"
            />
          ))}
        </nav>

        <PublicMobileNav
          links={links}
          copy={copy}
          locale={locale}
          infoSlug={infoSlug}
          darkHeader
          className="ml-auto lg:hidden"
        />
      </div>
    </header>
  );
}
