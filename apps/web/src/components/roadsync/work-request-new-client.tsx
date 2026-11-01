"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2Icon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { fetchProjects } from "@/lib/projects/api";
import { classifyWorkRequestError, createWorkRequest, FAILURE_COPY } from "@/lib/roadsync/api";
import {
  buildCreateBody,
  canHintCreate,
  ELIGIBLE_PROJECT_STATUSES,
  EMPTY_FORM,
  firstInvalidField,
  formatColombo,
  formatPosition,
  parseGeometryText,
  PRIORITY_LABELS,
  summarizeGeometry,
  WORK_PRIORITIES,
  WORK_TYPE_LABELS,
  WORK_TYPES,
  workRequestQueryKey,
  colomboLocalToUtc,
  type GeometryKind,
  type WorkRequestFormErrors,
  type WorkRequestFormValues,
} from "@/lib/roadsync/work-requests-view";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";

import { PriorityMark, WORK_TYPE_ICONS } from "./roadsync-shared";
import type { NearbyOverlay } from "@/lib/roadsync/nearby";
import { ConflictPreview } from "./conflict-preview";
import { NearbyActivityPanel } from "./nearby-activity";
import { LocationPicker } from "./work-map";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

const FIELD_LABEL: Record<keyof WorkRequestFormValues, string> = {
  projectId: "Project",
  workType: "Work type",
  priority: "Priority",
  geometryKind: "Geometry type",
  coordinates: "Coordinates",
  plannedStart: "Planned start",
  plannedEnd: "Planned end",
};

const KIND_HELP: Record<GeometryKind, string> = {
  Point: "One location. Enter a single line.",
  LineString: "A corridor. Enter two or more vertices in order, one per line.",
  Polygon: "A work area. Enter three or more corners; the shape closes automatically.",
};

export function WorkRequestNewClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [values, setValues] = useState<WorkRequestFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<WorkRequestFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  // Step 67: the server geometry check (null = not checked yet or unavailable; the API rechecks on create).
  const [geoValid, setGeoValid] = useState<boolean | null>(null);
  const [overlay, setOverlay] = useState<NearbyOverlay | null>(null);

  const projects = useQuery({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, "project-options"),
    queryFn: () => fetchProjects({ page: 1, limit: 25, sortBy: "title", sortDir: "asc" }),
    enabled: Boolean(userId),
    retry: false,
  });
  const eligible = useMemo(
    () => (projects.data?.projects ?? []).filter((p) => (ELIGIBLE_PROJECT_STATUSES as readonly string[]).includes(p.status)),
    [projects.data],
  );
  const project = eligible.find((p) => p.id === values.projectId);

  const mutation = useMutation({
    mutationFn: createWorkRequest,
    retry: false,
    onSuccess: (record) => {
      void queryClient.invalidateQueries({ queryKey: ["roadsync", "work-requests"] });
      router.push(`/roadsync/work-requests/${record.id}?created=1`);
    },
    onError: (error) => {
      submitting.current = false;
      const kind = classifyWorkRequestError(error);
      setServerError(FAILURE_COPY[kind]);
      queryClient.removeQueries({ queryKey: ["roadsync", "work-requests"], type: "inactive" });
      window.setTimeout(() => summaryRef.current?.focus(), 0);
    },
  });

  const set = <K extends keyof WorkRequestFormValues>(key: K, value: WorkRequestFormValues[K]) => {
    setValues((c) => ({ ...c, [key]: value }));
    setErrors((c) => ({ ...c, [key]: undefined }));
  };

  const geometry = parseGeometryText(values.geometryKind, values.coordinates);
  const geoSummary = geometry.ok ? summarizeGeometry(geometry.geometry) : null;
  const startUtc = colomboLocalToUtc(values.plannedStart);
  const endUtc = colomboLocalToUtc(values.plannedEnd);
  const datesOk = Boolean(startUtc && endUtc && new Date(endUtc) >= new Date(startUtc));
  const previewGeometry = geometry.ok && geoValid !== false ? geometry.geometry : null;
  const previewStart = datesOk ? startUtc : null;
  const previewEnd = datesOk ? endUtc : null;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || mutation.isPending) return;
    setServerError(null);
    const built = buildCreateBody(values);
    if (!built.ok) {
      setErrors(built.errors);
      const first = firstInvalidField(built.errors);
      window.setTimeout(() => {
        summaryRef.current?.focus();
        if (first) document.getElementById(`rs-${first}`)?.setAttribute("data-first-invalid", "true");
      }, 0);
      return;
    }
    if (geoValid === false) {
      setErrors({ coordinates: "Fix the location problems shown under the map." });
      window.setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setErrors({});
    submitting.current = true;
    mutation.mutate(built.body);
  }

  const errorEntries = (Object.keys(errors) as (keyof WorkRequestFormValues)[]).filter((k) => errors[k]);
  const aria = (k: keyof WorkRequestFormValues) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `rs-${k}-err` : undefined });

  if (roleKey && !canHintCreate(roleKey)) {
    return (
      <StaffWorkspaceShell title="Create work request" description="Draft a planned work request linked to one of your projects." wide>
        <div className="rs-state" role="alert">
          <h2>Your role cannot create work requests</h2>
          <p>{FAILURE_COPY.forbidden}</p>
          <Link href="/roadsync/work-requests" className="rs-btn">Back to work requests</Link>
        </div>
      </StaffWorkspaceShell>
    );
  }

  return (
    <StaffWorkspaceShell title="Create work request" description="Draft a planned work request linked to one of your projects. It is saved as a draft; nothing is submitted. The conflict preview is advisory." wide>
      <div className="rs-page">
        <p className="rs-crumb">Operations / RoadSync / New</p>
        {errorEntries.length > 0 || serverError ? (
          <div ref={summaryRef} className="rs-errsum" role="alert" tabIndex={-1}>
            <h2>{serverError ? "The work request was not created" : `Fix ${errorEntries.length} ${errorEntries.length === 1 ? "field" : "fields"} to continue`}</h2>
            {serverError ? <p style={{ margin: 0 }}>{serverError}</p> : null}
            <ul>
              {errorEntries.map((k) => (
                <li key={k}>
                  <a href={`#rs-${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(`rs-${k}`)?.focus(); }}>{FIELD_LABEL[k]}</a>: {errors[k]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form className="rs-create" onSubmit={onSubmit} noValidate>
          <div className="rs-form">
            <section className="rs-section" aria-labelledby="rs-s1">
              <div className="rs-section-head"><span className="rs-step" aria-hidden="true">1</span><h2 id="rs-s1">Project and work</h2></div>
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-projectId">Project</label>
                <select id="rs-projectId" className="rs-input" value={values.projectId} onChange={(e) => set("projectId", e.target.value)} {...aria("projectId")}>
                  <option value="">{projects.isPending ? "Loading projects…" : "Choose a project"}</option>
                  {eligible.map((p) => (
                    <option key={p.id} value={p.id}>{p.projectCode} · {p.title}</option>
                  ))}
                </select>
                {projects.isError ? <p className="rs-error">Projects could not be loaded. Reload the page to retry.</p> : null}
                {!projects.isPending && !projects.isError && eligible.length === 0 ? <p className="rs-help">No approved or active projects are available to you yet.</p> : null}
                {project ? <p className="rs-help">Agency (from the project): <strong>{project.agencyCode ?? "—"}</strong>. It cannot be changed here.</p> : <p className="rs-help">Only approved, active, on-hold or delayed projects you can manage are listed.</p>}
                {errors.projectId ? <p id="rs-projectId-err" className="rs-error">{errors.projectId}</p> : null}
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="rs-field">
                <legend className="rs-label" id="rs-workType">Work type</legend>
                <div className="rs-cards" role="radiogroup" aria-labelledby="rs-workType" {...aria("workType")}>
                  {WORK_TYPES.map((t, i) => {
                    const Icon = WORK_TYPE_ICONS[t];
                    return (
                      <label key={t} className="rs-card-pick">
                        <input type="radio" name="workType" value={t} id={i === 0 ? "rs-workType-first" : undefined} checked={values.workType === t} onChange={() => set("workType", t)} />
                        <span className="rs-icon" aria-hidden="true"><Icon /></span>
                        {WORK_TYPE_LABELS[t]}
                      </label>
                    );
                  })}
                </div>
                {errors.workType ? <p id="rs-workType-err" className="rs-error">{errors.workType}</p> : null}
              </fieldset>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="rs-field">
                <legend className="rs-label" id="rs-priority">Priority</legend>
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

            <section className="rs-section" aria-labelledby="rs-s2">
              <div className="rs-section-head"><span className="rs-step" aria-hidden="true">2</span><h2 id="rs-s2">Location geometry</h2></div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="rs-field">
                <legend className="rs-label">Geometry type</legend>
                <div className="rs-seg" role="radiogroup" aria-label="Geometry type">
                  {(["Point", "LineString", "Polygon"] as const).map((k) => (
                    <label key={k} className="rs-card-pick">
                      <input type="radio" name="geometryKind" value={k} checked={values.geometryKind === k} onChange={() => set("geometryKind", k)} />
                      {k === "Point" ? "Point" : k === "LineString" ? "Line (corridor)" : "Area (polygon)"}
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
                <label className="rs-label" htmlFor="rs-coordinates">Coordinates — longitude, latitude</label>
                <textarea id="rs-coordinates" className="rs-input" value={values.coordinates} onChange={(e) => set("coordinates", e.target.value)} spellCheck={false} placeholder={"79.8612, 6.9271\n79.8650, 6.9302"} {...aria("coordinates")} />
                <p className="rs-help">{KIND_HELP[values.geometryKind]} Longitude comes first (Sri Lanka is about 79–82, 5–10).</p>
                {errors.coordinates ? <p id="rs-coordinates-err" className="rs-error">{errors.coordinates}</p> : null}
              </div>
              <NearbyActivityPanel
                mode="preview"
                compact
                self={{ workType: values.workType || null, plannedStart: startUtc && endUtc && new Date(endUtc) >= new Date(startUtc) ? startUtc : null, plannedEnd: startUtc && endUtc && new Date(endUtc) >= new Date(startUtc) ? endUtc : null, geometry: geometry.ok && geoValid !== false ? geometry.geometry : null }}
                onOverlay={setOverlay}
              />
              <ConflictPreview variant="compact" geometry={previewGeometry} plannedStart={previewStart} plannedEnd={previewEnd} workType={values.workType} priority={values.priority} />
              <p className="rs-help">Nearby activity is advisory and never blocks saving.</p>
            </section>

            <section className="rs-section" aria-labelledby="rs-s3">
              <div className="rs-section-head"><span className="rs-step" aria-hidden="true">3</span><h2 id="rs-s3">Planned dates</h2></div>
              <div className="rs-two">
                <div className="rs-field">
                  <label className="rs-label" htmlFor="rs-plannedStart">Planned start (Colombo time)</label>
                  <input id="rs-plannedStart" type="datetime-local" className="rs-input" value={values.plannedStart} onChange={(e) => set("plannedStart", e.target.value)} {...aria("plannedStart")} />
                  {errors.plannedStart ? <p id="rs-plannedStart-err" className="rs-error">{errors.plannedStart}</p> : null}
                </div>
                <div className="rs-field">
                  <label className="rs-label" htmlFor="rs-plannedEnd">Planned end (Colombo time)</label>
                  <input id="rs-plannedEnd" type="datetime-local" className="rs-input" value={values.plannedEnd} onChange={(e) => set("plannedEnd", e.target.value)} {...aria("plannedEnd")} />
                  {errors.plannedEnd ? <p id="rs-plannedEnd-err" className="rs-error">{errors.plannedEnd}</p> : null}
                </div>
              </div>
              <p className="rs-help">Times are read as Sri Lanka time (UTC+05:30) and stored as UTC.</p>
            </section>

            <div className="rs-actions">
              <button type="submit" className="rs-btn is-primary" disabled={mutation.isPending} aria-busy={mutation.isPending}>
                {mutation.isPending ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
                {mutation.isPending ? "Creating draft…" : "Create draft"}
              </button>
              <Link href="/roadsync/work-requests" className="rs-btn" aria-disabled={mutation.isPending}>Cancel</Link>
            </div>
          </div>

          <aside className="rs-summary" aria-label="Draft summary">
            <h2>Draft summary</h2>
            <dl className="rs-dl">
              <div><dt>Project</dt><dd>{project ? `${project.projectCode} · ${project.title}` : "Not chosen"}</dd></div>
              <div><dt>Agency</dt><dd>{project?.agencyCode ?? "Set from the project"}</dd></div>
              <div><dt>Work</dt><dd>{values.workType ? WORK_TYPE_LABELS[values.workType as keyof typeof WORK_TYPE_LABELS] : "Not chosen"} · {PRIORITY_LABELS[values.priority as keyof typeof PRIORITY_LABELS] ?? "—"}</dd></div>
              <div>
                <dt>Geometry</dt>
                <dd>
                  {geoSummary
                    ? `${geoSummary.label}, ${geoSummary.vertices} ${geoSummary.vertices === 1 ? "vertex" : "vertices"}${geoSummary.lengthKm !== null ? `, about ${geoSummary.lengthKm.toFixed(2)} km` : ""}`
                    : "Not entered"}
                  {geoSummary?.outline[0] ? <><br />{formatPosition(geoSummary.outline[0])}</> : null}
                </dd>
              </div>
              <div><dt>Window</dt><dd>{startUtc && endUtc ? `${formatColombo(startUtc)} → ${formatColombo(endUtc)}` : "Not set"}</dd></div>
              <div><dt>Status on save</dt><dd>Draft</dd></div>
            </dl>
            <ConflictPreview variant="review" geometry={previewGeometry} plannedStart={previewStart} plannedEnd={previewEnd} workType={values.workType} priority={values.priority} />
          </aside>
        </form>
      </div>
    </StaffWorkspaceShell>
  );
}
