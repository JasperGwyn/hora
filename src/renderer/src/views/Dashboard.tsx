import { useState } from "react";
import type { JSX } from "react";
import { CircleStop, Trash2 } from "lucide-react";
import {
  entryAllocations,
  formatEntryProjectLabel,
} from "@shared/allocations";
import {
  formatClock,
  formatDayLabel,
  formatDuration,
  formatEntryRange,
  formatHourRange,
  getNextHourMs,
  startOfLocalDay,
  startOfLocalWeek,
  statusLabel,
} from "@shared/time";
import { projectTotalsFor, workTotalMs } from "@shared/totals";
import { HourRing } from "@/components/HourRing";
import { ShellHeader } from "@/components/ShellHeader";
import { TimeBars } from "@/components/TimeBars";
import { useHora } from "@/hooks/useHora";
import { logger } from "@/lib/logger";

export function Dashboard(): JSX.Element {
  const { state, live, ready } = useHora();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [closingNow, setClosingNow] = useState(false);

  const onDelete = async (entryId: string): Promise<void> => {
    if (confirmingId !== entryId) {
      setConfirmingId(entryId);
      return;
    }
    try {
      await window.hora.deleteHour(entryId);
      setConfirmingId(null);
    } catch (error) {
      logger.error("No se pudo borrar el registro", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const onCloseNow = async (): Promise<void> => {
    if (closingNow) {
      return;
    }
    setClosingNow(true);
    try {
      await window.hora.closeNow();
    } catch (error) {
      logger.error("No se pudo cerrar el tramo", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setClosingNow(false);
    }
  };

  if (!ready || !state || !live) {
    return <div className="loading">Hora</div>;
  }

  const now = Date.now();
  const todayTotals = projectTotalsFor(state.entries, state.projects, startOfLocalDay(now));
  const weekTotals = projectTotalsFor(state.entries, state.projects, startOfLocalWeek(now));
  const todayWorkMs = workTotalMs(todayTotals);
  const pending = state.entries
    .filter((entry) => entry.status === "pending")
    .sort((a, b) => a.segmentStartMs - b.segmentStartMs);
  const recent = state.entries
    .filter((entry) => entry.status !== "open")
    .sort((a, b) => b.segmentStartMs - a.segmentStartMs)
    .slice(0, 8);
  const names = new Map(state.projects.map((project) => [project.id, project.name]));
  const canCloseNow =
    !live.awaitingResume && live.activeMs >= state.settings.minActiveMsToPrompt;
  const remainderEndMs = getNextHourMs(live.hourStartMs);
  const ringCaption = live.awaitingResume
    ? "cerrado"
    : live.segmentStartMs === live.hourStartMs
      ? "hora actual"
      : "tramo actual";
  const pillAway = live.awaitingResume ? live.activeMs === 0 : live.idleNow;
  const closeHint = live.awaitingResume
    ? live.activeMs > 0
      ? "Si seguís, este tiempo se guarda en un tramo nuevo y Hora vuelve a preguntar."
      : "Este tramo ya está cerrado. Si seguís usando la computadora, Hora vuelve a preguntar."
    : canCloseNow
      ? "Registra el uso de hoy hasta ahora. Si después seguís, Hora vuelve a preguntar."
      : `Hace falta al menos ${formatDuration(state.settings.minActiveMsToPrompt)} de uso para registrar este tramo.`;
  const logEntries = pending.length > 0 ? pending : recent;

  return (
    <div className="app-shell">
      <ShellHeader launchAtLogin={state.settings.launchAtLogin} />
      <main className="main">
        <section className="hero">
          <HourRing
            activeMs={live.activeMs}
            idleMs={live.idleMs}
            capacityMs={remainderEndMs - live.segmentStartMs}
            label={formatClock(new Date(live.segmentStartMs))}
            caption={ringCaption}
          />
          <div className="hour-copy">
            <h1>{formatHourRange(live.segmentStartMs, remainderEndMs)}</h1>
            <p>
              {live.awaitingResume
                ? "Ya registraste el uso de este tramo. Si seguís en la computadora, Hora abre otro y te vuelve a preguntar."
                : "Solo cuenta el tiempo en el que usás la computadora. Si la hora pasa sin actividad, Hora ni siquiera pregunta."}
            </p>
            <div className={`status-pill${pillAway ? " away" : ""}`}>
              <span className="dot" />
              {live.awaitingResume
                ? live.activeMs > 0
                  ? "Seguís después de cerrar"
                  : "Tramo cerrado"
                : live.idleNow
                  ? "Computadora en reposo"
                  : "Estás usando la computadora"}
            </div>
            <div className="metrics">
              <div className="metric active">
                <b>{formatDuration(live.activeMs)}</b>
                <span>activos</span>
              </div>
              <div className="metric idle">
                <b>{formatDuration(live.idleMs)}</b>
                <span>en reposo</span>
              </div>
            </div>
            <div className="hero-actions">
              <button
                className="primary-btn close-now-btn"
                type="button"
                disabled={!canCloseNow || closingNow}
                onClick={() => {
                  void onCloseNow();
                }}
              >
                <CircleStop size={16} />
                Cerrar ahora
              </button>
              <p className="close-now-hint">{closeHint}</p>
            </div>
          </div>
        </section>

        <section className="panel log-panel">
          <h2>{pending.length > 0 ? "Pendientes" : "Horas recientes"}</h2>
          {logEntries.length === 0 ? (
            <p className="empty">Cuando cierre la hora, aparece acá el registro.</p>
          ) : (
            <div className="entry-list">
              {logEntries.map((entry) => {
                const assignedLabel =
                  entry.status === "assigned"
                    ? formatEntryProjectLabel(entryAllocations(entry), names)
                    : null;
                return (
                  <div
                    className={`entry${entry.status === "pending" ? " pending" : ""}`}
                    key={entry.id}
                  >
                    <div>
                      <strong>
                        {formatDayLabel(entry.hourStartMs)} · {formatEntryRange(entry)}
                      </strong>
                      <br />
                      <small>
                        {formatDuration(entry.activeMs)} activos
                        {assignedLabel
                          ? ` · ${assignedLabel}`
                          : ` · ${statusLabel(entry.status)}`}
                      </small>
                    </div>
                    <div className="entry-actions">
                      {entry.status === "pending" ? (
                        <button
                          className="ghost-btn"
                          type="button"
                          onClick={() => {
                            void window.hora.openPrompt();
                          }}
                        >
                          Asignar
                        </button>
                      ) : null}
                      <button
                        className={`icon-btn entry-delete${confirmingId === entry.id ? " is-confirm" : ""}`}
                        type="button"
                        aria-label={
                          confirmingId === entry.id
                            ? "Confirmar borrado"
                            : "Borrar registro"
                        }
                        onClick={() => {
                          void onDelete(entry.id);
                        }}
                      >
                        {confirmingId === entry.id ? "Borrar" : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panels">
          <div className="panel">
            <div className="panel-head">
              <h2>Hoy</h2>
              {todayTotals.length > 0 ? (
                <b className="panel-total">{formatDuration(todayWorkMs)}</b>
              ) : null}
            </div>
            <TimeBars
              rows={todayTotals}
              empty="Todavía no hay horas asignadas hoy."
            />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Esta semana</h2>
            </div>
            <TimeBars
              rows={weekTotals}
              empty="Todavía no hay horas asignadas. Al cerrar cada hora, Hora te va a preguntar a qué proyecto le dedicaste el tiempo de uso real."
            />
          </div>
        </section>
      </main>
    </div>
  );
}
