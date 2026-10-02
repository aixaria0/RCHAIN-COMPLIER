export type ErrorCode =
  | "INVALID_INPUT"
  | "RESOURCE_LIMIT"
  | "INTEGRITY_MISMATCH"
  | "BINDING_MISMATCH"
  | "INCOMPLETE_EVIDENCE"
  | "UNSUPPORTED_VERIFIER"
  | "QUORUM_MISSING"
  | "CONFLICT"
  | "CLAIM_REFUTED"
  | "VERIFIED"
  | "BUSY"
  | "TIMEOUT"
  | "IO_ERROR";

export class AssuranceError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AssuranceError";
    this.code = code;
  }
}

export function operationalError(cause: unknown, message: string): AssuranceError {
  return cause instanceof AssuranceError
    ? cause
    : new AssuranceError("IO_ERROR", message, { cause });
}

export function requireDigest(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value))
    throw new AssuranceError("INVALID_INPUT", `${name} must be a lowercase SHA-256 digest`);
}
