import type { HourEntry, HourStatus } from "./types.js";

export function getHourStartMs(nowMs: number): number {
  const date = new Date(nowMs);
  date.setMinutes(0, 0, 0);
  date.setMilliseconds(0);
  return date.getTime();
}

export function getNextHourMs(nowMs: number): number {
  return getHourStartMs(nowMs) + 60 * 60 * 1000;
}

export function msUntilNextHour(nowMs: number): number {
  return Math.max(50, getNextHourMs(nowMs) - nowMs);
}

export function classifySample(
  idleSeconds: number,
  thresholdSeconds: number,
): "active" | "idle" {
  return idleSeconds >= thresholdSeconds ? "idle" : "active";
}

export function shouldPromptForHour(
  activeMs: number,
  minActiveMs: number,
): boolean {
  return activeMs >= minActiveMs;
}

export function hydrateSegmentBounds(
  hourStartMs: number,
  status: HourStatus,
  segmentStartMs?: number,
  segmentEndMs?: number | null,
): { segmentStartMs: number; segmentEndMs: number | null } {
  const start = segmentStartMs ?? hourStartMs;
  if (segmentEndMs !== undefined) {
    return { segmentStartMs: start, segmentEndMs };
  }
  if (status === "open") {
    return { segmentStartMs: start, segmentEndMs: null };
  }
  return { segmentStartMs: start, segmentEndMs: getNextHourMs(hourStartMs) };
}

export function closeOpenHour(
  entry: HourEntry,
  minActiveMs: number,
  endedAtMs: number,
): HourEntry {
  if (entry.status !== "open") {
    return entry;
  }
  const status = shouldPromptForHour(entry.activeMs, minActiveMs)
    ? "pending"
    : "skipped_idle";
  return { ...entry, status, segmentEndMs: endedAtMs };
}

export function shouldOpenFollowUpSegment(
  hasOpenHour: boolean,
  kind: "active" | "idle",
): boolean {
  return hasOpenHour || kind === "active";
}

export function shouldPromoteFollowUp(
  pendingActiveMs: number,
  minActiveMs: number,
): boolean {
  return pendingActiveMs >= minActiveMs;
}

export function resolveStaleOpenHours(
  entries: HourEntry[],
  currentHourStartMs: number,
  minActiveMs: number,
): { entries: HourEntry[]; closed: HourEntry[] } {
  const closed: HourEntry[] = [];
  const next = entries.map((entry) => {
    if (entry.status !== "open" || entry.hourStartMs === currentHourStartMs) {
      return entry;
    }
    const updated = closeOpenHour(entry, minActiveMs, getNextHourMs(entry.hourStartMs));
    closed.push(updated);
    return updated;
  });
  return { entries: next, closed };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  if (minutes > 0) {
    return seconds > 0 && minutes < 5 ? `${minutes} min ${seconds} s` : `${minutes} min`;
  }
  return `${seconds} s`;
}

export function formatHourRange(startMs: number, endMs = getNextHourMs(startMs)): string {
  return `${formatClock(new Date(startMs))} – ${formatClock(new Date(endMs))}`;
}

export function formatEntryRange(entry: Pick<HourEntry, "segmentStartMs" | "segmentEndMs">): string {
  const endMs = entry.segmentEndMs ?? getNextHourMs(entry.segmentStartMs);
  return formatHourRange(entry.segmentStartMs, endMs);
}

export function formatClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDayLabel(hourStartMs: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(hourStartMs));
}

export function isSameLocalDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfLocalDay(nowMs: number): number {
  const date = new Date(nowMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfLocalWeek(nowMs: number): number {
  const date = new Date(nowMs);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function statusLabel(status: HourStatus): string {
  switch (status) {
    case "open":
      return "En curso";
    case "pending":
      return "Pendiente";
    case "assigned":
      return "Asignada";
    case "skipped_idle":
      return "Sin uso";
    case "unassigned":
      return "Sin proyecto";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function isClosedEntry(entry: HourEntry): boolean {
  return entry.status !== "open";
}

export function applySample(
  entry: HourEntry,
  elapsedMs: number,
  kind: "active" | "idle",
): HourEntry {
  if (kind === "active") {
    return { ...entry, activeMs: entry.activeMs + elapsedMs };
  }
  return { ...entry, idleMs: entry.idleMs + elapsedMs };
}
