import { describe, expect, it } from "vitest";
import {
  allocatedMsByProject,
  equalAllocations,
  equalPercents,
  entryAllocations,
  formatEntryProjectLabel,
  isValidSplit,
  migrateEntryAllocations,
  nudgeAllocation,
  setTwoWayPercent,
  singleAllocation,
  toggleProjectInSplit,
} from "./allocations.js";

describe("equalPercents", () => {
  it("reparte enteros que siempre suman 100", () => {
    expect(equalPercents(2)).toEqual([50, 50]);
    expect(equalPercents(3)).toEqual([34, 33, 33]);
    expect(equalPercents(1)).toEqual([100]);
    expect(equalPercents(0)).toEqual([]);
  });
});

describe("isValidSplit", () => {
  it("pide al menos dos proyectos que sumen 100", () => {
    expect(isValidSplit(singleAllocation("a"))).toBe(false);
    expect(isValidSplit(equalAllocations(["a", "b"]))).toBe(true);
    expect(
      isValidSplit([
        { projectId: "a", percent: 70 },
        { projectId: "b", percent: 30 },
      ]),
    ).toBe(true);
    expect(
      isValidSplit([
        { projectId: "a", percent: 70 },
        { projectId: "a", percent: 30 },
      ]),
    ).toBe(false);
  });
});

describe("migrateEntryAllocations", () => {
  it("reconstruye 100% desde el projectId viejo", () => {
    expect(migrateEntryAllocations("p1", undefined)).toEqual({
      projectId: "p1",
      allocations: [{ projectId: "p1", percent: 100 }],
    });
  });

  it("conserva un split ya persistido", () => {
    const allocations = [
      { projectId: "a", percent: 70 },
      { projectId: "b", percent: 30 },
    ];
    expect(migrateEntryAllocations(null, allocations)).toEqual({
      projectId: "a",
      allocations,
    });
  });
});

describe("entryAllocations", () => {
  it("cae al projectId si no hay allocations", () => {
    expect(
      entryAllocations({
        projectId: "p1",
        allocations: [],
      }),
    ).toEqual([{ projectId: "p1", percent: 100 }]);
  });
});

describe("allocatedMsByProject", () => {
  it("imputa proporcional y deja el resto al último para no perder ms", () => {
    const byProject = allocatedMsByProject(60_000, [
      { projectId: "a", percent: 70 },
      { projectId: "b", percent: 30 },
    ]);
    expect(byProject.get("a")).toBe(42_000);
    expect(byProject.get("b")).toBe(18_000);
  });

  it("cierra el redondeo en el último proyecto", () => {
    const byProject = allocatedMsByProject(100_000, equalAllocations(["a", "b", "c"]));
    const total = [...byProject.values()].reduce((sum, ms) => sum + ms, 0);
    expect(total).toBe(100_000);
  });
});

describe("setTwoWayPercent", () => {
  it("ajusta el par para que sume 100", () => {
    expect(
      setTwoWayPercent(
        [
          { projectId: "a", percent: 50 },
          { projectId: "b", percent: 50 },
        ],
        70,
      ),
    ).toEqual([
      { projectId: "a", percent: 70 },
      { projectId: "b", percent: 30 },
    ]);
  });
});

describe("nudgeAllocation", () => {
  it("mueve 5 puntos entre dos proyectos", () => {
    expect(
      nudgeAllocation(
        [
          { projectId: "a", percent: 50 },
          { projectId: "b", percent: 50 },
        ],
        "a",
        5,
      ),
    ).toEqual([
      { projectId: "a", percent: 55 },
      { projectId: "b", percent: 45 },
    ]);
  });

  it("toma del más grande cuando hay tres", () => {
    expect(
      nudgeAllocation(
        [
          { projectId: "a", percent: 40 },
          { projectId: "b", percent: 35 },
          { projectId: "c", percent: 25 },
        ],
        "c",
        5,
      ),
    ).toEqual([
      { projectId: "a", percent: 35 },
      { projectId: "b", percent: 35 },
      { projectId: "c", percent: 30 },
    ]);
  });
});

describe("toggleProjectInSplit", () => {
  it("reparte en partes iguales al sumar o sacar un proyecto", () => {
    expect(toggleProjectInSplit("b", singleAllocation("a"))).toEqual(equalAllocations(["a", "b"]));
    expect(toggleProjectInSplit("a", equalAllocations(["a", "b"]))).toEqual(singleAllocation("b"));
  });
});

describe("formatEntryProjectLabel", () => {
  const names = new Map([
    ["a", "Blume"],
    ["b", "Cata"],
  ]);

  it("omite el 100% para no ensuciar el caso simple", () => {
    expect(formatEntryProjectLabel(singleAllocation("a"), names)).toBe("Blume");
  });

  it("muestra porcentajes cuando hay split", () => {
    expect(
      formatEntryProjectLabel(
        [
          { projectId: "a", percent: 70 },
          { projectId: "b", percent: 30 },
        ],
        names,
      ),
    ).toBe("Blume 70% · Cata 30%");
  });
});
