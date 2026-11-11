"use client";

import { AI_FEATURE_KEYS, AI_MODEL_TIERS, type ModelCatalogEntry } from "@infraos/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import {
  resetAiSettings,
  updateAgencyAiSettings,
  updateAiSettings,
  fetchAiSettings,
} from "@/lib/ai-admin/api";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type {
  AiFeatureKey,
  AiModelTier,
  AiSettingsResponseDto,
  UpdateAiSettingsPayload,
} from "@/lib/ai-admin/types";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";

import { FeatureToggles } from "./feature-toggles";
import { LimitsTable } from "./limits-table";
import { ModelCatalogEditor } from "./model-catalog-editor";
import { useAiStatus } from "./ai-status-provider";
import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

function sanitizeCatalogEntry(entry: ModelCatalogEntry): ModelCatalogEntry {
  const out: ModelCatalogEntry = {
    modelId: entry.modelId.trim().slice(0, 160),
    source: entry.source,
  };
  if (entry.verifiedAt) out.verifiedAt = entry.verifiedAt;
  if (entry.pricePerMInputMinor !== undefined) {
    out.pricePerMInputMinor = Math.max(0, Math.round(entry.pricePerMInputMinor));
  }
  if (entry.pricePerMOutputMinor !== undefined) {
    out.pricePerMOutputMinor = Math.max(0, Math.round(entry.pricePerMOutputMinor));
  }
  if (entry.pricePerImageMinor !== undefined) {
    out.pricePerImageMinor = Math.max(0, Math.round(entry.pricePerImageMinor));
  }
  return out;
}

function SettingsFormBody({
  data,
  scope,
  selectedAgencyId,
  isSuperAdmin,
  locale,
  onReload,
}: {
  data: AiSettingsResponseDto;
  scope: "PLATFORM" | "AGENCY";
  selectedAgencyId: string;
  isSuperAdmin: boolean;
  locale: AuthLocale;
  onReload: () => void;
}) {
  const copy = getAiAdminCopy(locale);
  const { refetch: refetchStatus } = useAiStatus();
  const baseDoc = scope === "PLATFORM" ? data.platform : data.agency;
  const effective = data.effective;

  const [toggles, setToggles] = useState<Record<AiFeatureKey, boolean>>(
    () => ({ ...(baseDoc?.featureToggles ?? effective.featureToggles) }),
  );
  const [limit10m, setLimit10m] = useState<Record<AiFeatureKey, number>>(
    () => ({ ...(baseDoc?.limits.userRequestsPer10Min ?? effective.userRequestsPer10Min) }),
  );
  const [limitDay, setLimitDay] = useState<Record<AiFeatureKey, number>>(
    () => ({ ...(baseDoc?.limits.agencyRequestsPerDay ?? effective.agencyRequestsPerDay) }),
  );
  const [concurrency, setConcurrency] = useState<number>(
    () => baseDoc?.limits.concurrencyPerUser ?? effective.concurrencyPerUser,
  );
  const [dailyTokenBudget, setDailyTokenBudget] = useState<Record<AiModelTier, number>>(
    () => ({ ...(baseDoc?.budgets.dailyTokenBudget ?? effective.dailyTokenBudget) }),
  );
  const [dailyVisionImages, setDailyVisionImages] = useState<number>(
    () => baseDoc?.budgets.dailyVisionImages ?? effective.dailyVisionImages,
  );
  const [strongThreshold, setStrongThreshold] = useState<number>(
    () => baseDoc?.routing?.strongSummaryInputThreshold ?? effective.strongSummaryInputThreshold,
  );
  const [autoDowngradePct, setAutoDowngradePct] = useState<number>(
    () => baseDoc?.routing?.autoDowngradeAtBudgetPercent ?? effective.autoDowngradeAtBudgetPercent,
  );
  const [catalog, setCatalog] = useState<Partial<Record<AiModelTier, ModelCatalogEntry>>>(
    () => ({ ...(baseDoc?.modelCatalog ?? effective.modelCatalog ?? {}) }),
  );

  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const version = baseDoc?.version ?? 1;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setConflict(false);
    setError(null);
    try {
      const cleanToggles: Partial<Record<AiFeatureKey, boolean>> = {};
      const clean10m: Partial<Record<AiFeatureKey, number>> = {};
      const cleanDay: Partial<Record<AiFeatureKey, number>> = {};
      for (const f of AI_FEATURE_KEYS) {
        cleanToggles[f] = Boolean(toggles[f]);
        clean10m[f] = Math.max(1, Math.min(500, Math.round(limit10m[f] ?? 1)));
        cleanDay[f] = Math.max(1, Math.min(100000, Math.round(limitDay[f] ?? 1)));
      }
      const cleanBudgets: Partial<Record<AiModelTier, number>> = {};
      for (const tier of AI_MODEL_TIERS) {
        cleanBudgets[tier] = Math.max(1000, Math.min(1_000_000_000, Math.round(dailyTokenBudget[tier] ?? 1000)));
      }

      const payload: UpdateAiSettingsPayload = {
        scope,
        version,
        featureToggles: cleanToggles,
        limits: {
          userRequestsPer10Min: clean10m,
          agencyRequestsPerDay: cleanDay,
          concurrencyPerUser: Math.max(1, Math.min(5, Math.round(concurrency))),
        },
        budgets: {
          dailyTokenBudget: cleanBudgets,
          dailyVisionImages: Math.max(0, Math.min(100000, Math.round(dailyVisionImages))),
        },
        routing: {
          strongSummaryInputThreshold: Math.max(1000, Math.min(500000, Math.round(strongThreshold))),
          autoDowngradeAtBudgetPercent: Math.max(10, Math.min(100, Math.round(autoDowngradePct))),
        },
      };

      if (scope === "PLATFORM" && isSuperAdmin) {
        const cleanCatalog: NonNullable<UpdateAiSettingsPayload["modelCatalog"]> = {
          LOW: sanitizeCatalogEntry(catalog.LOW ?? { modelId: "", source: "admin-entered" }),
          STRONG: sanitizeCatalogEntry(catalog.STRONG ?? { modelId: "", source: "admin-entered" }),
          VISION: sanitizeCatalogEntry(catalog.VISION ?? { modelId: "", source: "admin-entered" }),
          EMBED: sanitizeCatalogEntry(catalog.EMBED ?? { modelId: "", source: "admin-entered" }),
        };
        payload.modelCatalog = cleanCatalog;
      }

      if (scope === "AGENCY" && selectedAgencyId) {
        await updateAgencyAiSettings(selectedAgencyId, payload);
      } else {
        await updateAiSettings(payload);
      }

      toast.success(copy.common.saved);
      refetchStatus();
      onReload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
      } else {
        setError(err instanceof Error ? err.message : copy.common.errorBody);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (resetting) return;
    setResetting(true);
    setError(null);
    try {
      await resetAiSettings({
        scope,
        ...(scope === "AGENCY" && selectedAgencyId ? { agencyId: selectedAgencyId } : {}),
      });
      setResetOpen(false);
      toast.success(copy.common.saved);
      refetchStatus();
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.common.errorBody);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="gov-grid">
      {conflict ? (
        <div className="ai-limit-banner" data-tone="critical" role="alert">
          <span>{copy.common.conflict}</span>
          <button type="button" className="ctr-btn" onClick={onReload}>
            {copy.common.refresh}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="ctr-error" role="alert" style={{ margin: 0 }}>{error}</p>
      ) : null}

      <FeatureToggles
        toggles={toggles}
        effective={effective.featureToggles}
        locale={locale}
        disabled={saving}
        onChange={(feat, next) => setToggles((prev) => ({ ...prev, [feat]: next }))}
      />

      <LimitsTable
        userRequestsPer10Min={limit10m}
        agencyRequestsPerDay={limitDay}
        concurrencyPerUser={concurrency}
        effective={effective}
        locale={locale}
        disabled={saving}
        onChange10m={(f, v) => setLimit10m((prev) => ({ ...prev, [f]: v }))}
        onChangeDay={(f, v) => setLimitDay((prev) => ({ ...prev, [f]: v }))}
        onChangeConcurrency={setConcurrency}
      />

      <section className="ctr-panel" style={{ display: "grid", gap: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.settings.budgetsTitle}</h3>
        <div className="gov-cards">
          {AI_MODEL_TIERS.map((tier) => (
            <label key={tier} style={{ display: "grid", gap: "0.25rem", fontSize: "0.84rem" }}>
              <span style={{ fontWeight: 600 }}>{copy.tiers[tier]}</span>
              <input
                type="number"
                className="ctr-input"
                min={1000}
                max={1000000000}
                value={dailyTokenBudget[tier] ?? 1000}
                disabled={saving}
                onChange={(e) => {
                  const val = Math.max(1000, Math.min(1000000000, Math.round(Number(e.target.value) || 1000)));
                  setDailyTokenBudget((prev) => ({ ...prev, [tier]: val }));
                }}
              />
            </label>
          ))}
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.84rem" }}>
            <span style={{ fontWeight: 600 }}>{copy.settings.dailyVisionImages}</span>
            <input
              type="number"
              className="ctr-input"
              min={0}
              max={100000}
              value={dailyVisionImages}
              disabled={saving}
              onChange={(e) => setDailyVisionImages(Math.max(0, Math.min(100000, Math.round(Number(e.target.value) || 0))))}
            />
          </label>
        </div>
      </section>

      <section className="ctr-panel" style={{ display: "grid", gap: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.settings.routingTitle}</h3>
        <div className="ctr-row" style={{ gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.84rem" }}>
            <span style={{ fontWeight: 600 }}>{copy.settings.strongThreshold}</span>
            <input
              type="number"
              className="ctr-input"
              min={1000}
              max={500000}
              value={strongThreshold}
              disabled={saving}
              onChange={(e) =>
                setStrongThreshold(Math.max(1000, Math.min(500000, Math.round(Number(e.target.value) || 1000))))
              }
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.84rem" }}>
            <span style={{ fontWeight: 600 }}>{copy.settings.autoDowngradePct}</span>
            <input
              type="number"
              className="ctr-input"
              min={10}
              max={100}
              value={autoDowngradePct}
              disabled={saving}
              onChange={(e) =>
                setAutoDowngradePct(Math.max(10, Math.min(100, Math.round(Number(e.target.value) || 10))))
              }
            />
          </label>
        </div>
      </section>

      <ModelCatalogEditor
        catalog={catalog}
        editable={scope === "PLATFORM" && isSuperAdmin}
        locale={locale}
        disabled={saving}
        onChange={(tier, entry) => setCatalog((prev) => ({ ...prev, [tier]: entry }))}
      />

      <div className="ctr-row" style={{ gap: "0.6rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="ctr-btn is-primary"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? copy.common.saving : copy.common.save}
        </button>
        <button
          type="button"
          className="ctr-btn is-danger"
          disabled={saving}
          onClick={() => setResetOpen(true)}
        >
          {copy.common.reset}
        </button>
      </div>

      <Dialog open={resetOpen} onOpenChange={(next) => { if (!resetting) setResetOpen(next); }}>
        <DialogContent className="sm:max-w-md ctr-dialog">
          <DialogHeader>
            <DialogTitle>{copy.common.resetConfirmTitle}</DialogTitle>
            <DialogDescription>{copy.common.resetConfirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="ctr-row" style={{ gap: "0.5rem" }}>
            <button type="button" className="ctr-btn is-ghost" onClick={() => setResetOpen(false)} disabled={resetting}>
              {copy.common.cancel}
            </button>
            <button type="button" className="ctr-btn is-danger" onClick={() => void handleReset()} disabled={resetting}>
              {copy.common.confirm}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SettingsForm({
  locale,
  roleKey,
}: {
  locale: AuthLocale;
  roleKey: string;
}) {
  const copy = getAiAdminCopy(locale);
  const qc = useQueryClient();
  const isSuperAdmin = roleKey === "SUPER_ADMIN";

  const [scope, setScope] = useState<"PLATFORM" | "AGENCY">(isSuperAdmin ? "PLATFORM" : "AGENCY");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");

  const agenciesQuery = useQuery({
    queryKey: ["admin", "agencies", "ai-settings"],
    queryFn: () => fetchAgencies({ page: 1 }),
    enabled: isSuperAdmin && scope === "AGENCY",
    staleTime: 60_000,
    retry: false,
  });

  const resolvedAgencyId =
    scope === "AGENCY" && isSuperAdmin
      ? selectedAgencyId || (agenciesQuery.data?.agencies?.[0]?.id ?? "")
      : "";

  const settingsQuery = useQuery({
    queryKey: ["ai", "settings", scope, resolvedAgencyId],
    queryFn: ({ signal }) => fetchAiSettings(resolvedAgencyId || undefined, signal),
    enabled: scope === "PLATFORM" || !isSuperAdmin || Boolean(resolvedAgencyId),
    retry: false,
  });

  const handleReload = () => {
    void qc.invalidateQueries({ queryKey: ["ai", "settings"] });
  };

  return (
    <div className="gov-grid">
      {isSuperAdmin ? (
        <section className="ctr-panel ctr-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="ctr-row" role="group" aria-label={copy.tabs.settings} style={{ gap: "0.4rem" }}>
            <button
              type="button"
              className={scope === "PLATFORM" ? "ctr-btn is-primary" : "ctr-btn"}
              aria-pressed={scope === "PLATFORM"}
              onClick={() => setScope("PLATFORM")}
            >
              {copy.settings.scopePlatform}
            </button>
            <button
              type="button"
              className={scope === "AGENCY" ? "ctr-btn is-primary" : "ctr-btn"}
              aria-pressed={scope === "AGENCY"}
              onClick={() => setScope("AGENCY")}
            >
              {copy.settings.scopeAgency}
            </button>
          </div>

          {scope === "AGENCY" ? (
            <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.82rem" }}>
              <span>{copy.settings.scopeAgency}</span>
              <select
                className="ctr-input"
                value={resolvedAgencyId}
                onChange={(e) => setSelectedAgencyId(e.target.value)}
              >
                {(agenciesQuery.data?.agencies ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                ))}
              </select>
            </label>
          ) : null}
        </section>
      ) : null}

      {settingsQuery.isPending ? (
        <div className="ctr-panel" role="status">{copy.common.loading}</div>
      ) : settingsQuery.isError ? (
        <div className="ctr-panel" role="alert">
          <strong>{copy.common.errorTitle}</strong>
          <p className="ctr-small">{copy.common.errorBody}</p>
          <button type="button" className="ctr-btn" onClick={() => void settingsQuery.refetch()}>
            {copy.common.retry}
          </button>
        </div>
      ) : settingsQuery.data ? (
        <SettingsFormBody
          key={`${scope}:${resolvedAgencyId}:${scope === "PLATFORM" ? (settingsQuery.data.platform?.version ?? 1) : (settingsQuery.data.agency?.version ?? 1)}`}
          data={settingsQuery.data}
          scope={scope}
          selectedAgencyId={resolvedAgencyId}
          isSuperAdmin={isSuperAdmin}
          locale={locale}
          onReload={handleReload}
        />
      ) : null}
    </div>
  );
}

