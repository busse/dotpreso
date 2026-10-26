# Theming

A deck starts from a **theme**: the colours and type of the player's frame, the web fonts to inline, what dotscene draws in, and a stylesheet for the copy. The deck names it once and overrides what it likes in its own `css`.

```ts
import { paper } from '../../themes/paper/theme.ts'

export const deck = defineDeck({ title, author, theme: paper, css: `…`, slides })
```

The default is `themes/paper`: off-white paper, near-black ink, a teal accent, a grotesque for headlines and a text serif for the copy. It is a starting point, not a house style. This page is how to build another one, for an organisation, from its style guide.

## What a theme is

`src/theme.ts` defines it. Every field, and what it drives:

| field | drives |
|---|---|
| `colors.paper` | the stage background, `--paper` |
| `colors.ink` | text, and the default stroke of lines and dots, `--ink` |
| `colors.muted` | citations, the counter, `--muted` |
| `colors.accent` | kickers, list markers, the progress bar, labels on the drawing, `--accent` |
| `colors.rule` | hairlines and link underlines, `--rule` |
| `colors.letterbox` | the bars beside the stage when the window isn't 16:9; defaults to `paper` |
| `fonts.display` / `text` / `mono` | the three font stacks, `--font-display`, `--font-text`, `--font-mono` |
| `faces` + `dir` | woff2 files to inline, so the built deck needs no network |
| `scene.line` / `dot` / `face` | what dotscene draws in unless a scene's own stylesheet says otherwise |
| `scene.roles` | bare rules for the illustration kit's roles (ground, soil, trunk, crown, grass, ridge, hills); a scene passes them as its `css` |
| `css` | the copy's typography and layout: `.text`, `.copy h1`, `.kicker`, `.lede`, lists, blockquotes, `.tag`, `.colophon` |

The build emits, in order: the fonts, each scene's stylesheet, the player's, then `themeCss(theme)`, then the deck's `css`. Later wins, so a deck can override any of it.

## Building a theme from a style guide

Whether you are a person with the brand book open or an agent pointed at an internal style-guide page, the work is the same.

1. **Copy the default.** `cp -R themes/paper themes/<name>`, rename the export, and delete the font files you won't use.

2. **Pull the tokens out of the guide.** You need five colours and three typefaces:
   - *paper*: the brand's lightest neutral, the one its documents sit on. Pure white is fine; a warm or cool off-white is kinder on a projector.
   - *ink*: the darkest neutral, used for body text. Not necessarily black.
   - *muted*: a mid neutral for secondary text.
   - *accent*: one brand colour that reads as "look here". If the guide offers several, take the one it uses for links and buttons.
   - *rule*: a light neutral for hairlines.
   - *display* for headlines, *text* for running copy, *mono* for labels and citations. If the brand has one typeface, use it for display and text and pick a mono that matches its temperature; if it has no mono, `ui-monospace, SFMono-Regular, Menlo, monospace` is fine.

3. **Check contrast on the stage.** Ink on paper at least 7:1; accent and muted on paper at least 4.5:1, because kickers and citations are small. A brand's hero colour is often too light for text; the guide usually has a darker step of it. Use that for `accent` and keep the hero for faces in the drawing.

4. **Fonts.** Only inline fonts the organisation is licensed to embed in a file it will hand out. Subset to latin (`pyftsubset` or a web service), as woff2, one file per weight or a variable file with a weight range, and list them in `faces`. Keep the system fallbacks in the stacks: a reader without the font still gets a sane page.

5. **The drawing.** `scene.line` and `scene.dot` are usually `ink`; `scene.face` is `paper`. The kit's landscape roles are where the brand shows in the illustration: pick a structure colour (trunks, grass, near hills) and a paler far colour (ridges, far hills) from the brand's secondary palette. Keep faces pale: a face exists to hide what is behind it, and a strong fill draws the eye off the presenter.

6. **The copy.** Keep the layout from `paper` (the column at top left, above the ground line) and change the type: sizes to suit the typeface's x-height, letter-spacing, the marker style. Element rules must be scoped inside the copy (`.copy h1`, `.text p`), never bare, or the build refuses them: a bare `p` would also style the citations and speaker notes.

7. **Look at it.** Point the example deck at the theme (`theme: <name>` in `decks/fox-goose-grain/deck.ts`) and `npm run dev fox-goose-grain`. Step through every slide; open the presenter window with `p`; add `?debug` to see the horizon. Check it on a projector or a large TV if you can: colours that work on a laptop wash out at a distance.

8. **Keep the theme in its own folder** with a short comment at the top saying whose it is, where the tokens came from, and when. Themes are data; they are easy to review in a pull request.

## What a theme does not do

- It does not change the stage. The stage is always 1600 × 900, copy at top left, drawing to the right, ground line at `--horizon`. A deck changes that with its own `css` and `layout` classes.
- It does not add logos or chrome. Put a logo in a slide's copy, or in the deck's `head`.
- It does not restyle a scene's own rules. A scene that says `.ds-face--vault{fill:#123}` keeps it under every theme. Scenes that want to follow the theme use its `tokens` and `scene.roles`.
