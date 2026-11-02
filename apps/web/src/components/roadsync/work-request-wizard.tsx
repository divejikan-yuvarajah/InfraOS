"use client";

import { useMemo, useRef, useState } from "react";
import { CheckIcon, CircleAlertIcon, Loader2Icon, SirenIcon } from "lucide-react";

import { fmt } from "@/lib/roadsync/assessment";
import type { NearbyOverlay } from "@/lib/roadsync/nearby";
import type { WorkRequestCopy } from "@/lib/roadsync/work-request-copy";
import {
  buildCreateBody,
  colomboLocalToUtc,
  formatColombo,
  formatPosition,
  parseGeometryText,
  stageHasErrors,
  stageOfField,
  STAGE_FIELDS,
  STAGES,
  startRule,
  summarizeGeometry,
  WORK_PRIORITIES,
  WORK_TYPES,
  WORKING_HOURS,
  type Stage,
  type WorkRequestFormErrors,
  type WorkRequestFormValues,
} from "@/lib/roadsync/work-requests-view";

import { ConflictPreview } from "./conflict-preview";
import { NearbyActivityPanel } from "./nearby-activity";
import { PriorityMark, WORK_TYPE_ICONS } from "./roadsync-shared";
import { LocationPicker } from "./work-map";

export type ProjectOption = { id: string; projectCode: string; title: string; agencyCode: string | null };
export type Pending = false | "save" | "submit";

/** Localized messages for the shared validation (buildCreateBody decides pass/fail; this only words the result). */
export function validateValues(values: WorkRequestFormValues, copy: WorkRequestCopy, geoValid: boolean | null): WorkRequestFormErrors {
  const built = buildCreateBody(values);
  const raw = built.ok ? {} : built.errors;
  const v = copy.validation;
  const out: WorkRequestFormErrors = {};
  if (raw.projectId) out.projectId = v.project;
  if (raw.workType) out.workType = v.workType;
  if (raw.priority) out.priority = v.priority;
  if (raw.coordinates) out.coordinates = v.coordinates;
  else if (geoValid === false) out.coordinates = v.coordinatesFix;
  if (raw.plannedStart) out.plannedStart = v.start;
  if (raw.plannedEnd) out.plannedEnd = colomboLocalToUtc(values.plannedEnd) && colomboLocalToUtc(values.plannedStart) ? v.endBefore : v.end;
  return out;
}

const pick = <T extends object>(errors: WorkRequestFormErrors, stage: Exclude<Stage, "review">): WorkRequestFormErrors =>
  Object.fromEntries(Object.entries(errors).filter(([k]) => (STAGE_FIELDS[stage] as string[]).includes(k)) as [keyof T, string][]) as WorkRequestFormErrors;

export function WorkRequestWizard({ mode, copy, values, setValues, errors, setErrors, projects, lockedProject, pending, onSave, onSubmit, onDiscard, submitNote }: {
  mode: "create" | "edit"; copy: WorkRequestCopy; values: WorkRequestFormValues; setValues: (next: (c: WorkRequestFormValues) => WorkRequestFormValues) => void;
  errors: WorkRequestFormErrors; setErrors: (next: (c: WorkRequestFormErrors) => WorkRequestFormErrors) => void;
  projects: { options: ProjectOption[]; pending: boolean; error: boolean }; lockedProject?: string | null; pending: Pending;
  onSave: () => void; onSubmit?: () => void; onDiscard?: () => void; submitNote?: string;
}) {
  const [stage, setStage] = useState<Stage>("basics");
  const [reached, setReached] = useState(0);
  const [geoValid, setGeoValid] = useState<boolean | null>(null);
  const [overlay, setOverlay] = useState<NearbyOverlay | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const index = STAGES.indexOf(stage);

  const set = <K extends keyof WorkRequestFormValues>(key: K, value: WorkRequestFormValues[K]) => {
    setValues((c) => ({ ...c, [key]: value }));
    setErrors((c) => ({ ...c, [key]: undefined }));
  };
  const aria = (k: keyof WorkRequestFormValues) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `rs-${k}-err` : undefined });

  const geometry = parseGeometryText(values.geometryKind, values.coordinates);
  const geoSummary = geometry.ok ? summarizeGeometry(geometry.geometry) : null;
  const startUtc = colomboLocalToUtc(values.plannedStart);
  const endUtc = colomboLocalToUtc(values.plannedEnd);
  const datesOk = Boolean(startUtc && endUtc && new Date(endUtc) >= new Date(startUtc));
  const rule = startRule(startUtc, values.isEmergency);
  const previewGeometry = geometry.ok && geoValid !== false ? geometry.geometry : null;
  const project = projects.options.find((p) => p.id === values.projectId);

  const all = useMemo(() => validateValues(values, copy, geoValid), [values, copy, geoValid]);
  const project_ok = !all.projectId;
  const checks = [
    { key: "project" as const, ok: project_ok },
    { key: "workType" as const, ok: !all.workType },
    { key: "location" as const, ok: !all.coordinates },
    { key: "dates" as const, ok: !all.plannedStart && !all.plannedEnd },
    { key: "hours" as const, ok: (WORKING_HOURS as readonly string[]).includes(values.workingHours) },
    { key: "startRule" as const, ok: rule === "ok" },
    { key: "geometry" as const, ok: geoValid !== false },
  ];
  const ready = checks.every((c) => c.ok);

  function go(next: Stage) {
    setStage(next);
    setReached((r) => Math.max(r, STAGES.indexOf(next)));
    window.setTimeout(() => panel.current?.focus(), 0);
  }
  function onNext() {
    if (stage === "review") return;
    const own = pick(all, stage);
    if (Object.keys(own).length) { setErrors((c) => ({ ...c, ...own })); return; }
    go(STAGES[index + 1] as Stage);
  }
  /** Jump to any stage already reached; leaving a stage with errors keeps the errors visible when you return. */
  function jump(target: Stage) {
    if (STAGES.indexOf(target) > reached) return;
    setErrors((c) => ({ ...c, ...(stage !== "review" ? pick(all, stage) : {}) }));
    go(target);
  }
  function guarded(run: () => void) {
    if (!ready) {
      setErrors((c) => ({ ...c, ...all }));
      const first = (Object.keys(all) as (keyof WorkRequestFormValues)[])[0];
      if (first) go(stageOfField(first));
      return;
    }
    run();
  }

  const busy = pending !== false;
  const geomKinds = ["Point", "LineString", "Polygon"] as const;

  return (
    <div className="rs-wiz">
      <nav aria-label={copy.create.progress}>
        <ol className="rs-stepper">
          {STAGES.map((s, i) => {
            const done = i < reached || (i < index);
            const bad = s !== "review" && i <= reached && i !== index && stageHasErrors(s, errors);
            return (
              <li key={s} className={`rs-stepper-item${i === index ? " is-current" : ""}${done ? " is-done" : ""}${bad ? " is-bad" : ""}`}>
                <button type="button" className="rs-stepper-btn" aria-current={i === index ? "step" : undefined} disabled={i > reached} onClick={() => jump(s)}>
                  <span className="rs-stepper-dot" aria-hidden="true">{bad ? <CircleAlertIcon /> : done && i !== index ? <CheckIcon /> : i + 1}</span>
                  <span className="rs-stepper-text"><strong>{copy.stages[s]}</strong><small>{copy.stageHelp[s]}</small></span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="rs-create">
        <div className="rs-form" ref={panel} tabIndex={-1} aria-live="polite">
          {stage === "basics" ? (
            <section className="rs-section" aria-labelledby="rs-s1">
              <div className="rs-section-head"><span className="rs-step" aria-hidden="true">1</span><h2 id="rs-s1">{copy.stages.basics}</h2></div>
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-projectId">{copy.fields.project}</label>
                {mode === "edit" ? (
                  <>
                    <p className="rs-input" aria-readonly="true">{lockedProject ?? "—"}</p>
                    <p className="rs-help">{copy.fields.projectLocked}</p>
                  </>
                ) : (
                  <>
                    <select id="rs-projectId" className="rs-input" value={values.projectId} onChange={(e) => set("projectId", e.target.value)} {...aria("projectId")}>
                      <option value="">{projects.pending ? copy.fields.projectLoading : copy.fields.projectChoose}</option>
                      {projects.options.map((p) => <option key={p.id} value={p.id}>{p.projectCode} · {p.title}</option>)}
                    </select>
                    {!projects.pending && !projects.error && projects.options.length === 0 ? <p className="rs-help">{copy.fields.projectNone}</p> : <p className="rs-help">{project ? `${project.agencyCode ?? "—"} · ${copy.fields.projectLocked}` : copy.fields.projectHelp}</p>}
                  </>
                )}
                {errors.projectId ? <p id="rs-projectId-err" className="rs-error">{errors.projectId}</p> : null}
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="rs-field">
                <legend className="rs-label" id="rs-workType">{copy.fields.workType}</legend>
                <div className="rs-cards" role="radiogroup" aria-labelledby="rs-workType" {...aria("workType")}>
                  {WORK_TYPES.map((t, i) => {
                    const Icon = WORK_TYPE_ICONS[t];
                    return (
                      <label key={t} className="rs-card-pick">
                        <input type="radio" name="workType" value={t} id={i === 0 ? "rs-workType-first" : undefined} checked={values.workType === t} onChange={() => set("workType", t)} />
                        <span className="rs-icon" aria-hidden="true"><Icon /></span>
                        {t.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                      </label>
                    );
                  })}
                </div>
                {errors.workType ? <p id="rs-workType-err" className="rs-error">{errors.workType}</p> : null}
              </fieldset>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="rs-field">
                <legend className="rs-label" id="rs-priority">{copy.fields.priority}</legend>
                <div className="rs-seg" role="radiogroup" aria-labelledby="rs-priority">
                  {WORK_PRIORITIES.map((p) => (
                    <label key={p} className="rs-card-pick">
                      <input type="radio" name="priority" value={p} checked={values.priority === p} onChange={() => set("priority", p)} />
                      <PriorityMark priority={p} />
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          ) : null}

          {stage === "location" ? (
            <section className="rs-section" aria-labelledby="rs-s2">
              <div className="rs-section-head"><span className="rs-step" aria-hidden="true">2</span><h2 id="rs-s2">{copy.stages.location}</h2></div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="rs-field">
                <legend className="rs-label">{copy.fields.geometryKind}</legend>
                <div className="rs-seg" role="radiogroup" aria-label={copy.fields.geometryKind}>
                  {geomKinds.map((k) => (
                    <label key={k} className="rs-card-pick">
                      <input type="radio" name="geometryKind" value={k} checked={values.geometryKind === k} onChange={() => set("geometryKind", k)} />
                      {copy.geometry[k]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <LocationPicker
                kind={values.geometryKind}
                coordinates={values.coordinates}
                onChange={(kind, text) => { setValues((c) => ({ ...c, geometryKind: kind, coordinates: text })); setErrors((c) => ({ ...c, coordinates: undefined, geometryKind: undefined })); }}
                onValidity={setGeoValid}
                overlay={overlay}
              />
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-coordinates">{copy.fields.coordinates}</label>
                <textarea id="rs-coordinates" className="rs-input" value={values.coordinates} onChange={(e) => set("coordinates", e.target.value)} spellCheck={false} placeholder={"79.8612, 6.9271\n79.8650, 6.9302"} {...aria("coordinates")} />
                <p className="rs-help">{copy.fields.coordinatesHelp}</p>
                {errors.coordinates ? <p id="rs-coordinates-err" className="rs-error">{errors.coordinates}</p> : null}
              </div>
              <NearbyActivityPanel mode="preview" compact self={{ workType: values.workType || null, plannedStart: datesOk ? startUtc : null, plannedEnd: datesOk ? endUtc : null, geometry: previewGeometry }} onOverlay={setOverlay} />
              <p className="rs-help">{copy.schedule.impactNote}</p>
            </section>
          ) : null}

          {stage === "schedule" ? (
            <section className="rs-section" aria-labelledby="rs-s3">
              <div className="rs-section-head"><span className="rs-step" aria-hidden="true">3</span><h2 id="rs-s3">{copy.stages.schedule}</h2></div>
              <p className="rs-help"><strong>{copy.schedule.tz}.</strong> {copy.schedule.tzHelp}</p>
              <div className="rs-two">
                <div className="rs-field">
                  <label className="rs-label" htmlFor="rs-plannedStart">{copy.fields.plannedStart}</label>
                  <input id="rs-plannedStart" type="datetime-local" className="rs-input" value={values.plannedStart} onChange={(e) => set("plannedStart", e.target.value)} {...aria("plannedStart")} />
                  {errors.plannedStart ? <p id="rs-plannedStart-err" className="rs-error">{errors.plannedStart}</p> : null}
                </div>
                <div className="rs-field">
                  <label className="rs-label" htmlFor="rs-plannedEnd">{copy.fields.plannedEnd}</label>
                  <input id="rs-plannedEnd" type="datetime-local" className="rs-input" value={values.plannedEnd} onChange={(e) => set("plannedEnd", e.target.value)} {...aria("plannedEnd")} />
                  {errors.plannedEnd ? <p id="rs-plannedEnd-err" className="rs-error">{errors.plannedEnd}</p> : null}
                </div>
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="rs-field">
                <legend className="rs-label" id="rs-workingHours">{copy.fields.workingHours}</legend>
                <div className="rs-cards" role="radiogroup" aria-labelledby="rs-workingHours">
                  {WORKING_HOURS.map((h) => (
                    <label key={h} className="rs-card-pick">
                      <input type="radio" name="workingHours" value={h} checked={values.workingHours === h} onChange={() => set("workingHours", h)} />
                      <span><strong>{copy.hours[h][0]}</strong><small style={{ display: "block", fontWeight: 400 }}>{copy.hours[h][1]}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="rs-field">
                <label className={`rs-emergency${values.isEmergency ? " is-on" : ""}`}>
                  <input type="checkbox" checked={values.isEmergency} onChange={(e) => set("isEmergency", e.target.checked)} />
                  <SirenIcon aria-hidden="true" />
                  <span><strong>{copy.fields.emergency}</strong><small>{copy.schedule.emergencyHelp}</small></span>
                </label>
              </div>
              <div className="rs-notice" role="note">
                <p style={{ margin: 0 }}>{values.isEmergency ? copy.schedule.ruleEmergency : copy.schedule.ruleNormal} {copy.schedule.serverFinal}</p>
              </div>
              {rule !== "ok" ? <p className="rs-error" role="status">{rule === "past" ? copy.schedule.pastWarn : copy.schedule.emergencyOldWarn}</p> : null}
              <ConflictPreview variant="compact" geometry={previewGeometry} plannedStart={datesOk ? startUtc : null} plannedEnd={datesOk ? endUtc : null} workType={values.workType} priority={values.priority} />
            </section>
          ) : null}

          {stage === "review" ? (
            <section className="rs-section" aria-labelledby="rs-s4">
              <div className="rs-section-head"><span className="rs-step" aria-hidden="true">4</span><h2 id="rs-s4">{copy.review.heading}</h2></div>
              <p className={ready ? "rs-help" : "rs-error"} role="status">{ready ? copy.review.ready : copy.review.notReady}</p>
              <ul className="rs-checklist" aria-label={copy.review.checklist}>
                {checks.map((c) => (
                  <li key={c.key} className={c.ok ? "is-ok" : "is-bad"}>
                    {c.ok ? <CheckIcon aria-hidden="true" /> : <CircleAlertIcon aria-hidden="true" />}
                    <span>{copy.review.items[c.key]}</span>
                    <em>{c.ok ? copy.review.ok : copy.review.fix}</em>
                    {!c.ok ? <button type="button" className="rs-btn" onClick={() => go(c.key === "project" || c.key === "workType" ? "basics" : c.key === "location" || c.key === "geometry" ? "location" : "schedule")}>{copy.actions.goTo}</button> : null}
                  </li>
                ))}
              </ul>
              {rule !== "ok" ? <p className="rs-error">{rule === "past" ? copy.schedule.pastWarn : copy.schedule.emergencyOldWarn}</p> : null}
              <p className="rs-help">{copy.review.savedNotSubmitted}</p>
              {submitNote ? <p className="rs-help">{submitNote}</p> : null}
            </section>
          ) : null}

          <div className="rs-actions rs-wiz-bar">
            {index > 0 ? <button type="button" className="rs-btn" onClick={() => go(STAGES[index - 1] as Stage)} disabled={busy}>{copy.actions.back}</button> : null}
            {stage !== "review" ? <button type="button" className="rs-btn is-primary" onClick={onNext} disabled={busy}>{copy.actions.next}</button> : (
              <>
                <button type="button" className="rs-btn" onClick={() => guarded(onSave)} disabled={busy} aria-busy={pending === "save"}>
                  {pending === "save" ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
                  {pending === "save" ? copy.actions.saving : mode === "edit" ? copy.actions.saveChanges : copy.actions.saveDraft}
                </button>
                {onSubmit ? (
                  <button type="button" className="rs-btn is-primary" onClick={() => guarded(onSubmit)} disabled={busy || rule !== "ok"} aria-busy={pending === "submit"}>
                    {pending === "submit" ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
                    {pending === "submit" ? copy.actions.submitting : copy.actions.submit}
                  </button>
                ) : null}
              </>
            )}
            {onDiscard ? <button type="button" className="rs-btn" onClick={onDiscard} disabled={busy}>{copy.actions.discard}</button> : null}
          </div>
        </div>

        <aside className="rs-summary" aria-label={copy.review.summary}>
          <h2>{copy.review.summary}</h2>
          <dl className="rs-dl">
            <div><dt>{copy.fields.project}</dt><dd>{project ? `${project.projectCode} · ${project.title}` : lockedProject ?? "—"}</dd></div>
            <div><dt>{copy.fields.workType}</dt><dd>{values.workType ? values.workType.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—"} · {values.priority}</dd></div>
            <div><dt>{copy.stages.location}</dt><dd>{geoSummary ? `${copy.geometry[geoSummary.label as keyof typeof copy.geometry] ?? geoSummary.label}, ${geoSummary.vertices}${geoSummary.lengthKm !== null ? `, ~${geoSummary.lengthKm.toFixed(2)} km` : ""}` : "—"}{geoSummary?.outline[0] ? <><br />{formatPosition(geoSummary.outline[0])}</> : null}</dd></div>
            <div><dt>{copy.stages.schedule}</dt><dd>{startUtc && endUtc ? `${formatColombo(startUtc)} → ${formatColombo(endUtc)}` : "—"}</dd></div>
            <div><dt>{copy.fields.workingHours}</dt><dd>{copy.hours[values.workingHours][0]}</dd></div>
            <div><dt>{copy.fields.emergency}</dt><dd>{values.isEmergency ? copy.review.emergencyOn : copy.review.emergencyOff}</dd></div>
            <div><dt>{copy.review.statusOnSave}</dt><dd>{copy.review.draft}</dd></div>
          </dl>
          <p className="rs-help">{fmt("{n}/4", { n: index + 1 })}</p>
        </aside>
      </div>
    </div>
  );
}
