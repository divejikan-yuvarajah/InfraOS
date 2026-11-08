"""Express -> FastAPI service authentication.

signature = HMAC-SHA256(AI_INTERNAL_SECRET, "METHOD\\nPATH\\nTIMESTAMP\\nSHA256_HEX(body)")
Timestamp is unix epoch milliseconds. For multipart uploads the "body" is the JSON metadata part, which declares the
file sha256; the service re-hashes the file and rejects on mismatch, so the file is covered transitively.
"""
from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import Request

from .config import Settings, get_settings
from .errors import ApiError


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sign(secret: str, method: str, path: str, timestamp: str, body_hash: str) -> str:
    msg = f"{method.upper()}\n{path}\n{timestamp}\n{body_hash}".encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def verify(request: Request, body_hash: str, settings: Settings | None = None) -> None:
    s = settings or get_settings()
    if "origin" in request.headers:  # browsers must never reach this service
        raise ApiError("FORBIDDEN")
    ts = request.headers.get("x-infraos-timestamp")
    sig = request.headers.get("x-infraos-signature")
    rid = request.headers.get("x-infraos-request-id")
    if not ts or not sig or not rid:
        raise ApiError("UNAUTHORIZED")
    try:
        ts_ms = int(ts)
    except ValueError:
        raise ApiError("UNAUTHORIZED") from None
    if abs(time.time() * 1000 - ts_ms) > s.clock_skew_s * 1000:
        raise ApiError("UNAUTHORIZED")
    expected = sign(s.ai_internal_secret.get_secret_value(), request.method, request.url.path, ts, body_hash)
    if not hmac.compare_digest(expected.encode(), sig.lower().encode()):
        raise ApiError("UNAUTHORIZED")


async def require_signed_body(request: Request) -> None:
    """Dependency for bodiless and JSON endpoints."""
    body = await request.body()
    verify(request, sha256_hex(body))
