import io
import json
import re

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
    # le 5 pillole dei caratteri sono pulsanti con stato premuto/non premuto
    assert len(re.findall(r'class="chip" data-option="[^"]+" aria-pressed="(?:true|false)"', html)) == 5


def test_api_docs_page():
    res = client.get("/api")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/html")
    assert "script-src 'self'" in res.headers["content-security-policy"]
    html = res.text
    for needle in ("/api/v1/generate", "length", "exclude_ambiguous", "very_strong",
                   "422", "no-store", "curl", 'href="/#sicurezza"'):
        assert needle in html
    assert "<script>" not in html and "style=" not in html


def test_api_docs_examples_match_api():
    # i nomi dei parametri documentati sono quelli che l'API accetta davvero
    html = client.get("/api").text
    for param in ("lower", "upper", "digits", "symbols"):
        assert f"<code>{param}</code>" in html


def test_service_worker_caches_new_assets():
    sw = client.get("/sw.js").text
    assert f"vaultforge-{APP_VERSION}" in sw
    for path in FONT_FILES + ["/api", f"/static/css/fonts.css?v={APP_VERSION}"]:
        assert f'"{path}"' in sw


def test_index_chips_have_spoken_labels():
    # "A–Z" e "a–z" suonano uguali a uno screen reader: servono nomi espliciti
    html = client.get("/").text
    for label in ("Maiuscole A–Z", "Minuscole a–z", "Numeri 0–9", "Simboli",
                  "Escludi caratteri ambigui"):
        assert f'aria-label="{label}' in html


@pytest.mark.parametrize("path", ["/", "/api"])
def test_head_request_shows_security_headers(path):
    # Il comando "curl -sI" della sezione Sicurezza usa HEAD: deve rispondere 200
    res = client.head(path)
    assert res.status_code == 200
    assert "default-src 'self'" in res.headers["content-security-policy"]
    assert "max-age=31536000" in res.headers["strict-transport-security"]


def test_api_passphrase_defaults():
    res = client.get("/api/v1/passphrase")
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    body = res.json()
    assert body["words"] == 7 and len(body["passphrase"].split("-")) == 7
    assert body["entropy_bits"] == 80.3 and body["strength"] == "strong"


def test_api_passphrase_space_separator():
    body = client.get("/api/v1/passphrase", params={"words": 4, "separator": "space", "number": False}).json()
    assert len(body["passphrase"].split(" ")) == 4 and body["strength"] == "weak"


@pytest.mark.parametrize("params", [{"words": 3}, {"words": 11}, {"separator": "x"}])
def test_api_passphrase_rejects_bad_input(params):
    assert client.get("/api/v1/passphrase", params=params).status_code == 422


def test_api_docs_cover_passphrase():
    html = client.get("/api").text
    for needle in ("/api/v1/passphrase", "<code>words</code>", "<code>separator</code>",
                   "<code>space</code>", "MIT"):
        assert needle in html


def test_index_has_mode_switch_and_passphrase_controls():
    html = client.get("/").text
    for needle in ('data-mode="password"', 'data-mode="passphrase"', 'data-pp="capitalize"',
                   'data-pp="number"', 'data-separator="space"', "Cifra finale",
                   "Per le password da ricordare e digitare", f"wordlist-it.js?v={APP_VERSION}"):
        assert needle in html
    assert html.index("wordlist-it.js") < html.index("js/app.js")
    assert "style=" not in html and "<script>" not in html


def test_service_worker_caches_wordlist():
    sw = client.get("/sw.js").text
    assert "vaultforge-1.2.0" in sw and f'"/static/js/wordlist-it.js?v={APP_VERSION}"' in sw


def test_index_explains_passphrase_security():
    html = client.get("/").text
    assert "passphrase" in html.lower() and "11 bit" in html and "conosce la lista" in html
