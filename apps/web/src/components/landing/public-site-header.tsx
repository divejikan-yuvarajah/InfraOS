import Link from "next/link";

import { InfraosWordmark } from "@/components/landing/infraos-wordmark";
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
    "public-motion-interactive rounded-md px-3 py-2 type-body-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FEB600]",
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
  connectedFuture = false,
}: {
  locale: PublicLocale;
  copy: PublicLandingCopy;
  infoSlug?: PublicInfoSlug | null;
  connectedFuture?: boolean;
}) {
  const links = getPublicHeaderNavLinks(copy, locale).map((item) => ({
    ...item,
    href: resolvePublicNavHref(locale, item.href),
  }));

  const headerClass = connectedFuture ? "cf-site-header" : "public-rescue-header sticky top-0 z-[var(--z-sticky)]";

  return (
    <header className={headerClass}>
      <div className={connectedFuture ? "cf-site-header__utility border-b border-white/10" : "border-b border-white/10"}>
        <div className="container-dashboard gutter-page flex flex-wrap items-center justify-between gap-2 py-2">
          <p className="type-caption text-slate-400">{copy.demoBanner}</p>
          <PublicLanguageNav
            locale={locale}
            label={copy.languageNavLabel}
            infoSlug={infoSlug}
            className={
              connectedFuture
                ? "cf-lang-nav [&_a]:text-slate-300 [&_a:hover]:text-white"
                : "[&_a]:text-slate-300 [&_a:hover]:text-white [&_span[aria-current]]:text-white [&_span[aria-current]]:decoration-[#FF5B00]"
            }
          />
        </div>
      </div>
      <div
        className={cn(
          "container-dashboard gutter-page flex min-h-[3.75rem] items-center gap-4 py-2",
          connectedFuture && "cf-site-header__bar",
        )}
      >
        <Link
          href={publicHomePath(locale)}
          className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FEB600]"
          aria-label={copy.homeLinkLabel}
        >
          {connectedFuture ? (
            <InfraosWordmark tagline={copy.hero.eyebrow} tone="on-light" markSize="size-10" />
          ) : (
            <span className="public-rescue-wordmark text-slate-100">INFRAOS</span>
          )}
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
              className={
                connectedFuture ? "text-slate-600 hover:text-[#8C1F28]" : "text-slate-300 hover:text-white"
              }
            />
          ))}
        </nav>

        <PublicMobileNav
          links={links}
          copy={copy}
          locale={locale}
          infoSlug={infoSlug}
          darkHeader={!connectedFuture}
          connectedFuture={connectedFuture}
          className={cn("ml-auto", connectedFuture ? "lg:hidden" : "lg:ml-0")}
        />
      </div>
    </header>
  );
}
