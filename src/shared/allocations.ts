import type { HourAllocation, HourEntry } from "./types.js";

export const ALLOCATION_STEP = 5;
export const MIN_ALLOCATION_PERCENT = 5;

export function singleAllocation(projectId: string): HourAllocation[] {
  return [{ projectId, percent: 100 }];
}

export function equalPercents(count: number): number[] {
  if (count <= 0) {
    return [];
  }
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function equalAllocations(projectIds: string[]): HourAllocation[] {
  const percents = equalPercents(projectIds.length);
  return projectIds.map((projectId, index) => ({
    projectId,
    percent: percents[index] ?? 0,
  }));
}

export function primaryProjectId(allocations: HourAllocation[]): string | null {
  if (allocations.length === 0) {
    return null;
  }
  const ranked = [...allocations].sort((a, b) => b.percent - a.percent);
  return ranked[0]?.projectId ?? null;
}

export function allocationsSum(allocations: HourAllocation[]): number {
  return allocations.reduce((sum, item) => sum + item.percent, 0);
}

export function isValidSplit(allocations: HourAllocation[]): boolean {
  if (allocations.length < 2) {
    return false;
  }
  const seen = new Set<string>();
  for (const item of allocations) {
    if (!Number.isInteger(item.percent) || item.percent < 1 || item.percent > 99) {
      return false;
    }
    if (item.projectId.length === 0 || seen.has(item.projectId)) {
      return false;
    }
    seen.add(item.projectId);
  }
  return allocationsSum(allocations) === 100;
}

export function parseAllocations(raw: unknown): HourAllocation[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: HourAllocation[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.projectId !== "string" || record.projectId.length === 0) {
      continue;
    }
    if (typeof record.percent !== "number" || !Number.isFinite(record.percent)) {
      continue;
    }
    result.push({
      projectId: record.projectId,
      percent: Math.round(record.percent),
    });
  }
  return result;
}

export function migrateEntryAllocations(
  projectId: string | null,
  allocationsRaw: unknown,
): { projectId: string | null; allocations: HourAllocation[] } {
  const parsed = parseAllocations(allocationsRaw);
  if (parsed.length > 0) {
    return {
      projectId: projectId ?? primaryProjectId(parsed),
      allocations: parsed,
    };
  }
  if (projectId) {
    return { projectId, allocations: singleAllocation(projectId) };
  }
  return { projectId: null, allocations: [] };
}

export function entryAllocations(
  entry: Pick<HourEntry, "projectId" | "allocations">,
): HourAllocation[] {
  if (Array.isArray(entry.allocations) && entry.allocations.length > 0) {
    return entry.allocations;
  }
  if (entry.projectId) {
    return singleAllocation(entry.projectId);
  }
  return [];
}

export function allocatedMsByProject(
  activeMs: number,
  allocations: HourAllocation[],
): Map<string, number> {
  const result = new Map<string, number>();
  let assigned = 0;
  allocations.forEach((item, index) => {
    const isLast = index === allocations.length - 1;
    const ms = isLast
      ? Math.max(0, activeMs - assigned)
      : Math.round((activeMs * item.percent) / 100);
    assigned += ms;
    result.set(item.projectId, (result.get(item.projectId) ?? 0) + ms);
  });
  return result;
}

export function formatEntryProjectLabel(
  allocations: HourAllocation[],
  names: ReadonlyMap<string, string>,
): string | null {
  if (allocations.length === 0) {
    return null;
  }
  const nameOf = (id: string): string => names.get(id) ?? "Proyecto archivado";
  if (allocations.length === 1) {
    const only = allocations[0];
    return only ? nameOf(only.projectId) : null;
  }
  return allocations
    .map((item) => `${nameOf(item.projectId)} ${item.percent}%`)
    .join(" · ");
}

export function setTwoWayPercent(
  allocations: HourAllocation[],
  firstPercent: number,
  minPercent = MIN_ALLOCATION_PERCENT,
): HourAllocation[] {
  if (allocations.length !== 2) {
    return allocations;
  }
  const first = allocations[0];
  const second = allocations[1];
  if (!first || !second) {
    return allocations;
  }
  const snapped = Math.round(firstPercent / ALLOCATION_STEP) * ALLOCATION_STEP;
  const clamped = Math.min(100 - minPercent, Math.max(minPercent, snapped));
  return [
    { projectId: first.projectId, percent: clamped },
    { projectId: second.projectId, percent: 100 - clamped },
  ];
}

export function nudgeAllocation(
  allocations: HourAllocation[],
  projectId: string,
  delta: number,
  minPercent = MIN_ALLOCATION_PERCENT,
): HourAllocation[] {
  if (allocations.length < 2 || delta === 0) {
    return allocations;
  }
  const index = allocations.findIndex((item) => item.projectId === projectId);
  const current = allocations[index];
  if (index < 0 || !current) {
    return allocations;
  }
  if (allocations.length === 2) {
    return setTwoWayPercent(
      allocations,
      index === 0 ? current.percent + delta : 100 - (current.percent + delta),
      minPercent,
    );
  }
  const others = allocations
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ itemIndex }) => itemIndex !== index);
  if (delta > 0) {
    const nextPercent = current.percent + delta;
    const donor = [...others].sort((a, b) => b.item.percent - a.item.percent)[0];
    if (!donor || nextPercent > 100 - minPercent || donor.item.percent - delta < minPercent) {
      return allocations;
    }
    return allocations.map((item, itemIndex) => {
      if (itemIndex === index) {
        return { ...item, percent: item.percent + delta };
      }
      if (itemIndex === donor.itemIndex) {
        return { ...item, percent: item.percent - delta };
      }
      return item;
    });
  }
  const abs = -delta;
  const receiver = [...others].sort((a, b) => a.item.percent - b.item.percent)[0];
  if (!receiver || current.percent - abs < minPercent) {
    return allocations;
  }
  return allocations.map((item, itemIndex) => {
    if (itemIndex === index) {
      return { ...item, percent: item.percent - abs };
    }
    if (itemIndex === receiver.itemIndex) {
      return { ...item, percent: item.percent + abs };
    }
    return item;
  });
}
