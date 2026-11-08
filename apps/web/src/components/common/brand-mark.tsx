import Image from "next/image";

/** Official InfraOS mark (docs/Logo). Optimised copies live in /public/brand. The navy parts need a light tile, so it always sits on white. */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white shadow-xs ring-1 ring-black/10 ${className}`} style={{ width: size, height: size }}>
      <Image src="/brand/infraos-icon-192.png" alt="" width={size} height={size} priority aria-hidden="true" />
    </span>
  );
}

/** Horizontal lockup with the platform name, for light backgrounds. */
export function BrandLogoFull({ height = 40, className = "" }: { height?: number; className?: string }) {
  return <Image src="/brand/infraos-logo-full.png" alt="InfraOS, National Infrastructure Intelligence and Coordination Platform" width={Math.round(height * (1000 / 306))} height={height} priority className={className} />;
}
