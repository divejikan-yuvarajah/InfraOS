"""One error shape: { code, message, retryable, requestId }. Never echoes input; never leaks stack traces."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .logging import log_event

# code -> (http status, retryable, generic message)
CATALOG: dict[str, tuple[int, bool, str]] = {
    "UNAUTHORIZED": (401, False, "Unauthorized."),
    "FORBIDDEN": (403, False, "Forbidden."),
    "VALIDATION_ERROR": (422, False, "The request is invalid."),
    "PAYLOAD_TOO_LARGE": (413, False, "The request is too large."),
    "UNSUPPORTED_FORMAT": (415, False, "This file format is not supported."),
    "ENCRYPTED_PDF": (422, False, "The PDF is password protected."),
    "SCANNED_NO_TEXT": (422, False, "The document appears to be scanned and has no extractable text. OCR is not available."),
    "EMPTY_TEXT": (422, False, "No text could be extracted."),
    "CORRUPT_FILE": (422, False, "The file is damaged or unreadable."),
    "TOO_LARGE": (422, False, "The document exceeds processing limits."),
    "HASH_MISMATCH": (422, False, "The file does not match its declared hash."),
    "DIMENSION_MISMATCH": (409, False, "Embedding dimension differs from the existing collection."),
    "EMBEDDING_PROVIDER_ERROR": (502, True, "The embedding provider failed."),
    "EMBEDDING_RATE_LIMITED": (503, True, "The embedding provider is rate limiting requests."),
    "VECTOR_STORE_ERROR": (502, True, "The vector store failed."),
    "AI_SERVICE_TIMEOUT": (504, True, "Processing timed out."),
    "BUSY": (503, True, "The service is busy."),
    "LLM_UNAVAILABLE": (502, True, "The language model is unavailable."),
    "LLM_TIMEOUT": (504, True, "The language model timed out."),
    "LLM_RATE_LIMITED": (503, True, "The language model is rate limiting requests."),
    "LLM_CONTEXT_TOO_LONG": (422, False, "The request is too long for the language model."),
    "LLM_INVALID_OUTPUT": (502, True, "The language model returned an invalid result."),
    "NOT_CONFIGURED": (503, False, "The service is not fully configured."),
    "NOT_FOUND": (404, False, "Not found."),
    "INTERNAL_ERROR": (500, False, "Internal error."),
}


class ApiError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code if code in CATALOG else "INTERNAL_ERROR"


def request_id_of(request: Request) -> str:
    rid = request.headers.get("x-infraos-request-id", "")
    return rid if 0 < len(rid) <= 64 and all(c.isalnum() or c in "-_" for c in rid) else "unknown"


def error_response(code: str, request: Request) -> JSONResponse:
    status, retryable, message = CATALOG.get(code, CATALOG["INTERNAL_ERROR"])
    body = {"code": code, "message": message, "retryable": retryable, "requestId": request_id_of(request)}
    return JSONResponse(body, status_code=status, headers={"Cache-Control": "no-store"})


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(request: Request, exc: ApiError) -> JSONResponse:
        log_event("error", code=exc.code, request_id=request_id_of(request))
        return error_response(exc.code, request)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, _exc: RequestValidationError) -> JSONResponse:
        return error_response("VALIDATION_ERROR", request)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        mapped = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 413: "PAYLOAD_TOO_LARGE"}
        code = mapped.get(exc.status_code, "VALIDATION_ERROR" if exc.status_code < 500 else "INTERNAL_ERROR")
        return error_response(code, request)

    @app.exception_handler(Exception)
    async def _any(request: Request, _exc: Exception) -> JSONResponse:
        log_event("unhandled", request_id=request_id_of(request))
        return error_response("INTERNAL_ERROR", request)
