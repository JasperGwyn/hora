import { useEffect, useMemo, useState } from "react";
import type { FormEvent, JSX } from "react";
import { X } from "lucide-react";
import type { HourAllocation, HourEntry } from "@shared/types";
import { equalAllocations, isValidSplit } from "@shared/allocations";
import { formatDuration, formatEntryRange } from "@shared/time";
import { HourSplitEditor } from "@/components/HourSplitEditor";
import { useHora } from "@/hooks/useHora";
import { logger } from "@/lib/logger";

function pendingEntry(entries: HourEntry[]): HourEntry | null {
  return (
    [...entries]
      .filter((entry) => entry.status === "pending")
      .sort((a, b) => a.segmentStartMs - b.segmentStartMs)[0] ?? null
  );
}

function toggleProjectInSplit(
  projectId: string,
  current: HourAllocation[],
): HourAllocation[] {
  const ids = current.map((item) => item.projectId);
  const nextIds = ids.includes(projectId)
    ? ids.filter((id) => id !== projectId)
    : [...ids, projectId];
  return equalAllocations(nextIds);
}

export function HourPrompt(): JSX.Element {
  const { state, ready } = useHora();
  const [name, setName] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [allocations, setAllocations] = useState<HourAllocation[]>([]);
  const entry = useMemo(
    () => (state ? pendingEntry(state.entries) : null),
    [state],
  );
  const projects = state?.projects.filter((project) => !project.archived) ?? [];
  const percentById = useMemo(
    () => new Map(allocations.map((item) => [item.projectId, item.percent])),
    [allocations],
  );

  useEffect(() => {
    setSplitting(false);
    setAllocations([]);
    setName("");
  }, [entry?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!entry) {
        return;
      }
      if (event.key === "Escape") {
        if (splitting) {
          setSplitting(false);
          setAllocations([]);
          return;
        }
        void window.hora.closePrompt();
        return;
      }
      const index = Number(event.key) - 1;
      if (index < 0 || index >= projects.length || !projects[index]) {
        return;
      }
      const projectId = projects[index].id;
      if (splitting) {
        setAllocations((current) => toggleProjectInSplit(projectId, current));
        return;
      }
      void window.hora.assignHour(entry.id, {
        kind: "project",
        projectId,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [entry, projects, splitting]);

  if (!ready || !state) {
    return <div className="loading">Hora</div>;
  }

  if (!entry) {
    return (
      <div className="prompt-body">
        <div className="prompt-chrome">
          Hora
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => {
              void window.hora.closePrompt();
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="prompt-inner">
          <h1>Nada pendiente.</h1>
          <p className="prompt-note">
            Cuando cierre una hora con uso real, te voy a preguntar acá.
          </p>
        </div>
      </div>
    );
  }

  const assignProject = async (projectId: string): Promise<void> => {
    try {
      await window.hora.assignHour(entry.id, { kind: "project", projectId });
    } catch (error) {
      logger.error("No se pudo asignar la hora", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const assignSplit = async (): Promise<void> => {
    if (!isValidSplit(allocations)) {
      return;
    }
    try {
      await window.hora.assignHour(entry.id, { kind: "split", allocations });
    } catch (error) {
      logger.error("No se pudo dividir la hora", {
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
    } catch (error) {
      logger.error("No se pudo crear y asignar el proyecto", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const exitSplit = (): void => {
    setSplitting(false);
    setAllocations([]);
  };

  const projectForm = (
    <form className="prompt-form" onSubmit={(event) => void onAdd(event)}>
      <input
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        placeholder={projects.length === 0 ? "Nombre del proyecto" : "Nuevo proyecto"}
        aria-label={projects.length === 0 ? "Nombre del proyecto" : "Nuevo proyecto"}
        autoFocus={projects.length === 0}
      />
      <button className="primary-btn" type="submit">
        {projects.length === 0 ? "Crear y asignar" : splitting ? "Sumar" : "Crear"}
      </button>
    </form>
  );

  return (
    <div className="prompt-body">
      <div className="prompt-chrome">
        {splitting ? "Dividir hora" : "Cierre de hora"}
        <button
          type="button"
          aria-label="Más tarde"
          onClick={() => {
            void window.hora.closePrompt();
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="prompt-inner">
        <div>
          <h1>
            {splitting
              ? "¿Cómo se parte este tramo?"
              : "¿A qué proyecto le dedicaste este tramo?"}
          </h1>
          <div className="prompt-meta">
            {formatEntryRange(entry)} · {formatDuration(entry.activeMs)} de
            uso real
          </div>
        </div>
        <p className="prompt-note">
          {splitting
            ? "Tocá proyectos para sumarlos. El clic ya no asigna el 100%."
            : `El tiempo en reposo no se cuenta. Solo asignás los ${formatDuration(entry.activeMs)} en los que usaste la computadora.`}
        </p>

        {projects.length === 0 ? (
          projectForm
        ) : (
          <div className="prompt-projects">
            {projects.map((project, index) => {
              const selected = percentById.has(project.id);
              return (
                <button
                  className={`prompt-project${splitting && selected ? " is-selected" : ""}`}
                  type="button"
                  key={project.id}
                  aria-pressed={splitting ? selected : undefined}
                  onClick={() => {
                    if (splitting) {
                      setAllocations((current) => toggleProjectInSplit(project.id, current));
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
              projects={projects}
              activeMs={entry.activeMs}
              onChange={setAllocations}
              onAssign={() => {
                void assignSplit();
              }}
            />
          ) : null}
          {!splitting && projects.length >= 1 ? (
            <button
              className="split-btn"
              type="button"
              onClick={() => {
                setSplitting(true);
              }}
            >
              Dividir
            </button>
          ) : null}
          <div className="prompt-actions">
            {splitting ? (
              <button className="none-btn" type="button" onClick={exitSplit}>
                Volver
              </button>
            ) : (
              <button
                className="none-btn"
                type="button"
                onClick={() => {
                  void window.hora.assignHour(entry.id, { kind: "none" });
                }}
              >
                No fue un proyecto
              </button>
            )}
            <button
              className="later-btn"
              type="button"
              onClick={() => {
                void window.hora.closePrompt();
              }}
            >
              Más tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
