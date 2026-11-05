"""VaultForge: web app e API per la generazione di password."""

from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import generator

APP_NAME = "VaultForge"
# Incrementala a ogni rilascio: invalida la cache del service worker.
APP_VERSION = "1.1.0"

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self'; "
        "img-src 'self' data:; connect-src 'self'; manifest-src 'self'; "
        "worker-src 'self'; object-src 'none'; base-uri 'none'; "
        "form-action 'self'; frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}

# La documentazione interattiva verra' pubblicata con l'API aziendale (Fase 2).
app = FastAPI(title=APP_NAME, version=APP_VERSION, docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    for name, value in SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    if request.url.path.startswith("/api/"):
        # Le password non devono finire in nessuna cache.
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def index(request: Request):
    return templates.TemplateResponse(
        request, "index.html", {"app_name": APP_NAME, "version": APP_VERSION}
    )


@app.get("/api", response_class=HTMLResponse, include_in_schema=False)
async def api_docs(request: Request):
    # Documentazione scritta a mano: quella automatica di FastAPI resta disattivata.
    return templates.TemplateResponse(
        request,
        "api.html",
        {"app_name": APP_NAME, "version": APP_VERSION, "home": "/"},
    )


@app.get("/sw.js", include_in_schema=False)
async def service_worker(request: Request):
    # Servito dalla radice perche' il service worker controlli tutto il sito.
    return templates.TemplateResponse(
        request,
        "sw.js",
        {"version": APP_VERSION},
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/manifest.webmanifest", include_in_schema=False)
async def manifest():
    return FileResponse(
        STATIC_DIR / "manifest.webmanifest", media_type="application/manifest+json"
    )


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(STATIC_DIR / "icons" / "favicon-32.png", media_type="image/png")


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}


@app.get("/api/v1/generate", tags=["password"])
async def api_generate(
    length: Annotated[
        int, Query(ge=generator.MIN_LENGTH, le=generator.MAX_LENGTH)
    ] = generator.DEFAULT_LENGTH,
    lower: bool = True,
    upper: bool = True,
    digits: bool = True,
    symbols: bool = True,
    exclude_ambiguous: bool = False,
):
    options = generator.Options(
        length=length,
        lower=lower,
        upper=upper,
        digits=digits,
        symbols=symbols,
        exclude_ambiguous=exclude_ambiguous,
    )
    try:
        password = generator.generate(options)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    bits = generator.entropy_bits(options)
    return {
        "password": password,
        "length": length,
        "entropy_bits": round(bits, 1),
        "strength": generator.strength(bits),
    }
