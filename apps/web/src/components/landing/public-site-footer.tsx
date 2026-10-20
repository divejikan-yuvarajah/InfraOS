import type { PublicLandingCopy } from "@/lib/landing/messages";

export function PublicSiteFooter({ copy }: { copy: PublicLandingCopy }) {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-dashboard gutter-page space-y-3 py-8">
        <p className="type-body-small max-w-prose text-text-secondary">{copy.footerDisclosure}</p>
        <p className="type-caption max-w-prose">{copy.translationDraftNote}</p>
      </div>
    </footer>
  );
}
