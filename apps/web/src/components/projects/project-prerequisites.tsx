"use client";

import { Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { addProjectDependency, fetchProjectDependencies, removeProjectDependency, searchDependencyCandidates } from "@/lib/projects/dependency-api";
import { canEditDependencies, dependencyFailure, dependencyQueryKey, directionSentence } from "@/lib/projects/dependency-view";
import { getTimelineCopy } from "@/lib/projects/timeline-messages";
import { timelineQueryKey, type TimelineGroup } from "@/lib/projects/timeline-view";

export function ProjectPrerequisites({
  projectId,
  epoch,
  userId,
  roleKey,
  copy,
  group,
  sort,
  page,
}: {
  projectId: string;
  epoch: string;
  userId: string;
  roleKey: string;
  copy: ReturnType<typeof getTimelineCopy>;
  group: TimelineGroup;
  sort: "asc" | "desc";
  page: number;
}) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const removeButton = useRef<HTMLButtonElement | null>(null);
  const canEdit = canEditDependencies(roleKey);
  const list = useQuery({
    queryKey: dependencyQueryKey(epoch, userId, roleKey, projectId),
    enabled: Boolean(userId),
    retry: false,
    queryFn: () => fetchProjectDependencies(projectId),
  });
  const candidates = useQuery({
    queryKey: [...dependencyQueryKey(epoch, userId, roleKey, projectId), "candidates", term],
    enabled: canEdit && term.trim().length >= 2,
    retry: false,
    queryFn: () => searchDependencyCandidates(projectId, term.trim()),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: dependencyQueryKey(epoch, userId, roleKey, projectId) });
    void queryClient.invalidateQueries({ queryKey: timelineQueryKey(epoch, userId, roleKey, projectId, group, sort, page) });
  }

  function fail(error: unknown) {
    const status = error instanceof ApiError ? error.status : 503;
    const kind = dependencyFailure(status);
    setNotice(kind === "conflict" ? copy.prereqConflict : kind === "missing" ? copy.prereqMissing : kind === "denied" ? copy.prereqDenied : kind === "invalid" ? copy.invalid : copy.prereqUnavailable);
  }

  const add = useMutation({
    mutationFn: (prerequisiteProjectId: string) => addProjectDependency(projectId, prerequisiteProjectId, list.data?.graphRevision ?? 0),
    onSuccess: () => {
      setNotice(null);
      setTerm("");
      refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (dependencyId: string) => removeProjectDependency(projectId, dependencyId, list.data?.graphRevision ?? 0),
    onSuccess: () => {
      setPendingRemove(null);
      setNotice(copy.prereqRemoved);
      refresh();
      removeButton.current?.focus();
    },
    onError: fail,
  });

  useEffect(() => {
    if (!pendingRemove) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setPendingRemove(null);
      removeButton.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingRemove]);

  const links = list.data?.links ?? [];
  return (
    <section className="auth-access-card project-timeline-prereq" aria-labelledby="timeline-prerequisites">
      <h2 id="timeline-prerequisites">{copy.prerequisites}</h2>
      <p>{copy.dependencies}</p>
      {list.isLoading ? <p role="status">{copy.loading}</p> : null}
      {list.isError ? <p role="alert">{copy.prereqUnavailable}</p> : null}
      {notice ? <p role="alert">{notice}</p> : null}
      {links.length === 0 && !list.isLoading ? <p>{copy.prereqEmpty}</p> : null}
      <ul>
        {links.map((link) => (
          <li key={link.id}>
            <Link2 aria-hidden="true" />
            {link.prerequisite.visibility === "visible" ? (
              <p>{directionSentence(link.prerequisite.projectCode, link.prerequisite.title)} {link.prerequisite.projectStatus}</p>
            ) : (
              <p>{copy.prereqRestricted}</p>
            )}
            {canEdit ? (
              <button
                ref={pendingRemove === link.id ? removeButton : undefined}
                type="button"
                className="auth-access-button"
                onClick={() => setPendingRemove(link.id)}
              >
                {copy.prereqRemove}
              </button>
            ) : null}
            {pendingRemove === link.id ? (
              <div role="dialog" aria-label={copy.prereqConfirm} onKeyDown={(event) => { if (event.key === "Escape") { setPendingRemove(null); removeButton.current?.focus(); } }}>
                <p>{copy.prereqConfirm}</p>
                <button type="button" className="auth-access-button" onClick={() => remove.mutate(link.id)}>{copy.prereqRemove}</button>
                <button type="button" className="auth-access-button" onClick={() => { setPendingRemove(null); removeButton.current?.focus(); }}>{copy.prereqCancel}</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form onSubmit={(event) => event.preventDefault()}>
          <label>
            {copy.prereqSearch}
            <input value={term} onChange={(event) => setTerm(event.target.value)} />
          </label>
          <ul>
            {(candidates.data ?? []).map((candidate) => (
              <li key={candidate.projectId}>
                <button type="button" className="auth-access-button" onClick={() => add.mutate(candidate.projectId)}>
                  {copy.prereqAdd} {candidate.projectCode} {candidate.title}
                </button>
              </li>
            ))}
          </ul>
        </form>
      ) : null}
    </section>
  );
}
