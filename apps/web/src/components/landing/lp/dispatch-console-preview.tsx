import { LockIcon, MonitorIcon, MoveHorizontalIcon, NavigationIcon } from "lucide-react";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS, LP_DISPATCH_ROWS } from "@/lib/landing/lp-data";

import { FigureCaption, SectionHeader, StatusBadge } from "./atoms";

/** Mock browser frame around a conceptual coordination matrix. Sample data only. */
export function DispatchConsolePreview({ copy }: { copy: LpCopy["dispatch"] }) {
  return (
    <section id={LP_ANCHORS.dispatch} className="lp-section lp-section--card" aria-labelledby="lp-dispatch-title">
      <div className="lp-container">
        <SectionHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="lp-dispatch-title"
          medium
          aside={<span className="lp-chip">{copy.conceptual}</span>}
        />
        <div className="lp-browser">
          <div className="lp-browser__bar">
            <div className="lp-browser__dots" aria-hidden="true">
              <i style={{ background: "rgba(140, 31, 40, 0.6)" }} />
              <i style={{ background: "rgba(254, 182, 0, 0.6)" }} />
              <i style={{ background: "rgba(39, 149, 65, 0.6)" }} />
            </div>
            <span className="lp-browser__url lp-mono">{copy.mockAddress}</span>
            <span className="lp-browser__tls">
              <LockIcon aria-hidden="true" width={12} height={12} />
              {copy.tlsBadge}
            </span>
          </div>
          <div className="lp-browser__body">
            <FigureCaption
              src="/landing/lp/dispatch-room.jpg"
              alt={copy.imageAlt}
              sizes="(min-width: 1280px) 1090px, 100vw"
              label={copy.plateLabel}
              caption={copy.plateCaption}
              chip={copy.plateChip}
              ChipIcon={MonitorIcon}
              dot="var(--lp-success)"
            />
            <div className="lp-filters">
              <div className="lp-filters__group">
                <strong>{copy.zone}</strong>
                <span className="lp-pill">{copy.resolution}</span>
              </div>
              <div className="lp-filters__group">
                <span className="lp-pill lp-pill--outline">{copy.layer}</span>
                <span className="lp-pill lp-pill--run">{copy.simulation}</span>
              </div>
            </div>
            <div className="lp-tablewrap">
              <div className="lp-tablescroll" tabIndex={0} role="region" aria-label={copy.tableCaption}>
                <table className="lp-table">
                  <caption>{copy.tableCaption}</caption>
                  <thead>
                    <tr>
                      {copy.columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LP_DISPATCH_ROWS.map((row) => (
                      <tr key={row.road}>
                        <th scope="row">
                          <span className="lp-table__road">
                            <NavigationIcon aria-hidden="true" />
                            {row.road}
                          </span>
                        </th>
                        <td>{row.lead}</td>
                        <td>
                          <span className="lp-table__co">
                            {row.coApplicants.map((agency) => (
                              <span key={agency} className="lp-pill">
                                {agency}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td>{row.window}</td>
                        <td>
                          <span className="lp-table__status">
                            <StatusBadge tone={row.status}>{copy.status[row.status]}</StatusBadge>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="lp-scrollhint">
                <MoveHorizontalIcon aria-hidden="true" />
                {copy.scrollHint}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

