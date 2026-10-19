import type { IsoDateTimeString } from "../primitives.js";

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "AUTH_REQUIRED",
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "INSUFFICIENT_PERMISSION",
  "RESOURCE_SCOPE_DENIED",
  "RESOURCE_NOT_ASSIGNED",
  "RESOURCE_NOT_FOUND",
  "INVALID_STATE_TRANSITION",
  "DUPLICATE_RESOURCE",
  "CONFLICT_DETECTED",
  "RATE_LIMITED",
  "NOT_READY",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  code: ApiErrorCode | string;
  message: string;
  details: unknown;
}

export interface ApiMeta {
  requestId: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

/** Matches the live Step 9 envelope: success always includes meta.requestId. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  meta: { requestId: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function isApiSuccess<T>(
  response: ApiResponse<T>,
): response is ApiSuccess<T> {
  return response.success === true;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type SortDirection = "asc" | "desc";

export interface SortSpec<TField extends string> {
  field: TField;
  direction: SortDirection;
}

export const HTTP_STATUS_BY_ERROR: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_PERMISSION: 403,
  RESOURCE_SCOPE_DENIED: 403,
  RESOURCE_NOT_ASSIGNED: 403,
  RESOURCE_NOT_FOUND: 404,
  INVALID_STATE_TRANSITION: 409,
  DUPLICATE_RESOURCE: 409,
  CONFLICT_DETECTED: 409,
  RATE_LIMITED: 429,
  NOT_READY: 503,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export type WireTimestamps = {
  createdAt: IsoDateTimeString;
  updatedAt?: IsoDateTimeString;
};
