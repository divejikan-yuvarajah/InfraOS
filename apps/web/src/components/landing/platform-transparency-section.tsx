import type { PublicLandingCopy } from "@/lib/landing/messages";
import { TRANSPARENCY_SECTION_ANCHOR } from "@/lib/landing/navigation";

function statusClass(status: "demonstration" | "planned" | "internal"): string {
  if (status === "demonstration") return "cf-transparency-module__status--demo";
  if (status === "planned") return "cf-transparency-module__status--planned";
  return "cf-transparency-module__status--internal";
}

export function PlatformTransparencySection({ copy }: { copy: PublicLandingCopy }) {
  const panel = copy.transparency;
  const explore = panel.rows.filter((r) => r.status === "demonstration");
  const planned = panel.rows.filter((r) => r.status !== "demonstration");

  return (
    <section
      id={TRANSPARENCY_SECTION_ANCHOR}
      aria-labelledby="transparency-heading"
      className="cf-transparency-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-transparency-section__inner">
        <header className="max-w-prose space-y-3">
          <p className="cf-transparency-section__eyebrow cf-gis-section__eyebrow">
            {panel.eyebrow}
          </p>
          <h2 id="transparency-heading" className="cf-transparency-section__title text-balance">
            {panel.title}
          </h2>
          <p className="cf-transparency-section__intro">{panel.intro}</p>
        </header>

        <div className="cf-transparency-bands">
          <div className="cf-transparency-band cf-transparency-band--explore">
            <h3 className="cf-transparency-band__title">{panel.exploreBandTitle}</h3>
            <p className="cf-transparency-module__note mt-1">{panel.tableCaption}</p>
            {explore.map((row) => (
              <div key={row.id} className="cf-transparency-module">
                <div className="cf-transparency-module__head">
                  <span className="cf-transparency-module__name" lang="en">
                    {row.module}
                  </span>
                  <span
                    className={`cf-transparency-module__status ${statusClass(row.status)}`}
                  >
                    {row.statusLabel}
                  </span>
                </div>
                <p className="cf-transparency-module__note">{row.note}</p>
              </div>
            ))}
          </div>

          <div className="cf-transparency-band cf-transparency-band--planned">
            <h3 className="cf-transparency-band__title">{panel.plannedBandTitle}</h3>
            {planned.map((row) => (
              <div key={row.id} className="cf-transparency-module">
                <div className="cf-transparency-module__head">
                  <span className="cf-transparency-module__name" lang="en">
                    {row.module}
                  </span>
                  <span
                    className={`cf-transparency-module__status ${statusClass(row.status)}`}
                  >
                    {row.statusLabel}
                  </span>
                </div>
                <p className="cf-transparency-module__note">{row.note}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="cf-transparency-footer">{panel.footerNote}</p>
      </div>
    </section>
  );
}
