const unavailableCodes = new Set([
  "ER_LOCK_WAIT_TIMEOUT", "ER_LOCK_DEADLOCK", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
  "EPIPE", "ENOTFOUND", "PROTOCOL_CONNECTION_LOST", "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
]);

export function isInfrastructureUnavailable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && unavailableCodes.has(error.code);
}
