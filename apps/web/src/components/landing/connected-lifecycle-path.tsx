import { LifecycleStageIcon } from "@/components/landing/lifecycle-stage-icon";
import { LIFECYCLE_STAGE_IDS } from "@/lib/landing/lifecycle-stages";
import type { PublicLandingCopy } from "@/lib/landing/messages";

/** Accessible connected-route lifecycle — all stage text visible without interaction. */
export function ConnectedLifecyclePath({
  copy,
  labelledBy,
}: {
  copy: PublicLandingCopy;
  labelledBy: string;
}) {
  const stages = LIFECYCLE_STAGE_IDS.map((id) => copy.lifecycle.stages.find((s) => s.id === id)).filter(
    (stage): stage is (typeof copy.lifecycle.stages)[number] => Boolean(stage),
  );

  return (
    <div className="cf-lifecycle-path">
      <ol className="cf-lifecycle-path__desktop" aria-labelledby={labelledBy}>
        {stages.map((stage, index) => (
          <li key={stage.id} className="cf-lifecycle-path__stage">
            <div className="cf-lifecycle-path__node" aria-hidden>
              <span className="cf-lifecycle-path__num">{index + 1}</span>
              <LifecycleStageIcon stageId={stage.id} className="cf-lifecycle-path__icon" />
            </div>
            <div className="cf-lifecycle-path__copy">
              <h3 className="cf-lifecycle-path__title">{stage.title}</h3>
              <p className="cf-lifecycle-path__body">{stage.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <ol className="cf-lifecycle-path__mobile" aria-labelledby={labelledBy}>
        {stages.map((stage, index) => (
          <li key={stage.id} className="cf-lifecycle-path__mobile-step">
            <div className="cf-lifecycle-path__mobile-rail" aria-hidden>
              <span className="cf-lifecycle-path__mobile-dot">
                <LifecycleStageIcon stageId={stage.id} className="size-4" />
              </span>
              {index < stages.length - 1 ? <span className="cf-lifecycle-path__mobile-line" /> : null}
            </div>
            <div className="cf-lifecycle-path__mobile-copy">
              <p className="cf-lifecycle-path__mobile-index">
                {copy.lifecycle.stageLabel} {index + 1}
              </p>
              <h3 className="cf-lifecycle-path__title">{stage.title}</h3>
              <p className="cf-lifecycle-path__body">{stage.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
