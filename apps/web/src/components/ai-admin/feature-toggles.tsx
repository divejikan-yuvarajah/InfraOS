"use client";

import { AI_FEATURE_KEYS } from "@infraos/shared-types";

import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type { AiFeatureKey } from "@/lib/ai-admin/types";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

export function FeatureToggles({
  toggles,
  effective,
  locale,
  disabled,
  onChange,
}: {
  toggles: Record<AiFeatureKey, boolean>;
  effective: Record<AiFeatureKey, boolean>;
  locale: AuthLocale;
  disabled?: boolean;
  onChange: (key: AiFeatureKey, next: boolean) => void;
}) {
  const copy = getAiAdminCopy(locale);

  return (
    <section className="ctr-panel" style={{ display: "grid", gap: "0.65rem" }}>
      <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.settings.togglesTitle}</h3>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {AI_FEATURE_KEYS.map((feat) => {
          const checked = toggles[feat] ?? false;
          const eff = effective[feat] ?? false;
          return (
            <label
              key={feat}
              className="gov-toggle-row"
              data-vision={feat === "vision" ? "true" : undefined}
              style={{ cursor: disabled ? "not-allowed" : "pointer" }}
            >
              <div style={{ display: "grid", gap: "0.2rem" }}>
                <div className="ctr-row" style={{ gap: "0.5rem" }}>
                  <strong style={{ fontSize: "0.88rem" }}>{copy.features[feat]}</strong>
                  {!eff ? (
                    <span className="ctr-badge" data-tone="neutral">{copy.myUsage.disabled}</span>
                  ) : null}
                </div>
                {feat === "vision" ? (
                  <p className="ctr-small" style={{ margin: 0 }}>{copy.settings.visionWarning}</p>
                ) : null}
              </div>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(feat, e.target.checked)}
                aria-label={copy.features[feat]}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}

