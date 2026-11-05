"""Genera le icone di VaultForge: il logo a ruota di cassaforte in ottone su grafite.

Uso: .venv/Scripts/python tools/make_icons.py
Richiede Pillow (in requirements-dev.txt). Sovrascrive i file in static/icons/.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ICONS = Path(__file__).resolve().parent.parent / "static" / "icons"
GRAPHITE = (13, 14, 17, 255)
BRASS = (201, 163, 91, 255)
SUPERSAMPLE = 4

# Logo su una griglia di 26 unita' (come nel prototipo): cerchio r=11,
# cerchio interno r=5.5, quattro tacche cardinali da r=11 a r=7.
OUTER_R, INNER_R, TICK_IN = 11.0, 5.5, 7.0

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0d0e11"/>
  <g transform="translate(9 9) scale(1.769)" fill="none" stroke="#c9a35b" stroke-width="1.6" stroke-linecap="round">
    <circle cx="13" cy="13" r="11"/>
    <circle cx="13" cy="13" r="5.5"/>
    <path d="M13 2v4M13 20v4M2 13h4M20 13h4"/>
  </g>
</svg>
"""


def draw_icon(size: int, logo_fraction: float, stroke_units: float, radius_fraction: float) -> Image.Image:
    """Icona quadrata: logo largo `logo_fraction` del lato, angoli arrotondati di `radius_fraction`."""
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * radius_fraction), fill=GRAPHITE)

    unit = big * logo_fraction / (2 * OUTER_R + stroke_units)
    c = big / 2
    width = max(1, round(stroke_units * unit))
    for r in (OUTER_R, INNER_R):
        rr = r * unit
        draw.ellipse((c - rr, c - rr, c + rr, c + rr), outline=BRASS, width=width)
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        x1, y1 = c + dx * OUTER_R * unit, c + dy * OUTER_R * unit
        x2, y2 = c + dx * TICK_IN * unit, c + dy * TICK_IN * unit
        draw.line((x1, y1, x2, y2), fill=BRASS, width=width)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    targets = {
        # nome: (lato, frazione del logo, spessore in unita', raggio angoli)
        "favicon-32.png": (32, 0.84, 2.6, 0.2),
        "apple-touch-icon.png": (180, 0.62, 1.8, 0.0),
        "icon-192.png": (192, 0.66, 1.8, 0.22),
        "icon-512.png": (512, 0.66, 1.6, 0.22),
        "icon-maskable-512.png": (512, 0.5, 1.6, 0.0),
    }
    for name, (size, fraction, stroke, radius) in targets.items():
        draw_icon(size, fraction, stroke, radius).save(ICONS / name, optimize=True)
    (ICONS / "icon.svg").write_text(SVG, encoding="utf-8")
    print(f"Icone scritte in {ICONS}")


if __name__ == "__main__":
    main()
