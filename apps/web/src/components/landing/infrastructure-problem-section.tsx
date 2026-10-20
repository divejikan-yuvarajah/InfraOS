import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROBLEM_SECTION_ANCHOR } from "@/lib/landing/navigation";
import { PUBLIC_PROBLEM } from "@/lib/landing/public-content";

export function InfrastructureProblemSection() {
  return (
    <section
      id={PROBLEM_SECTION_ANCHOR}
      aria-labelledby="problem-heading"
      className="border-b border-border bg-surface scroll-mt-24 lg:scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page py-12 md:py-16">
        <header className="mx-auto max-w-prose space-y-3 text-center md:text-left">
          <p className="type-label text-infra-orange">{PUBLIC_PROBLEM.eyebrow}</p>
          <h2 id="problem-heading" className="type-section-title text-text-primary">
            {PUBLIC_PROBLEM.title}
          </h2>
          <p className="type-body text-text-secondary">{PUBLIC_PROBLEM.intro}</p>
        </header>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:gap-6">
          {PUBLIC_PROBLEM.cards.map((card) => (
            <li key={card.id}>
              <Card className="h-full shadow-elevation-sm">
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="type-card-title">{card.title}</CardTitle>
                    <Badge variant={card.badge.variant}>{card.badge.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="type-body-small text-text-secondary">
                    {card.body}
                  </CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
