"use client";

import { AI_FEATURE_KEYS } from "@infraos/shared-types";

import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type { AiEffectiveSettingsDto, AiFeatureKey } from "@/lib/ai-admin/types";
import { formatNumber } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

export function LimitsTable({
  userRequestsPer10Min,
  agencyRequestsPerDay,
  concurrencyPerUser,
  effective,
  locale,
  disabled,
  onChange10m,
  onChangeDay,
  onChangeConcurrency,
}: {
  userRequestsPer10Min: Record<AiFeatureKey, number>;
  agencyRequestsPerDay: Record<AiFeatureKey, number>;
  concurrencyPerUser: number;
  effective: AiEffectiveSettingsDto;
  locale: AuthLocale;
  disabled?: boolean;
  onChange10m: (feature: AiFeatureKey, value: number) => void;
  onChangeDay: (feature: AiFeatureKey, value: number) => void;
  onChangeConcurrency: (value: number) => void;
}) {
  const copy = getAiAdminCopy(locale);

  return (
    <section className="ctr-panel" style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.settings.limitsTitle}</h3>
        <p className="ctr-small" style={{ margin: "0.2rem 0 0" }}>{copy.settings.effectiveNote}</p>
      </div>

      <div className="ctr-table-wrap">
        <table className="ctr-table" style={{ width: "100%", fontSize: "0.84rem" }}>
          <thead>
            <tr>
              <th scope="col">{copy.myUsage.featureCol}</th>
              <th scope="col">{copy.settings.perUser10m}</th>
              <th scope="col">{copy.settings.perAgencyDay}</th>
            </tr>
          </thead>
          <tbody>
            {AI_FEATURE_KEYS.map((feat) => {
              const val10m = userRequestsPer10Min[feat] ?? effective.userRequestsPer10Min[feat] ?? 1;
              const valDay = agencyRequestsPerDay[feat] ?? effective.agencyRequestsPerDay[feat] ?? 1;
              const eff10m = effective.userRequestsPer10Min[feat];
              const effDay = effective.agencyRequestsPerDay[feat];
              return (
                <tr key={feat}>
                  <td>{copy.features[feat]}</td>
                  <td>
                    <div className="ctr-row" style={{ gap: "0.4rem", alignItems: "center" }}>
                      <input
                        type="number"
                        className="ctr-input"
                        style={{ width: "6rem" }}
                        min={1}
                        max={500}
                        value={val10m}
                        disabled={disabled}
                        aria-label={`${copy.features[feat]} — ${copy.settings.perUser10m}`}
                        onChange={(e) => {
                          const num = Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1)));
                          onChange10m(feat, num);
                        }}
                      />
                      {eff10m !== val10m ? (
                        <span className="ctr-small">({formatNumber(eff10m, locale)})</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="ctr-row" style={{ gap: "0.4rem", alignItems: "center" }}>
                      <input
                        type="number"
                        className="ctr-input"
                        style={{ width: "7rem" }}
                        min={1}
                        max={100000}
                        value={valDay}
                        disabled={disabled}
                        aria-label={`${copy.features[feat]} — ${copy.settings.perAgencyDay}`}
                        onChange={(e) => {
                          const num = Math.max(1, Math.min(100000, Math.round(Number(e.target.value) || 1)));
                          onChangeDay(feat, num);
                        }}
                      />
                      {effDay !== valDay ? (
                        <span className="ctr-small">({formatNumber(effDay, locale)})</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="ctr-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center", fontSize: "0.86rem" }}>
        <span style={{ fontWeight: 600 }}>{copy.settings.concurrency}</span>
        <input
          type="number"
          className="ctr-input"
          style={{ width: "5rem" }}
          min={1}
          max={5}
          value={concurrencyPerUser}
          disabled={disabled}
          onChange={(e) => {
            const num = Math.max(1, Math.min(5, Math.round(Number(e.target.value) || 1)));
            onChangeConcurrency(num);
          }}
        />
      </label>
    </section>
  );
}

