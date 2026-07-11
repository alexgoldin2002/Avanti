// Render the Avanti logo SVGs to high-resolution PNGs for decks/social.
// Uses @resvg/resvg-js (self-contained, no system libraries required).
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'

const FOREST = '#0B2010'
const WHITE = '#FFFFFF'

// [source svg, output png, render width (px), background or null for transparent]
const JOBS = [
  ['public/avanti-hero-lockup.svg',        'public/avanti-hero-lockup.png',            2400, null],
  ['public/avanti-hero-lockup.svg',        'public/avanti-hero-lockup-on-white.png',   2400, WHITE],
  ['public/avanti-hero-lockup-white.svg',  'public/avanti-hero-lockup-on-forest.png',  2400, FOREST],
  ['public/avanti-wordmark.svg',           'public/avanti-wordmark.png',               1600, null],
  ['public/avanti-wordmark-white.svg',     'public/avanti-wordmark-on-forest.png',     1600, FOREST],
]

for (const [src, out, width, bg] of JOBS) {
  const svg = readFileSync(src, 'utf8')
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: bg ?? 'rgba(0,0,0,0)',
    font: { loadSystemFonts: false }, // paths are already outlined
  })
  const png = resvg.render().asPng()
  writeFileSync(out, png)
  const { width: w, height: h } = resvg.render()
  console.log(`wrote ${out}  ${w}x${h}  ${bg ?? 'transparent'}`)
}
