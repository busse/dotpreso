# dotpreso — authoring contract

Decks of forward/back slides whose illustrations are dotscene scenes that animate *between* slides. Read `../dotscene/CLAUDE.md` first; everything there applies to the scenes here. The example deck, `decks/fox-goose-grain/`, is the smallest complete one: read it before writing a deck.

## Model

- A **deck** (`decks/<name>/deck.ts`, exporting `deck`) is `defineDeck({ title, author, theme?, css, head, fonts?, slides })`.
- A **theme** (`src/theme.ts`; `themes/<name>/theme.ts`) is the look a deck starts from: the player's colours and font stacks, woff2 faces to inline, what dotscene draws in (`scene.line/dot/face`), bare rules for the kit's landscape roles (`scene.roles`, which a scene passes as its `css`), and the copy's typography. The build emits it after the player's stylesheet and before the deck's `css`, so a deck overrides what it likes. `themes/paper` is the default. `docs/theming.md` is how to build one from a style guide.
- A **slide** is `{ id, layout?, html, cites?, notes?, cues }`. The stage is 1600 × 900 CSS px; copy is positioned in stage pixels. Write a slide with citations as `cited((c) => ({ … }))` (`src/deck.ts` `cites`): `c.ref('key')` in the copy numbers sources by first use, `c.list()` is the footer, and a key that is not in `SOURCES` fails the build. A footer the copy never points at (`cites: [{ text }]` with no `c.ref`) renders as a plain line.
- **Fonts** are inlined: a theme's `faces` (files next to the theme) and a deck's own `fonts: [{ family, weight, style?, file, unicodeRange? }]` (files next to the deck). The built file then needs no network at all.
- A **cue** is `{ scene, at, from?, delay? }`: while the slide shows, `scene` rests on keyframe `at`. Advancing plays each scene from the previous slide's mark to this one. A scene absent from the previous slide fades in (after `delay`), playing from `from` if given, else appearing at `at`.
- The build resolves mark names to milliseconds with dotscene's `keyframeTime`, so a misspelt mark fails the build.
- A **static** scene (no `animate`) is plain SVG: cue it as `{ scene }` with no `at`. The runtime never mounts it, and the player doesn't wait for it. The example deck's holding slide, `scenes/riverStill.ts`, is one.
- A **loop** cue `{ scene, loop: true }` plays a looping scene for as long as the slide shows, and pauses it on leaving: an ambient scene for a holding slide while the room fills.
- **`figures/kit.ts`** is the one copy of the small helpers: `round`/`round1`/`roundVec`, `FLOOR`, `ASPECT`, `grounded`, `loop`/`chain`/`kinds`/`hidden`, `ringShape` (a ring as edges + face + hidden dots), `posePoint` (where a pose's hand is), `carryGeometry` and `withTail`. Reach for it before writing a local `r1`.
- **`figures/person.ts`** is the presenter: dotscene's person plus the gestures a talk needs. **`figures/scenery.ts`** is the landscape: ground, trees, grass, hills, clouds, and `strew` to scatter them clear of the stations.
- **`figures/draw.ts`** (`sketch`) writes a figure as a drawing: shapes, paths, rings and dots, each call its own layer so paint order is call order, with poses that move named points.
- **Isometric scenes** build in grid metres with `figures/iso.ts` — dotscene's `box`/`merge`/`figureOf` plus hip and pyramid roofs, dormers, windows on wall planes, chimneys and trees. Only near-facing surfaces are drawn: a hidden face's edges would paint over the near ones.

## Journeys

`figures/stage.ts`:

- `stage({ walker, from, camera, parallax })` — `camera(x)` says where the camera looks when the walker stands at x. Keep the walker at a fixed fraction across the frame so the world, not the figure, moves. A still camera (the example deck's river) is `camera: () => CAMERA`.
- `walk({ to, carry?, follow? })` — one keyframe per gait phase, `linear`, advancing `HALF` per phase so the planted foot stays put. `carry` keeps a part in the right hand. `follow: false` walks across a still frame (an entrance).
- `pose(name, { parts })` — strike a presenter pose, moving other parts in the same beat.
- `mark(name)` — name the last keyframe; that is what a slide's cue rests on.
- `place(x)` — tell the stage the walker is at x after something else moved them (the boat in the example deck), so the next `walk` starts there.
- `keyframes()` appends a short tail, because the runtime wraps its clock at the end of the lap and the last slide must not sit on it.

## Traps

- **Sparse keyframes glide between mentions.** A part drifts from its last mention towards its next one, even across a slide's mark. `stage.step()` restates the walker on every step that leaves them out, so a beat that only moves a prop doesn't pull the presenter towards the next slide. Other parts you must restate yourself: mention a part where it rests *before* it moves (the cargo in `river.ts` is restated on the ground in the beat before it is lifted; the boat is restated at its mooring in the beat before it is rowed), and hold anything carried through a beat that moves something else.
- **A keyframe that names a part resets the geometry it leaves out.** Opacity and depth carry over from earlier keyframes, but `at`, `pose`, `rotate`, `scale` and `flipX` fall back to the part's *declaration* (dotscene `src/layout.ts`). A beat that only fades a part, `{ leaf0: { opacity: 1 } }`, would slide it to its declared place, usually the scene origin. `carryGeometry` in `figures/kit.ts` fills the gap from the part's last mention; `stage.keyframes()` runs it, so a timeline written through the stage is safe. Anything written as raw keyframes must run it or restate position and pose on every beat. This is a different trap from the glide above: carrying forward fixes a part that is *mentioned without its geometry*; restating fixes a part that is *not mentioned at all*.
- **Several scenes on one page share one stylesheet.** `src/build.ts` compiles blocks with `styles: false` and puts dotscene's defaults in `<head>` once, followed by each scene's scoped rules. Needs dotscene at or after `6d6a7ec`.
- **Deck and theme CSS must scope element rules inside the copy.** A bare `li` or `p` rule, or one scoped only by a layout class (`.crossing li`), also styles the citations and the speaker notes, which share the slide. The build refuses such a selector (`unscopedSelectors` in `src/build.ts`): write `.copy h1`, `.text p`, `.crossing .text li`.
- **Labels on the drawing** use `toStage(camera, point)` — the camera at that slide's mark. Keep the anchor points in the scene file (`SPOTS`) so they move with the props.
- **Paint order is declaration order.** A part declared later paints over an earlier one: the example deck declares the boat after the farmer and the cargo so the hull hides their feet when they are aboard.
- A slide's copy fades in at 60% of the longest transition, capped at 1.8 s.
- **Copy must stay above the horizon** (`--horizon`, 702 px on the paper layout: the ground line). Open the built page with `?debug` to see the line and the copy boxes; it warns in the console for any slide that crosses. Dense slides hold about 80 words.

## Checking

```sh
npm run check && npm run typecheck && npm run build
```

`check` validates every scene and then runs `scripts/framing.ts`: every cued scene resolved at its mark, reporting any prop that straddles the frame's edge (landscape parts — `ground*`, `tree<n>`, `tuft<n>`, `sun`, `river` — are meant to run off the edge and are skipped), any `.tag` label that lands off the stage or on the presenter (`FRAMING_MARGIN=16` to see what is merely close), and any part still gliding through a slide's mark — stated before the mark and differently after it, but not at the mark itself, so the slide rests on an in-between state. Fix those by restating the part in the step that the mark names.

Then look at it: `npm run dev <deck>` builds, serves, rebuilds on save and reloads the page (`?dev`); add `?debug` for the horizon. Step through every slide; press `p` for the presenter window. The ASCII preview is good for poses and framing, not for colour or copy.

## Publishing

A talk is published to its own public repo, served at `https://<owner>.github.io/<repo>/`; `owner` defaults to whoever `gh` is signed in as. The deck's `publish` block names the repo; `checkPublish` (src/deck.ts) requires a lowercase slug and, for a `talk-YYMM-…` name, that YYMM matches `publish.date`. `npm run publish <deck>` exports to `../<repo>/` and pushes, so it is outward-facing: run it only when asked. Speaker notes are stripped from the public copy unless `publish.notes` is true; decide per talk. Give a published deck a `preview` (a 1200 × 630 card): it becomes the og:image. See README → Publishing.

## Style

TypeScript strict, named exports, functional. Conventional commits. Feedback and changes go through GitHub Issues and pull requests.
