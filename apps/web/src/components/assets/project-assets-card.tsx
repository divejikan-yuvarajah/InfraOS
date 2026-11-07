"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { fetchAssets } from "@/lib/assets/api";
import { getAssetCopy } from "@/lib/assets/messages";
import { hintConvert, useAssetKeys } from "@/lib/assets/session";
import { fill } from "@/lib/assets/view";
import { failureOf } from "@/lib/assets/api";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { ConditionChip } from "./asset-ui";

/** Read-only "Assets" card on the project overview. The directory is scope-filtered by the server; a 403 or empty result for a non-completed project renders nothing. */
export function ProjectAssetsCard({ projectId, status }: { projectId: string; status: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getAssetCopy(locale);
  const { key, roleKey } = useAssetKeys();
  const q = useQuery({ queryKey: key("project-assets", projectId), queryFn: ({ signal }) => fetchAssets({ projectId, limit: 5, sort: "name" }, signal), retry: false });
  if (q.isError && failureOf(q.error).status !== 0) return null;
  const rows = q.data?.rows ?? [];
  const canConvert = status === "COMPLETED" && hintConvert(roleKey);
  if (!q.data) return null;
  if (rows.length === 0 && !canConvert) return null;
  return (
    <section className="sp-surface spp-panel" aria-label={copy.nav.assets}>
      <h3>{copy.nav.assets}</h3>
      {rows.length === 0 ? <p>{copy.wizard.description}</p> : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
          {rows.map((a) => <li key={a.id}><Link className="ins-link" href={`/assets/${a.id}`}>{a.assetNo ?? "—"} · {a.name}</Link> <ConditionChip value={a.condition} copy={copy} /></li>)}
        </ul>
      )}
      {rows.length > 0 ? <p className="ins-muted">{fill(copy.common.total, { n: q.data.total })}</p> : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {rows.length > 0 ? <Link className="ctr-btn" href={`/assets?projectId=${projectId}`}>{copy.nav.assets} →</Link> : null}
        {canConvert && rows.length === 0 ? <Link className="ctr-btn is-primary" href={`/assets/convert?projectId=${projectId}`}>{copy.nav.convert}</Link> : null}
      </div>
    </section>
  );
}
