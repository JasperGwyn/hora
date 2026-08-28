import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, JSX } from "react";
import type { HourAllocation, HourEntry, Project } from "@shared/types";
import {
  entryAllocations,
  equalAllocations,
  isValidSplit,
  toggleProjectInSplit,
} from "@shared/allocations";
import { HourSplitEditor } from "@/components/HourSplitEditor";
import { logger } from "@/lib/logger";

export type HourAssignTone = "prompt" | "dashboard";

type HourAssignFormProps = {
  entry: HourEntry;
  projects: Project[];
  tone: HourAssignTone;
  assignLabel: string;
  dismissLabel: string;
  onDone: () => void;
  onDismiss: () => void;
  onSplittingChange?: (splitting: boolean) => void;
};

function projectsForEditor(
  projects: Project[],
  selectedIds: readonly string[],
): Project[] {
  const selected = new Set(selectedIds);
  const active = projects.filter((project) => !project.archived);
  const extras = projects.filter(
    (project) => project.archived && selected.has(project.id),
  );
  return [...active, ...extras];
}

function startFromEntry(entry: HourEntry): {
  splitting: boolean;
  allocations: HourAllocation[];
} {
  const allocations = entryAllocations(entry);
  if (allocations.length >= 2) {
    return { splitting: true, allocations };
  }
  return { splitting: false, allocations };
}

export function HourAssignForm({
  entry,
  projects,
  tone,
  assignLabel,
  dismissLabel,
  onDone,
  onDismiss,
  onSplittingChange,
}: HourAssignFormProps): JSX.Element {
  const started = startFromEntry(entry);
  const [name, setName] = useState("");
  const [splitting, setSplitting] = useState(started.splitting);
  const [allocations, setAllocations] = useState<HourAllocation[]>(started.allocations);
  const visible = useMemo(
    () =>
      projectsForEditor(
        projects,
        allocations.map((item) => item.projectId),
      ),
    [projects, allocations],
  );
  const percentById = useMemo(
    () => new Map(allocations.map((item) => [item.projectId, item.percent])),
    [allocations],
  );
  const currentProjectId =
    !splitting && allocations.length === 1 ? (allocations[0]?.projectId ?? null) : null;

  useEffect(() => {
    onSplittingChange?.(splitting);
  }, [onSplittingChange, splitting]);

  const assignProject = useCallback(
    async (projectId: string): Promise<void> => {
      try {
        await window.hora.assignHour(entry.id, { kind: "project", projectId });
        onDone();
      } catch (error) {
        logger.error("No se pudo asignar la hora", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [entry.id, onDone],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === "Escape") {
        if (splitting) {
          setSplitting(false);
          setAllocations(entryAllocations(entry));
          return;
        }
        onDismiss();
        return;
      }
      const index = Number(event.key) - 1;
      if (index < 0 || index >= visible.length || !visible[index]) {
        return;
      }
      const projectId = visible[index].id;
      if (splitting) {
        setAllocations((current) => toggleProjectInSplit(projectId, current));
        return;
      }
      void assignProject(projectId);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [assignProject, entry, onDismiss, splitting, visible]);

  const assignSplit = async (): Promise<void> => {
    if (!isValidSplit(allocations)) {
      return;
    }
    try {
      await window.hora.assignHour(entry.id, { kind: "split", allocations });
      onDone();
    } catch (error) {
      logger.error("No se pudo dividir la hora", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const assignNone = async (): Promise<void> => {
    try {
      await window.hora.assignHour(entry.id, { kind: "none" });
      onDone();
    } catch (error) {
      logger.error("No se pudo marcar la hora sin proyecto", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const onAdd = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    try {
      const next = await window.hora.addProject(trimmed);
      const created = [...next.projects]
        .filter((project) => !project.archived)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      setName("");
      if (!created) {
        return;
      }
      if (splitting) {
        setAllocations((current) =>
          equalAllocations([...current.map((item) => item.projectId), created.id]),
        );
        return;
      }
      await window.hora.assignHour(entry.id, {
        kind: "project",
        projectId: created.id,
      });
      onDone();
    } catch (error) {
      logger.error("No se pudo crear y asignar el proyecto", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const exitSplit = (): void => {
    setSplitting(false);
    setAllocations(entryAllocations(entry));
  };

  const enterSplit = (): void => {
    setSplitting(true);
    setAllocations(entryAllocations(entry));
  };

  const projectForm = (
    <form className="prompt-form" onSubmit={(event) => void onAdd(event)}>
      <input
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        placeholder={visible.length === 0 ? "Nombre del proyecto" : "Nuevo proyecto"}
        aria-label={visible.length === 0 ? "Nombre del proyecto" : "Nuevo proyecto"}
        autoFocus={tone === "prompt" && visible.length === 0}
      />
      <button className="primary-btn" type="submit">
        {visible.length === 0 ? "Crear y asignar" : splitting ? "Sumar" : "Crear"}
      </button>
    </form>
  );

  return (
    <div className={`hour-assign hour-assign--${tone}`}>
      {visible.length === 0 ? (
        projectForm
      ) : (
        <div className="prompt-projects">
          {visible.map((project, index) => {
            const selected = percentById.has(project.id);
            const current = currentProjectId === project.id;
            return (
              <button
                className={`prompt-project${splitting && selected ? " is-selected" : ""}${current ? " is-current" : ""}`}
                type="button"
                key={project.id}
                aria-pressed={splitting ? selected : current ? true : undefined}
                onClick={() => {
                  if (splitting) {
                    setAllocations((currentAllocations) =>
                      toggleProjectInSplit(project.id, currentAllocations),
                    );
                    return;
                  }
                  void assignProject(project.id);
                }}
              >
                <span className="swatch" style={{ background: project.color }} />
                <span>{project.name}</span>
                <span className="prompt-project-meta">
                  {splitting && selected ? (
                    <span className="prompt-pct">{percentById.get(project.id)}%</span>
                  ) : null}
                  {index < 9 ? <span className="kbd">{index + 1}</span> : null}
                </span>
              </button>
            );
          })}
          {projectForm}
        </div>
      )}

      <div className="prompt-actions-stack">
        {splitting ? (
          <HourSplitEditor
            allocations={allocations}
            projects={visible}
            activeMs={entry.activeMs}
            assignLabel={assignLabel}
            onChange={setAllocations}
            onAssign={() => {
              void assignSplit();
            }}
          />
        ) : null}
        {!splitting && visible.length >= 1 ? (
          <button className="split-btn" type="button" onClick={enterSplit}>
            Dividir
          </button>
        ) : null}
        <div className="prompt-actions">
          {splitting ? (
            <button className="none-btn" type="button" onClick={exitSplit}>
              Volver
            </button>
          ) : (
            <button className="none-btn" type="button" onClick={() => void assignNone()}>
              No fue un proyecto
            </button>
          )}
          <button className="later-btn" type="button" onClick={onDismiss}>
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
