type LogLevel = "info" | "warn" | "error";

function writeLine(level: LogLevel, scope: string, message: string, extra?: unknown): void {
  const stamp = new Date().toISOString();
  const payload = extra === undefined ? "" : ` ${JSON.stringify(extra)}`;
  process.stderr.write(`[${stamp}] ${level.toUpperCase()} ${scope} ${message}${payload}\n`);
}

export function createLogger(scope: string): {
  info: (message: string, extra?: unknown) => void;
  warn: (message: string, extra?: unknown) => void;
  error: (message: string, extra?: unknown) => void;
} {
  return {
    info: (message, extra) => {
      writeLine("info", scope, message, extra);
    },
    warn: (message, extra) => {
      writeLine("warn", scope, message, extra);
    },
    error: (message, extra) => {
      writeLine("error", scope, message, extra);
    },
  };
}
