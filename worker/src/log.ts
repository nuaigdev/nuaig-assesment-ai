type Fields = Record<string, unknown>;

function write(level: "info" | "error", message: string, fields: Fields) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export type Logger = {
  info: (message: string, fields?: Fields) => void;
  error: (message: string, fields?: Fields) => void;
  child: (base: Fields) => Logger;
};

function makeLogger(base: Fields): Logger {
  return {
    info: (message, fields = {}) => write("info", message, { ...base, ...fields }),
    error: (message, fields = {}) => write("error", message, { ...base, ...fields }),
    child: (extra) => makeLogger({ ...base, ...extra }),
  };
}

/** JSON-lines logs, readable in Railway/Render/Fly log views. */
export const log = makeLogger({});
