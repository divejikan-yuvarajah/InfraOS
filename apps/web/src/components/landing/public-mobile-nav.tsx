"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PublicNavLink } from "@/lib/landing/navigation";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ID = "public-mobile-primary-nav";

export function PublicMobileNav({
  links,
  className,
}: {
  links: readonly PublicNavLink[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={cn(className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-controls={MOBILE_NAV_ID}
        aria-label={open ? "Close primary navigation" : "Open primary navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        <MenuIcon aria-hidden="true" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" id={MOBILE_NAV_ID} className="w-72">
          <SheetHeader>
            <SheetTitle className="type-label text-left">Menu</SheetTitle>
          </SheetHeader>
          <nav aria-label="Primary" className="mt-4 flex flex-col gap-1">
            {links.map((item) => {
              const isHash = item.href.startsWith("#");
              const className =
                "rounded-md px-3 py-2 type-body-small text-text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

              if (isHash) {
                return (
                  <a key={item.href} href={item.href} className={className} onClick={close}>
                    {item.label}
                  </a>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={className} onClick={close}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
