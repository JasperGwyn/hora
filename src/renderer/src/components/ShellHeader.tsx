import type { JSX } from "react";
import { logger } from "@/lib/logger";

type ShellHeaderProps = {
  launchAtLogin: boolean;
};

export function ShellHeader({ launchAtLogin }: ShellHeaderProps): JSX.Element {
  const onToggleLogin = async (): Promise<void> => {
    try {
      await window.hora.updateSettings({ launchAtLogin: !launchAtLogin });
    } catch (error) {
      logger.error("No se pudo actualizar el inicio automático", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <header className="shell-header">
      <div className="brand-mark">
        Ho<span>ra</span>
      </div>
      <label className="settings-row">
        Arrancar con Windows
        <button
          type="button"
          className={launchAtLogin ? "toggle on" : "toggle"}
          role="switch"
          aria-checked={launchAtLogin}
          onClick={() => {
            void onToggleLogin();
          }}
        />
      </label>
    </header>
  );
}
