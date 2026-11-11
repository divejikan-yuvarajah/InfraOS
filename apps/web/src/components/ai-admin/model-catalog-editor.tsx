"use client";

import { AI_MODEL_TIERS, type ModelCatalogEntry } from "@infraos/shared-types";
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { probeAiModels } from "@/lib/ai-admin/api";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type { AiModelTier, ModelsCheckProbeDto } from "@/lib/ai-admin/types";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

export function ModelCatalogEditor({
  catalog,
  editable,
  locale,
  disabled,
  onChange,
}: {
  catalog: Partial<Record<AiModelTier, ModelCatalogEntry>>;
  editable: boolean;
  locale: AuthLocale;
  disabled?: boolean;
  onChange: (tier: AiModelTier, entry: ModelCatalogEntry) => void;
}) {
  const copy = getAiAdminCopy(locale);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ModelsCheckProbeDto | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [copiedTier, setCopiedTier] = useState<AiModelTier | null>(null);

  const handleProbe = async () => {
    if (probing) return;
    setProbing(true);
    setProbeError(null);
    try {
      const data = await probeAiModels();
      setProbeResult(data);
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : copy.common.errorBody);
    } finally {
      setProbing(false);
    }
  };

  const handleCopy = async (tier: AiModelTier, value: string) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTier(tier);
      window.setTimeout(() => setCopiedTier((cur) => (cur === tier ? null : cur)), 1500);
    } catch {
      // Clipboard unavailable in restricted browser context
    }
  };

  const entryFor = (tier: AiModelTier): ModelCatalogEntry =>
    catalog[tier] ?? {
      modelId: "",
      source: "admin-entered",
    };

  return (
    <section className="ctr-panel" style={{ display: "grid", gap: "0.75rem" }}>
      <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.settings.catalogTitle}</h3>
          {!editable ? (
            <p className="ctr-small" style={{ margin: "0.2rem 0 0" }}>{copy.settings.catalogReadOnly}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="ctr-btn"
          disabled={probing || disabled}
          onClick={() => void handleProbe()}
        >
          <RefreshCwIcon aria-hidden="true" className={probing ? "animate-spin" : undefined} />
          <span>{probing ? copy.settings.checkingModels : copy.settings.checkModels}</span>
        </button>
      </div>

      {probeError ? (
        <p className="ctr-error" role="alert" style={{ margin: 0 }}>{probeError}</p>
      ) : null}

      {probeResult ? (
        <div className="ctr-panel" style={{ background: "rgba(37, 99, 235, 0.04)", display: "grid", gap: "0.5rem" }}>
          <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
            <strong style={{ fontSize: "0.86rem" }}>{copy.settings.probeResultTitle}</strong>
            <span
              className="ctr-badge"
              data-tone={probeResult.reachable ? "success" : "critical"}
            >
              {probeResult.message}
            </span>
          </div>
          <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.82rem" }}>
            {AI_MODEL_TIERS.map((tier) => {
              const detected = probeResult.configuredModels[tier] ?? "";
              return (
                <div key={tier} className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span>
                    <strong>{copy.tiers[tier]}:</strong>{" "}
                    <code>{detected || copy.common.notConfigured}</code>
                  </span>
                  {detected ? (
                    <button
                      type="button"
                      className="ctr-btn is-ghost"
                      onClick={() => void handleCopy(tier, detected)}
                    >
                      {copiedTier === tier ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                      <span>{copiedTier === tier ? copy.settings.copied : copy.settings.copyModelId}</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="ctr-table-wrap">
        <table className="ctr-table" style={{ width: "100%", fontSize: "0.83rem" }}>
          <thead>
            <tr>
              <th scope="col">{copy.settings.probeModelTier}</th>
              <th scope="col">{copy.settings.modelIdLabel}</th>
              <th scope="col">{copy.settings.sourceLabel}</th>
              <th scope="col">{copy.settings.inPriceLabel}</th>
              <th scope="col">{copy.settings.outPriceLabel}</th>
              <th scope="col">{copy.settings.imgPriceLabel}</th>
            </tr>
          </thead>
          <tbody>
            {AI_MODEL_TIERS.map((tier) => {
              const entry = entryFor(tier);
              const lockRow = !editable || Boolean(disabled);
              return (
                <tr key={tier}>
                  <td><strong>{copy.tiers[tier]}</strong></td>
                  <td>
                    <input
                      type="text"
                      className="ctr-input"
                      maxLength={160}
                      value={entry.modelId}
                      disabled={lockRow}
                      placeholder={copy.common.notConfigured}
                      aria-label={`${copy.tiers[tier]} — ${copy.settings.modelIdLabel}`}
                      onChange={(e) => onChange(tier, { ...entry, modelId: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="ctr-input"
                      value={entry.source}
                      disabled={lockRow}
                      aria-label={`${copy.tiers[tier]} — ${copy.settings.sourceLabel}`}
                      onChange={(e) =>
                        onChange(tier, {
                          ...entry,
                          source: e.target.value as ModelCatalogEntry["source"],
                        })
                      }
                    >
                      <option value="admin-entered">admin-entered</option>
                      <option value="provider-listing">provider-listing</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="ctr-input"
                      style={{ width: "6.5rem" }}
                      min={0}
                      value={entry.pricePerMInputMinor ?? ""}
                      disabled={lockRow}
                      aria-label={`${copy.tiers[tier]} — ${copy.settings.inPriceLabel}`}
                      onChange={(e) =>
                        onChange(tier, {
                          ...entry,
                          pricePerMInputMinor:
                            e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="ctr-input"
                      style={{ width: "6.5rem" }}
                      min={0}
                      value={entry.pricePerMOutputMinor ?? ""}
                      disabled={lockRow}
                      aria-label={`${copy.tiers[tier]} — ${copy.settings.outPriceLabel}`}
                      onChange={(e) =>
                        onChange(tier, {
                          ...entry,
                          pricePerMOutputMinor:
                            e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="ctr-input"
                      style={{ width: "6.5rem" }}
                      min={0}
                      value={entry.pricePerImageMinor ?? ""}
                      disabled={lockRow}
                      aria-label={`${copy.tiers[tier]} — ${copy.settings.imgPriceLabel}`}
                      onChange={(e) =>
                        onChange(tier, {
                          ...entry,
                          pricePerImageMinor:
                            e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

