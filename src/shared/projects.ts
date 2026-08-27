import type { Project } from "./types.js";

export const NON_WORK_PROJECT_NAME = "Otros";

const LEGACY_NON_WORK_NAMES = ["boludeo"] as const;

function normalizeProjectName(name: string): string {
  return name.trim().toLocaleLowerCase("es");
}

export function canonicalizeProjectName(name: string): string {
  const trimmed = name.trim();
  const normalized = normalizeProjectName(trimmed);
  if (normalized === normalizeProjectName(NON_WORK_PROJECT_NAME)) {
    return NON_WORK_PROJECT_NAME;
  }
  if (LEGACY_NON_WORK_NAMES.some((legacy) => legacy === normalized)) {
    return NON_WORK_PROJECT_NAME;
  }
  return trimmed;
}

export function countsTowardWork(name: string): boolean {
  return canonicalizeProjectName(name) !== NON_WORK_PROJECT_NAME;
}

export function hydrateProjects(projects: Project[]): {
  projects: Project[];
  changed: boolean;
} {
  const next = projects.map((project) => ({
    ...project,
    name: canonicalizeProjectName(project.name),
  }));
  const changed = next.some((project, index) => project.name !== projects[index]?.name);
  return { projects: next, changed };
}
