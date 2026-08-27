import { allocatedMsByProject, entryAllocations } from "./allocations.js";
import { countsTowardWork } from "./projects.js";
import type { HourEntry, Project } from "./types.js";

export type ProjectTotal = {
  projectId: string;
  name: string;
  color: string;
  ms: number;
  countsTowardWork: boolean;
};

function projectMap(projects: Project[]): Map<string, Project> {
  return new Map(projects.map((project) => [project.id, project]));
}

function toTotal(projectId: string, ms: number, known: Map<string, Project>): ProjectTotal {
  const project = known.get(projectId);
  const name = project?.name ?? "Proyecto archivado";
  return {
    projectId,
    name,
    color: project?.color ?? "#9a9186",
    ms,
    countsTowardWork: countsTowardWork(name),
  };
}

export function assignedMsByProject(entries: HourEntry[], fromMs: number): Map<string, number> {
  const bucket = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status !== "assigned" || entry.hourStartMs < fromMs) {
      continue;
    }
    const allocations = entryAllocations(entry);
    if (allocations.length === 0) {
      continue;
    }
    const byProject = allocatedMsByProject(entry.activeMs, allocations);
    for (const [projectId, ms] of byProject) {
      bucket.set(projectId, (bucket.get(projectId) ?? 0) + ms);
    }
  }
  return bucket;
}

export function projectTotalsFor(
  entries: HourEntry[],
  projects: Project[],
  fromMs: number,
): ProjectTotal[] {
  const known = projectMap(projects);
  return sortTodayRows(
    [...assignedMsByProject(entries, fromMs).entries()].map(([projectId, ms]) =>
      toTotal(projectId, ms, known),
    ),
  );
}

export function sortTodayRows(rows: ProjectTotal[]): ProjectTotal[] {
  return [...rows].sort((a, b) => {
    if (a.countsTowardWork !== b.countsTowardWork) {
      return a.countsTowardWork ? -1 : 1;
    }
    if (b.ms !== a.ms) {
      return b.ms - a.ms;
    }
    return a.name.localeCompare(b.name, "es");
  });
}

export function todayProjectTotals(
  entries: HourEntry[],
  projects: Project[],
  fromMs: number,
): ProjectTotal[] {
  const bucket = assignedMsByProject(entries, fromMs);
  const rows = projects
    .filter((project) => !project.archived)
    .map((project) => ({
      projectId: project.id,
      name: project.name,
      color: project.color,
      ms: bucket.get(project.id) ?? 0,
      countsTowardWork: countsTowardWork(project.name),
    }));
  return sortTodayRows(rows);
}

export function workTotalMs(rows: ProjectTotal[]): number {
  return rows.reduce((sum, row) => (row.countsTowardWork ? sum + row.ms : sum), 0);
}

export function workSharePercents(rows: ProjectTotal[]): Map<string, number> {
  const work = rows.filter((row) => row.countsTowardWork && row.ms > 0);
  const total = work.reduce((sum, row) => sum + row.ms, 0);
  const shares = new Map<string, number>();
  if (total === 0) {
    return shares;
  }
  let assigned = 0;
  work.forEach((row, index) => {
    const isLast = index === work.length - 1;
    const percent = isLast
      ? Math.max(0, 100 - assigned)
      : Math.round((row.ms / total) * 100);
    assigned += percent;
    shares.set(row.projectId, percent);
  });
  return shares;
}
