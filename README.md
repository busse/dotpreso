# dotpreso

Forward-and-back HTML slide decks whose illustrations are [dotscene](https://github.com/busse/dotscene) scenes — and whose illustrations *move between slides*. A presenter walks from one slide's station to the next while the camera rides along, so the figure holds its place on the page and the landscape slides past behind it. That scroll is the "advance".

A built deck is one HTML file that opens straight from disk with no network at all: every scene, the dotscene runtime, the player, the styles and the web fonts (as data URIs) are inlined.

## Setup

dotpreso runs TypeScript directly under Node 22.18 or later, and depends on dotscene checked out next door:

```sh
git clone https://github.com/busse/dotscene.git
git clone https://github.com/busse/dotpreso-public.git dotpreso
cd dotpreso
npm install
npm run dev fox-goose-grain      # build the example deck, serve it, rebuild on save
```

Start with the example, `decks/fox-goose-grain/`: an old river-crossing puzzle in seven slides, one crossing each. It is small enough to read in one sitting and uses everything: a static scene, an animated one with marks, labels on the drawing, citations, speaker notes and a theme.

## Presenting

| key | |
|---|---|
| → Space PageDown Enter, click | next |
| ← PageUp Backspace, click the left fifth | back |
| Home / End | first / last |
| `7` then Enter | go to slide 7 |
| `f` | fullscreen |
| `s` | speaker notes |
| `b` or `.` | blank the screen |
| `p` | open the presenter window |

Presentation clickers send PageUp/PageDown, so they work as-is. Swipe works on touch. `#5` in the URL opens slide 5. Pressing next mid-transition finishes it at once and moves on; going back rewinds the same stretch at triple speed. With `prefers-reduced-motion`, every change is a cut.

### The presenter window

`p` opens the same file a second time with `?presenter`: the current slide's notes, its title, the next slide's title and a clock, on a dark background with no stage. Put that window on the laptop and the main one on the projector. The two talk over a `BroadcastChannel`, so the arrow keys (or the clicker) work in whichever window has focus, and the presenter window follows every advance. `r` (or a click on the clock) resets the clock.

### Flags

| `?presenter` | the presenter window, above |
|---|---|
| `?debug` | draws the horizon (`--horizon`, the deck's ground line) and outlines the copy; warns in the console on any slide whose copy crosses it |
| `?dev` | reloads the page whenever `npm run dev` rebuilds it |

## How it works

A deck (`decks/<name>/deck.ts`) is a list of slides. Each slide has HTML copy, citations, speaker notes, and **cues**: which scenes are on stage and which named keyframe each one rests on.

```ts
{ id: 'fox', cues: [{ scene: river, at: 'fox' }], html: `…` }
```

On an advance the player plays every cued scene's timeline from where the last slide left it to where this one rests, by driving the dotscene runtime's `seek()` frame by frame. A scene that wasn't on the previous slide fades in, playing from `from`.

Citations are numbered by first use: a slide written as `cited((c) => ({ … }))` puts `${c.ref('alcuin')}` in its copy and `c.list()` in its footer, and a source key that doesn't exist fails the build.

`figures/stage.ts` writes the long timelines: `walk({ to })` moves the presenter with a planted-foot gait and the camera with them; `pose()` strikes a gesture; `mark('name')` names the keyframe a slide rests on. Parallax layers follow the camera at a fraction of its travel. `toStage()` in `src/deck.ts` converts a scene point to stage pixels, so a slide can write a label — FOX, GOOSE, GRAIN — exactly onto the drawing.

## Themes

A deck starts from a theme — colours, type, inlined fonts, what dotscene draws in, and the copy's layout — and overrides what it likes in its own `css`. The default is `themes/paper`: off-white paper, near-black ink, a teal accent, a grotesque for headlines and a text serif for the copy. It is a starting point, not a house style.

```ts
import { paper } from '../../themes/paper/theme.ts'
export const deck = defineDeck({ title, author, theme: paper, slides })
```

To build a theme for your organisation from its style guide, see [docs/theming.md](docs/theming.md). It is written for a person with the brand book open, or for an agent pointed at the guide.

## Layout

| path | |
|---|---|
| `src/` | deck model, theme contract, build, CLI, browser player |
| `figures/` | the illustration kit: the presenter, scenery, the staging helpers |
| `themes/<name>/` | a theme: `theme.ts` and its `fonts/` |
| `decks/<name>/` | a deck: `deck.ts`, its `scenes/`, `figures/` |
| `dist/` | build output (ignored) |

## Authoring loop

```sh
npm run dev <deck>                                              # build, serve, rebuild on save, reload the page
npm run check                                                   # validate every scene, then check the framing of every slide
npm run framing                                                 # just the framing: props cut by the frame, labels off the stage or on the presenter
npm run preview -- river --dir decks --pose fox --width 120     # one slide's frame, in the terminal
npm run preview -- river --dir decks --every 3000               # a flipbook
npm run typecheck
npm run build                                                   # → dist/<deck>/index.html
```

See [CLAUDE.md](CLAUDE.md) for the conventions and the traps.

## Publishing a talk

A talk, once given, can get its own public repo, served by GitHub Pages at `https://<owner>.github.io/<repo>/`, holding only the built file. Give the deck a `publish` block:

```ts
publish: {
  repo: 'river-crossing-talk',   // lowercase; a `talk-YYMM-…` name is checked against `date`
  owner: 'your-github-login',    // the GitHub user or org; defaults to whoever `gh` is signed in as
  event: 'Where it was given',
  date: '2026-10',               // YYYY-MM-DD, or YYYY-MM until the day is known
  venue: 'The room',
  notes: true,                   // keep the speaker notes in the public copy (default: stripped)
},
```

```sh
npm run export <deck>     # build the public copy into ../<repo>/ (index.html, README.md, .nojekyll)
npm run publish <deck>    # export, commit, create the public repo if new, push, turn on Pages
```

Re-run `publish` after any change; a push is a deploy. Pages serves the `main` branch's root, so there is no workflow to maintain. The public copy carries a canonical link and link-preview tags, and its README records the dotpreso commit it was built from. Give a published deck a `preview` (a 1200 × 630 card, usually the title slide rendered with the player chrome hidden) and it becomes the og:image.

## Feedback and changes

Bugs, ideas and adjustments go through [GitHub Issues](https://github.com/busse/dotpreso-public/issues); changes through pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md).
