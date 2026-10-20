import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LandingSectionPhoto } from "@/components/landing/landing-section-photo";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { PROBLEM_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function InfrastructureProblemSection({ copy }: { copy: PublicLandingCopy }) {
  return (
    <section
      id={PROBLEM_SECTION_ANCHOR}
      aria-labelledby="problem-heading"
      className="scroll-mt-28 border-b border-border bg-surface"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] lg:items-start lg:gap-12">
          <header className="max-w-prose space-y-3">
            <p className="type-label text-link">{copy.problem.eyebrow}</p>
            <h2 id="problem-heading" className="type-section-title text-balance text-text-primary">
              {copy.problem.title}
            </h2>
            <p className="type-body text-text-secondary">{copy.problem.intro}</p>
          </header>
          <LandingSectionPhoto
            photoId="expresswayConstructionSeeduwa"
            alt={copy.photography.problemExpresswayAlt}
            credit={copy.photography.problemExpresswayCredit}
            className="lg:order-last"
          />
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:gap-6">
          {copy.problem.cards.map((card) => (
            <li key={card.id} className="min-w-0">
              <Card className="h-full shadow-elevation-sm">
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="type-card-title">{card.title}</CardTitle>
                    <Badge variant={card.variant}>{card.badge}</Badge>
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
