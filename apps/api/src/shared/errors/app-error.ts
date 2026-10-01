export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;
  readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: unknown = null,
    isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
