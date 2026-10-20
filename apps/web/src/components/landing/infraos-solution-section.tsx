import { CoordinationSequenceDiagram } from "@/components/landing/coordination-sequence-diagram";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function InfraosSolutionSection({ copy }: { copy: PublicLandingCopy }) {
  const solution = copy.solution;

  return (
    <section
      id={SOLUTION_SECTION_ANCHOR}
      aria-labelledby="solution-heading"
      className="scroll-mt-28 border-b border-border bg-[#111827] text-white"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <header className="max-w-prose space-y-3">
            <p className="type-label text-[#FEB600]">{solution.eyebrow}</p>
            <h2 id="solution-heading" className="type-section-title text-balance text-white">
              {solution.title}
            </h2>
            <p className="type-body text-slate-200">{solution.intro}</p>
          </header>
          <div className="rounded-xl border border-white/15 bg-white/5 p-2">
            <CoordinationSequenceDiagram illustration={copy.illustration} solution={copy.solution} />
          </div>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2" aria-labelledby="solution-contrast-heading">
          <h3 id="solution-contrast-heading" className="sr-only">
            {solution.contrastTitle}
          </h3>
          <div>
            <p className="type-label text-white">{solution.withoutTitle}</p>
            <p className="type-body-small mt-2 text-slate-200">{solution.withoutBody}</p>
            <p className="type-caption mt-3 text-[#FEB600]">{solution.withoutBadge}</p>
          </div>
          <div>
            <p className="type-label text-white">{solution.withTitle}</p>
            <p className="type-body-small mt-2 text-slate-200">{solution.withBody}</p>
            <p className="type-caption mt-3 text-white">{solution.withBadge}</p>
          </div>
          <p className="type-caption text-slate-300 md:col-span-2">{solution.caption}</p>
        </div>
        <p className="type-body-small mt-8 max-w-prose text-slate-200">{solution.modulesNote}</p>
      </div>
    </section>
  );
}
