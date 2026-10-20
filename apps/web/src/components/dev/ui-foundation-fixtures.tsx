import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComponentLibraryPreview } from "@/components/examples/component-library-preview";
import { DataTablePreview } from "@/components/data-table/data-table-preview";
import { FeedbackPreview } from "@/components/feedback/feedback-preview";
import { AppShellPreview } from "@/components/layout/app-shell-preview";
import { DemoCoordinationForm } from "@/components/forms/demo-coordination-form";
import { MIXED_SCRIPT_SAMPLES } from "@/lib/design/design-tokens";
import { projectStatusVisual } from "@/lib/design/semantic-colors";

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

const STATUS_SAMPLES = [
  { label: "Pending review", variant: "pending" as const },
  { label: "Schedule warning", variant: "warning" as const },
  { label: "High conflict", variant: "critical" as const },
  { label: "Approved", variant: "success" as const },
  { label: "Draft", variant: "neutral" as const },
  { label: "Informational", variant: "info" as const },
] as const;

/** Development-only Step 17–24 verification fixtures (not public marketing). */
export function UiFoundationFixtures() {
  const approvedVariant = projectStatusVisual("APPROVED");

  return (
    <section
      aria-labelledby="dev-fixtures-heading"
      className="container-content gutter-page flex w-full flex-col gap-8 border-t border-border bg-muted/30 py-12"
    >
      <header className="space-y-3">
        <Badge variant="secondary">Development fixtures</Badge>
        <h2 id="dev-fixtures-heading" className="type-section-title text-text-primary">
          UI foundation preview
        </h2>
        <p className="type-body-small max-w-prose text-text-secondary">
          Visible only in development. Operational shell, tables, forms, and feedback
          states remain available for local verification—they are not part of the public
          landing experience.
        </p>
      </header>

      <Card className="shadow-elevation-sm">
        <CardHeader className="gap-2 p-6">
          <CardTitle className="type-card-title">Foundation health</CardTitle>
          <CardDescription className="type-body-small">
            Express remains the API. This app does not authorize users by itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-0">
          <h3 className="type-label text-text-primary">Core lifecycle</h3>
          <ol className="flex flex-wrap items-center gap-2 type-body-small text-text-secondary">
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

      <Card aria-labelledby="brand-tokens-heading" className="shadow-elevation-sm">
        <CardHeader className="gap-2 p-6">
          <CardTitle id="brand-tokens-heading" className="type-card-title">
            Brand & status tokens (Step 17)
          </CardTitle>
          <CardDescription className="type-body-small">
            Semantic colors are visual only. Each badge includes a text label.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-0">
          <div className="flex flex-wrap gap-2">
            {STATUS_SAMPLES.map(({ label, variant }) => (
              <Badge key={label} variant={variant}>
                {label}
              </Badge>
            ))}
          </div>
          <p className="type-body-small text-text-secondary">
            Step 16 mapping example: project status{" "}
            <Badge variant={approvedVariant}>APPROVED</Badge> →{" "}
            <span className="font-mono text-xs">{approvedVariant}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button">Primary action</Button>
            <Button type="button" variant="outline">
              Secondary
            </Button>
            <Button type="button" variant="destructive">
              Critical action
            </Button>
            <Button type="button" variant="link">
              Link on canvas
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card aria-labelledby="typography-tokens-heading" className="shadow-elevation-sm">
        <CardHeader className="gap-2 p-6">
          <CardTitle id="typography-tokens-heading" className="type-section-title">
            Typography & layout tokens (Step 18)
          </CardTitle>
          <CardDescription className="type-body-small">
            Geist UI with system Noto fallbacks for Tamil/Sinhala glyphs when locally installed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 rounded-lg border border-border p-4">
              <p className="type-label text-text-muted">KPI (tabular nums)</p>
              <p className="type-metric text-text-primary">LKR 12,450,000.00</p>
              <p className="type-caption">Budget allocated · FY 2026</p>
            </div>
            <div className="space-y-1 rounded-lg border border-border p-4">
              <p className="type-label text-text-muted">Risk score</p>
              <p className="type-metric text-text-primary">
                <span className="type-tabular-nums">87</span>
                <span className="type-body-small font-normal text-text-secondary">
                  {" "}
                  / 100
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="type-label text-text-primary">Long agency / project names</p>
            <p className="type-body-small text-text-secondary">
              {MIXED_SCRIPT_SAMPLES.agencyEn}
            </p>
            <p className="type-body-small text-text-secondary" lang="ta">
              {MIXED_SCRIPT_SAMPLES.agencyTa}
            </p>
            <p className="type-body-small text-text-secondary" lang="si">
              {MIXED_SCRIPT_SAMPLES.agencySi}
            </p>
            <p className="type-body-small text-text-secondary">
              {MIXED_SCRIPT_SAMPLES.projectEn}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border p-4">
              <p className="type-label">Compact card padding (p-4, gap-2)</p>
              <p className="type-body-small text-text-secondary">
                Dense dashboard rhythm uses 16px padding and 8px gaps.
              </p>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-6 shadow-elevation-md">
              <p className="type-label">Raised surface (shadow-md)</p>
              <p className="type-body-small text-text-secondary">
                Popovers/modals use stronger elevation; most KPI cards stay flat with borders only.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-elevation-sm">
        <CardContent className="p-6">
          <ComponentLibraryPreview />
        </CardContent>
      </Card>

      <Card className="shadow-elevation-sm">
        <CardHeader>
          <CardTitle className="type-card-title">Application shell fixture (Step 23)</CardTitle>
          <CardDescription>
            Development only. The public page is not replaced by this shell.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppShellPreview />
        </CardContent>
      </Card>

      <Card className="shadow-elevation-sm">
        <CardHeader>
          <CardTitle className="type-card-title">Feedback states fixture (Step 22)</CardTitle>
          <CardDescription>
            Development only. Illustrates loading, empty, error and success presentation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackPreview />
        </CardContent>
      </Card>

      <Card className="shadow-elevation-sm">
        <CardHeader>
          <CardTitle className="type-card-title">Data table fixture (Step 21)</CardTitle>
          <CardDescription>Development only. Synthetic rows.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTablePreview />
        </CardContent>
      </Card>

      <Card className="shadow-elevation-sm">
        <CardHeader>
          <CardTitle className="type-card-title">Form validation fixture (Step 20)</CardTitle>
          <CardDescription>Development only. Client checks are not authorization.</CardDescription>
        </CardHeader>
        <CardContent>
          <DemoCoordinationForm />
        </CardContent>
      </Card>
    </section>
  );
}
