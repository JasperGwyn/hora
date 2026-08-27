import { describe, expect, it } from "vitest";
import { DEFAULT_MIN_ACTIVE_MS_TO_PROMPT } from "./types.js";
import {
  applySample,
  classifySample,
  closeOpenHour,
  formatDuration,
  formatEntryRange,
  formatHourRange,
  getHourStartMs,
  getNextHourMs,
  hydrateSegmentBounds,
  resolveStaleOpenHours,
  shouldOpenFollowUpSegment,
  shouldPromoteFollowUp,
  shouldPromptForHour,
} from "./time.js";
import type { HourEntry } from "./types.js";

describe("getHourStartMs", () => {
  it("alinea al comienzo de la hora local", () => {
    const date = new Date(2026, 7, 25, 14, 37, 12, 500);
    const start = new Date(getHourStartMs(date.getTime()));
    expect(start.getHours()).toBe(14);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });
});

describe("getNextHourMs", () => {
  it("devuelve el siguiente límite de hora", () => {
    const date = new Date(2026, 7, 25, 14, 59, 0, 0);
    const next = new Date(getNextHourMs(date.getTime()));
    expect(next.getHours()).toBe(15);
    expect(next.getMinutes()).toBe(0);
  });
});

describe("classifySample", () => {
  it("marca activo si el idle está bajo el umbral", () => {
    expect(classifySample(90, 120)).toBe("active");
  });

  it("marca idle si no hubo input por el umbral o más", () => {
    expect(classifySample(120, 120)).toBe("idle");
    expect(classifySample(180, 120)).toBe("idle");
  });
});

describe("shouldPromptForHour", () => {
  it("no pregunta si la computadora no se usó", () => {
    expect(shouldPromptForHour(0, DEFAULT_MIN_ACTIVE_MS_TO_PROMPT)).toBe(false);
    expect(shouldPromptForHour(20_000, DEFAULT_MIN_ACTIVE_MS_TO_PROMPT)).toBe(false);
  });

  it("pregunta si hubo uso real", () => {
    expect(shouldPromptForHour(5 * 60_000, DEFAULT_MIN_ACTIVE_MS_TO_PROMPT)).toBe(true);
  });
});

describe("resolveStaleOpenHours", () => {
  const minActiveMs = DEFAULT_MIN_ACTIVE_MS_TO_PROMPT;
  const yesterday19 = new Date(2026, 7, 25, 19, 0, 0, 0).getTime();
  const today09 = new Date(2026, 7, 26, 9, 0, 0, 0).getTime();

  function openEntry(hourStartMs: number, activeMs: number): HourEntry {
    return {
      id: `h-${hourStartMs}`,
      hourStartMs,
      segmentStartMs: hourStartMs,
      segmentEndMs: null,
      activeMs,
      idleMs: 5_000,
      projectId: null,
      allocations: [],
      status: "open",
      assignedAt: null,
    };
  }

  it("deja pendiente la hora de ayer si hubo uso real", () => {
    const leftover = openEntry(yesterday19, 40 * 60_000);
    const { entries, closed } = resolveStaleOpenHours(
      [leftover],
      today09,
      minActiveMs,
    );
    expect(closed).toHaveLength(1);
    expect(closed[0]?.status).toBe("pending");
    expect(entries[0]?.status).toBe("pending");
    expect(closed[0]?.segmentEndMs).toBe(getNextHourMs(yesterday19));
  });

  it("marca sin uso si la hora vieja no llegó al mínimo", () => {
    const leftover = openEntry(yesterday19, 20_000);
    const { closed } = resolveStaleOpenHours([leftover], today09, minActiveMs);
    expect(closed[0]?.status).toBe("skipped_idle");
  });

  it("no cierra la hora actual si se reinicia en el mismo tramo", () => {
    const current = openEntry(today09, 12 * 60_000);
    const { entries, closed } = resolveStaleOpenHours(
      [current],
      today09,
      minActiveMs,
    );
    expect(closed).toHaveLength(0);
    expect(entries[0]?.status).toBe("open");
    expect(entries[0]?.activeMs).toBe(12 * 60_000);
  });

  it("no toca horas ya cerradas", () => {
    const assigned: HourEntry = {
      ...openEntry(yesterday19, 30 * 60_000),
      status: "assigned",
      assignedAt: "2026-08-25T20:00:00.000Z",
    };
    const { entries, closed } = resolveStaleOpenHours(
      [assigned],
      today09,
      minActiveMs,
    );
    expect(closed).toHaveLength(0);
    expect(entries[0]?.status).toBe("assigned");
  });
});

describe("applySample", () => {
  const base: HourEntry = {
    id: "h1",
    hourStartMs: 0,
    segmentStartMs: 0,
    segmentEndMs: null,
    activeMs: 0,
    idleMs: 0,
    projectId: null,
    allocations: [],
    status: "open",
    assignedAt: null,
  };

  it("acumula activo e idle por separado", () => {
    const active = applySample(base, 10_000, "active");
    const idle = applySample(active, 10_000, "idle");
    expect(idle.activeMs).toBe(10_000);
    expect(idle.idleMs).toBe(10_000);
  });
});

describe("formatDuration", () => {
  it("formatea minutos y horas", () => {
    expect(formatDuration(90_000)).toBe("1 min 30 s");
    expect(formatDuration(3_600_000)).toBe("1 h");
  });
});

describe("formatHourRange", () => {
  it("usa el fin de la hora calendario por defecto", () => {
    const start = new Date(2026, 7, 25, 20, 0, 0, 0).getTime();
    expect(formatHourRange(start)).toBe("20:00 – 21:00");
  });

  it("muestra un tramo cerrado antes de que termine la hora", () => {
    const start = new Date(2026, 7, 25, 20, 0, 0, 0).getTime();
    const end = new Date(2026, 7, 25, 20, 20, 0, 0).getTime();
    expect(formatHourRange(start, end)).toBe("20:00 – 20:20");
  });
});

describe("formatEntryRange", () => {
  it("usa el fin real del tramo si está cerrado", () => {
    const hourStart = new Date(2026, 7, 25, 20, 0, 0, 0).getTime();
    expect(
      formatEntryRange({
        segmentStartMs: hourStart,
        segmentEndMs: hourStart + 20 * 60_000,
      }),
    ).toBe("20:00 – 20:20");
  });
});

describe("hydrateSegmentBounds", () => {
  const hourStart = new Date(2026, 7, 25, 20, 0, 0, 0).getTime();

  it("completa horas viejas cerradas como el tramo completo", () => {
    expect(hydrateSegmentBounds(hourStart, "assigned")).toEqual({
      segmentStartMs: hourStart,
      segmentEndMs: getNextHourMs(hourStart),
    });
  });

  it("deja abierta una hora en curso sin fin", () => {
    expect(hydrateSegmentBounds(hourStart, "open")).toEqual({
      segmentStartMs: hourStart,
      segmentEndMs: null,
    });
  });

  it("conserva un cierre anticipado ya persistido", () => {
    const end = hourStart + 20 * 60_000;
    expect(hydrateSegmentBounds(hourStart, "pending", hourStart, end)).toEqual({
      segmentStartMs: hourStart,
      segmentEndMs: end,
    });
  });
});

describe("closeOpenHour", () => {
  it("cierra el tramo en el instante pedido y lo deja pendiente", () => {
    const hourStart = new Date(2026, 7, 25, 20, 0, 0, 0).getTime();
    const endedAt = new Date(2026, 7, 25, 20, 20, 0, 0).getTime();
    const closed = closeOpenHour(
      {
        id: "h1",
        hourStartMs: hourStart,
        segmentStartMs: hourStart,
        segmentEndMs: null,
        activeMs: 15 * 60_000,
        idleMs: 0,
        projectId: null,
        allocations: [],
        status: "open",
        assignedAt: null,
      },
      DEFAULT_MIN_ACTIVE_MS_TO_PROMPT,
      endedAt,
    );
    expect(closed.status).toBe("pending");
    expect(closed.segmentEndMs).toBe(endedAt);
  });
});

describe("shouldOpenFollowUpSegment", () => {
  it("no abre un tramo nuevo si el anterior se cerró y seguís en reposo", () => {
    expect(shouldOpenFollowUpSegment(false, "idle")).toBe(false);
  });

  it("abre un tramo nuevo apenas volvés a usar la computadora", () => {
    expect(shouldOpenFollowUpSegment(false, "active")).toBe(true);
  });

  it("sigue muestreando si ya hay un tramo abierto", () => {
    expect(shouldOpenFollowUpSegment(true, "idle")).toBe(true);
    expect(shouldOpenFollowUpSegment(true, "active")).toBe(true);
  });
});

describe("shouldPromoteFollowUp", () => {
  it("no crea el tramo de continuación hasta que haya uso real", () => {
    expect(shouldPromoteFollowUp(20_000, DEFAULT_MIN_ACTIVE_MS_TO_PROMPT)).toBe(false);
    expect(shouldPromoteFollowUp(60_000, DEFAULT_MIN_ACTIVE_MS_TO_PROMPT)).toBe(true);
  });
});
