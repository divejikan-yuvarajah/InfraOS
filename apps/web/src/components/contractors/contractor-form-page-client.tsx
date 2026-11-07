"use client";

import { useQuery } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { ApiError } from "@/lib/api/client";
import { fetchProfile } from "@/lib/contractors/api";
import { canHintManage } from "@/lib/contractors/list-query";
import { getContractorCopy } from "@/lib/contractors/messages";
import { useContractorKeys } from "@/lib/contractors/session";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import "@/styles/site-plan-projects.css";
import "@/styles/contractors.css";

import { Skeleton } from "./contractor-badges";
import { ContractorForm } from "./contractor-form";

/** Register (no id) or edit (id). Edit loads the profile; the server decides whether the viewer may manage it. */
export function ContractorFormPageClient({ id }: { id?: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getContractorCopy(locale);
  const keys = useContractorKeys();
  const profile = useQuery({ queryKey: keys.key("profile", id ?? ""), queryFn: () => fetchProfile(id!), enabled: Boolean(id), retry: false });
  const title = id ? copy.form.editTitle : copy.form.createTitle;

  let body: React.ReactNode;
  if (!id) {
    body = canHintManage(keys.roleKey) ? <ContractorForm key="create" mode="create" copy={copy} locale={locale} roleKey={keys.roleKey} /> : <p className="ctr-error" role="alert">{copy.form.forbidden}</p>;
  } else if (profile.isLoading) {
    body = <div className="sp-surface ctr-panel" aria-busy="true"><Skeleton height="2rem" width="40%" /><Skeleton height="10rem" /></div>;
  } else if (profile.error) {
    const status = profile.error instanceof ApiError ? profile.error.status : 0;
    body = <div role="alert" className="sp-surface ctr-panel"><p className="ctr-error">{status === 404 ? copy.common.notFound : status === 403 ? copy.common.forbidden : copy.common.unavailable}</p><div><button type="button" className="ctr-btn" onClick={() => void profile.refetch()}>{copy.common.retry}</button></div></div>;
  } else if (profile.data && !profile.data.can.manage) {
    body = <p className="ctr-error" role="alert">{copy.form.forbidden}</p>;
  } else if (profile.data) {
    body = <ContractorForm key={profile.data.updatedAt ?? profile.data.id} mode="edit" profile={profile.data} copy={copy} locale={locale} roleKey={keys.roleKey} />;
  }

  return (
    <StaffWorkspaceShell
      title={title}
      wide
      context={<ContextBar crumbs={[{ label: copy.breadcrumbWorkspace, href: "/dashboard" }, { label: copy.title, href: "/contractors" }, { label: title }]} />}
    >
      <div className="ctr">
        {locale !== "en" ? <p className="ctr-small">{copy.nativeReview}</p> : null}
        {body}
      </div>
    </StaffWorkspaceShell>
  );
}
