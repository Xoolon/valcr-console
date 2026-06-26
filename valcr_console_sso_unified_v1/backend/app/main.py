# app/main.py
# =============================================================================
# CHANGES:
#   - Added SecurityHeadersMiddleware from app.middleware.security
#   - Removed inline security headers middleware (now handled by the class)
#   - All other middleware (RateLimit, CORS, TrustedHost, auth rate limit) remain
# =============================================================================

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base

from app.models import user, session_profile, calculation_event, notification, embed, calculation  # noqa
from app.models.ingestion_queue import IngestionQueueItem

from app.api.v1.connect import shopify as shopify_connect
from app.api.v1.connect.etsy import etsy_router
from app.api.v1.connect.store_metrics import router as store_metrics_router
from app.api.v1.connect import webhooks as connect_webhooks
from app.api.v1.data.router import legacy_data_router, data_router
from app.services.nightly_jobs import run_nightly_jobs
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.api.v1.alerts import router as alerts_router
from app.api.v1.console.keys import router as console_keys_router
from app.api.v1.console.usage import router as console_usage_router
from app.api.v1.console.webhooks import router as console_webhooks_router
from app.api.v1.console.billing import router as console_billing_router
from app.services.benchmark_service import run_benchmark_job, run_quarterly_anchor_refresh
from app.api.v1.benchmarks_public import router as pub_bench_router
from app.api.v1.reports import router as reports_router

# ── Rate limiter (in-process sliding window) ──────────────────────────────
from app.middleware.rate_limiter import RateLimitMiddleware

# ── Security headers middleware ─────────────────────────────────────────────
from app.middleware.security import SecurityHeadersMiddleware

# ── Redis rate limiter (distributed) ──────────────────────────────────────
from app.services.redis_rate_limiter import check_rate_limit_redis
from app.api.v1.connect.dashboard import router as dashboard_router

from app.api.v1 import (
    auth, calculators, payments, admin, analytics,
    telemetry, notifications, profile, calculations,
    exports, benchmarks, embeds, blog, sitemap, score,
)

from app.api.v1.insights import router as insights_router
from app.api.v1.connect.manual_upload import upload_router, domain_router

if settings.SENTRY_DSN and settings.ENVIRONMENT == "production":
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1)


async def _flush_all_store_buffers():
    try:
        from app.services.valcr_track import _event_buffer, _flush_store_buffer
        import asyncio
        store_ids = list(_event_buffer.keys())
        if store_ids:
            await asyncio.gather(*[_flush_store_buffer(sid) for sid in store_ids])
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def _run_sec_ingestion():
        try:
            from app.normalisation.sec_edgar_normaliser import run_sec_edgar_ingestion
            from app.services.public_data_worker import run_worker_loop
            count = await run_sec_edgar_ingestion()
            await run_worker_loop(max_jobs=1000)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"SEC ingestion failed: {e}")

    async def _run_public_aggregates():
        try:
            from app.normalisation.public_aggregates_normaliser import run_public_aggregates_ingestion
            await run_public_aggregates_ingestion(
                census_api_key=getattr(settings, "CENSUS_API_KEY", ""),
                bls_api_key=getattr(settings, "BLS_API_KEY", ""),
                comtrade_api_key=getattr(settings, "COMTRADE_API_KEY", ""),
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Public aggregates ingestion failed: {e}")

    async def _run_companies_house():
        api_key = getattr(settings, "COMPANIES_HOUSE_API_KEY", "")
        if not api_key:
            return
        try:
            from app.normalisation.companies_house_normaliser import run_companies_house_ingestion
            from app.services.public_data_worker import run_worker_loop
            count = await run_companies_house_ingestion(api_key=api_key, max_companies=200)
            await run_worker_loop(max_jobs=500)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Companies House ingestion failed: {e}")

    scheduler = AsyncIOScheduler()

    scheduler.add_job(run_nightly_jobs,              'cron', hour=2, minute=0)
    scheduler.add_job(_flush_all_store_buffers,      'interval', minutes=5)
    scheduler.add_job(run_benchmark_job,             'cron', hour=2, minute=30)
    scheduler.add_job(run_quarterly_anchor_refresh,  'cron', month='1,4,7,10', day=1, hour=3)

    from app.services.public_data_worker import run_worker_loop
    scheduler.add_job(run_worker_loop,               'interval', minutes=5)
    scheduler.add_job(_run_sec_ingestion,            'cron', month='1,4,7,10', day=15, hour=4)
    scheduler.add_job(_run_public_aggregates,        'cron', month='1,4,7,10', day=1,  hour=4)
    scheduler.add_job(_run_companies_house,          'cron', day=1, hour=5)

    scheduler.start()
    yield
    scheduler.shutdown()
    await engine.dispose()


app = FastAPI(
    title="Valcr API", version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=None, lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
if settings.ENVIRONMENT == "production":
    allowed_origins = [
        "https://valcr.site", "https://www.valcr.site",
        "https://cdn.valcr.site", "https://console.valcr.site",
        "https://valcr.vercel.app",
    ]
else:
    allowed_origins = [
        "http://localhost:5173", "http://localhost:5174", "http://localhost:5175",
        "http://localhost:4173",
        "http://127.0.0.1:5173", "http://127.0.0.1:5174",
        "http://127.0.0.1:5175", "http://127.0.0.1:4173",
    ]

print("ENVIRONMENT =", settings.ENVIRONMENT)
print("ALLOWED_ORIGINS =", allowed_origins)

app.add_middleware(
    CORSMiddleware, allow_origins=allowed_origins, allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["api.valcr.site", "localhost", "127.0.0.1", "*.fly.dev"],
)

# ── In-process rate limiter (covers ALL /api/ routes) ────────────────────────
app.add_middleware(RateLimitMiddleware)

# ── Security headers (hardened) ──────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ── Auth endpoint rate limiter (Redis-backed) ────────────────────────────────
@app.middleware("http")
async def auth_rate_limit_middleware(request: Request, call_next):
    auth_paths = [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/console-exchange",
    ]
    if request.url.path in auth_paths:
        client_ip = (
            request.headers.get("cf-connecting-ip") or
            request.headers.get("x-forwarded-for", "").split(",")[0].strip() or
            (request.client.host if request.client else "unknown")
        )
        allowed = await check_rate_limit_redis(f"auth:{client_ip}", max_per_min=10)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please wait 60 seconds."},
                headers={"Retry-After": "60"},
            )
    return await call_next(request)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,              prefix="/api/v1/auth",        tags=["auth"])
app.include_router(calculators.router,       prefix="/api/v1/calculators", tags=["calculators"])
app.include_router(payments.router,          prefix="/api/v1",             tags=["payments"])
app.include_router(admin.router,             prefix="/api/v1",             tags=["admin"])
app.include_router(analytics.router,         prefix="/api/v1",             tags=["analytics"])
app.include_router(telemetry.router,         prefix="/api/v1",             tags=["telemetry"])
app.include_router(notifications.router,     prefix="/api/v1",             tags=["notifications"])
app.include_router(profile.router,           prefix="/api/v1",             tags=["profile"])
app.include_router(calculations.router,      prefix="/api/v1",             tags=["calculations"])
app.include_router(exports.router,           prefix="/api/v1",             tags=["exports"])
app.include_router(benchmarks.router,        prefix="/api/v1",             tags=["benchmarks"])
app.include_router(pub_bench_router,         prefix="/api/v1")
app.include_router(embeds.router,            prefix="/api/v1",             tags=["embeds"])
app.include_router(blog.router,              prefix="/api/v1",             tags=["blog"])
app.include_router(sitemap.router,           prefix="/api/v1",             tags=["sitemap"])
app.include_router(score.router,             prefix="/api/v1",             tags=["score"])
app.include_router(shopify_connect.router,   prefix="/api/v1")
app.include_router(etsy_router, prefix="/api/v1")
app.include_router(connect_webhooks.wh_router, prefix="/api/v1")
app.include_router(legacy_data_router)
app.include_router(data_router)
app.include_router(alerts_router,            prefix="/api/v1")
app.include_router(console_keys_router,      prefix="/api/v1")
app.include_router(console_usage_router,     prefix="/api/v1")
app.include_router(console_webhooks_router,  prefix="/api/v1")
app.include_router(console_billing_router,   prefix="/api/v1")
app.include_router(insights_router,          prefix="/api/v1")
app.include_router(upload_router,            prefix="/api/v1")
app.include_router(domain_router,            prefix="/api/v1")
app.include_router(dashboard_router,         prefix="/api/v1")
app.include_router(store_metrics_router,     prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
