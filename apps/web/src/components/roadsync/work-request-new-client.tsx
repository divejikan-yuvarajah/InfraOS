"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { fetchProjects } from "@/lib/projects/api";
import { classifyWorkRequestError, createWorkRequest, submitWorkRequest, type WorkRequestFailureKind } from "@/lib/roadsync/api";
import { buildCreateBody, canHintCreate, ELIGIBLE_PROJECT_STATUSES, EMPTY_FORM, workRequestQueryKey, type WorkRequestFormErrors, type WorkRequestFormValues } from "@/lib/roadsync/work-requests-view";
import { getWorkRequestCopy, type WorkRequestCopy } from "@/lib/roadsync/work-request-copy";
import { fmt } from "@/lib/roadsync/assessment";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { WorkRequestWizard, type Pending } from "./work-request-wizard";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export const failureText = (copy: WorkRequestCopy, kind: WorkRequestFailureKind): string =>
  ({ forbidden: copy.failures.forbidden, "not-found": copy.failures.notFound, conflict: copy.failures.conflict, invalid: copy.failures.invalid, auth: copy.failures.auth, unavailable: copy.failures.unavailable })[kind];

/**
 * Create flow: one shared form state across four stages. "Save Draft" creates a draft. "Submit for Coordination" is
 * an explicit save-then-submit: if the draft is saved but the submit fails, the draft is kept and the user lands on
 * its detail page with the reason instead of losing the work or being told nothing was saved.
 */
export function WorkRequestNewClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [locale] = useWorkspaceLocale();
  const copy = getWorkRequestCopy(locale);
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [values, setValues] = useState<WorkRequestFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<WorkRequestFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const projects = useQuery({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, "project-options"),
    queryFn: () => fetchProjects({ page: 1, limit: 25, sortBy: "title", sortDir: "asc" }),
    enabled: Boolean(userId),
    retry: false,
  });
  const options = useMemo(() => (projects.data?.projects ?? []).filter((p) => (ELIGIBLE_PROJECT_STATUSES as readonly string[]).includes(p.status)), [projects.data]);

  const mutation = useMutation({ mutationFn: createWorkRequest, retry: false });

  async function run(kind: Exclude<Pending, false>) {
    if (busy.current) return;
    const built = buildCreateBody(values);
    if (!built.ok) return;
    busy.current = true;
    setPending(kind);
    setServerError(null);
    let created;
    try {
      created = await mutation.mutateAsync(built.body);
    } catch (error) {
      busy.current = false;
      setPending(false);
      setServerError(failureText(copy, classifyWorkRequestError(error)));
      window.setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["roadsync", "work-requests"] });
    if (kind === "save") return router.push(`/roadsync/work-requests/${created.id}?created=1`);
    try {
      const submitted = await submitWorkRequest(created.id, created.revision);
      router.push(`/roadsync/work-requests/${submitted.id}?submitted=1`);
    } catch (error) {
      // Partial success: the draft exists. Say so plainly and hand over to the detail page.
      const kindOfError = classifyWorkRequestError(error);
      const reason = kindOfError === "invalid" ? copy.failures.submitDate : failureText(copy, kindOfError);
      router.push(`/roadsync/work-requests/${created.id}?created=1&submitFailed=${encodeURIComponent(reason)}`);
    }
  }

  const errorEntries = (Object.keys(errors) as (keyof WorkRequestFormValues)[]).filter((k) => errors[k]);

  if (roleKey && !canHintCreate(roleKey)) {
    return (
      <StaffWorkspaceShell title={copy.create.title} description={copy.create.description} wide>
        <div className="rs-state" role="alert">
          <h2>{copy.create.roleDenied}</h2>
          <p>{copy.create.roleDeniedBody}</p>
          <Link href="/roadsync/work-requests" className="rs-btn">{copy.create.back}</Link>
        </div>
      </StaffWorkspaceShell>
    );
  }

  return (
    <StaffWorkspaceShell title={copy.create.title} description={copy.create.description} wide>
      <div className="rs-page">
        <p className="rs-crumb">{copy.create.crumb}</p>
        {errorEntries.length > 0 || serverError ? (
          <div ref={summaryRef} className="rs-errsum" role="alert" tabIndex={-1}>
            <h2>{serverError ? copy.create.errSummaryServer : fmt(copy.create.errSummary, { n: errorEntries.length })}</h2>
            {serverError ? <p style={{ margin: 0 }}>{serverError}</p> : null}
            <ul>{errorEntries.map((k) => <li key={k}>{errors[k]}</li>)}</ul>
          </div>
        ) : null}
        <WorkRequestWizard
          mode="create"
          copy={copy}
          values={values}
          setValues={setValues}
          errors={errors}
          setErrors={setErrors}
          projects={{ options, pending: projects.isPending, error: projects.isError }}
          pending={pending}
          onSave={() => void run("save")}
          onSubmit={() => void run("submit")}
        />
        <p className="rs-help"><Link href="/roadsync/work-requests">{copy.actions.cancel}</Link></p>
      </div>
    </StaffWorkspaceShell>
  );
}
