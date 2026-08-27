import { app, BrowserWindow, screen, shell } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { is } from "@electron-toolkit/utils";
import { promptBoundsForWorkArea } from "@shared/prompt-layout";
import type { WindowKind } from "@shared/types";
import { createLogger } from "@shared/logger";

const logger = createLogger("windows");

function preloadPath(): string {
  return join(__dirname, "../preload/index.js");
}

export function appIconPath(): string | undefined {
  const candidates = [
    join(__dirname, "../../resources/icon.ico"),
    join(process.resourcesPath, "icon.ico"),
    join(__dirname, "../../resources/icon.png"),
    join(process.resourcesPath, "icon.png"),
  ];
  return candidates.find((file) => existsSync(file));
}

export function positionPromptWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return;
  }
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  win.setBounds(promptBoundsForWorkArea(display.workArea));
}

export function presentPromptWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return;
  }
  positionPromptWindow(win);
  win.setSkipTaskbar(false);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.moveTop();
  app.focus({ steal: true });
  win.focus();
}

export function whenWindowReady(win: BrowserWindow, callback: () => void): void {
  let done = false;
  const run = (): void => {
    if (done || win.isDestroyed()) {
      return;
    }
    done = true;
    callback();
  };
  win.once("ready-to-show", run);
  if (!win.webContents.isLoadingMainFrame() && win.webContents.getURL() !== "") {
    run();
  }
}

function loadWindow(win: BrowserWindow, kind: WindowKind): void {
  const query = kind === "prompt" ? "?window=prompt" : "";
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}${query}`);
    return;
  }
  void win.loadFile(join(__dirname, "../renderer/index.html"), {
    query: kind === "prompt" ? { window: "prompt" } : {},
  });
}

export function createDashboardWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1080,
    height: 740,
    minWidth: 880,
    minHeight: 620,
    show: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: "#12100E",
    title: "Hora",
    icon: appIconPath(),
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const dashboardIcon = appIconPath();
  if (dashboardIcon) {
    win.setIcon(dashboardIcon);
  }

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  loadWindow(win, "dashboard");
  win.webContents.on("did-fail-load", (_event, code, description, url) => {
    logger.error("No se pudo cargar el dashboard", { code, description, url });
  });
  return win;
}

export function createPromptWindow(): BrowserWindow {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const bounds = promptBoundsForWorkArea(display.workArea);
  const win = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: "#EFE7D8",
    title: "¿A qué proyecto?",
    icon: appIconPath(),
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const promptIcon = appIconPath();
  if (promptIcon) {
    win.setIcon(promptIcon);
  }

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  loadWindow(win, "prompt");
  win.webContents.on("did-fail-load", (_event, code, description, url) => {
    logger.error("No se pudo cargar el prompt", { code, description, url });
  });
  logger.info("Ventana de prompt creada");
  return win;
}
