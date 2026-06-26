"""In-process sliding-window rate limiting for FastAPI."""
import time
import logging
from collections import defaultdict
from threading import Lock
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

RATE_RULES: list[tuple[str, int, int]] = [
    ("/api/v1/auth/console-exchange", 30, 60),
    ("/api/v1/auth/console-handoff", 30, 60),
    ("/api/v1/auth/login", 10, 60),
    ("/api/v1/auth/register", 10, 60),
    ("/api/v1/auth/forgot-password", 5, 60),
    ("/api/v1/auth/reset-password", 5, 60),
    ("/api/v1/score", 30, 60),
    ("/api/v1/benchmarks", 60, 60),
    ("/api/v1/telemetry/session", 30, 60),
    ("/api/v1/telemetry/events", 120, 60),
    ("/api/v1/admin", 20, 60),
    ("/api/v1", 200, 60),
]
EXEMPT_PATHS = {"/health", "/sitemap.xml", "/docs", "/openapi.json", "/redoc"}


class _SlidingWindowCounter:
    def __init__(self):
        self._store: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        window_start = now - window_seconds
        with self._lock:
            self._store[key] = [t for t in self._store[key] if t > window_start]
            current_count = len(self._store[key])
            if current_count >= max_requests:
                return False, 0
            self._store[key].append(now)
            return True, max_requests - current_count - 1

    def cleanup_old_keys(self, older_than_seconds: int = 300):
        cutoff = time.time() - older_than_seconds
        with self._lock:
            stale = [k for k, ts in self._store.items() if not ts or max(ts) < cutoff]
            for key in stale:
                del self._store[key]


_counter = _SlidingWindowCounter()
_last_cleanup = time.time()


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_rule(path: str) -> tuple[int, int] | None:
    for prefix, max_req, window in RATE_RULES:
        if path.startswith(prefix):
            return max_req, window
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        global _last_cleanup
        path = request.url.path
        if path in EXEMPT_PATHS or not path.startswith("/api/"):
            return await call_next(request)
        rule = _get_rule(path)
        if not rule:
            return await call_next(request)

        max_requests, window_seconds = rule
        client_ip = _get_client_ip(request)
        # Group by rule prefix rather than raw path/query variants.
        rate_key = f"{client_ip}:{path}"
        allowed, remaining = _counter.is_allowed(rate_key, max_requests, window_seconds)

        now = time.time()
        if now - _last_cleanup > 300:
            _counter.cleanup_old_keys()
            _last_cleanup = now

        if not allowed:
            logger.warning("Rate limit exceeded: %s on %s", client_ip, path)
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limited",
                    "message": "Too many requests. Please slow down.",
                    "retry_after": window_seconds,
                },
                headers={
                    "Retry-After": str(window_seconds),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(now + window_seconds)),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
