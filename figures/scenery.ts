import { defineFigure, type EdgeSpec, type Figure, type FigureSpec, type Part, type Vec2 } from 'dotscene'

type FaceSpec = NonNullable<FigureSpec['faces']>[number]
import { FLOOR, grounded, round1 } from './kit.ts'

/**
 * The landscape a presenter walks through. Drawn in the person module (feet at y = 64),
 * in the constellation idiom: every vertex a dot, every edge a line.
 *
 * Roles, for the deck's stylesheet to colour:
 *   ground  — the line walked on            (ink)
 *   soil    — ticks under it                 (muted, dots hidden)
 *   scenery — trees, grass                   (structure blue)
 *   ridge   — hills and clouds, far away     (pale blue)
 *   hidden  — construction points            (no dot)
 */

/** A small deterministic generator, so a rebuild draws the same landscape. */
export const seeded = (seed: number) => {
  let state = seed >>> 0
  return (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const r1 = round1

/** The line walked on, from `x0` to `x1`, with a scatter of soil ticks beneath it. */
export const ground = (x0: number, x1: number, seed = 7): Figure => {
  const random = seeded(seed)
  const points: Record<string, Vec2> = { g0: [x0, FLOOR], g1: [x1, FLOOR] }
  const edges: EdgeSpec[] = [{ from: 'g0', to: 'g1', kind: 'ground' }]
  const pointKinds: Record<string, string> = { g0: 'hidden', g1: 'hidden' }
  let i = 0
  for (let x = x0 + 8; x < x1 - 8; x += 14 + random() * 26) {
    const y = FLOOR + 5 + random() * 12
    const length = 3 + random() * 7
    points[`s${i}a`] = [r1(x), r1(y)]
    points[`s${i}b`] = [r1(x + length), r1(y)]
    edges.push({ from: `s${i}a`, to: `s${i}b`, kind: 'soil' })
    pointKinds[`s${i}a`] = 'hidden'
    pointKinds[`s${i}b`] = 'hidden'
    i++
  }
  return defineFigure('ground', { title: 'Ground', points, edges, pointKinds })
}

/** A constellation tree: a trunk, and a crown of dots joined like a star chart. */
export const tree = defineFigure('tree', {
  title: 'A tree',
  points: {
    root: [0, 64],
    fork: [0, 38],
    b1: [-9, 30],
    b2: [8, 27],
    c1: [-17, 22],
    c2: [-12, 8],
    c3: [-2, 0],
    c4: [10, 4],
    c5: [18, 16],
    c6: [14, 28],
    c7: [0, 16],
    c8: [-20, 32],
  },
  edges: [
    { from: 'root', to: 'fork', kind: 'trunk' },
    { from: 'fork', to: 'b1', kind: 'trunk' },
    { from: 'fork', to: 'b2', kind: 'trunk' },
    { from: 'fork', to: 'c7', kind: 'trunk' },
    ...(
      [
        ['b1', 'c1'], ['c1', 'c2'], ['c2', 'c3'], ['c3', 'c4'], ['c4', 'c5'], ['c5', 'c6'],
        ['c6', 'b2'], ['b1', 'c8'], ['c8', 'c1'], ['c7', 'c2'], ['c7', 'c4'], ['c7', 'c3'],
      ] as const
    ).map(([from, to]) => ({ from, to, kind: 'crown' })),
  ],
  pointKinds: {
    root: 'hidden', fork: 'trunk',
    b1: 'crown', b2: 'crown', c1: 'crown', c2: 'crown', c3: 'crown', c4: 'crown', c5: 'crown', c6: 'crown', c7: 'crown', c8: 'crown',
  },
})

/** A tuft of grass, three blades from one root. */
export const tuft = defineFigure('tuft', {
  title: 'Grass',
  points: { base: [0, 64], l: [-4, 57], m: [0.5, 55], r: [4, 58] },
  edges: [
    { from: 'base', to: 'l', kind: 'grass' },
    { from: 'base', to: 'm', kind: 'grass' },
    { from: 'base', to: 'r', kind: 'grass' },
  ],
  pointKinds: { base: 'hidden', l: 'grass', m: 'grass', r: 'grass' },
})

/**
 * A range of hills: a ridge of dots over [x0, x1], filled down to the floor so a nearer
 * range can hide a farther one.
 */
export const hills = (name: string, x0: number, x1: number, low: number, high: number, spacing: number, seed: number): Figure => {
  const random = seeded(seed)
  const points: Record<string, Vec2> = {}
  const edges: EdgeSpec[] = []
  const rim: string[] = []
  const pointKinds: Record<string, string> = {}
  let i = 0
  let previous: string | undefined
  for (let x = x0; x <= x1; x += spacing * (0.7 + random() * 0.6)) {
    const id = `r${i++}`
    points[id] = [r1(x), r1(FLOOR - low - random() * (high - low))]
    pointKinds[id] = 'ridge'
    if (previous !== undefined) edges.push({ from: previous, to: id, kind: 'ridge' })
    rim.push(id)
    previous = id
  }
  const last = points[rim[rim.length - 1]!]!
  points.baseR = [last[0], FLOOR]
  points.baseL = [x0, FLOOR]
  pointKinds.baseR = 'hidden'
  pointKinds.baseL = 'hidden'
  const faces: FaceSpec[] = [{ points: [...rim, 'baseR', 'baseL'], kind: name }]
  return defineFigure(name, { title: 'Hills', points, edges, faces, pointKinds })
}

/** A small cloud of dots. */
export const cloud = defineFigure('cloud', {
  title: 'A cloud',
  points: { a: [-16, 4], b: [-9, -2], c: [0, -5], d: [9, -2], e: [16, 3], f: [5, 5], g: [-5, 6] },
  edges: (
    [
      ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'g'], ['g', 'a'], ['b', 'g'], ['c', 'f'],
    ] as const
  ).map(([from, to]) => ({ from, to, kind: 'ridge' })),
  pointKinds: { a: 'ridge', b: 'ridge', c: 'ridge', d: 'ridge', e: 'ridge', f: 'ridge', g: 'ridge' },
})

/** Trees and grass strewn along [x0, x1], skipping anywhere a station needs clear ground. */
export const strew = (x0: number, x1: number, clear: readonly (readonly [number, number])[], seed = 11): Part[] => {
  const random = seeded(seed)
  const free = (x: number, pad: number): boolean => clear.every(([a, b]) => x < a - pad || x > b + pad)
  const parts: Part[] = []
  let t = 0
  for (let x = x0; x < x1; x += 70 + random() * 90) {
    if (!free(x, 22)) continue
    const scale = 0.75 + random() * 0.55
    parts.push({ figure: tree, id: `tree${t++}`, at: grounded(x, scale), scale: r1(scale * 100) / 100, flipX: random() > 0.5 })
  }
  let g = 0
  for (let x = x0; x < x1; x += 18 + random() * 40) {
    if (!free(x, 6)) continue
    const scale = 0.7 + random() * 0.6
    parts.push({ figure: tuft, id: `tuft${g++}`, at: grounded(x, scale), scale: r1(scale * 100) / 100 })
  }
  return parts
}
