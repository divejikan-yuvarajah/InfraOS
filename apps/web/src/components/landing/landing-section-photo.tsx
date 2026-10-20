import Image from "next/image";

import { cn } from "cn";

import {
  LANDING_PHOTO_PATHS,
  type LandingPhotoId,
} from "@/lib/landing/landing-photos";

type LandingSectionPhotoProps = {
  photoId: LandingPhotoId;
  alt: string;
  credit: string;
  className?: string;
  /** Default 16/10 — suitable for infrastructure scenes */
  aspectClassName?: string;
  priority?: boolean;
};

const PHOTO_DIMENSIONS: Record<
  LandingPhotoId,
  { width: number; height: number }
> = {
  expresswayConstructionSeeduwa: { width: 1280, height: 960 },
  southernExpressway: { width: 1024, height: 576 },
  roadConstructionWilpattu: { width: 1280, height: 960 },
};

export function LandingSectionPhoto({
  photoId,
  alt,
  credit,
  className,
  aspectClassName = "aspect-[4/3]",
  priority = false,
}: LandingSectionPhotoProps) {
  const src = LANDING_PHOTO_PATHS[photoId];
  const { width, height } = PHOTO_DIMENSIONS[photoId];

  return (
    <figure className={cn("min-w-0", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-muted/30 shadow-elevation-sm",
          aspectClassName,
        )}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 28rem"
          className="h-full w-full object-cover"
          priority={priority}
        />
      </div>
      <figcaption className="type-caption mt-2 text-text-muted">{credit}</figcaption>
    </figure>
  );
}
