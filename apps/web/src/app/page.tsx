import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const LIFECYCLE = [
  "Plan",
  "Coordinate",
  "Approve",
  "Build",
  "Verify",
  "Monitor",
  "Complete",
  "Maintain",
] as const;

export default function HomePage() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6 lg:px-8"
    >
      <header className="space-y-3">
        <Badge variant="secondary">Frontend foundation</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          INFRAOS
        </h1>
        <p className="max-w-2xl text-base text-text-secondary sm:text-lg">
          National Infrastructure Intelligence & Coordination Platform
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Foundation initialized successfully.</CardTitle>
          <CardDescription>
            This is a temporary health page. Landing, dashboards, and feature
            routes are added in later steps. Express remains the API — this app
            does not authorize users by itself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2 className="mb-3 text-sm font-medium text-text-primary">
            Core lifecycle
          </h2>
          <ol className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            {LIFECYCLE.map((stage, index) => (
              <li key={stage} className="flex items-center gap-2">
                <span className="rounded-md border border-border bg-surface px-2 py-1 text-text-primary">
                  {stage}
                </span>
                {index < LIFECYCLE.length - 1 ? (
                  <span aria-hidden="true" className="text-infra-orange">
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
