import type { ReactNode } from "react";

import { MAIN_CONTENT_ID } from "@/lib/accessibility/document-landmarks";
import { getLpCopy } from "@/lib/landing/lp-copy";
import { getLpLinks } from "@/lib/landing/lp-data";
import type { PublicInfoSlug, PublicLocale } from "@/lib/landing/locales";

import "@/styles/lp.css";

import { CivicFooter } from "./civic-footer";
import { lpFontClass } from "./lp-fonts";
import { LpHeader } from "./lp-header";

export function LpSubpageShell({
  locale,
  infoSlug,
  children,
}: {
  locale: PublicLocale;
  infoSlug: PublicInfoSlug;
  children: ReactNode;
}) {
  const copy = getLpCopy(locale);
  const links = getLpLinks(locale);

  return (
    <div lang={locale} className={`${lpFontClass} lp-root flex min-h-full flex-1 flex-col`}>
      <LpHeader copy={copy.nav} links={links} locale={locale} infoSlug={infoSlug} />
      <main id={MAIN_CONTENT_ID} lang={locale} tabIndex={-1} className="lp-subpage flex min-w-0 flex-1 flex-col outline-none">
        {children}
      </main>
      <CivicFooter copy={copy.footer} nav={copy.nav} stages={copy.lifecycle.stages} links={links} locale={locale} infoSlug={infoSlug} />
    </div>
  );
}

