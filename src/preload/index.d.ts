import type { HoraApi } from "./index";

declare global {
  interface Window {
    hora: HoraApi;
  }
}

export {};
