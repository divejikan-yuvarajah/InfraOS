"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { fetchRequestAdvice } from "@/lib/roadsync/advisor-api";
import { getAdvisorCopy } from "@/lib/roadsync/advisor-copy";
import "@/styles/mission-control-roadsync-advisor.css";

/** On-demand only: nothing is computed until the user presses Analyse. Hidden to anyone the API does not serve. */
export function RequestAdvisorCard({ requestId }: { requestId: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getAdvisorCopy(locale);
  const run = useMutation({ mutationFn: () => fetchRequestAdvice(requestId) });
  if (run.error instanceof ApiError && (run.error.status === 404 || run.error.status === 403)) return null;
  const a = run.data;
  return (
    <section className="ad-coord" aria-label={copy.request.title}>
      <h3 className="ad-h">{copy.request.title}</h3>
      <p className="rs-help">{copy.ribbon}</p>
      {!a ? <button type="button" className="rs-btn" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}{copy.request.analyse}</button> : (
        <>
          <p>{a.requestPlan ? fmt(copy.request.fixes, { days: `${a.requestPlan.shiftDays > 0 ? "+" : ""}${a.requestPlan.shiftDays}`, n: a.requestPlan.fixes, m: a.requestPlan.of }) : copy.request.none}</p>
          {a.conflictId ? <Link className="rs-btn is-primary" href={`/roadsync/conflicts/${a.conflictId}?tab=advisor`}>{copy.request.open}</Link> : null}
        </>
      )}
      {run.isError ? <p className="rz-warn" role="alert">{copy.failed}</p> : null}
    </section>
  );
}
