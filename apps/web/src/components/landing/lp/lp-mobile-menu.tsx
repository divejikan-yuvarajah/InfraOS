"use client";

import Link from "next/link";
import { LockIcon, MenuIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { LpLinks } from "@/lib/landing/lp-data";
import type { LpCopy } from "@/lib/landing/lp-copy";
import type { PublicLocale } from "@/lib/landing/locales";

import { IconButton, NavLink } from "./atoms";
import { lpFontClass } from "./lp-fonts";
import { LpLanguageNav } from "./lp-language-nav";

const MENU_ID = "lp-mobile-menu";

/** Slide-out menu. Radix Dialog supplies the focus trap, Esc to close and scroll lock. */
export function LpMobileMenu({ copy, links, locale }: { copy: LpCopy["nav"]; links: LpLinks; locale: PublicLocale }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const items = [
    { label: copy.home, href: links.home, current: true },
    { label: copy.about, href: links.about },
    { label: copy.howItWorks, href: links.howItWorks },
    { label: copy.faq, href: links.faq },
    { label: copy.contact, href: links.contact },
  ];

  return (
    <>
      <IconButton label={copy.openMenu} expanded={open} controls={MENU_ID} buttonRef={buttonRef} onClick={() => setOpen(true)}>
        <MenuIcon aria-hidden="true" />
      </IconButton>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          id={MENU_ID}
          side="right"
          showCloseButton={false}
          className={`${lpFontClass} lp-root lp-drawer`}
          lang={locale}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buttonRef.current?.focus();
          }}
        >
          <div style={{ padding: "1rem", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SheetTitle className="lp-display" style={{ fontSize: 20, fontWeight: 600 }}>
                {copy.menuTitle}
              </SheetTitle>
              <SheetClose asChild>
                <button type="button" className="lp-iconbtn" style={{ display: "inline-flex" }} aria-label={copy.closeMenu}>
                  <XIcon aria-hidden="true" />
                </button>
              </SheetClose>
            </div>
            <SheetDescription className="lp-sr-only">{copy.label}</SheetDescription>
            <nav aria-label={copy.label} className="lp-drawer__nav">
              {items.map((item) => (
                <NavLink key={item.href} href={item.href} current={item.current} className="lp-drawer__link" onClick={close}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <Link href={links.signIn} className="lp-btn lp-btn--primary lp-drawer__signin" style={{ width: "100%" }} onClick={close}>
              <LockIcon aria-hidden="true" width={16} height={16} />
              {copy.signIn}
            </Link>
            <div className="lp-drawer__lang">
              <div className="lp-drawer__lang-label">{copy.languageLabel}</div>
              <LpLanguageNav locale={locale} label={copy.languageLabel} onNavigate={close} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

