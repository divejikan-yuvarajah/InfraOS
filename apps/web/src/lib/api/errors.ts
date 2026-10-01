export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; details?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

type EnvelopeError = {
  message?: unknown;
  error?: unknown;
  code?: unknown;
  details?: unknown;
};

export function parseApiError(
  status: number,
  statusText: string,
  body: unknown,
): ApiError {
  if (body && typeof body === "object") {
    const envelope = body as EnvelopeError;
    const messageCandidate = envelope.message ?? envelope.error;
    const message =
      typeof messageCandidate === "string" && messageCandidate.length > 0
        ? messageCandidate
        : statusText || "Request failed";
    const code = typeof envelope.code === "string" ? envelope.code : undefined;
    return new ApiError(message, status, {
      code,
      details: envelope.details,
    });
  }

  return new ApiError(statusText || "Request failed", status);
}
