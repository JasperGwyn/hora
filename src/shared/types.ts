export const APP_NAME = "Hora";
export const SAMPLE_INTERVAL_MS = 10_000;
export const DEFAULT_IDLE_THRESHOLD_SECONDS = 120;
export const DEFAULT_MIN_ACTIVE_MS_TO_PROMPT = 60_000;

export const PROJECT_COLORS = [
  "#C46A3A",
  "#D4A054",
  "#7A8F6A",
  "#5B7C99",
  "#8B6B8A",
  "#B85C4A",
  "#6A8E8F",
  "#C48B6A",
] as const;

export type WindowKind = "dashboard" | "prompt";

export type HourStatus = "open" | "pending" | "assigned" | "skipped_idle" | "unassigned";

export type Project = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  createdAt: string;
};

export type HourAllocation = {
  projectId: string;
  percent: number;
};

export type HourEntry = {
  id: string;
  hourStartMs: number;
  segmentStartMs: number;
  segmentEndMs: number | null;
  activeMs: number;
  idleMs: number;
  projectId: string | null;
  allocations: HourAllocation[];
  status: HourStatus;
  assignedAt: string | null;
};

export type AppSettings = {
  idleThresholdSeconds: number;
  minActiveMsToPrompt: number;
  launchAtLogin: boolean;
};

export type AppState = {
  projects: Project[];
  entries: HourEntry[];
  settings: AppSettings;
};

export type LiveHour = {
  hourStartMs: number;
  segmentStartMs: number;
  activeMs: number;
  idleMs: number;
  idleNow: boolean;
  idleSeconds: number;
  awaitingResume: boolean;
};

export type AssignTarget =
  | { kind: "project"; projectId: string }
  | { kind: "split"; allocations: HourAllocation[] }
  | { kind: "none" };

export const DEFAULT_SETTINGS: AppSettings = {
  idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
  minActiveMsToPrompt: DEFAULT_MIN_ACTIVE_MS_TO_PROMPT,
  launchAtLogin: true,
};

export const EMPTY_STATE: AppState = {
  projects: [],
  entries: [],
  settings: DEFAULT_SETTINGS,
};
