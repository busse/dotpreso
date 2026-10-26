import { defineFigure, ring, type Vec2, type Vec3 } from 'dotscene'

/**
 * An isometric building kit, for scenes built in grid space (metres across, metres deep,
 * metres up) and projected once with dotscene's `isometric`.
 *
 * `Shape`, `merge`, `figureOf` and `box` follow dotscene's own kit (scenes/iso.ts in that
 * repo), which is not exported from the package. Added here: hip and pyramid roofs, quads on
 * any plane (windows, doors, flags, a band of stonework), dormers, and trees.
 *
 * The view looks from +x, +y. Two walls of a box show: the one facing +y ("front", the left
 * of the two on screen) and the one facing +x ("side", the right). Anything facing away is
 * left out entirely rather than painted and covered, because a figure paints all its faces
 * before any of its lines and a hidden face's edges would draw over the near ones.
 */

export interface Shape {
  readonly points: Readonly<Record<string, Vec2>>
  readonly edges: readonly { readonly from: string; readonly to: string; readonly kind?: string }[]
  readonly faces: readonly { readonly points: readonly string[]; readonly kind: string }[]
  readonly kinds: Readonly<Record<string, string>>
  readonly layers: readonly (readonly string[])[]
}

const empty: Shape = { points: {}, edges: [], faces: [], kinds: {}, layers: [] }

/** Combine shapes in paint order: each becomes a layer, so later shapes cover earlier ones. */
export const merge = (...shapes: readonly Shape[]): Shape => ({
  points: Object.assign({}, ...shapes.map((s) => s.points)),
  edges: shapes.flatMap((s) => s.edges),
  faces: shapes.flatMap((s) => s.faces),
  kinds: Object.assign({}, ...shapes.map((s) => s.kinds)),
  layers: shapes.flatMap((s) => (s.layers.length > 0 ? s.layers : [Object.keys(s.points)])),
})

export const figureOf = (name: string, shape: Shape, title: string) =>
  defineFigure(name, {
    title,
    points: shape.points,
    edges: shape.edges,
    faces: shape.faces,
    pointKinds: shape.kinds,
    ...(shape.layers.length < 2 ? {} : { layers: shape.layers.filter((layer) => layer.length > 0) }),
  })

/** Hide every point of a shape (no dots), or give them a role. */
export const dots = (shape: Shape, kind = 'hidden'): Shape => ({
  ...shape,
  kinds: Object.fromEntries(Object.keys(shape.points).map((name) => [name, kind])),
})

export const isoKit = (project: (cell: Vec3) => Vec2) => {
  /** A flat polygon on any plane, from grid corners. Its outline takes `edge`; `null` draws none. */
  const quad = (prefix: string, corners: readonly Vec3[], kind: string, edge: string | null = 'ink'): Shape => {
    const names = corners.map((_c, i) => `${prefix}${i}`)
    return {
      points: Object.fromEntries(corners.map((c, i) => [names[i]!, project(c)])),
      edges: edge === null ? [] : names.map((from, i) => ({ from, to: names[(i + 1) % names.length]!, kind: edge })),
      faces: [{ points: names, kind }],
      kinds: Object.fromEntries(names.map((name) => [name, 'hidden'])),
      layers: [],
    }
  }

  const line = (prefix: string, a: Vec3, b: Vec3, kind = 'ink', dotKind = 'hidden'): Shape => ({
    points: { [`${prefix}A`]: project(a), [`${prefix}B`]: project(b) },
    edges: [{ from: `${prefix}A`, to: `${prefix}B`, kind }],
    faces: [],
    kinds: { [`${prefix}A`]: dotKind, [`${prefix}B`]: dotKind },
    layers: [],
  })

  /** A solid box from grid corner `from` to `to`, `base` to `top` high: its two near walls and its top. */
  const box = (prefix: string, from: Vec2, to: Vec2, top: number, base = 0, faces = { front: 'front', side: 'side', top: 'top' }): Shape => {
    const [x0, y0] = from
    const [x1, y1] = to
    const p = {
      [`${prefix}Near`]: project([x1, y1, base]),
      [`${prefix}East`]: project([x1, y0, base]),
      [`${prefix}West`]: project([x0, y1, base]),
      [`${prefix}TopFar`]: project([x0, y0, top]),
      [`${prefix}TopEast`]: project([x1, y0, top]),
      [`${prefix}TopNear`]: project([x1, y1, top]),
      [`${prefix}TopWest`]: project([x0, y1, top]),
    }
    const e = (a: string, b: string) => ({ from: `${prefix}${a}`, to: `${prefix}${b}`, kind: 'ink' })
    return {
      points: p,
      edges: [
        e('East', 'Near'), e('Near', 'West'), e('East', 'TopEast'), e('Near', 'TopNear'), e('West', 'TopWest'),
        e('TopFar', 'TopEast'), e('TopEast', 'TopNear'), e('TopNear', 'TopWest'), e('TopWest', 'TopFar'),
      ],
      faces: [
        { points: [`${prefix}TopFar`, `${prefix}TopEast`, `${prefix}TopNear`, `${prefix}TopWest`], kind: faces.top },
        { points: [`${prefix}East`, `${prefix}Near`, `${prefix}TopNear`, `${prefix}TopEast`], kind: faces.side },
        { points: [`${prefix}Near`, `${prefix}West`, `${prefix}TopWest`, `${prefix}TopNear`], kind: faces.front },
      ],
      kinds: Object.fromEntries(Object.keys(p).map((name) => [name, 'hidden'])),
      layers: [],
    }
  }

  /** A box's two near walls only, for a building that gets a roof of its own on top. */
  const walls = (prefix: string, from: Vec2, to: Vec2, top: number, front = 'front', side = 'side', base = 0): Shape => {
    const [x0, y0] = from
    const [x1, y1] = to
    const p = {
      [`${prefix}Near`]: project([x1, y1, base]),
      [`${prefix}East`]: project([x1, y0, base]),
      [`${prefix}West`]: project([x0, y1, base]),
      [`${prefix}TopEast`]: project([x1, y0, top]),
      [`${prefix}TopNear`]: project([x1, y1, top]),
      [`${prefix}TopWest`]: project([x0, y1, top]),
    }
    const e = (a: string, b: string) => ({ from: `${prefix}${a}`, to: `${prefix}${b}`, kind: 'ink' })
    return {
      points: p,
      edges: [e('East', 'Near'), e('Near', 'West'), e('East', 'TopEast'), e('Near', 'TopNear'), e('West', 'TopWest'), e('TopEast', 'TopNear'), e('TopNear', 'TopWest')],
      faces: [
        { points: [`${prefix}East`, `${prefix}Near`, `${prefix}TopNear`, `${prefix}TopEast`], kind: side },
        { points: [`${prefix}Near`, `${prefix}West`, `${prefix}TopWest`, `${prefix}TopNear`], kind: front },
      ],
      kinds: Object.fromEntries(Object.keys(p).map((name) => [name, 'hidden'])),
      layers: [],
    }
  }

  /**
   * A hip roof over [from, to], eaves at `eave` overhanging by `over`, ridge along x at `ridge`
   * high and `inset` in from each end. Only the slopes facing the viewer: the long front slope
   * and the hip at the +x end.
   */
  const hipRoof = (prefix: string, from: Vec2, to: Vec2, eave: number, ridge: number, inset: number, over = 0.6, kinds = { front: 'roof', side: 'roofSide' }): Shape => {
    const [x0, y0] = [from[0] - over, from[1] - over]
    const [x1, y1] = [to[0] + over, to[1] + over]
    const ym = (y0 + y1) / 2
    const p = {
      [`${prefix}East`]: project([x1, y0, eave]),
      [`${prefix}Near`]: project([x1, y1, eave]),
      [`${prefix}West`]: project([x0, y1, eave]),
      [`${prefix}R0`]: project([x0 + inset, ym, ridge]),
      [`${prefix}R1`]: project([x1 - inset, ym, ridge]),
    }
    const e = (a: string, b: string, kind = 'ink') => ({ from: `${prefix}${a}`, to: `${prefix}${b}`, kind })
    return {
      points: p,
      edges: [e('West', 'Near'), e('Near', 'East'), e('West', 'R0'), e('Near', 'R1'), e('East', 'R1'), e('R0', 'R1')],
      faces: [
        { points: [`${prefix}West`, `${prefix}Near`, `${prefix}R1`, `${prefix}R0`], kind: kinds.front },
        { points: [`${prefix}Near`, `${prefix}East`, `${prefix}R1`], kind: kinds.side },
      ],
      kinds: { ...Object.fromEntries(Object.keys(p).map((name) => [name, 'hidden'])), [`${prefix}R0`]: 'ridge', [`${prefix}R1`]: 'ridge' },
      layers: [],
    }
  }

  /** A pyramid roof to a single apex: the two slopes facing the viewer. */
  const pyramid = (prefix: string, from: Vec2, to: Vec2, eave: number, apex: number, over = 0.6, kinds = { front: 'roof', side: 'roofSide' }): Shape => {
    const [x0, y0] = [from[0] - over, from[1] - over]
    const [x1, y1] = [to[0] + over, to[1] + over]
    const p = {
      [`${prefix}East`]: project([x1, y0, eave]),
      [`${prefix}Near`]: project([x1, y1, eave]),
      [`${prefix}West`]: project([x0, y1, eave]),
      [`${prefix}Apex`]: project([(x0 + x1) / 2, (y0 + y1) / 2, apex]),
    }
    const e = (a: string, b: string) => ({ from: `${prefix}${a}`, to: `${prefix}${b}`, kind: 'ink' })
    return {
      points: p,
      edges: [e('West', 'Near'), e('Near', 'East'), e('West', 'Apex'), e('Near', 'Apex'), e('East', 'Apex')],
      faces: [
        { points: [`${prefix}West`, `${prefix}Near`, `${prefix}Apex`], kind: kinds.front },
        { points: [`${prefix}Near`, `${prefix}East`, `${prefix}Apex`], kind: kinds.side },
      ],
      kinds: { ...Object.fromEntries(Object.keys(p).map((name) => [name, 'hidden'])), [`${prefix}Apex`]: 'ridge' },
      layers: [],
    }
  }

  /** A window on a front wall (the plane y = `y`), sill at `z`. */
  const frontWindow = (prefix: string, x: number, y: number, z: number, w = 1.2, h = 1.7, kind = 'glass'): Shape =>
    quad(prefix, [[x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y, z + h], [x - w / 2, y, z + h]], kind, 'trim')

  /** A window on a side wall (the plane x = `x`). */
  const sideWindow = (prefix: string, x: number, y: number, z: number, w = 1.2, h = 1.7, kind = 'glass'): Shape =>
    quad(prefix, [[x, y + w / 2, z], [x, y - w / 2, z], [x, y - w / 2, z + h], [x, y + w / 2, z + h]], kind, 'trim')

  /**
   * A gabled dormer standing on a front roof slope: its face at y = `y`, sill at `z`, roof
   * ridge running back into the main roof. The face, its window, its gable and its +x slope.
   */
  const dormer = (prefix: string, x: number, y: number, z: number, w = 1.6, h = 1.6, depth = 1.6): Shape => {
    const l = x - w / 2
    const r = x + w / 2
    const top = z + h
    const apex = top + w * 0.45
    return merge(
      quad(`${prefix}c`, [[r, y, z], [r, y - depth, z + depth * 0.9], [r, y - depth, top], [r, y, top]], 'side'),
      quad(`${prefix}f`, [[l, y, z], [r, y, z], [r, y, top], [x, y, apex], [l, y, top]], 'front'),
      quad(`${prefix}s`, [[r + 0.15, y + 0.15, top], [r + 0.15, y - depth, top], [x, y - depth, apex], [x, y + 0.15, apex]], 'roofSide'),
      frontWindow(`${prefix}w`, x, y, z + 0.25, w * 0.6, h * 0.7),
    )
  }

  /** A chimney stack: a narrow box with a darker cap. */
  const chimney = (prefix: string, x: number, y: number, base: number, top: number, w = 1.2, d = 1.6): Shape =>
    merge(
      box(`${prefix}b`, [x - w / 2, y - d / 2], [x + w / 2, y + d / 2], top, base, { front: 'chimney', side: 'chimneySide', top: 'chimney' }),
      box(`${prefix}c`, [x - w / 2 - 0.15, y - d / 2 - 0.15], [x + w / 2 + 0.15, y + d / 2 + 0.15], top + 0.35, top, { front: 'cap', side: 'cap', top: 'cap' }),
    )

  /**
   * A tree: a trunk with a fork, and a canopy of overlapping blobs — dots joined like a star
   * chart, each blob filled so the canopy hides what is behind it. The canopy is centred at
   * 62% of `height`, so trunks stay short and the crown carries the shape. `seed` varies it.
   */
  const tree = (prefix: string, at: Vec2, height: number, radius: number, seed: number, kind = 'crown'): Shape => {
    let state = (seed * 9301 + 49297) % 233280
    const random = () => {
      state = (state * 9301 + 49297) % 233280
      return state / 233280
    }
    // Grid metres to screen units, read off the projection itself.
    const scale = project([1, 0, 0])[0] - project([0, 0, 0])[0]
    const crownZ = height * 0.62
    const base = project([at[0], at[1], 0])
    const fork = project([at[0], at[1], crownZ - radius * 0.55])
    const blobs: { dx: number; dz: number; r: number }[] =
      radius < 1.5
        ? [{ dx: 0, dz: 0, r: 1 }]
        : [
            { dx: -0.45, dz: -0.15, r: 0.72 },
            { dx: 0.45, dz: -0.1, r: 0.7 },
            { dx: 0, dz: 0.3, r: 0.78 },
          ]
    const points: Record<string, Vec2> = { [`${prefix}base`]: base, [`${prefix}fork`]: fork }
    const edges: Shape['edges'][number][] = [{ from: `${prefix}base`, to: `${prefix}fork`, kind: 'trunk' }]
    const faces: Shape['faces'][number][] = []
    const kinds: Record<string, string> = { [`${prefix}base`]: 'hidden', [`${prefix}fork`]: 'hidden' }
    const layers: string[][] = [[`${prefix}base`, `${prefix}fork`]]
    blobs.forEach((blob, b) => {
      const center = project([at[0] + blob.dx * radius, at[1] + blob.dx * radius * -0.2, crownZ + blob.dz * radius])
      const count = 11
      const names: string[] = []
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2
        const r = radius * blob.r * scale * (0.82 + random() * 0.3)
        const name = `${prefix}b${b}k${i}`
        points[name] = [Math.round((center[0] + Math.cos(angle) * r) * 10) / 10, Math.round((center[1] + Math.sin(angle) * r * 0.9) * 10) / 10]
        kinds[name] = kind
        names.push(name)
      }
      names.forEach((from, i) => edges.push({ from, to: names[(i + 1) % count]!, kind }))
      const hub = `${prefix}b${b}m`
      points[hub] = center
      kinds[hub] = kind
      names.filter((_n, i) => i % 4 === 1).forEach((from) => edges.push({ from, to: hub, kind: `${kind}Inner` }))
      if (blobs.length > 1) edges.push({ from: `${prefix}fork`, to: hub, kind: 'branch' })
      faces.push({ points: names, kind })
      layers.push([...names, hub])
    })
    return { points, edges, faces, kinds, layers }
  }

  /** A flat ellipse on the ground: a planting bed, a pool of lamplight. */
  const disc = (prefix: string, center: Vec2, rx: number, ry: number, kind: string, edge: string | null = 'ink', count = 16): Shape => {
    const unit = ring('_', [0, 0], 1, count, 0).points
    const corners: Vec3[] = Object.values(unit).map(([ux, uy]) => [center[0] + ux * rx, center[1] + uy * ry, 0])
    return quad(prefix, corners, kind, edge)
  }

  return { project, quad, line, box, walls, hipRoof, pyramid, frontWindow, sideWindow, dormer, chimney, tree, disc, empty }
}
