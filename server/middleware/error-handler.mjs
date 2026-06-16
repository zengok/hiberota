import { logger } from "../config/logger.mjs";

export function errorHandler(error, req, res, _next) {
  logger.error("request_failed", error, { requestId: req.requestId, path: req.originalUrl });
  res.status(error.status || 500).json({
    error: error.code || "internal_error",
    requestId: req.requestId,
  });
}
