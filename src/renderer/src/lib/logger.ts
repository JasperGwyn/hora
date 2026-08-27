type LogFn = (message: string, extra?: unknown) => void;

function noop(_message: string, _extra?: unknown): void {
  return;
}

export const logger: { info: LogFn; warn: LogFn; error: LogFn } = {
  info: noop,
  warn: noop,
  error: noop,
};
