import { useEffect, useState } from "react";
import type { AppState, LiveHour } from "@shared/types";
import { logger } from "@/lib/logger";

type HoraSnapshot = {
  state: AppState | null;
  live: LiveHour | null;
  ready: boolean;
};

export function useHora(): HoraSnapshot {
  const [state, setState] = useState<AppState | null>(null);
  const [live, setLive] = useState<LiveHour | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const [nextState, nextLive] = await Promise.all([
          window.hora.getState(),
          window.hora.getLive(),
        ]);
        if (!cancelled) {
          setState(nextState);
          setLive(nextLive);
        }
      } catch (error) {
        logger.error("No se pudo cargar el estado", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void load();
    const offState = window.hora.onState(setState);
    const offLive = window.hora.onLive(setLive);
    return () => {
      cancelled = true;
      offState();
      offLive();
    };
  }, []);

  return { state, live, ready: state !== null && live !== null };
}
