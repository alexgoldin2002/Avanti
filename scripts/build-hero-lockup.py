"""Generate the Avanti hero lockup as an outlined-path SVG.

Reproduces the landing hero (app/page.tsx) exactly:
  - eyebrow  "GROUP TRAVEL, HANDLED · EST. 2026"  (Inter, 0.28em tracking, 70%)
  - wordmark "AVANTI"                              (Cormorant Garamond italic, 0.02em)
  - tagline  "All the dream. None of the nightmare." (Cormorant Garamond italic, 85%)

The site loads only upright Cormorant, so its `italic` is the browser's
synthetic oblique. We match that with a shear of 0.25 (the Skia/Chrome value).
Every glyph is converted to a vector path, so the file is self-contained.
"""
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

CORMORANT = "public/brand/CormorantGaramond-Regular.ttf"
INTER = "public/brand/Inter-Regular-static.ttf"
OBLIQUE = 0.25  # synthetic italic shear, matches the browser

# size in px, tracking in em, oblique on/off, opacity — mirrors the CSS
LINES = [
    dict(font=INTER,     text="GROUP TRAVEL, HANDLED \u00b7 EST. 2026", size=11.2,
         tracking=0.28, oblique=False, opacity=0.70, gap_after=24),
    dict(font=CORMORANT, text="AVANTI", size=170.0,
         tracking=0.02, oblique=True, opacity=1.00, gap_after=32),
    dict(font=CORMORANT, text="All the dream. None of the nightmare.", size=24.0,
         tracking=0.0, oblique=True, opacity=0.85, gap_after=0),
]

PAD = 16.0
_fonts: dict = {}


def load(path):
    if path not in _fonts:
        tt = TTFont(path)
        data = open(path, "rb").read()
        hbfont = hb.Font(hb.Face(data))
        _fonts[path] = (tt, tt.getGlyphSet(), tt["head"].unitsPerEm, hbfont)
    return _fonts[path]


def build_line(line):
    tt, glyphset, upm, hbfont = load(line["font"])
    scale = line["size"] / upm
    tracking_px = line["tracking"] * line["size"]
    k = OBLIQUE if line["oblique"] else 0.0

    # Shape exactly like a browser: HarfBuzz applies kerning + default features.
    buf = hb.Buffer()
    buf.add_str(line["text"])
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})

    sp = SVGPathPen(glyphset)
    bp = BoundsPen(glyphset)
    penx = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gname = tt.getGlyphName(info.codepoint)
        ox = penx + pos.x_offset * scale
        oy = pos.y_offset * scale
        # x' = scale*x + k*scale*y + ox ; y' = scale*y + oy   (y-up text space)
        m = (scale, 0, k * scale, scale, ox, oy)
        glyphset[gname].draw(TransformPen(sp, m))
        glyphset[gname].draw(TransformPen(bp, m))
        # CSS adds letter-spacing on top of the (kerned) advance
        penx += pos.x_advance * scale + tracking_px

    bounds = bp.bounds or (0, 0, penx, line["size"])
    return {"d": sp.getCommands(), "bounds": bounds, **line}


def main():
    lines = [build_line(l) for l in LINES]

    widths = [b["bounds"][2] - b["bounds"][0] for b in lines]
    total_w = max(widths)

    # stack top-to-bottom by ink box, applying the CSS gaps between lines
    placed = []
    cursor = PAD
    for ln, w in zip(lines, widths):
        xmin, ymin, xmax, ymax = ln["bounds"]
        top_ext, bot_ext = ymax, -ymin
        baseline = cursor + top_ext
        tx = PAD + (total_w - w) / 2 - xmin
        placed.append((ln, tx, baseline))
        cursor = baseline + bot_ext + ln["gap_after"]

    total_h = cursor - lines[-1]["gap_after"] + PAD
    canvas_w = total_w + 2 * PAD

    for out, color in {
        "public/avanti-hero-lockup.svg": "#0B2010",
        "public/avanti-hero-lockup-white.svg": "#FFFFFF",
    }.items():
        groups = []
        for ln, tx, baseline in placed:
            groups.append(
                f'  <g transform="translate({tx:.2f} {baseline:.2f}) scale(1 -1)" '
                f'fill="{color}" fill-opacity="{ln["opacity"]:g}">\n'
                f'    <path d="{ln["d"]}"/>\n'
                f'  </g>'
            )
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {canvas_w:.2f} {total_h:.2f}" '
            f'role="img" aria-label="Avanti — All the dream. None of the nightmare.">\n'
            f'  <title>Avanti</title>\n'
            + "\n".join(groups)
            + "\n</svg>\n"
        )
        with open(out, "w") as f:
            f.write(svg)
        print(f"wrote {out}  ({canvas_w:.0f}x{total_h:.0f})  {color}")


if __name__ == "__main__":
    main()
