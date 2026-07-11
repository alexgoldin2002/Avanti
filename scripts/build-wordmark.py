"""Generate the AVANTI wordmark as outlined-path SVGs.

Mirrors the nav bar wordmark: Cormorant Garamond, 0.5em letter-spacing.
Letters are converted to vector paths so the logo renders identically
everywhere, with no dependency on the font being installed.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

FONT = "public/brand/CormorantGaramond-Regular.ttf"
TEXT = "AVANTI"
TRACKING_EM = 0.5  # matches tracking-[0.5em] in the nav
PAD_EM = 0.12      # small breathing room around the mark

OUTPUTS = {
    "public/avanti-wordmark.svg": "#0B2010",        # forest-deep (brand green)
    "public/avanti-wordmark-white.svg": "#FFFFFF",   # for dark backgrounds
}


def layout(font):
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphset = font.getGlyphSet()
    tracking = TRACKING_EM * upm

    positions = []  # (glyph_name, x_offset)
    x = 0.0
    for ch in TEXT:
        gname = cmap[ord(ch)]
        positions.append((gname, x))
        x += glyphset[gname].width + tracking
    # drop the trailing tracking so the mark is tight on both sides
    total_advance = x - tracking
    return upm, glyphset, positions, total_advance


def combined_bounds(glyphset, positions):
    bp = BoundsPen(glyphset)
    for gname, xoff in positions:
        tp = TransformPen(bp, (1, 0, 0, 1, xoff, 0))
        glyphset[gname].draw(tp)
    return bp.bounds  # (xMin, yMin, xMax, yMax) in font units, y-up


def combined_path(glyphset, positions):
    sp = SVGPathPen(glyphset)
    for gname, xoff in positions:
        tp = TransformPen(sp, (1, 0, 0, 1, xoff, 0))
        glyphset[gname].draw(tp)
    return sp.getCommands()


def main():
    font = TTFont(FONT)
    upm, glyphset, positions, _ = layout(font)
    xMin, yMin, xMax, yMax = combined_bounds(glyphset, positions)
    d = combined_path(glyphset, positions)

    pad = PAD_EM * upm
    width = (xMax - xMin) + 2 * pad
    height = (yMax - yMin) + 2 * pad
    # Flip y (font space is y-up, SVG is y-down) and shift into the viewBox.
    tx = pad - xMin
    ty = pad + yMax
    transform = f"translate({tx:.2f} {ty:.2f}) scale(1 -1)"

    for path, color in OUTPUTS.items():
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {width:.2f} {height:.2f}" '
            f'role="img" aria-label="AVANTI">\n'
            f'  <title>AVANTI</title>\n'
            f'  <g transform="{transform}" fill="{color}">\n'
            f'    <path d="{d}"/>\n'
            f'  </g>\n'
            f'</svg>\n'
        )
        with open(path, "w") as f:
            f.write(svg)
        print(f"wrote {path}  ({width:.0f}x{height:.0f})  {color}")


if __name__ == "__main__":
    main()
