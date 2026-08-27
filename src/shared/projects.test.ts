import { describe, expect, it } from "vitest";
import type { Project } from "./types.js";
import {
  canonicalizeProjectName,
  countsTowardWork,
  hydrateProjects,
  NON_WORK_PROJECT_NAME,
} from "./projects.js";

function project(name: string): Project {
  return {
    id: "p1",
    name,
    color: "#C46A3A",
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("canonicalizeProjectName", () => {
  it("renombra Boludeo a Otros", () => {
    expect(canonicalizeProjectName("Boludeo")).toBe(NON_WORK_PROJECT_NAME);
    expect(canonicalizeProjectName(" boludeo ")).toBe(NON_WORK_PROJECT_NAME);
  });

  it("normaliza Otros", () => {
    expect(canonicalizeProjectName("otros")).toBe(NON_WORK_PROJECT_NAME);
    expect(canonicalizeProjectName("Otros")).toBe(NON_WORK_PROJECT_NAME);
  });

  it("deja los demás nombres intactos", () => {
    expect(canonicalizeProjectName(" Blume ")).toBe("Blume");
  });
});

describe("countsTowardWork", () => {
  it("excluye Otros y el nombre viejo Boludeo", () => {
    expect(countsTowardWork("Otros")).toBe(false);
    expect(countsTowardWork("Boludeo")).toBe(false);
    expect(countsTowardWork("Blume")).toBe(true);
  });
});

describe("hydrateProjects", () => {
  it("renombra Boludeo y marca el cambio", () => {
    const result = hydrateProjects([project("Boludeo"), project("Blume")]);
    expect(result.changed).toBe(true);
    expect(result.projects.map((item) => item.name)).toEqual(["Otros", "Blume"]);
  });

  it("no marca cambio si ya está migrado", () => {
    const result = hydrateProjects([project("Otros"), project("Blume")]);
    expect(result.changed).toBe(false);
  });
});
