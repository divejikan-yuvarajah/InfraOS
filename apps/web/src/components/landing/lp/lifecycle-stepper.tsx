"use client";

import { CheckIcon } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS, LP_DEFAULT_STAGE_INDEX } from "@/lib/landing/lp-data";

import { RouteLine, SectionHeader } from "./atoms";

/** Eight-stage lifecycle. Buttons in a list with roving focus; arrow keys, Home and End move between stages. */
export function LifecycleStepper({ copy }: { copy: LpCopy["lifecycle"] }) {
  const [selected, setSelected] = useState(LP_DEFAULT_STAGE_INDEX);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = copy.stages.length;

  const focusStage = (index: number) => {
    const next = (index + count) % count;
    setSelected(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusStage(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusStage(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusStage(0);
        break;
      case "End":
        event.preventDefault();
        focusStage(count - 1);
        break;
      default:
    }
  };

  const activeStage = copy.stages[selected] ?? copy.stages[0];

  return (
    <section id={LP_ANCHORS.lifecycle} className="lp-section lp-section--card" aria-labelledby="lp-lifecycle-title">
      <div className="lp-container">
        <SectionHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="lp-lifecycle-title"
          medium
          aside={<p className="lp-sechead__aside">{copy.directive}</p>}
        />
        <div className="lp-stepper">
          <RouteLine progress={selected / (count - 1)} />
          <ol className="lp-stepper__list" aria-label={copy.listLabel}>
            {copy.stages.map((stage, index) => {
              const state = index < selected ? "done" : index === selected ? "active" : "todo";
              const number = String(index + 1).padStart(2, "0");
              return (
                <li key={stage.name}>
                  <button
                    ref={(node) => {
                      refs.current[index] = node;
                    }}
                    type="button"
                    className="lp-step"
                    data-state={state}
                    aria-current={index === selected ? "step" : undefined}
                    tabIndex={index === selected ? 0 : -1}
                    onClick={() => setSelected(index)}
                    onMouseEnter={() => setSelected(index)}
                    onFocus={() => setSelected(index)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                  >
                    {index === selected ? <span className="lp-step__badge">{copy.activeBadge}</span> : null}
                    <span className="lp-step__node">
                      {state === "done" ? <CheckIcon aria-hidden="true" width={18} height={18} /> : String(index + 1)}
                    </span>
                    <span className="lp-step__name">
                      {number}. {stage.name}
                    </span>
                    <span className="lp-step__desc">{stage.desc}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="lp-step__readout" aria-live="polite">
            <span className="lp-step__readout-tag">
              {String(selected + 1).padStart(2, "0")}. {activeStage.name} · {activeStage.tag}
            </span>
            <span className="lp-step__readout-desc">{activeStage.desc}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

