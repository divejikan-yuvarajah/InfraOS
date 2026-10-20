"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { PublicLanguageNav } from "@/components/landing/public-language-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PublicInfoSlug, PublicLocale } from "@/lib/landing/locales";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import type { PublicNavLink } from "@/lib/landing/navigation";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ID = "public-mobile-primary-nav";

export function PublicMobileNav({
  links,
  copy,
  locale,
  infoSlug = null,
  className,
}: {
  links: readonly PublicNavLink[];
  copy: PublicLandingCopy;
  locale: PublicLocale;
  infoSlug?: PublicInfoSlug | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  }, []);

  return (
    <div className={cn(className)}>
      <Button
        ref={menuButtonRef}
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-controls={MOBILE_NAV_ID}
        aria-label={open ? copy.closeMenu : copy.openMenu}
        onClick={() => setOpen((value) => !value)}
      >
        <MenuIcon aria-hidden="true" />
      </Button>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" id={MOBILE_NAV_ID} className="w-72">
          <SheetHeader>
            <SheetTitle className="type-label text-left">{copy.menuTitle}</SheetTitle>
          </SheetHeader>
          <nav aria-label={copy.primaryNavLabel} className="mt-4 flex flex-col gap-1">
            {links.map((item) => {
              const className =
                "public-motion-interactive rounded-md px-3 py-2 type-body-small text-text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

              return (
                <Link key={item.href} href={item.href} className={className} onClick={close}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <PublicLanguageNav
            locale={locale}
            label={copy.languageNavLabel}
            infoSlug={infoSlug}
            className="mt-6 border-t border-border pt-4"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
