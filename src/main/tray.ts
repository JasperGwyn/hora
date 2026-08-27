import { Menu, Tray, nativeImage, app, screen } from "electron";
import type { NativeImage } from "electron";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createLogger } from "@shared/logger";

const logger = createLogger("tray");

type TrayHandlers = {
  onOpenDashboard: () => void;
  onOpenPrompt: () => void;
  onCloseNow: () => void;
  onSimulateHour: () => void;
  onQuit: () => void;
};

function loadTrayImage(): NativeImage {
  const candidates = [
    join(__dirname, "../../resources/tray.png"),
    join(process.resourcesPath, "tray.png"),
    join(app.getAppPath(), "resources/tray.png"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      const image = nativeImage.createFromPath(file);
      if (!image.isEmpty()) {
        const scale = Math.max(1, Math.round(screen.getPrimaryDisplay().scaleFactor));
        const edge = 16 * scale;
        return image.resize({ width: edge, height: edge });
      }
    }
  }
  logger.warn("No se encontró el icono de bandeja, se usa fallback");
  return nativeImage.createEmpty();
}

export function createTray(handlers: TrayHandlers): Tray {
  const tray = new Tray(loadTrayImage());
  tray.setToolTip("Hora — seguimiento de proyectos");
  const menu = Menu.buildFromTemplate([
    {
      label: "Abrir Hora",
      click: () => {
        handlers.onOpenDashboard();
      },
    },
    {
      label: "Asignar hora pendiente",
      click: () => {
        handlers.onOpenPrompt();
      },
    },
    {
      label: "Cerrar ahora",
      click: () => {
        handlers.onCloseNow();
      },
    },
    {
      label: "Probar pregunta de esta hora",
      click: () => {
        handlers.onSimulateHour();
      },
    },
    { type: "separator" },
    {
      label: "Salir",
      click: () => {
        handlers.onQuit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => {
    handlers.onOpenDashboard();
  });
  return tray;
}

export function updateTrayTooltip(tray: Tray, text: string): void {
  tray.setToolTip(text);
}
