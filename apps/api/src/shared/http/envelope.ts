export type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
    [key: string]: unknown;
  };
};

export type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
  meta: {
    requestId: string;
  };
};

export function success<T>(
  data: T,
  requestId: string,
  extraMeta?: Record<string, unknown>,
): SuccessEnvelope<T> {
  return {
    success: true,
    data,
    meta: { requestId, ...extraMeta },
  };
}

export function failure(
  code: string,
  message: string,
  requestId: string,
  details: unknown = null,
): ErrorEnvelope {
  return {
    success: false,
    error: { code, message, details },
    meta: { requestId },
  };
}
