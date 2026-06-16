function serializeError(error) {
  if (!error) return {};
  return {
    name: error.name,
    code: error.code,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  };
}

export const logger = {
  info(message, meta = {}) {
    console.log(JSON.stringify({ level: "info", message, ...meta, timestamp: new Date().toISOString() }));
  },
  warn(message, meta = {}) {
    console.warn(JSON.stringify({ level: "warn", message, ...meta, timestamp: new Date().toISOString() }));
  },
  error(message, error, meta = {}) {
    console.error(JSON.stringify({ level: "error", message, error: serializeError(error), ...meta, timestamp: new Date().toISOString() }));
  },
};
