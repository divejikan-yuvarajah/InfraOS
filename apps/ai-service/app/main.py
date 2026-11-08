"""INFRAOS AI service: stateless compute. Express is the only caller; there is no CORS and no browser access."""
from __future__ import annotations

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from .config import Settings, get_settings
from .errors import error_response, install_error_handlers
from starlette.datastructures import UploadFile as _UploadFile

from .routers import capabilities, extract, health


class BodyLimitMiddleware(BaseHTTPMiddleware):
    """Rejects oversized bodies up front using Content-Length (chunked uploads without a length are refused)."""

    def __init__(self, app, max_bytes: int) -> None:  # noqa: ANN001
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in {"POST", "PUT", "PATCH"}:
            raw = request.headers.get("content-length")
            if raw is None or not raw.isdigit():
                return error_response("VALIDATION_ERROR", request)
            if int(raw) > self.max_bytes:
                return error_response("PAYLOAD_TOO_LARGE", request)
        return await call_next(request)


def create_app(settings: Settings | None = None) -> FastAPI:
    s = settings or get_settings()
    docs = s.is_dev
    app = FastAPI(
        title="INFRAOS AI service",
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.state.settings = s
    app.add_middleware(BodyLimitMiddleware, max_bytes=s.max_body_bytes)
    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(capabilities.router)
    app.include_router(extract.router)
    _UploadFile.spool_max_size = s.max_body_bytes + 1024 * 1024  # keep uploads in memory: no temp files on disk
    return app


app = create_app()  # fails fast at startup when required env is missing or weak
