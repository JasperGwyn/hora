import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { X } from "lucide-react";
import { formatDuration, formatEntryRange, promptEntryForFocus } from "@shared/time";
import { HourAssignForm } from "@/components/HourAssignForm";
import { useHora } from "@/hooks/useHora";
import { logger } from "@/lib/logger";

export function HourPrompt(): JSX.Element {
  const { state, ready } = useHora();
  const [splitting, setSplitting] = useState(false);
  const [focusId, setFocusId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const next = await window.hora.getPromptFocus();
        if (!cancelled) {
          setFocusId(next);
        }
      } catch (error) {
        logger.error("No se pudo leer el tramo del prompt", {
          message: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setFocusId(null);
        }
      }
    };
    void load();
    const off = window.hora.onPromptFocus(setFocusId);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const entry = useMemo(
    () => (state && focusId !== undefined ? promptEntryForFocus(state.entries, focusId) : null),
    [focusId, state],
  );
  const projects = state?.projects ?? [];
  const editing = entry !== null && entry.status !== "pending";

  if (!ready || !state || focusId === undefined) {
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

  return (
    <div className="prompt-body">
      <div className="prompt-chrome">
        {splitting ? "Dividir hora" : editing ? "Editar hora" : "Cierre de hora"}
        <button
          type="button"
          aria-label={editing ? "Cerrar" : "Más tarde"}
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
        <HourAssignForm
          key={entry.id}
          entry={entry}
          projects={projects}
          tone="prompt"
          assignLabel={editing ? "Guardar" : "Asignar"}
          dismissLabel={editing ? "Cerrar" : "Más tarde"}
          onDone={() => undefined}
          onDismiss={() => {
            void window.hora.closePrompt();
          }}
          onSplittingChange={setSplitting}
        />
      </div>
    </div>
  );
}
