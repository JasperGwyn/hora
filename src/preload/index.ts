import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, AppState, AssignTarget, LiveHour } from "@shared/types";

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke("hora:get-state"),
  getLive: (): Promise<LiveHour> => ipcRenderer.invoke("hora:get-live"),
  addProject: (name: string): Promise<AppState> =>
    ipcRenderer.invoke("hora:add-project", name),
  renameProject: (id: string, name: string): Promise<AppState> =>
    ipcRenderer.invoke("hora:rename-project", id, name),
  archiveProject: (id: string): Promise<AppState> =>
    ipcRenderer.invoke("hora:archive-project", id),
  assignHour: (entryId: string, target: AssignTarget): Promise<AppState> =>
    ipcRenderer.invoke("hora:assign-hour", entryId, target),
  deleteHour: (entryId: string): Promise<AppState> =>
    ipcRenderer.invoke("hora:delete-hour", entryId),
  updateSettings: (patch: Partial<Pick<AppSettings, "launchAtLogin">>): Promise<AppSettings> =>
    ipcRenderer.invoke("hora:update-settings", patch),
  openDashboard: (): Promise<void> => ipcRenderer.invoke("hora:open-dashboard"),
  openPrompt: (entryId?: string): Promise<void> =>
    ipcRenderer.invoke("hora:open-prompt", entryId),
  getPromptFocus: (): Promise<string | null> => ipcRenderer.invoke("hora:get-prompt-focus"),
  closePrompt: (): Promise<void> => ipcRenderer.invoke("hora:close-prompt"),
  closeNow: (): Promise<AppState> => ipcRenderer.invoke("hora:close-now"),
  onState: (callback: (state: AppState) => void): (() => void) => {
    const listener = (_event: unknown, state: AppState): void => {
      callback(state);
    };
    ipcRenderer.on("hora:state", listener);
    return () => {
      ipcRenderer.removeListener("hora:state", listener);
    };
  },
  onLive: (callback: (live: LiveHour) => void): (() => void) => {
    const listener = (_event: unknown, live: LiveHour): void => {
      callback(live);
    };
    ipcRenderer.on("hora:live", listener);
    return () => {
      ipcRenderer.removeListener("hora:live", listener);
    };
  },
  onPromptFocus: (callback: (entryId: string | null) => void): (() => void) => {
    const listener = (_event: unknown, entryId: string | null): void => {
      callback(entryId);
    };
    ipcRenderer.on("hora:prompt-focus", listener);
    return () => {
      ipcRenderer.removeListener("hora:prompt-focus", listener);
    };
  },
};

contextBridge.exposeInMainWorld("hora", api);

export type HoraApi = typeof api;
