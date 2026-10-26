import { cites, defineDeck, toStage, type Cue, type Slide } from '../../src/deck.ts'
import { paper } from '../../themes/paper/theme.ts'
import { CAMERA, SPOTS, scene as river } from './scenes/river.ts'
import { scene as still } from './scenes/riverStill.ts'

/**
 * The fox, the goose and the bag of grain: the example deck.
 *
 * An old river-crossing puzzle told in seven slides, one crossing each, so that advancing a
 * slide *is* a crossing. It shows the whole of dotpreso in one small place: a static scene
 * for the holding slide, an animated scene whose marks the slides rest on, labels written
 * onto the drawing, a slide with citations, speaker notes, and a theme.
 *
 *   npm run dev fox-goose-grain
 */

const SOURCES = {
  alcuin: {
    text: 'Alcuin of York (c. 800). Propositiones ad acuendos juvenes, no. 18: a wolf, a goat and a cabbage.',
    url: 'https://en.wikipedia.org/wiki/Wolf,_goat_and_cabbage_problem',
  },
  hadley: {
    text: 'Hadley, J. & Singmaster, D. (1992). Problems to Sharpen the Young. The Mathematical Gazette, 76(475), 102–126.',
    url: 'https://doi.org/10.2307/3620384',
  },
} as const

/** A slide whose citations are numbered by first use: `c.ref('key')` in the copy, `c.list()` for the footer. */
const cited = (make: (c: ReturnType<typeof cites<keyof typeof SOURCES>>) => Slide): Slide => make(cites(SOURCES))

/** The river scene resting on a mark; `from` is where it plays from when it first appears. */
const at = (mark: string, from?: string): Cue => ({ scene: river, at: mark, ...(from === undefined ? {} : { from }) })

/** A label written on the drawing: a scene point, pinned to where it lands on the stage. */
const tag = (spot: keyof typeof SPOTS, text: string, lift = 34): string => {
  const { left, top } = toStage(CAMERA, [SPOTS[spot][0], SPOTS[spot][1] - lift])
  return `<span class="tag" style="left:${left}px;top:${top}px">${text}</span>`
}

/** A crossing slide: the kicker counts them. */
const crossing = (n: number, id: string, title: string, body: string, notes: string): Slide => ({
  id,
  layout: 'crossing',
  cues: [at(id)],
  html: `<div class="text">
  <p class="kicker">Crossing ${n} of 7</p>
  <h1>${title}</h1>
  ${body}
</div>`,
  notes,
})

export const deck = defineDeck({
  title: 'The fox, the goose and the bag of grain',
  author: 'dotpreso',
  description: 'An old river-crossing puzzle in seven slides, one crossing each: the example deck for dotpreso.',
  theme: paper,
  css: `
:root {
  /* Where the ground line crosses the stage; copy must stay above it (\`?debug\` checks). */
  --horizon: 702px;
}
.title .copy h1 { font-size: 78px; }
.crossing .text { width: 640px; }
.end .text .small p { margin-top: 18px; }
`,
  slides: [
    {
      id: 'hold',
      layout: 'hold',
      cues: [{ scene: still }],
      html: `<div class="text">
  <p class="kicker">An example deck</p>
  <h1>The fox, the goose and the bag of grain</h1>
</div>`,
      notes: '<p>A holding slide: a static scene, cued with no mark. Nothing moves until the talk starts.</p>',
    },
    {
      id: 'title',
      layout: 'title',
      cues: [at('title', 'empty')],
      html: `<div class="text">
  <p class="kicker">A puzzle, told in slides</p>
  <h1>The fox, the goose and the bag of grain</h1>
  <p class="lede">A farmer has to get all three across a river. The boat holds the farmer and one other thing.</p>
</div>`,
      notes: '<p>The river scene fades in and plays from its first keyframe: the farmer walks in from the left and looks at the problem.</p>',
    },
    {
      id: 'rule',
      layout: 'rule',
      cues: [at('rule')],
      html: `<div class="text">
  <p class="kicker">The rule</p>
  <h1>Never leave the wrong two alone</h1>
  <ul>
    <li>Left together, the fox eats the goose.</li>
    <li>Left together, the goose eats the grain.</li>
    <li>The fox and the grain are safe with each other.</li>
  </ul>
</div>
${tag('foxL', 'Fox')}${tag('gooseL', 'Goose')}${tag('grainL', 'Grain')}`,
      notes: '<p>The labels are written onto the drawing with <code>toStage()</code>: a scene point becomes a stage pixel, so they sit over the animals wherever the props are placed.</p>',
    },
    crossing(1, 'goose1', 'Take the goose first', '<p class="lede">The fox will not touch the grain, so those two can wait together.</p>', '<p>Each crossing is the stretch of timeline between two marks: pick up, walk to the boat, row, set down.</p>'),
    crossing(2, 'back1', 'Come back alone', '<p class="lede">The goose is safe on the far bank. Nothing on the near bank is in danger.</p>', '<p>An empty crossing: the same choreography with no cargo.</p>'),
    crossing(3, 'fox', 'Take the fox over', '<p class="lede">Now the fox and the goose are on the same bank, and the farmer is about to leave.</p>', '<p>Hold here a beat. The audience sees the problem before the next slide solves it.</p>'),
    crossing(4, 'gooseBack', 'Bring the goose back', '<p class="lede">The move nobody expects: something comes back. The fox waits alone on the far side.</p>', '<p>This is the heart of the puzzle. Everything else is forced.</p>'),
    crossing(5, 'grain', 'Take the grain over', '<p class="lede">The grain joins the fox, which has no interest in it. The goose waits on the near bank.</p>', ''),
    crossing(6, 'back2', 'Come back alone', '<p class="lede">One thing left to fetch.</p>', ''),
    crossing(7, 'goose2', 'Fetch the goose', '<p class="lede">All three across, and nothing eaten. Seven crossings, and no fewer will do.</p>', '<p>The farmer waves. Going back a slide rewinds the crossing at triple speed.</p>'),
    cited((c) => ({
      id: 'source',
      layout: 'source',
      cues: [at('goose2')],
      html: `<div class="text">
  <p class="kicker">Where it comes from</p>
  <h1>Twelve hundred years old</h1>
  <p>The puzzle appears in a Latin collection of problems attributed to Alcuin of York, around the year 800, as a wolf, a goat and a cabbage.${c.ref('alcuin')} The fox, the goose and the grain are the English telling.${c.ref('hadley')}</p>
</div>`,
      cites: c.list(),
      notes: '<p>A cited slide: <code>c.ref()</code> numbers the sources by first use and <code>c.list()</code> lists them in the footer. A key that is not in <code>SOURCES</code> fails the build.</p>',
    })),
    {
      id: 'end',
      layout: 'end',
      cues: [at('goose2')],
      html: `<div class="text">
  <p class="kicker">How this deck is made</p>
  <h1>One scene, ten marks</h1>
  <p>The river is one dotscene scene with a timeline. Each slide names the keyframe it rests on, and advancing plays the stretch in between.</p>
  <p class="small">The deck is <code>decks/fox-goose-grain/deck.ts</code>; the scene, <code>scenes/river.ts</code>; the cast, <code>figures/props.ts</code>. The look is the <code>paper</code> theme.</p>
</div>
<p class="colophon">Illustrated with dotscene · presented with dotpreso</p>`,
      notes: '<p>Press <kbd>s</kbd> for these notes, <kbd>p</kbd> for the presenter window, <kbd>f</kbd> for fullscreen.</p>',
    },
  ],
})
