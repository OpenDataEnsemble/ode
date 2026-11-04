"""
Regenerates the cluster count badges used by the Observations map
(src/assets/map/cluster-*.png). Counts are images, not map text, so they
render offline without map fonts. Requires Pillow >= 10.1.

    python scripts/generate-map-cluster-badges.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from_root = Path(__file__).resolve().parent.parent
OUT = from_root / "src" / "assets" / "map"
SCALE = 3
FONT_PX = 13 * SCALE
STROKE_PX = 1 * SCALE

LABELS = {str(n): str(n) for n in range(2, 10)}
LABELS.update(
    {
        "10p": "10+",
        "20p": "20+",
        "50p": "50+",
        "100p": "100+",
        "200p": "200+",
        "500p": "500+",
        "1kp": "1k+",
        "2kp": "2k+",
        "5kp": "5k+",
        "10kp": "10k+",
    }
)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default(size=FONT_PX)
    for key, text in LABELS.items():
        left, top, right, bottom = font.getbbox(text, stroke_width=STROKE_PX)
        pad = STROKE_PX
        image = Image.new("RGBA", (right - left + pad * 2, bottom - top + pad * 2), (0, 0, 0, 0))
        ImageDraw.Draw(image).text(
            (pad - left, pad - top),
            text,
            font=font,
            fill=(255, 255, 255, 255),
            stroke_width=STROKE_PX,
            stroke_fill=(0, 0, 0, 110),
        )
        image.save(OUT / f"cluster-{key}@3x.png", optimize=True)
        base = image.resize(
            (max(1, image.width // SCALE), max(1, image.height // SCALE)),
            Image.LANCZOS,
        )
        base.save(OUT / f"cluster-{key}.png", optimize=True)
    print(f"Wrote {len(LABELS)} badges to {OUT}")


if __name__ == "__main__":
    main()
