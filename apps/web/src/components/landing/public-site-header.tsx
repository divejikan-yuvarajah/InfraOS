import Link from "next/link";

import { PublicMobileNav } from "@/components/landing/public-mobile-nav";
import { getAvailablePublicNavLinks } from "@/lib/landing/navigation";
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
    "rounded-md px-3 py-2 type-body-small text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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

export function PublicSiteHeader() {
  const links = getAvailablePublicNavLinks();

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-surface/95 supports-backdrop-filter:backdrop-blur-sm">
      <div className="container-dashboard gutter-page flex h-14 items-center gap-4">
        <Link
          href="/"
          className="type-label shrink-0 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="INFRAOS — Home"
        >
          INFRA<span className="text-infra-orange">OS</span>
        </Link>

        <nav
          aria-label="Primary"
          className="ml-auto hidden items-center gap-1 md:flex"
        >
          {links.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <PublicMobileNav links={links} className="ml-auto md:hidden" />
      </div>
    </header>
  );
}
