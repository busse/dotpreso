import { defineTheme } from '../../src/theme.ts'

/**
 * Paper: the default theme. Warm off-white paper, near-black ink, and a readable teal for
 * structure and emphasis; a grotesque for headlines, a text serif for the copy, a mono for
 * labels. The drawing keeps to ink on paper, with the landscape in pale blues so it recedes.
 *
 * The web fonts are latin subsets of Archivo, Newsreader and IBM Plex Mono (all OFL), so a
 * built deck carries its type with it.
 */

export const tokens = {
  paper: '#fbfaf7',
  sunk: '#f2f1ec',
  surface: '#e6e4dd',
  hairline: '#dbd9d2',
  tan400: '#b4b2ab',
  tan500: '#948c7d',
  tan700: '#574f41',
  ink: '#1d2021',
  ink2: '#3b4042',
  muted: '#656c6f',
  blue050: '#f1fafd',
  blue100: '#dcf2f9',
  blue200: '#c2e8f3',
  blue300: '#a4dded',
  blue400: '#6fc2dc',
  blue600: '#1b7f9f',
  blue700: '#0b6580',
  blue800: '#075166',
} as const

const t = tokens

/** Only the latin range, as the subsetted files expect. */
export const LATIN =
  'U+0000-00FF, U+0100-017F, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'

export const paper = defineTheme({
  name: 'paper',
  colors: { paper: t.paper, ink: t.ink, muted: t.muted, accent: t.blue700, rule: t.hairline },
  fonts: {
    display: '"Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif',
    text: '"Newsreader", Georgia, "Times New Roman", serif',
    mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  dir: import.meta.dirname,
  faces: [
    { family: 'Archivo', weight: '400 800', file: 'fonts/archivo-latin.woff2', unicodeRange: LATIN },
    { family: 'IBM Plex Mono', weight: 400, file: 'fonts/ibm-plex-mono-400-latin.woff2', unicodeRange: LATIN },
    { family: 'IBM Plex Mono', weight: 500, file: 'fonts/ibm-plex-mono-500-latin.woff2', unicodeRange: LATIN },
    { family: 'IBM Plex Mono', weight: 600, file: 'fonts/ibm-plex-mono-600-latin.woff2', unicodeRange: LATIN },
    { family: 'Newsreader', weight: '400 500', file: 'fonts/newsreader-latin.woff2', unicodeRange: LATIN },
    { family: 'Newsreader', weight: 400, style: 'italic', file: 'fonts/newsreader-italic-latin.woff2', unicodeRange: LATIN },
  ],
  scene: {
    line: t.ink,
    dot: t.ink,
    face: t.paper,
    // The kit's landscape: ink underfoot, blue structure, paler blue the farther away.
    roles: [
      `.ds-dot--hidden{display:none}`,
      `.ds-line--ground{stroke:${t.ink};stroke-width:.8}`,
      `.ds-line--soil{stroke:${t.tan500};stroke-opacity:.55;stroke-width:.5}`,
      `.ds-line--trunk{stroke:${t.blue600}}`,
      `.ds-dot--trunk{fill:${t.blue600}}`,
      `.ds-line--crown{stroke:${t.blue400};stroke-width:.45}`,
      `.ds-dot--crown{fill:${t.blue600}}`,
      `.ds-line--grass{stroke:${t.blue400};stroke-width:.45}`,
      `.ds-dot--grass{fill:${t.blue400};r:.6}`,
      `.ds-line--ridge{stroke:${t.blue300};stroke-width:.5}`,
      `.ds-dot--ridge{fill:${t.blue300};r:.8}`,
      `.ds-face--hillsNear{fill:${t.blue050}}`,
      `.ds-face--hillsFar{fill:${t.paper}}`,
      `.ds-dot--head{r:2.6}`,
      `.ds-line--blue{stroke:${t.blue700}}`,
      `.ds-dot--blue{fill:${t.blue700}}`,
      `.ds-face--accent{fill:${t.blue300}}`,
    ].join(''),
  },
  // The copy: a column at top left, above the ground line, with the drawing to the right.
  css: `
.text {
  position: absolute;
  left: 96px;
  top: 80px;
  width: 700px;
}
.text, .cites, .colophon {
  text-shadow: 0 0 3px ${t.paper}, 0 0 8px ${t.paper}, 0 0 14px ${t.paper};
}
.text .kicker {
  margin: 0 0 22px;
  font: 500 17px/1.2 var(--font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}
.copy h1 {
  margin: 0 0 26px;
  font: 700 66px/1.03 var(--font-display);
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.text p, .text li {
  margin: 0 0 14px;
  font: 400 25px/1.38 var(--font-text);
  text-wrap: pretty;
}
.text .lede {
  font-size: 32px;
  line-height: 1.32;
}
.text ul, .text ol {
  margin: 0 0 18px;
  padding-left: 1.1em;
}
.text li {
  margin-bottom: 8px;
  padding-left: 0.2em;
}
.text li::marker {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.8em;
}
.copy blockquote {
  margin: 0 0 22px;
  padding: 2px 0 2px 22px;
  border-left: 3px solid ${t.blue300};
}
.copy blockquote p {
  font-style: italic;
}
.ref {
  font: 500 0.52em/1 var(--font-mono);
  color: var(--accent);
  vertical-align: super;
  margin-left: 2px;
}
.copy strong {
  font-weight: 500;
  font-family: var(--font-display);
  font-size: 0.92em;
}
.copy code {
  font: 500 0.82em/1 var(--font-mono);
  color: ${t.ink2};
}
.text .small, .text .small p {
  font-size: 22px;
  color: ${t.ink2};
}
/* A label written on the drawing, at a point the slide computed with toStage(). */
.tag {
  position: absolute;
  transform: translate(-50%, -50%);
  font: 600 18px/1 var(--font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  white-space: nowrap;
}
.colophon {
  position: absolute;
  left: 96px;
  bottom: 30px;
  margin: 0;
  font: 400 14px/1.5 var(--font-mono);
  color: var(--muted);
}
`,
})
