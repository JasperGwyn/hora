import { describe, expect, it } from "vitest";
import type { HourEntry, Project } from "./types.js";
import {
  projectTotalsFor,
  todayProjectTotals,
  workSharePercents,
  workTotalMs,
} from "./totals.js";

function project(id: string, name: string, archived = false): Project {
  return {
    id,
    name,
    color: "#C46A3A",
    archived,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function assigned(
  projectId: string,
  hourStartMs: number,
  activeMs: number,
): HourEntry {
  return {
    id: `${projectId}-${hourStartMs}`,
    hourStartMs,
    segmentStartMs: hourStartMs,
    segmentEndMs: hourStartMs + 3_600_000,
    activeMs,
    idleMs: 0,
    projectId,
    allocations: [{ projectId, percent: 100 }],
    status: "assigned",
    assignedAt: "2026-08-26T12:00:00.000Z",
  };
}

describe("workTotalMs", () => {
  it("suma solo los proyectos que cuentan como trabajo", () => {
    const fromMs = Date.UTC(2026, 7, 26, 0, 0, 0);
    const entries = [
      assigned("work", fromMs + 10 * 3_600_000, 3_600_000),
      assigned("otros", fromMs + 11 * 3_600_000, 1_800_000),
    ];
    const totals = projectTotalsFor(
      entries,
      [project("work", "Blume"), project("otros", "Otros")],
      fromMs,
    );
    expect(workTotalMs(totals)).toBe(3_600_000);
    expect(totals.find((item) => item.projectId === "otros")?.ms).toBe(1_800_000);
  });

  it("excluye Boludeo aunque todavía no se haya renombrado", () => {
    const fromMs = Date.UTC(2026, 7, 26, 0, 0, 0);
    const totals = projectTotalsFor(
      [assigned("idle", fromMs, 2_400_000), assigned("work", fromMs, 600_000)],
      [project("idle", "Boludeo"), project("work", "Cata")],
      fromMs,
    );
    expect(workTotalMs(totals)).toBe(600_000);
    expect(totals.map((item) => item.projectId)).toEqual(["work", "idle"]);
  });
});

describe("workSharePercents", () => {
  it("reparte enteros que suman 100 solo entre proyectos de trabajo", () => {
    const fromMs = Date.UTC(2026, 7, 26, 0, 0, 0);
    const totals = projectTotalsFor(
      [
        assigned("a", fromMs, 2_100_000),
        assigned("b", fromMs, 900_000),
        assigned("otros", fromMs, 3_600_000),
      ],
      [project("a", "Blume"), project("b", "Cata"), project("otros", "Otros")],
      fromMs,
    );
    const shares = workSharePercents(totals);
    expect(shares.get("a")).toBe(70);
    expect(shares.get("b")).toBe(30);
    expect(shares.has("otros")).toBe(false);
    expect([...shares.values()].reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("deja 100 al único proyecto de trabajo", () => {
    const fromMs = Date.UTC(2026, 7, 26, 0, 0, 0);
    const totals = projectTotalsFor(
      [assigned("a", fromMs, 600_000)],
      [project("a", "Blume")],
      fromMs,
    );
    expect(workSharePercents(totals).get("a")).toBe(100);
  });
});

describe("todayProjectTotals", () => {
  it("incluye proyectos activos en cero y deja Otros al final", () => {
    const fromMs = Date.UTC(2026, 7, 26, 0, 0, 0);
    const rows = todayProjectTotals(
      [assigned("otros", fromMs, 120_000)],
      [
        project("otros", "Otros"),
        project("work", "Blume"),
        project("old", "Archivado", true),
      ],
      fromMs,
    );
    expect(rows.map((item) => item.projectId)).toEqual(["work", "otros"]);
    expect(rows[0]?.ms).toBe(0);
    expect(rows[1]?.ms).toBe(120_000);
  });
});
