import { posePoints, ring, type EdgeSpec, type Keyframe, type PartKeyframe, type Pose, type Vec2 } from 'dotscene'
import { person } from './person.ts'

/**
 * The small helpers every figure and scene in a deck reaches for: rounding, edge loops, dot
 * kinds, rings as shapes, where a pose's hand is, and two passes over a keyframe list. One
 * copy here instead of one per file.
 */

/** The ground, in the person module: feet at y = 64. */
export const FLOOR = 64

/** Every camera in a deck is widescreen. */
export const ASPECT = 16 / 9

export const round = (n: number, places = 2): number => {
  const k = 10 ** places
  return Math.round(n * k) / k
}
export const round1 = (n: number): number => round(n, 1)
export const roundVec = (v: readonly [number, number], places = 2): Vec2 => [round(v[0], places), round(v[1], places)]

/** Where something drawn with its feet at `FLOOR` stands, scaled by `scale`, so its feet stay down. */
export const grounded = (x: number, scale: number, places = 1): Vec2 => [round(x, places), round(FLOOR * (1 - scale), places)]

/** A closed loop through the named points, all of one kind. */
export const loop = (names: readonly string[], kind: string): EdgeSpec[] =>
  names.map((from, i) => ({ from, to: names[(i + 1) % names.length]!, kind }))

/** An open chain through the named points. */
export const chain = (names: readonly string[], kind: string): EdgeSpec[] =>
  names.slice(1).map((to, i) => ({ from: names[i]!, to, kind }))

/** The same `pointKinds` entry for every name. */
export const kinds = (names: readonly string[], kind: string): Record<string, string> =>
  Object.fromEntries(names.map((name) => [name, kind]))

/** Construction points: no dot. */
export const hidden = (names: readonly string[]): Record<string, string> => kinds(names, 'hidden')

export interface RingShape {
  readonly names: string[]
  readonly points: Record<string, Vec2>
  readonly edges: EdgeSpec[]
  readonly faces: { points: string[]; kind: string }[]
  readonly pointKinds: Record<string, string>
}

/**
 * A ring of points as a figure piece: its rim as edges of `edge` kind (or none), a face of
 * `face` kind (or none), and its dots hidden unless `dots` names a kind for them.
 */
export const ringShape = (
  prefix: string,
  center: Vec2,
  radius: number,
  count: number,
  options: { readonly edge?: string | null; readonly face?: string | null; readonly dots?: string | null; readonly start?: number } = {},
): RingShape => {
  const { edge = 'ink', face = null, dots = null, start } = options
  const r = start === undefined ? ring(prefix, center, radius, count) : ring(prefix, center, radius, count, start)
  const names = Object.keys(r.points)
  return {
    names,
    points: r.points,
    edges: edge === null ? [] : r.edges.map(([from, to]) => ({ from, to, kind: edge })),
    faces: face === null ? [] : [{ points: names, kind: face }],
    pointKinds: kinds(names, dots ?? 'hidden'),
  }
}

/** A point of the person's pose, in the person's own space. A computed pose falls back to `idle` for points it leaves out. */
export const posePoint = (pose: string | Pose, point: string): Vec2 =>
  typeof pose === 'string' ? posePoints(person, pose)[point]! : (pose.points[point] ?? posePoints(person, 'idle')[point]!)

/** The fields of a part's keyframe that place and draw it, as opposed to fading or layering it. */
const GEOMETRY = ['at', 'pose', 'rotate', 'scale', 'flipX'] as const

/**
 * Carry each part's last place, pose and turn forward through a list of keyframes or beats,
 * in the order given. dotscene fills the geometry a keyframe leaves out from the part's
 * declaration, not from its last keyframe, so a beat that only fades a part would otherwise
 * snap it to wherever it was declared. After this pass, a part that is mentioned at all is
 * mentioned whole.
 */
export const carryGeometry = <T extends { readonly parts?: Readonly<Record<string, PartKeyframe>> }>(frames: readonly T[]): T[] => {
  const held = new Map<string, PartKeyframe>()
  return frames.map((frame) => {
    if (frame.parts === undefined) return frame
    const parts: Record<string, PartKeyframe> = {}
    for (const [id, state] of Object.entries(frame.parts)) {
      const geometry: Record<string, unknown> = { ...held.get(id) }
      for (const field of GEOMETRY) if (state[field] !== undefined) geometry[field] = state[field]
      held.set(id, geometry as PartKeyframe)
      parts[id] = { ...(geometry as PartKeyframe), ...state }
    }
    return { ...frame, parts }
  })
}

/**
 * A short tail after the last keyframe. The runtime wraps its clock at the end of the lap,
 * so a slide resting on the last mark must not sit exactly on it.
 */
export const withTail = (keyframes: readonly Keyframe[], duration = 200): Keyframe[] => [
  ...keyframes,
  { name: 'tail', duration, hold: 0, parts: {} },
]
