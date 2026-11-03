import { CircleCheckIcon, CircleXIcon, HardHatIcon, LayersIcon, NetworkIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS } from "@/lib/landing/lp-data";

import { FigureCaption, SectionHeader } from "./atoms";

const BEFORE_ICONS = [TriangleAlertIcon, HardHatIcon, TriangleAlertIcon];
const AFTER_ICONS = [NetworkIcon, LayersIcon, ShieldCheckIcon];

export function ProblemSolutionSection({ copy }: { copy: LpCopy["problem"] }) {
  return (
    <section id={LP_ANCHORS.problem} className="lp-section lp-section--canvas" aria-labelledby="lp-problem-title">
      <div className="lp-container">
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} id="lp-problem-title" wide />
        <FigureCaption
          src="/landing/lp/trench-excavation.jpg"
          alt={copy.imageAlt}
          sizes="(min-width: 1280px) 1184px, 100vw"
          label={copy.plateLabel}
          caption={copy.plateCaption}
          chip={copy.plateChip}
          dot="var(--lp-attention)"
        />
        <div className="lp-compare">
          <div className="lp-card lp-compare__card">
            <div>
              <div className="lp-compare__head">
                <span className="lp-compare__title lp-compare__title--bad">
                  <span className="lp-dot" style={{ background: "var(--lp-critical)", width: 12, height: 12 }} aria-hidden="true" />
                  {copy.beforeTitle}
                </span>
                <span className="lp-compare__tag">{copy.beforeTag}</span>
              </div>
              <ul className="lp-compare__items">
                {copy.beforeItems.map((item, index) => {
                  const Icon = BEFORE_ICONS[index];
                  return (
                    <li key={item.title} className="lp-compare__item lp-compare__item--bad">
                      <Icon aria-hidden="true" />
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="lp-compare__outcome lp-compare__outcome--bad">
              <span>{copy.beforeOutcome}</span>
              <CircleXIcon aria-hidden="true" />
            </div>
          </div>
          <div className="lp-card lp-compare__card">
            <div>
              <div className="lp-compare__head">
                <span className="lp-compare__title lp-compare__title--good">
                  <span className="lp-dot" style={{ background: "var(--lp-success)", width: 12, height: 12 }} aria-hidden="true" />
                  {copy.afterTitle}
                </span>
                <span className="lp-compare__tag lp-compare__tag--good">{copy.afterTag}</span>
              </div>
              <ul className="lp-compare__items">
                {copy.afterItems.map((item, index) => {
                  const Icon = AFTER_ICONS[index];
                  return (
                    <li key={item.title} className="lp-compare__item lp-compare__item--good">
                      <Icon aria-hidden="true" />
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="lp-compare__outcome lp-compare__outcome--good">
              <span>{copy.afterOutcome}</span>
              <CircleCheckIcon aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

