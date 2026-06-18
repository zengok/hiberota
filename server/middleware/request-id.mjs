import crypto from "node:crypto";

export function requestId(req, res, next) {
  const incomingId = req.get("x-request-id") || "";
  const id = /^[a-zA-Z0-9._:-]{8,80}$/.test(incomingId) ? incomingId : crypto.randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
