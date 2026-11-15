"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateProjectPublicRelease } from "@/lib/issues/api";

export function PublicReleaseCard({
  projectId,
  projectCode,
  title,
  initialIsPublic = false,
}: {
  projectId: string;
  projectCode: string;
  title: string;
  initialIsPublic?: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [showProgress, setShowProgress] = useState(true);
  const [showBudgetBand, setShowBudgetBand] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (nextPublic: boolean) =>
      updateProjectPublicRelease(projectId, {
        isPublic: nextPublic,
        slug: projectCode.toLowerCase(),
        showProgress,
        showBudgetBand,
        showCoordinates: true,
        safeTitle: title,
      }),
    onSuccess: (_data, nextPublic) => {
      setIsPublic(nextPublic);
      setSavedMsg(nextPublic ? "Published to Public Portal" : "Removed from Public Portal");
    },
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Public Transparency Release</h3>
          <p className="text-xs text-slate-500">Controls allowlisted visibility on /portal without exposing finance or internal notes.</p>
        </div>
        <button
          type="button"
          disabled={mut.isPending}
          onClick={() => mut.mutate(!isPublic)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            isPublic ? "bg-emerald-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {isPublic ? "Publicly Released (Click to Unpublish)" : "Publish to Public Portal"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />
          Show progress %
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showBudgetBand} onChange={(e) => setShowBudgetBand(e.target.checked)} />
          Show budget band
        </label>
        {savedMsg ? <span className="font-medium text-emerald-700">{savedMsg}</span> : null}
      </div>
    </div>
  );
}
