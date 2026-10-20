import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";
import { PUBLIC_SOLUTION } from "@/lib/landing/public-content";

function SolutionContrastPanel() {
  return (
    <div
      className="grid gap-4 rounded-xl border border-border bg-muted/40 p-4 md:grid-cols-2"
      aria-labelledby="solution-contrast-heading"
    >
      <h3 id="solution-contrast-heading" className="sr-only">
        Illustrative before and after coordination view
      </h3>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <p className="type-label text-text-primary">Without a shared view</p>
        <p className="type-body-small text-text-secondary">
          Separate lists and dates hide that two works target the same corridor in the same
          month.
        </p>
        <Badge variant="critical">Overlap risk (illustrative)</Badge>
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4 ring-1 ring-[color-mix(in_oklch,var(--infra-green)_35%,transparent)]">
        <p className="type-label text-text-primary">With coordinated planning</p>
        <p className="type-body-small text-text-secondary">
          Overlaps surface for review so agencies can adjust schedules before mobilization.
        </p>
        <Badge variant="success">Resolution path (intended)</Badge>
      </div>
      <p className="type-caption text-text-muted md:col-span-2">
        {PUBLIC_SOLUTION.illustrationCaption}
      </p>
    </div>
  );
}

export function InfraosSolutionSection() {
  return (
    <section
      id={SOLUTION_SECTION_ANCHOR}
      aria-labelledby="solution-heading"
      className="border-b border-border bg-background scroll-mt-24 lg:scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page py-12 md:py-16">
        <header className="mx-auto max-w-prose space-y-3 text-center md:text-left">
          <p className="type-label text-infra-orange">{PUBLIC_SOLUTION.eyebrow}</p>
          <h2 id="solution-heading" className="type-section-title text-text-primary">
            {PUBLIC_SOLUTION.title}
          </h2>
          <p className="type-body text-text-secondary">{PUBLIC_SOLUTION.intro}</p>
        </header>

        <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
          {PUBLIC_SOLUTION.flowSteps.map((step, index) => (
            <li key={step.id}>
              <Card className="h-full shadow-elevation-sm">
                <CardHeader className="gap-2">
                  <p className="type-caption text-text-muted">
                    Step {index + 1} · illustrative flow
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

        <div className="mt-10">
          <SolutionContrastPanel />
        </div>

        <p className="type-body-small mx-auto mt-8 max-w-prose text-text-secondary">
          {PUBLIC_SOLUTION.modulesNote}
        </p>
      </div>
    </section>
  );
}
