import type { LifecycleStepperStage } from "@/components/landing/lifecycle-stepper";
import type { PublicLandingCopy } from "./messages";

export function lifecycleStagesForStepper(copy: PublicLandingCopy): LifecycleStepperStage[] {
  return copy.lifecycle.stages.map((stage) => ({
    id: stage.id,
    title: stage.title,
    summary: stage.body,
  }));
}
