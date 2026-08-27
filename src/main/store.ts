import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app } from "electron";
import { DEFAULT_IDLE_THRESHOLD_SECONDS, EMPTY_STATE, PROJECT_COLORS } from "@shared/types";
import type {
  AppSettings,
  AppState,
  AssignTarget,
  HourEntry,
  Project,
} from "@shared/types";
import {
  isValidSplit,
  migrateEntryAllocations,
  primaryProjectId,
  singleAllocation,
} from "@shared/allocations";
import { canonicalizeProjectName, hydrateProjects } from "@shared/projects";
import {
  closeOpenHour,
  hydrateSegmentBounds,
  resolveStaleOpenHours,
} from "@shared/time";
import { createLogger } from "@shared/logger";

const logger = createLogger("store");

function dataPath(): string {
  return join(app.getPath("userData"), "hora-data.json");
}

function nextColor(projects: Project[]): string {
  return PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
}

function cloneState(state: AppState): AppState {
  return structuredClone(state);
}

function hydrateEntry(entry: HourEntry): HourEntry {
  const migrated = migrateEntryAllocations(
    entry.projectId,
    "allocations" in entry ? entry.allocations : undefined,
  );
  const bounds = hydrateSegmentBounds(
    entry.hourStartMs,
    entry.status,
    "segmentStartMs" in entry ? entry.segmentStartMs : undefined,
    "segmentEndMs" in entry ? entry.segmentEndMs : undefined,
  );
  return { ...entry, ...migrated, ...bounds };
}

function projectExists(projects: Project[], projectId: string): boolean {
  return projects.some((project) => project.id === projectId);
}

function assignedEntry(
  entry: HourEntry,
  target: AssignTarget,
  assignedAt: string,
  projects: Project[],
): HourEntry {
  switch (target.kind) {
    case "project":
      return {
        ...entry,
        assignedAt,
        projectId: target.projectId,
        allocations: singleAllocation(target.projectId),
        status: "assigned",
      };
    case "split": {
      if (!isValidSplit(target.allocations)) {
        throw new Error("El split tiene que sumar 100% entre al menos dos proyectos");
      }
      for (const item of target.allocations) {
        if (!projectExists(projects, item.projectId)) {
          throw new Error("Proyecto no encontrado");
        }
      }
      return {
        ...entry,
        assignedAt,
        projectId: primaryProjectId(target.allocations),
        allocations: target.allocations,
        status: "assigned",
      };
    }
    case "none":
      return {
        ...entry,
        assignedAt,
        projectId: null,
        allocations: [],
        status: "unassigned",
      };
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

export class HoraStore {
  private state: AppState = cloneState(EMPTY_STATE);
  private saveChain: Promise<void> = Promise.resolve();

  getState(): AppState {
    return cloneState(this.state);
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(dataPath(), "utf8");
      const parsed = JSON.parse(raw) as Partial<AppState>;
      const hydratedProjects = hydrateProjects(
        Array.isArray(parsed.projects) ? parsed.projects : [],
      );
      this.state = {
        projects: hydratedProjects.projects,
        entries: Array.isArray(parsed.entries)
          ? parsed.entries.map((entry) => hydrateEntry(entry))
          : [],
        settings: {
          ...EMPTY_STATE.settings,
          ...(parsed.settings ?? {}),
          idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
        },
      };
      if (hydratedProjects.changed) {
        await this.save();
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        logger.warn("No se pudo leer el estado, se usa vacío", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      this.state = cloneState(EMPTY_STATE);
    }
  }

  async save(): Promise<void> {
    const run = this.saveChain.then(() => this.writeState());
    this.saveChain = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }

  private async writeState(): Promise<void> {
    const file = dataPath();
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(this.state, null, 2), "utf8");
    await rename(tmp, file);
  }

  getSettings(): AppSettings {
    return { ...this.state.settings };
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    this.state.settings = { ...this.state.settings, ...patch };
    await this.save();
    return this.getSettings();
  }

  addProject(name: string): Project {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("El nombre del proyecto no puede estar vacío");
    }
    const project: Project = {
      id: crypto.randomUUID(),
      name: canonicalizeProjectName(trimmed),
      color: nextColor(this.state.projects),
      archived: false,
      createdAt: new Date().toISOString(),
    };
    this.state.projects = [...this.state.projects, project];
    return project;
  }

  renameProject(id: string, name: string): Project {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("El nombre del proyecto no puede estar vacío");
    }
    this.state.projects = this.state.projects.map((project) =>
      project.id === id ? { ...project, name: canonicalizeProjectName(trimmed) } : project,
    );
    const updated = this.state.projects.find((project) => project.id === id);
    if (!updated) {
      throw new Error("Proyecto no encontrado");
    }
    return updated;
  }

  archiveProject(id: string): void {
    this.state.projects = this.state.projects.map((project) =>
      project.id === id ? { ...project, archived: true } : project,
    );
  }

  upsertOpenHour(hourStartMs: number, segmentStartMs = hourStartMs): HourEntry {
    const existing = this.state.entries.find(
      (entry) => entry.hourStartMs === hourStartMs && entry.status === "open",
    );
    if (existing) {
      return existing;
    }
    const created: HourEntry = {
      id: crypto.randomUUID(),
      hourStartMs,
      segmentStartMs,
      segmentEndMs: null,
      activeMs: 0,
      idleMs: 0,
      projectId: null,
      allocations: [],
      status: "open",
      assignedAt: null,
    };
    this.state.entries = [...this.state.entries, created];
    return created;
  }

  findOpenHour(hourStartMs: number): HourEntry | null {
    return (
      this.state.entries.find(
        (entry) => entry.hourStartMs === hourStartMs && entry.status === "open",
      ) ?? null
    );
  }

  hasClosedEntryForHour(hourStartMs: number): boolean {
    return this.state.entries.some(
      (entry) => entry.hourStartMs === hourStartMs && entry.status !== "open",
    );
  }

  latestSegmentEndForHour(hourStartMs: number): number | null {
    const ends = this.state.entries
      .filter((entry) => entry.hourStartMs === hourStartMs && entry.segmentEndMs !== null)
      .map((entry) => entry.segmentEndMs)
      .filter((end): end is number => end !== null);
    if (ends.length === 0) {
      return null;
    }
    return Math.max(...ends);
  }

  updateOpenHour(hourStartMs: number, patch: Pick<HourEntry, "activeMs" | "idleMs">): void {
    this.state.entries = this.state.entries.map((entry) =>
      entry.hourStartMs === hourStartMs && entry.status === "open"
        ? { ...entry, ...patch }
        : entry,
    );
  }

  closeHour(hourStartMs: number, minActiveMs: number, endedAtMs: number): HourEntry | null {
    const open = this.state.entries.find(
      (entry) => entry.hourStartMs === hourStartMs && entry.status === "open",
    );
    if (!open) {
      return null;
    }
    const closed = closeOpenHour(open, minActiveMs, endedAtMs);
    this.state.entries = this.state.entries.map((entry) =>
      entry.id === open.id ? closed : entry,
    );
    return closed;
  }

  closeStaleOpenHours(currentHourStartMs: number): HourEntry[] {
    const result = resolveStaleOpenHours(
      this.state.entries,
      currentHourStartMs,
      this.state.settings.minActiveMsToPrompt,
    );
    this.state.entries = result.entries;
    return result.closed;
  }

  assignHour(entryId: string, target: AssignTarget): HourEntry {
    const entry = this.state.entries.find((item) => item.id === entryId);
    if (!entry) {
      throw new Error("Hora no encontrada");
    }
    const assignedAt = new Date().toISOString();
    const next = assignedEntry(entry, target, assignedAt, this.state.projects);
    this.state.entries = this.state.entries.map((item) =>
      item.id === entryId ? next : item,
    );
    return next;
  }

  deleteHour(entryId: string): HourEntry {
    const entry = this.state.entries.find((item) => item.id === entryId);
    if (!entry) {
      throw new Error("Hora no encontrada");
    }
    if (entry.status === "open") {
      throw new Error("No se puede borrar la hora en curso");
    }
    this.state.entries = this.state.entries.filter((item) => item.id !== entryId);
    return entry;
  }

  oldestPending(): HourEntry | null {
    const pending = this.state.entries
      .filter((entry) => entry.status === "pending")
      .sort((a, b) => a.segmentStartMs - b.segmentStartMs);
    return pending[0] ?? null;
  }

  pendingCount(): number {
    return this.state.entries.filter((entry) => entry.status === "pending").length;
  }
}
