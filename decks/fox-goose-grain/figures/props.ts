import { defineFigure } from 'dotscene'

/**
 * The cast: a fox, a goose, a bag of grain and the boat. Each is drawn around its own
 * origin, with its underside at y = 6, so the same figure can sit on the ground
 * (`at: [x, FLOOR - 6]`), ride in the boat, or hang from the farmer's hand (`at: handAt(…)`).
 *
 * Every vertex is a dot and every edge a line, in the constellation idiom; a face fills the
 * body so the hills don't show through it.
 */

/** How far below a figure's origin its feet are. */
export const UNDERSIDE = 6

export const fox = defineFigure('fox', {
  title: 'A fox',
  points: {
    nose: [10, -1], head: [6, -3], earA: [4, -7], earB: [8, -6], neck: [2, -2],
    back: [-4, -3], rump: [-8, -1], tailA: [-12, -3], tailB: [-15, 1],
    chest: [1, 2], belly: [-5, 2],
    legFA: [3, 6], legFB: [6, 6], legBA: [-6, 6], legBB: [-9, 6],
  },
  edges: [
    ...([
      ['nose', 'head'], ['head', 'earA'], ['head', 'earB'], ['earA', 'earB'], ['head', 'neck'],
      ['neck', 'back'], ['back', 'rump'], ['rump', 'tailA'], ['tailA', 'tailB'],
      ['neck', 'chest'], ['chest', 'belly'], ['belly', 'rump'], ['nose', 'chest'],
    ] as const).map(([from, to]) => ({ from, to, kind: 'fox' })),
    { from: 'chest', to: 'legFA', kind: 'fox' }, { from: 'chest', to: 'legFB', kind: 'fox' },
    { from: 'belly', to: 'legBA', kind: 'fox' }, { from: 'belly', to: 'legBB', kind: 'fox' },
  ],
  faces: [{ points: ['nose', 'head', 'neck', 'back', 'rump', 'belly', 'chest'], kind: 'body' }],
})

export const goose = defineFigure('goose', {
  title: 'A goose',
  points: {
    beak: [9, -7], head: [5, -8], neckA: [3, -4], neckB: [1, 0],
    breast: [-1, 3], keel: [-4, 5], body: [-7, 2], back: [-4, -2], tail: [-11, -1],
    footA: [-2, 6], footB: [-5, 6],
  },
  edges: [
    ...([
      ['beak', 'head'], ['head', 'neckA'], ['neckA', 'neckB'], ['neckB', 'breast'], ['breast', 'keel'],
      ['keel', 'body'], ['body', 'tail'], ['tail', 'back'], ['back', 'neckB'],
      ['keel', 'footA'], ['body', 'footB'],
    ] as const).map(([from, to]) => ({ from, to, kind: 'goose' })),
  ],
  faces: [{ points: ['neckB', 'breast', 'keel', 'body', 'tail', 'back'], kind: 'body' }],
})

export const grain = defineFigure('grain', {
  title: 'A bag of grain',
  points: {
    baseL: [-5, 6], baseR: [5, 6], sideL: [-6, -2], sideR: [6, -2],
    neckL: [-2, -6], neckR: [2, -6], tie: [0, -7], top: [0, -10],
  },
  edges: [
    ...([
      ['baseL', 'baseR'], ['baseR', 'sideR'], ['sideR', 'neckR'], ['neckR', 'tie'],
      ['tie', 'neckL'], ['neckL', 'sideL'], ['sideL', 'baseL'], ['tie', 'top'],
    ] as const).map(([from, to]) => ({ from, to, kind: 'sack' })),
  ],
  faces: [{ points: ['baseL', 'baseR', 'sideR', 'neckR', 'neckL', 'sideL'], kind: 'sack' }],
})

/** The hull, drawn after whoever is aboard so the gunwale hides their feet. Origin at the waterline. */
export const boat = defineFigure('boat', {
  title: 'A rowing boat',
  points: { sternTop: [-24, -6], bowTop: [24, -7], bowBot: [15, 2], sternBot: [-15, 2], thwart: [0, -4] },
  edges: [
    ...([
      ['sternTop', 'bowTop'], ['bowTop', 'bowBot'], ['bowBot', 'sternBot'], ['sternBot', 'sternTop'],
    ] as const).map(([from, to]) => ({ from, to, kind: 'hull' })),
  ],
  faces: [{ points: ['sternTop', 'bowTop', 'bowBot', 'sternBot'], kind: 'hull' }],
  pointKinds: { thwart: 'hidden' },
})
