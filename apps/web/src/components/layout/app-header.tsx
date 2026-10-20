"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function AppHeader({
  contextLabel,
  showFuturePreview = false,
}: {
  contextLabel?: string;
  showFuturePreview?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex min-h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-primary-nav"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <MenuIcon aria-hidden="true" />
      </Button>
      <p className="type-label text-text-primary">
        INFRA<span className="text-infra-orange">OS</span>
      </p>
      {contextLabel ? (
        <p className="ml-auto min-w-0 truncate type-caption text-text-secondary">{contextLabel}</p>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" id="mobile-primary-nav" className="w-72 p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>INFRAOS</SheetTitle>
          </SheetHeader>
          <AppSidebar
            showFuturePreview={showFuturePreview}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </header>
  );
}
