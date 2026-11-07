"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { fetchContractorFinance } from "@/lib/finance/api";
import { getFinanceCopy } from "@/lib/finance/messages";
import { canHintFinance, useFinanceKeys } from "@/lib/finance/session";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import "@/styles/contractors.css";
import "@/styles/finance.css";

import { MoneyText } from "./finance-ui";

/** "Open finance" link on the project overview, shown only to roles that can read project finance. The finance page re-checks on the server. */
export function OpenFinanceLink({ projectId }: { projectId: string }) {
  const keys = useFinanceKeys();
  const [locale] = useWorkspaceLocale();
  const copy = getFinanceCopy(locale);
  if (!canHintFinance(keys.roleKey)) return null;
  return <Link className="ctr-btn" href={`/projects/${projectId}/finance`} style={{ width: "fit-content" }}>{copy.common.openFinance} →</Link>;
}

/** Read-only finance card on the contractor profile. Hidden for users without payment read (403 shows a restricted note). */
export function ContractorFinanceCard({ contractorId }: { contractorId: string }) {
  const keys = useFinanceKeys();
  const [locale] = useWorkspaceLocale();
  const copy = getFinanceCopy(locale);
  const q = useQuery({ queryKey: keys.key("contractor", contractorId), queryFn: () => fetchContractorFinance(contractorId), enabled: canHintFinance(keys.roleKey), retry: false });
  if (!canHintFinance(keys.roleKey)) return null;
  const denied = q.error instanceof ApiError && (q.error.status === 403 || q.error.status === 404);
  return (
    <section className="sp-surface ctr-panel" aria-label={copy.contractorCard.title}>
      <h3>{copy.contractorCard.title}</h3>
      {q.isLoading ? <p className="ctr-small" role="status">{copy.common.loading}</p> : null}
      {denied ? <p className="ctr-restricted">{copy.contractorCard.restricted}</p> : q.error ? <div role="alert"><p className="ctr-error">{copy.contractorCard.failed}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
      {q.data ? (
        <>
          <dl className="fin-kv">
            <dt>{copy.contractorCard.paid}</dt><dd><MoneyText minor={q.data.paidMinor} locale={locale} /></dd>
            <dt>{copy.contractorCard.pending}</dt><dd><MoneyText minor={q.data.pendingMinor} locale={locale} /></dd>
            <dt>{copy.contractorCard.approved}</dt><dd><MoneyText minor={q.data.approvedUnpaidMinor} locale={locale} /></dd>
            <dt>{copy.contractorCard.projects}</dt><dd className="ctr-num">{q.data.projects}</dd>
            <dt>{copy.contractorCard.overCap}</dt><dd className="ctr-num">{q.data.overCapAssignments}</dd>
            <dt>{copy.contractorCard.unverified}</dt><dd className="ctr-num">{q.data.paidWithoutVerifiedProgress}</dd>
          </dl>
          <p className="ctr-small">{copy.contractorCard.basedOn}</p>
          <Link className="ctr-btn" style={{ width: "fit-content" }} href="/finance/payments?tab=all">{copy.contractorCard.openQueue}</Link>
        </>
      ) : null}
    </section>
  );
}
