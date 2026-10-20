import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { FEATURES_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function PlatformFeaturesSection({ copy }: { copy: PublicLandingCopy }) {
  const { features } = copy;

  return (
    <section
      id={FEATURES_SECTION_ANCHOR}
      aria-labelledby="features-heading"
      className="scroll-mt-28 border-b border-border bg-surface"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <header className="mx-auto max-w-prose space-y-3">
          <p className="type-label text-link">{features.eyebrow}</p>
          <h2 id="features-heading" className="type-section-title text-balance text-text-primary">
            {features.title}
          </h2>
          <p className="type-body text-text-secondary">{features.intro}</p>
        </header>

        <ul className="mt-10 grid gap-4 lg:grid-cols-2 lg:gap-6">
          {features.items.map((item) => (
            <li key={item.id} className="min-w-0">
              <Card className="h-full shadow-elevation-sm">
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="type-card-title">
                      <span lang="en">{item.moduleName}</span>
                      <span className="sr-only"> — </span>
                      <span className="font-normal text-text-secondary"> · {item.title}</span>
                    </CardTitle>
                    <Badge variant={item.status === "demonstration" ? "info" : "neutral"}>
                      {item.status === "demonstration"
                        ? features.statusDemonstration
                        : features.statusPlanned}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="type-body-small text-text-secondary">
                    {item.body}
                  </CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <p className="type-body-small mx-auto mt-8 max-w-prose text-text-secondary">
          {features.disclosure}
        </p>
      </div>
    </section>
  );
}
