"use client";

import { useHandoff } from "@/lib/roadsync/advisor";

import { CoordinationComposer } from "./coordination-composer";
import { ScenarioLab } from "./scenario-lab";

/** Opens the EXISTING composer / Scenario Lab with an Advisor prefill when one was handed off for this conflict. Nothing is created. */
export function PrefilledComposer({ conflictId }: { conflictId: string }) {
  const handoff = useHandoff("coordination", conflictId);
  return <CoordinationComposer key={handoff ? "prefilled" : "blank"} conflictId={conflictId} prefill={handoff} />;
}
export function PrefilledLab({ id }: { id: string }) {
  const handoff = useHandoff("simulator", id);
  return <ScenarioLab key={handoff ? "prefilled" : "blank"} id={id} prefill={handoff} />;
}
