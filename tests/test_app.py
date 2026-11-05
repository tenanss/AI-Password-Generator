import io
import json

import pytest
from PIL import Image
from fastapi.testclient import TestClient

import generator
from main import APP_VERSION, app

client = TestClient(app)


def test_index_served_with_security_headers():
    res = client.get("/")
    assert res.status_code == 200
    assert "VaultForge" in res.text
    assert f"app.js?v={APP_VERSION}" in res.text
    csp = res.headers["content-security-policy"]
    assert "script-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["referrer-policy"] == "no-referrer"


def test_index_has_no_inline_scripts_or_styles():
    html = client.get("/").text
    assert "<script>" not in html
    assert "style=" not in html
    assert "onclick" not in html


def test_api_generate_defaults():
    res = client.get("/api/v1/generate")
    assert res.status_code == 200
    assert res.headers["cache-control"] == "no-store"
    body = res.json()
    assert len(body["password"]) == generator.DEFAULT_LENGTH
    assert body["strength"] in {"weak", "fair", "strong", "very_strong"}
    assert body["entropy_bits"] > 0


def test_api_generate_options():
    res = client.get("/api/v1/generate", params={"length": 40, "symbols": False, "upper": False})
    body = res.json()
    assert len(body["password"]) == 40
    assert set(body["password"]) <= set(generator.LOWER + generator.DIGITS)


@pytest.mark.parametrize("length", [7, 129, 10_000_000, -1])
def test_api_rejects_bad_length(length):
    assert client.get("/api/v1/generate", params={"length": length}).status_code == 422


def test_api_rejects_no_classes():
    params = {"lower": False, "upper": False, "digits": False, "symbols": False}
    res = client.get("/api/v1/generate", params=params)
    assert res.status_code == 422


def test_manifest():
    res = client.get("/manifest.webmanifest")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/manifest+json")
    data = json.loads(res.content)
    assert data["name"] == "VaultForge"
    for icon in data["icons"]:
        assert client.get(icon["src"]).status_code == 200


def test_service_worker():
    res = client.get("/sw.js")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/javascript")
    assert f"vaultforge-{APP_VERSION}" in res.text
    assert "{{" not in res.text


def test_static_assets_and_health():
    assert client.get("/static/css/app.css").status_code == 200
    assert client.get("/static/js/app.js").status_code == 200
    assert client.get("/favicon.ico").status_code == 200
    assert client.get("/healthz").json() == {"status": "ok"}


FONT_FILES = [
    "/static/fonts/fraunces-latin.woff2",
    "/static/fonts/fraunces-italic-latin.woff2",
    "/static/fonts/inter-latin.woff2",
    "/static/fonts/jetbrains-mono-latin.woff2",
]


@pytest.mark.parametrize("path", FONT_FILES)
def test_font_served(path):
    res = client.get(path)
    assert res.status_code == 200
    assert res.content[:4] == b"wOF2"


def test_fonts_css_declares_local_faces():
    css = client.get("/static/css/fonts.css").text
    for family in ("Fraunces", "Inter", "JetBrains Mono"):
        assert f'font-family: "{family}"' in css
    assert "font-style: italic" in css
    assert "http" not in css


@pytest.mark.parametrize("path,size", [
    ("/static/icons/favicon-32.png", 32),
    ("/static/icons/apple-touch-icon.png", 180),
    ("/static/icons/icon-192.png", 192),
    ("/static/icons/icon-512.png", 512),
    ("/static/icons/icon-maskable-512.png", 512),
])
def test_icon_sizes_and_palette(path, size):
    img = Image.open(io.BytesIO(client.get(path).content)).convert("RGB")
    assert img.size == (size, size)
    assert img.getpixel((size // 2, size // 2)) == (13, 14, 17)  # centro grafite


def test_manifest_uses_caveau_colors():
    data = json.loads(client.get("/manifest.webmanifest").content)
    assert data["theme_color"] == "#0d0e11"
    assert data["background_color"] == "#0d0e11"


def test_svg_icon_is_brass_dial():
    svg = client.get("/static/icons/icon.svg").text
    assert "#c9a35b" in svg and "<circle" in svg


def test_index_structure():
    html = client.get("/").text
    for needle in ('id="come-funziona"', 'id="sicurezza"', 'href="#come-funziona"',
                   'href="#sicurezza"', 'href="/api"', 'id="dial"', 'id="generate"',
                   "Genera e sigilla", "sigillata", "Quattro passaggi", "Verificalo",
                   "https://github.com/tenanss/VaultForge", "fonts.css?v="):
        assert needle in html
    assert 'data-option="excludeAmbiguous"' in html
    assert 'name="theme-color" content="#0d0e11"' in html
    assert "Aziende" not in html
    assert "fonts.googleapis" not in html


def test_index_chips_are_accessible_buttons():
    html = client.get("/").text
    assert html.count('class="chip"') == 5
    assert html.count("aria-pressed=") == 5
