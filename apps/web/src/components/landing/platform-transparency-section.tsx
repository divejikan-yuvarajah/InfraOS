import type { PublicLandingCopy } from "@/lib/landing/messages";
import { TRANSPARENCY_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function PlatformTransparencySection({ copy }: { copy: PublicLandingCopy }) {
  const panel = copy.transparency;

  return (
    <section
      id={TRANSPARENCY_SECTION_ANCHOR}
      aria-labelledby="transparency-heading"
      className="scroll-mt-28 border-b border-border bg-background"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <header className="max-w-prose space-y-3">
          <p className="type-label text-link">{panel.eyebrow}</p>
          <h2 id="transparency-heading" className="type-section-title text-balance text-text-primary">
            {panel.title}
          </h2>
          <p className="type-body text-text-secondary">{panel.intro}</p>
        </header>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-start">
            <caption className="sr-only">{panel.tableCaption}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="type-label py-3 pe-4 text-text-primary">
                  {panel.colModule}
                </th>
                <th scope="col" className="type-label py-3 pe-4 text-text-primary">
                  {panel.colStatus}
                </th>
                <th scope="col" className="type-label py-3 text-text-primary">
                  {panel.colNotes}
                </th>
              </tr>
            </thead>
            <tbody>
              {panel.rows.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <th scope="row" className="type-body-small py-3 pe-4 font-medium text-text-primary">
                    {row.module}
                  </th>
                  <td className="type-body-small py-3 pe-4 text-text-secondary">
                    <span
                      className={
                        row.status === "demonstration"
                          ? "inline-flex rounded-md border border-border bg-surface px-2 py-0.5 type-caption text-text-primary"
                          : row.status === "planned"
                            ? "inline-flex rounded-md border border-dashed border-border px-2 py-0.5 type-caption text-text-muted"
                            : "inline-flex rounded-md border border-border px-2 py-0.5 type-caption text-text-secondary"
                      }
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="type-body-small py-3 text-text-secondary">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="type-body-small mt-6 max-w-prose rounded-md border border-border bg-muted/40 px-3 py-2 text-text-primary">
          {panel.footerNote}
        </p>
      </div>
    </section>
  );
}
