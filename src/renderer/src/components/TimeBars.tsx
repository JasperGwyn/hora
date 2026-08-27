import type { JSX } from "react";
import { formatDuration } from "@shared/time";
import { workSharePercents } from "@shared/totals";
import type { ProjectTotal } from "@shared/totals";

type TimeBarsProps = {
  rows: ProjectTotal[];
  empty: string;
};

export function TimeBars({ rows, empty }: TimeBarsProps): JSX.Element {
  if (rows.length === 0) {
    return <p className="empty">{empty}</p>;
  }

  const maxMs = Math.max(1, ...rows.map((item) => item.ms));
  const shares = workSharePercents(rows);

  return (
    <>
      {rows.map((item) => {
        const share = shares.get(item.projectId);
        return (
          <div
            className={`bar-row${item.countsTowardWork ? "" : " is-other"}`}
            key={item.projectId}
          >
            <span className="swatch" style={{ background: item.color }} />
            <div className="bar-label">
              <span>{item.name}</span>
              {item.countsTowardWork ? null : <small>No cuenta</small>}
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(6, (item.ms / maxMs) * 100)}%`,
                  background: item.color,
                }}
              />
            </div>
            <div className="bar-meta">
              <em>{formatDuration(item.ms)}</em>
              {share === undefined ? null : <small>{share}%</small>}
            </div>
          </div>
        );
      })}
    </>
  );
}
