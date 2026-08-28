import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  powerMonitor,
} from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import type { AssignTarget, HourEntry } from "@shared/types";
import {
  formatDuration,
  formatEntryRange,
  formatHourRange,
  getNextHourMs,
  isAssignableStatus,
} from "@shared/time";
import { createLogger } from "@shared/logger";
import { HoraStore } from "./store";
import { IdleTracker } from "./tracker";
import { createTray, updateTrayTooltip } from "./tray";
import {
  appIconPath,
  createDashboardWindow,
  createPromptWindow,
  presentPromptWindow,
  whenWindowReady,
} from "./windows";

const logger = createLogger("main");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let store: HoraStore | undefined;
let tracker: IdleTracker | undefined;
let dashboardWindow: BrowserWindow | null = null;
let promptWindow: BrowserWindow | null = null;
let tray: ReturnType<typeof createTray> | null = null;
let quitting = false;
let flushingOnQuit = false;
let promptFocusId: string | null = null;

function startHidden(): boolean {
  return process.argv.includes("--hidden");
}

function isDashboardOpen(): boolean {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) {
    return false;
  }
  return dashboardWindow.isVisible() || dashboardWindow.isMinimized();
}

function hideDashboard(): void {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) {
    dashboardWindow = null;
    return;
  }
  if (dashboardWindow.isVisible() || dashboardWindow.isMinimized()) {
    dashboardWindow.hide();
  }
  dashboardWindow.setSkipTaskbar(true);
}

function keepDashboardHidden(wasOpen: boolean): void {
  if (wasOpen) {
    return;
  }
  hideDashboard();
}

function showDashboard(): void {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) {
    dashboardWindow = createDashboardWindow();
    dashboardWindow.on("close", (event) => {
      if (quitting) {
        return;
      }
      event.preventDefault();
      hideDashboard();
    });
    dashboardWindow.once("ready-to-show", () => {
      if (!dashboardWindow || dashboardWindow.isDestroyed()) {
        return;
      }
      dashboardWindow.setSkipTaskbar(false);
      dashboardWindow.show();
      dashboardWindow.focus();
    });
    return;
  }
  dashboardWindow.setSkipTaskbar(false);
  if (dashboardWindow.isMinimized()) {
    dashboardWindow.restore();
  }
  dashboardWindow.show();
  dashboardWindow.focus();
}

function destroyPrompt(): void {
  promptFocusId = null;
  if (promptWindow && !promptWindow.isDestroyed()) {
    promptWindow.destroy();
  }
  promptWindow = null;
}

function syncPromptState(): void {
  if (!store || !promptWindow || promptWindow.isDestroyed()) {
    return;
  }
  promptWindow.webContents.send("hora:state", store.getState());
  promptWindow.webContents.send("hora:prompt-focus", promptFocusId);
}

function resolvePromptEntry(entryId?: string): HourEntry | null {
  if (!store) {
    return null;
  }
  if (entryId) {
    const entry = store.findEntry(entryId);
    if (entry && isAssignableStatus(entry.status)) {
      return entry;
    }
    return null;
  }
  return store.oldestPending();
}

function revealPrompt(dashboardWasOpen: boolean): void {
  if (!promptWindow || promptWindow.isDestroyed()) {
    return;
  }
  presentPromptWindow(promptWindow);
  syncPromptState();
  keepDashboardHidden(dashboardWasOpen);
  presentPromptWindow(promptWindow);
  setImmediate(() => {
    keepDashboardHidden(dashboardWasOpen);
    if (promptWindow && !promptWindow.isDestroyed() && promptFocusId) {
      presentPromptWindow(promptWindow);
    }
  });
}

function showPrompt(entryId?: string): void {
  if (!store) {
    return;
  }
  const target = resolvePromptEntry(entryId);
  if (!target) {
    if (!entryId) {
      destroyPrompt();
    }
    return;
  }
  promptFocusId = target.id;
  const dashboardWasOpen = isDashboardOpen();
  if (!promptWindow || promptWindow.isDestroyed()) {
    promptWindow = createPromptWindow();
    promptWindow.on("closed", () => {
      promptWindow = null;
      promptFocusId = null;
    });
    promptWindow.webContents.on("did-finish-load", () => {
      syncPromptState();
    });
    whenWindowReady(promptWindow, () => {
      logger.info("Mostrando prompt", {
        entryId: target.id,
        hourStartMs: target.hourStartMs,
      });
      revealPrompt(dashboardWasOpen);
    });
    return;
  }
  logger.info("Mostrando prompt", {
    entryId: target.id,
    hourStartMs: target.hourStartMs,
  });
  revealPrompt(dashboardWasOpen);
}

function notifyHour(entry: HourEntry): void {
  if (entry.status !== "pending") {
    return;
  }
  try {
    if (Notification.isSupported()) {
      const icon = appIconPath();
      const notification = new Notification({
        title: "¿A qué proyecto le dedicaste este tramo?",
        body: `${formatEntryRange(entry)} · ${formatDuration(entry.activeMs)} de uso real`,
        ...(icon ? { icon } : {}),
        timeoutType: "never",
      });
      notification.on("click", () => {
        showPrompt();
      });
      notification.show();
    }
  } catch (error: unknown) {
    logger.warn("No se pudo mostrar la notificación", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  showPrompt();
}

function broadcast(): void {
  if (!store || !tracker) {
    return;
  }
  const state = store.getState();
  const live = tracker.getLive();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("hora:state", state);
      win.webContents.send("hora:live", live);
    }
  }
  if (tray) {
    const pending = store.pendingCount();
    const pendingText =
      pending > 0 ? ` · ${pending} pendiente${pending === 1 ? "" : "s"}` : "";
    const liveText = live.awaitingResume
      ? `Tramo cerrado · si seguís, Hora pregunta de nuevo${pendingText}`
      : `Hora ${formatHourRange(live.segmentStartMs, getNextHourMs(live.hourStartMs))} · ${formatDuration(live.activeMs)} activos${pendingText}`;
    updateTrayTooltip(tray, liveText);
  }
}

function applyLoginItem(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    enabled,
    args: ["--hidden"],
  });
}

function registerIpc(): void {
  ipcMain.handle("hora:get-state", () => {
    if (!store) {
      throw new Error("Store no inicializado");
    }
    return store.getState();
  });
  ipcMain.handle("hora:get-live", () => {
    if (!tracker) {
      throw new Error("Tracker no inicializado");
    }
    return tracker.getLive();
  });
  ipcMain.handle("hora:add-project", async (_event, name: string) => {
    if (!store) {
      throw new Error("Store no inicializado");
    }
    store.addProject(name);
    await store.save();
    broadcast();
    return store.getState();
  });
  ipcMain.handle("hora:rename-project", async (_event, id: string, name: string) => {
    if (!store) {
      throw new Error("Store no inicializado");
    }
    store.renameProject(id, name);
    await store.save();
    broadcast();
    return store.getState();
  });
  ipcMain.handle("hora:archive-project", async (_event, id: string) => {
    if (!store) {
      throw new Error("Store no inicializado");
    }
    store.archiveProject(id);
    await store.save();
    broadcast();
    return store.getState();
  });
  ipcMain.handle(
    "hora:assign-hour",
    async (_event, entryId: string, target: AssignTarget) => {
      if (!store) {
        throw new Error("Store no inicializado");
      }
      const current = store.findEntry(entryId);
      const wasPending = current?.status === "pending";
      store.assignHour(entryId, target);
      await store.save();
      broadcast();
      if (wasPending && store.oldestPending()) {
        showPrompt();
      } else {
        destroyPrompt();
      }
      return store.getState();
    },
  );
  ipcMain.handle("hora:delete-hour", async (_event, entryId: string) => {
    if (!store) {
      throw new Error("Store no inicializado");
    }
    const deleted = store.deleteHour(entryId);
    await store.save();
    broadcast();
    if (promptFocusId === deleted.id || deleted.status === "pending") {
      if (store.oldestPending()) {
        showPrompt();
      } else {
        destroyPrompt();
      }
    }
    return store.getState();
  });
  ipcMain.handle(
    "hora:update-settings",
    async (_event, patch: { launchAtLogin?: boolean }) => {
      if (!store) {
        throw new Error("Store no inicializado");
      }
      const settings = await store.updateSettings(patch);
      if (patch.launchAtLogin !== undefined) {
        applyLoginItem(patch.launchAtLogin);
      }
      broadcast();
      return settings;
    },
  );
  ipcMain.handle("hora:close-now", () => {
    if (!tracker || !store) {
      throw new Error("Tracker no inicializado");
    }
    tracker.closeNow();
    broadcast();
    return store.getState();
  });
  ipcMain.handle("hora:open-dashboard", () => {
    showDashboard();
  });
  ipcMain.handle("hora:open-prompt", (_event, entryId?: string) => {
    showPrompt(typeof entryId === "string" ? entryId : undefined);
  });
  ipcMain.handle("hora:get-prompt-focus", () => promptFocusId);
  ipcMain.handle("hora:close-prompt", () => {
    destroyPrompt();
  });
}

if (gotLock) {
  app.on("second-instance", () => {
    showDashboard();
  });

  void app
    .whenReady()
    .then(async () => {
      electronApp.setAppUserModelId("com.hora.timer");
      store = new HoraStore();
      await store.load();
      applyLoginItem(store.getSettings().launchAtLogin);

      tracker = new IdleTracker(store, {
        onHourClosed: (entry) => {
          broadcast();
          notifyHour(entry);
        },
        onTick: () => {
          broadcast();
        },
      });

      registerIpc();
      tracker.start();

      tray = createTray({
        onOpenDashboard: () => {
          showDashboard();
        },
        onOpenPrompt: () => {
          showPrompt();
        },
        onCloseNow: () => {
          tracker?.closeNow();
        },
        onSimulateHour: () => {
          tracker?.forceCloseForPrompt();
        },
        onQuit: () => {
          quitting = true;
          app.quit();
        },
      });

      const hasProjects = store.getState().projects.some((project) => !project.archived);
      if (!startHidden() || !hasProjects) {
        showDashboard();
      }
      if (store.pendingCount() > 0) {
        showPrompt();
      }

      app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
      });

      powerMonitor.on("unlock-screen", () => {
        tracker?.tick();
      });
      powerMonitor.on("resume", () => {
        tracker?.tick();
      });
      powerMonitor.on("suspend", () => {
        void tracker?.persist();
      });
      powerMonitor.on("shutdown", () => {
        void tracker?.persist();
      });
    })
    .catch((error: unknown) => {
      logger.error("No se pudo iniciar Hora", {
        message: error instanceof Error ? error.message : String(error),
      });
    });
}

app.on("window-all-closed", () => {
  return;
});

app.on("before-quit", (event) => {
  quitting = true;
  if (flushingOnQuit) {
    return;
  }
  event.preventDefault();
  flushingOnQuit = true;
  const persist = tracker ? tracker.stop() : store ? store.save() : Promise.resolve();
  void persist.finally(() => {
    app.quit();
  });
});
