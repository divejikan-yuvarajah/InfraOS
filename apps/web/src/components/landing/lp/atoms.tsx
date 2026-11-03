import Image from "next/image";
import Link from "next/link";
import { BanIcon, CircleCheckIcon, ClockIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { LpStatusTone } from "@/lib/landing/lp-copy";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  lede,
  aside,
  id,
  wide = false,
  medium = false,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  aside?: ReactNode;
  id?: string;
  wide?: boolean;
  medium?: boolean;
}) {
  return (
    <div className={cn("lp-sechead", wide && "lp-sechead--wide")}>
      <div>
        <span className="lp-eyebrow">{eyebrow}</span>
        <h2 id={id} className={cn("lp-display lp-h2", medium && "lp-h2--md")}>
          {title}
        </h2>
        {lede ? <p className="lp-lede">{lede}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/** Photo with an editorial caption overlay (Fig./Plate labels). */
export function FigureCaption({
  src,
  alt,
  label,
  title,
  caption,
  chip,
  ChipIcon,
  dot,
  priority = false,
  sizes,
  hero = false,
}: {
  src: string;
  alt: string;
  label: string;
  title?: string;
  caption: string;
  chip?: string;
  ChipIcon?: LucideIcon;
  dot?: string;
  priority?: boolean;
  sizes: string;
  hero?: boolean;
}) {
  return (
    <figure className={cn("lp-figure", !hero && "lp-figure--card")}>
      <div className={cn("lp-figure__frame", hero && "lp-figure__frame--hero")}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} />
        <div className="lp-figure__shade" aria-hidden="true" />
        <figcaption className="lp-figure__cap">
          <div>
            <span className="lp-figure__label">
              {dot ? <span className="lp-dot" style={{ background: dot, width: 6, height: 6 }} aria-hidden="true" /> : null}
              {label}
            </span>
            {title ? <div className="lp-display lp-figure__title">{title}</div> : null}
            <p className="lp-figure__text">{caption}</p>
          </div>
          {chip ? (
            <span className="lp-figure__chip">
              {ChipIcon ? <ChipIcon /> : null}
              {chip}
            </span>
          ) : null}
        </figcaption>
      </div>
    </figure>
  );
}

export function StatPill({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="lp-stat">
      <div className={cn("lp-stat__value", accent && "lp-stat__value--accent")}>{value}</div>
      <div className="lp-stat__label">{label}</div>
    </div>
  );
}

const STATUS_ICON: Record<LpStatusTone, LucideIcon> = {
  locked: CircleCheckIcon,
  pending: ClockIcon,
  blocked: BanIcon,
};

/** Status tag: always carries an icon and text, never colour alone. */
export function StatusBadge({ tone, children }: { tone: LpStatusTone; children: ReactNode }) {
  const Icon = STATUS_ICON[tone];
  return (
    <span className={cn("lp-badge", `lp-badge--${tone}`)}>
      <Icon />
      {children}
    </span>
  );
}

/** Single-weight route line; `progress` is 0 to 1 and only fills the orange segment. */
export function RouteLine({ progress }: { progress: number }) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div className="lp-stepper__track" aria-hidden="true">
      <div className="lp-stepper__fill" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function NavLink({
  href,
  current,
  className,
  children,
  onClick,
}: {
  href: string;
  current?: boolean;
  className: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined} onClick={onClick}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  expanded,
  controls,
  onClick,
  children,
  buttonRef,
}: {
  label: string;
  expanded?: boolean;
  controls?: string;
  onClick: () => void;
  children: ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="lp-iconbtn"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
