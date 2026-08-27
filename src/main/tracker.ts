import { powerMonitor } from "electron";
import { SAMPLE_INTERVAL_MS } from "@shared/types";
import type { HourEntry, LiveHour } from "@shared/types";
import {
  applySample,
  classifySample,
  getHourStartMs,
  getNextHourMs,
  msUntilNextHour,
  shouldOpenFollowUpSegment,
  shouldPromoteFollowUp,
  shouldPromptForHour,
} from "@shared/time";
import { createLogger } from "@shared/logger";
import type { HoraStore } from "./store";

const logger = createLogger("tracker");

type TrackerHandlers = {
  onHourClosed: (entry: HourEntry) => void;
  onTick: (live: LiveHour) => void;
};

export class IdleTracker {
  private sampleTimer: NodeJS.Timeout | null = null;
  private hourTimer: NodeJS.Timeout | null = null;
  private lastSampleAt = 0;
  private currentHourStart = 0;
  private pendingResumeMs = 0;
  private stopped = true;

  constructor(
    private readonly store: HoraStore,
    private readonly handlers: TrackerHandlers,
  ) {}

  start(): void {
    this.stopped = false;
    const now = Date.now();
    this.currentHourStart = getHourStartMs(now);
    const closed = this.store.closeStaleOpenHours(this.currentHourStart);
    this.pendingResumeMs = 0;
    this.ensureOpenHour(now);
    this.lastSampleAt = now;
    this.armHourTimer();
    this.sampleTimer = setInterval(() => {
      this.sample();
    }, SAMPLE_INTERVAL_MS);
    if (closed.length > 0) {
      logger.info("Horas abiertas de una sesión anterior, se cierran", {
        count: closed.length,
      });
      void this.store.save();
      for (const entry of closed) {
        logger.info("Hora cerrada", {
          hourStartMs: entry.hourStartMs,
          status: entry.status,
          activeMs: entry.activeMs,
          idleMs: entry.idleMs,
        });
        this.handlers.onHourClosed(entry);
      }
    }
    this.sample();
    logger.info("Tracker iniciado", { hourStartMs: this.currentHourStart });
  }

  tick(): void {
    this.sample();
  }

  persist(): Promise<void> {
    return this.store.save();
  }

  forceCloseForPrompt(): HourEntry | null {
    const settings = this.store.getSettings();
    const open =
      this.store.findOpenHour(this.currentHourStart) ??
      this.store.upsertOpenHour(this.currentHourStart);
    if (open.activeMs < settings.minActiveMsToPrompt) {
      this.store.updateOpenHour(this.currentHourStart, {
        activeMs: settings.minActiveMsToPrompt,
        idleMs: open.idleMs,
      });
    }
    return this.closeNow();
  }

  closeNow(): HourEntry | null {
    if (this.stopped) {
      return null;
    }
    this.sample();
    const settings = this.store.getSettings();
    const open = this.store.findOpenHour(this.currentHourStart);
    if (!open || !shouldPromptForHour(open.activeMs, settings.minActiveMsToPrompt)) {
      return null;
    }
    const now = Date.now();
    this.finalizeHour(this.currentHourStart, now);
    this.lastSampleAt = now;
    this.pendingResumeMs = 0;
    return this.store.oldestPending();
  }

  stop(): Promise<void> {
    if (!this.stopped) {
      this.stopped = true;
      if (this.sampleTimer) {
        clearInterval(this.sampleTimer);
        this.sampleTimer = null;
      }
      if (this.hourTimer) {
        clearTimeout(this.hourTimer);
        this.hourTimer = null;
      }
    }
    return this.store.save();
  }

  getLive(): LiveHour {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const settings = this.store.getSettings();
    const open = this.store.findOpenHour(this.currentHourStart);
    const awaitingResume = !open && this.store.hasClosedEntryForHour(this.currentHourStart);
    const remainderStart = this.store.latestSegmentEndForHour(this.currentHourStart);
    return {
      hourStartMs: this.currentHourStart,
      segmentStartMs: open?.segmentStartMs ?? remainderStart ?? this.currentHourStart,
      activeMs: open?.activeMs ?? this.pendingResumeMs,
      idleMs: open?.idleMs ?? 0,
      idleNow: classifySample(idleSeconds, settings.idleThresholdSeconds) === "idle",
      idleSeconds,
      awaitingResume,
    };
  }

  private sample(): void {
    if (this.stopped) {
      return;
    }
    const now = Date.now();
    this.rollHourIfNeeded(now);
    const elapsedMs = Math.min(Math.max(now - this.lastSampleAt, 0), SAMPLE_INTERVAL_MS * 3);
    this.lastSampleAt = now;
    if (elapsedMs <= 0) {
      return;
    }

    const settings = this.store.getSettings();
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const kind = classifySample(idleSeconds, settings.idleThresholdSeconds);
    const existing = this.store.findOpenHour(this.currentHourStart);
    if (!existing) {
      this.sampleFollowUp(now, elapsedMs, kind, settings.minActiveMsToPrompt);
      return;
    }
    const updated = applySample(existing, elapsedMs, kind);
    this.store.updateOpenHour(this.currentHourStart, {
      activeMs: updated.activeMs,
      idleMs: updated.idleMs,
    });
    void this.store.save();
    this.handlers.onTick(this.getLive());
  }

  private rollHourIfNeeded(nowMs: number): void {
    const hourStart = getHourStartMs(nowMs);
    if (hourStart === this.currentHourStart) {
      return;
    }
    this.finalizeHour(this.currentHourStart, hourStart);
    this.currentHourStart = hourStart;
    this.pendingResumeMs = 0;
    this.store.upsertOpenHour(hourStart);
    this.armHourTimer();
  }

  private sampleFollowUp(
    nowMs: number,
    elapsedMs: number,
    kind: "active" | "idle",
    minActiveMs: number,
  ): void {
    if (!shouldOpenFollowUpSegment(false, kind)) {
      this.pendingResumeMs = 0;
      this.handlers.onTick(this.getLive());
      return;
    }
    this.pendingResumeMs += elapsedMs;
    if (!shouldPromoteFollowUp(this.pendingResumeMs, minActiveMs)) {
      this.handlers.onTick(this.getLive());
      return;
    }
    const segmentStartMs = Math.max(this.currentHourStart, nowMs - this.pendingResumeMs);
    this.store.upsertOpenHour(this.currentHourStart, segmentStartMs);
    this.store.updateOpenHour(this.currentHourStart, {
      activeMs: this.pendingResumeMs,
      idleMs: 0,
    });
    this.pendingResumeMs = 0;
    void this.store.save();
    this.handlers.onTick(this.getLive());
  }

  private ensureOpenHour(nowMs: number): void {
    const hasOpen = this.store.findOpenHour(this.currentHourStart) !== null;
    if (hasOpen || !this.store.hasClosedEntryForHour(this.currentHourStart)) {
      this.store.upsertOpenHour(this.currentHourStart, getHourStartMs(nowMs));
    }
  }

  private finalizeHour(hourStartMs: number, endedAtMs = getNextHourMs(hourStartMs)): void {
    const settings = this.store.getSettings();
    const closed = this.store.closeHour(hourStartMs, settings.minActiveMsToPrompt, endedAtMs);
    if (!closed) {
      return;
    }
    logger.info("Hora cerrada", {
      hourStartMs,
      segmentStartMs: closed.segmentStartMs,
      segmentEndMs: closed.segmentEndMs,
      status: closed.status,
      activeMs: closed.activeMs,
      idleMs: closed.idleMs,
    });
    void this.store.save();
    this.handlers.onHourClosed(closed);
  }

  private armHourTimer(): void {
    if (this.hourTimer) {
      clearTimeout(this.hourTimer);
    }
    const delay = msUntilNextHour(Date.now());
    this.hourTimer = setTimeout(() => {
      this.sample();
      this.armHourTimer();
    }, delay);
  }
}
