import { defineFigure, ring, type EdgeSpec, type Figure, type FigureSpec, type Vec2 } from 'dotscene'
import { loop, round1 } from './kit.ts'

type FaceSpec = NonNullable<FigureSpec['faces']>[number]
type Points = Record<string, Vec2>

/**
 * A figure written as a drawing: closed shapes, lines and dots, each painted over the last.
 *
 * Every call is its own layer, so paint order is call order — draw what stands behind first.
 * Points are named `p0`, `p1`, … in call order; a call returns its names, so a pose can move
 * them (`pose`). Dots are hidden unless a call names a dot kind.
 */
export interface Sketch {
  /** A closed shape: an outline of `edge` kind (or none) over a face of `face` kind (or none). */
  shape(corners: readonly Vec2[], options?: { face?: string | null; edge?: string | null; dots?: string | null }): string[]
  /** An open chain through the points. */
  path(points: readonly Vec2[], kind?: string, dots?: string | null): string[]
  /** One segment. */
  line(a: Vec2, b: Vec2, kind?: string, dots?: string | null): string[]
  /** A ring of `count` points: a closed shape. */
  circle(center: Vec2, radius: number, count: number, options?: { face?: string | null; edge?: string | null; dots?: string | null; start?: number }): string[]
  /** A lone dot. */
  dot(at: Vec2, kind: string): string
  /** Give named points another place in pose `name`, computed from where they rest. */
  pose(name: string, names: readonly string[], move: (rest: Vec2, index: number) => Vec2): void
  /** Where a point rests. */
  at(name: string): Vec2
  done(title: string): Figure
}

const v = (p: Vec2): Vec2 => [round1(p[0]), round1(p[1])]

export const sketch = (name: string): Sketch => {
  const points: Points = {}
  const edges: EdgeSpec[] = []
  const faces: FaceSpec[] = []
  const pointKinds: Record<string, string> = {}
  const layers: string[][] = []
  const poses: Record<string, Points> = {}
  let n = 0

  const add = (corners: readonly Vec2[], dots: string | null): string[] => {
    const names = corners.map((corner) => {
      const id = `p${n++}`
      points[id] = v(corner)
      pointKinds[id] = dots ?? 'hidden'
      return id
    })
    layers.push(names)
    return names
  }

  const shape: Sketch['shape'] = (corners, { face = null, edge = 'ink', dots = null } = {}) => {
    const names = add(corners, dots)
    if (edge !== null) edges.push(...loop(names, edge))
    if (face !== null) faces.push({ points: names, kind: face })
    return names
  }

  const path: Sketch['path'] = (corners, kind = 'ink', dots = null) => {
    const names = add(corners, dots)
    names.slice(1).forEach((to, i) => edges.push({ from: names[i]!, to, kind }))
    return names
  }

  return {
    shape,
    path,
    line: (a, b, kind = 'ink', dots = null) => path([a, b], kind, dots),
    circle: (center, radius, count, { start = -90, ...options } = {}) =>
      shape(Object.values(ring('_', center, radius, count, start).points), options),
    dot: (at, kind) => add([at], kind)[0]!,
    pose: (pose, names, move) => {
      const target = (poses[pose] ??= {})
      names.forEach((id, i) => {
        target[id] = v(move(points[id]!, i))
      })
    },
    at: (id) => points[id]!,
    // A figure with poses can always go back to how it rests: `rest` names that.
    done: (title) => defineFigure(name, { title, points, edges, faces, pointKinds, layers, poses: Object.keys(poses).length === 0 ? {} : { rest: {}, ...poses } }),
  }
}

/** A rectangle's corners, from its top-left and bottom-right. */
export const box = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** A rectangle with its corners cut at `c`, for anything rounded. */
export const rounded = (x0: number, y0: number, x1: number, y1: number, c: number): Vec2[] => [
  [x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c],
]

/** Points along an arc about `center`, from `from` to `to` degrees (0 = right, clockwise, y down). */
export const arc = (center: Vec2, radius: number, from: number, to: number, count: number): Vec2[] =>
  Array.from({ length: count }, (_u, i) => {
    const a = ((from + ((to - from) * i) / (count - 1)) * Math.PI) / 180
    return v([center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius])
  })
