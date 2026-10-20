import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function InfraosSolutionSection({ copy }: { copy: PublicLandingCopy }) {
  const solution = copy.solution;

  return (
    <section
      id={SOLUTION_SECTION_ANCHOR}
      aria-labelledby="solution-heading"
      className="scroll-mt-28 border-b border-border bg-background"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page py-12 md:py-16">
        <header className="mx-auto max-w-prose space-y-3">
          <p className="type-label text-link">{solution.eyebrow}</p>
          <h2 id="solution-heading" className="type-section-title text-balance text-text-primary">
            {solution.title}
          </h2>
          <p className="type-body text-text-secondary">{solution.intro}</p>
        </header>
        <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
          {solution.flowSteps.map((step, index) => (
            <li key={step.id} className="min-w-0">
              <Card className="h-full shadow-elevation-sm">
                <CardHeader className="gap-2">
                  <p className="type-caption text-text-muted">
                    {index + 1} · {solution.flowLabel}
                  </p>
                  <CardTitle className="type-card-title">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="type-body-small text-text-secondary">
                    {step.body}
                  </CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
        <div
          className="mt-10 grid gap-4 rounded-xl border border-border bg-muted/40 p-4 md:grid-cols-2"
          aria-labelledby="solution-contrast-heading"
        >
          <h3 id="solution-contrast-heading" className="sr-only">
            {solution.contrastTitle}
          </h3>
          <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
            <p className="type-label text-text-primary">{solution.withoutTitle}</p>
            <p className="type-body-small text-text-secondary">{solution.withoutBody}</p>
            <Badge variant="critical">{solution.withoutBadge}</Badge>
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
            <p className="type-label text-text-primary">{solution.withTitle}</p>
            <p className="type-body-small text-text-secondary">{solution.withBody}</p>
            <Badge variant="success">{solution.withBadge}</Badge>
          </div>
          <p className="type-caption text-text-muted md:col-span-2">{solution.caption}</p>
        </div>
        <p className="type-body-small mx-auto mt-8 max-w-prose text-text-secondary">
          {solution.modulesNote}
        </p>
      </div>
    </section>
  );
}
