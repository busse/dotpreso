import { defineFigure, defineScene, type EdgeSpec, type Part, type Vec2 } from 'dotscene'
import { ASPECT, FLOOR, grounded, roundVec } from '../../../figures/kit.ts'
import { person } from '../../../figures/person.ts'
import { cloud, ground, hills, seeded, strew, tree } from '../../../figures/scenery.ts'
import { handAt, stage } from '../../../figures/stage.ts'
import { paper, tokens as t } from '../../../themes/paper/theme.ts'
import { UNDERSIDE, boat, fox, goose, grain } from '../figures/props.ts'

/**
 * A river with a bank either side, and the seven crossings that get a fox, a goose and a
 * bag of grain across it. Unlike a journey, the camera never moves: every slide looks at
 * the same stretch of water, and what changes is who is on which bank.
 *
 * Each crossing is a mark the deck rests a slide on. Advancing plays the stretch between
 * two marks: the farmer picks something up, walks to the boat, rows over, and sets it down.
 */

export const CAMERA = { at: [0, -2] as Vec2, width: 420 }

/** The river runs from -60 to 60; the boat docks just inside each bank. */
const RIVER: readonly [number, number] = [-60, 60]
const DOCK = { left: -40, right: 40 } as const
const EDGE = { left: -72, right: 72 } as const
type Side = keyof typeof DOCK

/** Where things rest on each bank, as the x of their origin. */
export const SPOTS = {
  foxL: [-176, FLOOR - UNDERSIDE], gooseL: [-146, FLOOR - UNDERSIDE], grainL: [-118, FLOOR - UNDERSIDE],
  gooseR: [112, FLOOR - UNDERSIDE], foxR: [146, FLOOR - UNDERSIDE], grainR: [178, FLOOR - UNDERSIDE],
} as const satisfies Record<string, Vec2>

const at = (x: number, y = 0): Vec2 => roundVec([x, y])

// ── the water ──────────────────────────────────────────────────────────────────────────

/** Three rows of short strokes, the way water is drawn when it is not drawn. */
const river = (() => {
  const random = seeded(21)
  const points: Record<string, Vec2> = {}
  const edges: EdgeSpec[] = []
  const pointKinds: Record<string, string> = {}
  let i = 0
  for (const y of [FLOOR + 4, FLOOR + 9, FLOOR + 15]) {
    for (let x = RIVER[0] + 4 + random() * 6; x < RIVER[1] - 8; x += 10 + random() * 8) {
      const wobble = random() * 1.5 - 0.75
      points[`w${i}a`] = at(x, y + wobble)
      points[`w${i}b`] = at(x + 4 + random() * 3, y + wobble)
      edges.push({ from: `w${i}a`, to: `w${i}b`, kind: 'water' })
      pointKinds[`w${i}a`] = 'hidden'
      pointKinds[`w${i}b`] = 'hidden'
      i++
    }
  }
  return defineFigure('river', { title: 'A river', points, edges, pointKinds })
})()

const LAND: readonly Part[] = [
  { figure: hills('hillsFar', -300, 300, 18, 46, 52, 5), id: 'hillsFar', at: at(0) },
  { figure: cloud, id: 'cloudA', at: at(30, -78), scale: 0.9 },
  { figure: cloud, id: 'cloudB', at: at(120, -104), scale: 1.2 },
  // A tree at the back of each bank, behind the cast.
  { figure: tree, id: 'tree90', at: grounded(-202, 1.1), scale: 1.1 },
  { figure: tree, id: 'tree91', at: grounded(204, 1.0), flipX: true },
  { figure: ground(-300, RIVER[0], 7), id: 'groundL', at: at(0) },
  { figure: ground(RIVER[1], 300, 8), id: 'groundR', at: at(0) },
  { figure: river, id: 'river', at: at(0) },
  // Trees and grass, keeping clear of the water and of where the cast stands.
  ...strew(-300, 300, [[-200, -102], [RIVER[0] - 2, RIVER[1] + 2], [102, 200]], 11),
]

// ── the crossings ──────────────────────────────────────────────────────────────────────

const FARMER = 'farmer'
const other = (side: Side): Side => (side === 'left' ? 'right' : 'left')
/** Where the farmer stands in the boat: a little aft of centre, feet below the gunwale. */
const aboard = (side: Side): Vec2 => at(DOCK[side] - 8, -4)
/** Where the cargo sits in the boat. */
const stowed = (side: Side): Vec2 => at(DOCK[side] + 9, FLOOR - UNDERSIDE - 4)

const s = stage({ walker: FARMER, from: -250, camera: () => CAMERA })

let side: Side = 'left'

/** Walk to the bank, step aboard (with the cargo, if any), row across and step off. */
const cross = (cargo?: { id: string; from: Vec2 }): void => {
  const to = other(side)
  const flipX = to === 'left'
  const carry = cargo === undefined ? undefined : { id: cargo.id }
  if (cargo !== undefined) {
    // Pick it up: it rested where it was last set down; say so, or it glides to the hand early.
    s.walk({ to: cargo.from[0] - 12, follow: false })
    s.pose('stand', { duration: 200, parts: { [cargo.id]: { at: cargo.from } } })
    s.pose('lift', { duration: 350, parts: { [cargo.id]: { at: handAt(s.at(), 'lift') } } })
  }
  s.walk({ to: EDGE[side], follow: false, ...(carry === undefined ? {} : { carry }) })
  // Aboard. The boat is restated where it was moored so the row starts from there.
  s.step({
    duration: 350,
    parts: {
      [FARMER]: { at: aboard(side), pose: 'stand', flipX },
      boat: { at: at(DOCK[side], FLOOR) },
      ...(cargo === undefined ? {} : { [cargo.id]: { at: stowed(side) } }),
    },
  })
  s.step({
    duration: 1500,
    easing: 'easeInOut',
    parts: {
      [FARMER]: { at: aboard(to), pose: 'stand', flipX },
      boat: { at: at(DOCK[to], FLOOR) },
      ...(cargo === undefined ? {} : { [cargo.id]: { at: stowed(to) } }),
    },
  })
  // Ashore, cargo in hand.
  s.step({
    duration: 350,
    parts: {
      [FARMER]: { at: at(EDGE[to]), pose: 'stand', flipX },
      ...(cargo === undefined ? {} : { [cargo.id]: { at: handAt(EDGE[to], 'stand', 'handR', flipX) } }),
    },
  })
  s.place(EDGE[to])
  side = to
}

/** Carry the cargo to its spot on this bank and set it down. */
const setDown = (id: string, spot: Vec2): void => {
  const flipX = side === 'left'
  s.walk({ to: spot[0] - (flipX ? -12 : 12), follow: false, carry: { id } })
  s.pose('offer', { duration: 300, flipX, parts: { [id]: { at: handAt(s.at(), 'offer', 'handR', flipX) } } })
  s.step({ duration: 300, easing: 'easeOut', parts: { [id]: { at: spot } } })
  s.pose('stand', { duration: 250, flipX })
}

// An empty river bank, then the farmer walks in and looks at the problem.
s.step({ parts: { [FARMER]: { at: at(-250), pose: 'stepA' } }, camera: CAMERA })
s.mark('empty')
s.walk({ to: -192, follow: false })
s.pose('stand', { duration: 250 })
s.pose('ponder', { duration: 450, easing: 'easeOut' })
s.mark('title')

// The rule: the farmer gestures at the three of them.
s.pose('presentR', { duration: 400 })
s.mark('rule')

// 1. The goose goes first: the fox has no taste for grain.
s.pose('stand', { duration: 250 })
cross({ id: 'goose', from: SPOTS.gooseL })
setDown('goose', SPOTS.gooseR)
s.mark('goose1')

// 2. Back alone.
cross()
s.pose('stand', { duration: 250, flipX: true })
s.mark('back1')

// 3. The fox goes over...
cross({ id: 'fox', from: SPOTS.foxL })
setDown('fox', SPOTS.foxR)
s.mark('fox')

// 4. ...and the goose comes back, so the fox is never left with it.
cross({ id: 'goose', from: SPOTS.gooseR })
setDown('goose', SPOTS.gooseL)
s.mark('gooseBack')

// 5. The grain goes over to the fox.
cross({ id: 'grain', from: SPOTS.grainL })
setDown('grain', SPOTS.grainR)
s.mark('grain')

// 6. Back alone, once more.
cross()
s.pose('stand', { duration: 250, flipX: true })
s.mark('back2')

// 7. The goose, at last.
cross({ id: 'goose', from: SPOTS.gooseL })
setDown('goose', SPOTS.gooseR)
s.pose('wave', { duration: 400 })
s.mark('goose2')

const keyframes = s.keyframes()

/** The cast at rest, on the left bank, with the boat moored. Shared with the still scene. */
export const CAST: readonly Part[] = [
  { figure: fox, id: 'fox', at: SPOTS.foxL },
  { figure: goose, id: 'goose', at: SPOTS.gooseL },
  { figure: grain, id: 'grain', at: SPOTS.grainL },
]

export const sceneCss = [
  paper.scene.roles,
  `.ds-line--water{stroke:${t.blue400};stroke-width:.5}`,
  `.ds-line--hull{stroke:${t.tan700};stroke-width:.9}`,
  `.ds-dot--hull{fill:${t.tan700}}`,
  `.ds-face--hull{fill:${t.surface}}`,
  `.ds-face--body{fill:${t.paper}}`,
  `.ds-line--sack{stroke:${t.tan700};stroke-width:.6}`,
  `.ds-dot--sack{fill:${t.tan700};r:.9}`,
  `.ds-face--sack{fill:${t.sunk}}`,
  `.ds-line--fox{stroke-width:.6}`,
  `.ds-line--goose{stroke-width:.6}`,
].join('')

export const scene = defineScene('river', {
  title: 'A farmer ferries a fox, a goose and a bag of grain across a river, one at a time',
  decorative: true,
  parts: [
    ...LAND,
    ...CAST,
    { figure: person, id: FARMER, at: at(-250), pose: 'stepA' },
    // After the farmer and the cargo, so the hull hides their feet when they are aboard.
    { figure: boat, id: 'boat', at: at(DOCK.left, FLOOR) },
  ],
  camera: { ...CAMERA, aspect: ASPECT },
  fit: 'slice',
  dotRadius: 1.15,
  lineWidth: 0.6,
  css: sceneCss,
  animate: { keyframes, mode: 'loop' },
})

export { LAND, DOCK }
