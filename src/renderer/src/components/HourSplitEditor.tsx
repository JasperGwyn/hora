import type { JSX } from "react";
import { Minus, Plus } from "lucide-react";
import type { HourAllocation, Project } from "@shared/types";
import {
  ALLOCATION_STEP,
  allocatedMsByProject,
  isValidSplit,
  MIN_ALLOCATION_PERCENT,
  nudgeAllocation,
  setTwoWayPercent,
} from "@shared/allocations";
import { formatDuration } from "@shared/time";

const TWO_WAY_PRESETS = [50, 70, 30] as const;

type HourSplitEditorProps = {
  allocations: HourAllocation[];
  projects: Project[];
  activeMs: number;
  onChange: (allocations: HourAllocation[]) => void;
  onAssign: () => void;
};

function projectById(projects: Project[]): Map<string, Project> {
  return new Map(projects.map((project) => [project.id, project]));
}

export function HourSplitEditor({
  allocations,
  projects,
  activeMs,
  onChange,
  onAssign,
}: HourSplitEditorProps): JSX.Element {
  const known = projectById(projects);
  const ready = isValidSplit(allocations);
  const byMs = allocatedMsByProject(activeMs, allocations);
  const twoWay = allocations.length === 2;
  const first = allocations[0];

  return (
    <div className="prompt-split">
      {allocations.length < 2 ? (
        <p className="prompt-split-hint">Elegí al menos dos proyectos.</p>
      ) : (
        <>
          <div className="prompt-split-bar" aria-hidden="true">
            {allocations.map((item) => {
              const project = known.get(item.projectId);
              return (
                <span
                  className="prompt-split-seg"
                  key={item.projectId}
                  style={{
                    width: `${item.percent}%`,
                    background: project?.color ?? "#9a9186",
                  }}
                />
              );
            })}
          </div>
          {twoWay ? (
            <div className="prompt-split-legend">
              {allocations.map((item) => {
                const project = known.get(item.projectId);
                return (
                  <span key={item.projectId}>
                    <span
                      className="swatch"
                      style={{ background: project?.color ?? "#9a9186" }}
                    />
                    {project?.name ?? "Proyecto"} {item.percent}% ·{" "}
                    {formatDuration(byMs.get(item.projectId) ?? 0)}
                  </span>
                );
              })}
            </div>
          ) : null}
          {twoWay && first ? (
            <>
              <label className="prompt-split-slider">
                <span className="sr-only">
                  Porcentaje para {known.get(first.projectId)?.name ?? "el primer proyecto"}
                </span>
                <input
                  type="range"
                  min={MIN_ALLOCATION_PERCENT}
                  max={100 - MIN_ALLOCATION_PERCENT}
                  step={ALLOCATION_STEP}
                  value={first.percent}
                  onChange={(event) => {
                    onChange(setTwoWayPercent(allocations, Number(event.target.value)));
                  }}
                />
              </label>
              <div className="prompt-presets">
                {TWO_WAY_PRESETS.map((percent) => (
                  <button
                    className={`prompt-preset${first.percent === percent ? " is-active" : ""}`}
                    type="button"
                    key={percent}
                    onClick={() => {
                      onChange(setTwoWayPercent(allocations, percent));
                    }}
                  >
                    {percent} / {100 - percent}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="prompt-split-rows">
              {allocations.map((item) => {
                const project = known.get(item.projectId);
                return (
                  <div className="prompt-split-row" key={item.projectId}>
                    <span className="swatch" style={{ background: project?.color ?? "#9a9186" }} />
                    <span>{project?.name ?? "Proyecto"}</span>
                    <em>
                      {item.percent}% · {formatDuration(byMs.get(item.projectId) ?? 0)}
                    </em>
                    <div className="prompt-nudge">
                      <button
                        type="button"
                        aria-label={`Bajar ${project?.name ?? "proyecto"}`}
                        onClick={() => {
                          onChange(
                            nudgeAllocation(allocations, item.projectId, -ALLOCATION_STEP),
                          );
                        }}
                      >
                        <Minus size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Subir ${project?.name ?? "proyecto"}`}
                        onClick={() => {
                          onChange(
                            nudgeAllocation(allocations, item.projectId, ALLOCATION_STEP),
                          );
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <button
        className="primary-btn prompt-assign"
        type="button"
        disabled={!ready}
        onClick={onAssign}
      >
        Asignar
      </button>
    </div>
  );
}
