"use client";

import * as React from "react";
import { InfoIcon } from "lucide-react";
import { toast } from "sonner";

import { ConflictSeverityBadge, ProjectStatusBadge } from "@/components/common/status-badge";
import { DatePicker } from "@/components/common/date-picker";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ComponentLibraryPreview() {
  const [dateValue, setDateValue] = React.useState<string | undefined>();

  return (
    <section
      aria-labelledby="step-19-preview-heading"
      className="space-y-8"
    >
      <h2 id="step-19-preview-heading" className="type-section-title text-text-primary">
        UI component library (Step 19 verification)
      </h2>
      <p className="type-body-small text-text-secondary">
        Development fixture only — synthetic labels, no backend actions. UI visibility
        does not grant permissions.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button">Primary</Button>
        <Button type="button" variant="secondary">
          Secondary
        </Button>
        <Button type="button" variant="outline">
          Outline
        </Button>
        <Button type="button" variant="ghost">
          Ghost
        </Button>
        <Button type="button" variant="destructive">
          Destructive
        </Button>
        <Button type="button" loading>
          Loading
        </Button>
        <Button type="button" size="icon" aria-label="More actions">
          <InfoIcon className="size-4" />
        </Button>
      </div>

      <div className="grid max-w-md gap-3">
        <div className="grid gap-2">
          <Label htmlFor="demo-input">Project reference</Label>
          <Input id="demo-input" placeholder="WR-2026-001" autoComplete="off" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="demo-notes">Notes</Label>
          <Textarea id="demo-notes" placeholder="Optional coordination notes" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="demo-agency">Agency</Label>
          <Select>
            <SelectTrigger id="demo-agency" className="w-full">
              <SelectValue placeholder="Select agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rda">
                Road Development Authority — Western Province Corridor Unit
              </SelectItem>
              <SelectItem value="water">National Water Supply Board</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DatePicker
          id="demo-date"
          label="Planned start (date-only)"
          value={dateValue}
          onChange={setDateValue}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ProjectStatusBadge status="UNDER_REVIEW" />
        <ProjectStatusBadge status="APPROVED" />
        <ConflictSeverityBadge severity="HIGH" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Alert>
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>Neutral operational notice with visible title.</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <AlertTitle>Schedule review</AlertTitle>
          <AlertDescription>Pending coordination — label + color.</AlertDescription>
        </Alert>
        <Alert variant="success">
          <AlertTitle>Approved</AlertTitle>
          <AlertDescription>Visual success only; server still validates.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>Conflict detected</AlertTitle>
          <AlertDescription>Critical semantic styling with readable text.</AlertDescription>
        </Alert>
      </div>

      <Tabs defaultValue="overview" className="w-full max-w-lg">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="type-body-small text-text-secondary">
          Tab panel content — keyboard: arrow keys between triggers.
        </TabsContent>
        <TabsContent value="milestones" className="type-body-small text-text-secondary">
          Placeholder panel for future Step 20+ forms.
        </TabsContent>
      </Tabs>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableCaption className="type-caption">
            Synthetic budget row — tabular numerals
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Line item</TableHead>
              <TableHead scope="col" className="text-right">
                Amount (LKR)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Segment resurfacing</TableCell>
              <TableCell className="type-tabular-nums text-right">
                12,450,000.00
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              Open dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog title</DialogTitle>
              <DialogDescription>
                Focus is trapped while open; Esc closes and restores focus.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              Confirm action
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject draft?</AlertDialogTitle>
              <AlertDialogDescription>
                Example destructive confirmation — no API call.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline">
              Open sheet
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Mobile-friendly panel</SheetTitle>
              <SheetDescription>Sheet overlay for narrow viewports.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" aria-label="Help">
              <InfoIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Supplementary hint — not sole label.</TooltipContent>
        </Tooltip>

        <Button
          type="button"
          variant="secondary"
          onClick={() => toast.message("Synthetic toast", { description: "No server success implied." })}
        >
          Show toast
        </Button>
      </div>
    </section>
  );
}
