import { defineFigure, mirrorX } from 'dotscene'

/**
 * The presenter: dotscene's `person` (scenes/person.ts in that repo), plus the gestures a
 * talk needs — pondering, pointing, shrugging, reaching, swinging a hammer.
 *
 * Kept as a copy rather than an import because dotscene exports its library, not its
 * scenes. Point names are identical, so a pose written for one works on the other.
 *
 * Local space: origin at the top of the head, y downward, feet at y = 64. That is the module
 * every prop in a deck is drawn against.
 */

const left = {
  shoulderL: [-7, 15],
  elbowL: [-13, 24],
  handL: [-16, 33],
  hipL: [-5, 36],
  kneeL: [-7, 50],
  footL: [-8, 64],
} as const

/** Standing in profile, facing +x, weight even. The base for every profile gesture. */
const profile = {
  head: [4, 3],
  neck: [2, 13],
  chest: [1, 22],
  hip: [0, 34],
  shoulderL: [-3, 16],
  shoulderR: [3, 15],
  hipL: [-3, 36],
  hipR: [3, 36],
  kneeL: [-2, 50],
  footL: [-4, 64],
  kneeR: [3, 50],
  footR: [4, 64],
  elbowL: [-3, 25],
  handL: [-3, 34],
  elbowR: [4, 25],
  handR: [5, 34],
} as const

export const person = defineFigure('person', {
  title: 'A person',
  points: {
    head: [0, 3],
    neck: [0, 13],
    chest: [0, 22],
    hip: [0, 34],
    ...left,
    ...mirrorX(left),
  },
  edges: [
    ['head', 'neck'],
    ['neck', 'chest'],
    ['chest', 'hip'],
    ['neck', 'shoulderL'],
    ['neck', 'shoulderR'],
    ['shoulderL', 'elbowL'],
    ['elbowL', 'handL'],
    ['shoulderR', 'elbowR'],
    ['elbowR', 'handR'],
    ['hip', 'hipL'],
    ['hip', 'hipR'],
    ['hipL', 'kneeL'],
    ['kneeL', 'footL'],
    ['hipR', 'kneeR'],
    ['kneeR', 'footR'],
  ],
  pointKinds: { head: 'head' },
  poses: {
    idle: {},
    wave: { elbowR: [14, 16], handR: [18, 5], head: [1, 3] },
    /** Hand to chin, head tipped: considering the signpost. */
    ponder: { elbowR: [9, 22], handR: [2, 10], elbowL: [-8, 26], handL: [5, 27], head: [-1, 3] },
    /** Both palms up. */
    shrug: {
      shoulderL: [-7, 13], shoulderR: [7, 13],
      elbowL: [-13, 23], handL: [-20, 17],
      elbowR: [13, 23], handR: [20, 17],
      head: [0, 4],
    },
    /** Arm out towards the slide's copy, on the viewer's left. */
    presentL: { elbowL: [-14, 19], handL: [-24, 15] },
    /** Arm out to the right, showing off the prop. */
    presentR: { elbowR: [14, 19], handR: [24, 15] },
    /** Both arms spread wide: ta-da. */
    reveal: {
      elbowL: [-14, 12], handL: [-22, 3],
      elbowR: [14, 12], handR: [22, 3],
      head: [0, 2],
    },
    holdR: { elbowR: [12, 26], handR: [12, 35] },
    /** Pen to the page on the viewer's right: the start of a signature, and its end. */
    signA: { elbowR: [15, 24], handR: [24, 24] },
    signB: { elbowR: [18, 24], handR: [32, 23.5], head: [1, 3] },

    /** Bent forward over a shovel or a rake, weight on the back foot (from dotscene). */
    dig: {
      head: [10, 11], neck: [7, 19], chest: [4, 25], hip: [0, 34],
      shoulderL: [4, 21], elbowL: [11, 30], handL: [17, 40],
      shoulderR: [9, 20], elbowR: [15, 28], handR: [20, 35],
      hipL: [-2, 35], kneeL: [-8, 49], footL: [-11, 64],
      hipR: [3, 35], kneeR: [8, 50], footR: [12, 63],
    },
    /** Seated in profile, facing right, hands out at a wheel or a yoke (from dotscene). */
    drive: {
      head: [4, 7], neck: [3, 16], chest: [2, 23], hip: [0, 32],
      shoulderL: [2, 17], elbowL: [9, 24], handL: [15, 27],
      shoulderR: [4, 18], elbowR: [11, 25], handR: [16, 25],
      hipL: [0, 33], kneeL: [12, 36], footL: [17, 46],
      hipR: [1, 34], kneeR: [13, 37], footR: [18, 47],
    },

    // ── profile, facing +x ─────────────────────────────────────────────────────────────
    stand: profile,
    /** Both hands forward at waist height, lifting a lid. */
    lift: { ...profile, elbowL: [7, 25], handL: [15, 27], elbowR: [8, 24], handR: [16, 25] },
    /** Both hands up and forward — the lid has come up with them. */
    liftHigh: { ...profile, elbowL: [9, 15], handL: [15, 6], elbowR: [10, 14], handR: [16, 5], head: [5, 2] },
    /** Right hand raised overhead, as if about to swing. */
    swingUp: { ...profile, elbowR: [4, 5], handR: [-2, -3], elbowL: [7, 24], handL: [13, 27] },
    /** The swing landed: right hand forward and down. */
    swingDown: { ...profile, elbowR: [11, 21], handR: [19, 29], elbowL: [6, 25], handL: [12, 29], head: [6, 5], neck: [3, 14] },
    /** Reaching up and forward to a board at head height. */
    reachUp: { ...profile, elbowR: [10, 11], handR: [18, 4] },
    /**
     * A hand raised to ask or answer, as in a classroom: upper arm up, forearm vertical, hand
     * above the head. Never use the forward, straight-armed `reachUp` for this; a row of
     * figures in that pose reads as a salute.
     */
    handUp: { ...profile, elbowR: [7, 6], handR: [7.5, -4.5] },
    /** Reaching steeply overhead for something just out of reach: a rung, a shelf. */
    reachHigh: { ...profile, elbowR: [6.5, 5.5], handR: [9.5, -5] },
    /** Hand resting on something at hip height in front. */
    rest: { ...profile, elbowR: [9, 26], handR: [17, 31] },
    /** Both hands on a wheel in front, at chest height. */
    crank: { ...profile, elbowR: [10, 31], handR: [18, 38], elbowL: [8, 27], handL: [17, 30] },
    /** Working strings from above: both hands up and forward. */
    puppeteer: { ...profile, elbowL: [7, 14], handL: [13, 5], elbowR: [9, 15], handR: [16, 9], head: [5, 4] },
    /** The same, one hand tugged up — the puppet waves. */
    puppeteerTug: { ...profile, elbowL: [7, 14], handL: [13, 5], elbowR: [8, 10], handR: [14, 1], head: [5, 4] },
    /** Offering something across a counter. */
    offer: { ...profile, elbowR: [10, 21], handR: [20, 23] },

    // ── the walk, in profile facing +x (from dotscene) ─────────────────────────────────
    stepA: {
      head: [4, 6], neck: [2, 16], chest: [1, 25], hip: [0, 37],
      shoulderL: [-3, 19], shoulderR: [3, 18],
      hipL: [-3, 39], hipR: [3, 39],
      kneeL: [6, 51], footL: [10, 64],
      kneeR: [-4, 51], footR: [-10, 63],
      elbowL: [-8, 27], handL: [-11, 35],
      elbowR: [7, 28], handR: [9, 38],
    },
    passA: {
      head: [4, 3], neck: [2, 13], chest: [1, 22], hip: [0, 34],
      shoulderL: [-3, 16], shoulderR: [3, 15],
      hipL: [-3, 36], hipR: [3, 36],
      kneeL: [-2, 50], footL: [0, 64],
      kneeR: [8, 47], footR: [5, 59],
      elbowL: [-5, 25], handL: [-7, 34],
      elbowR: [7, 25], handR: [9, 35],
    },
    stepB: {
      head: [4, 6], neck: [2, 16], chest: [1, 25], hip: [0, 37],
      shoulderL: [-3, 19], shoulderR: [3, 18],
      hipL: [-3, 39], hipR: [3, 39],
      kneeR: [6, 51], footR: [10, 64],
      kneeL: [-4, 51], footL: [-10, 63],
      elbowL: [1, 26], handL: [4, 33],
      elbowR: [7, 28], handR: [9, 38],
    },
    passB: {
      head: [4, 3], neck: [2, 13], chest: [1, 22], hip: [0, 34],
      shoulderL: [-3, 16], shoulderR: [3, 15],
      hipL: [-3, 36], hipR: [3, 36],
      kneeR: [2, 50], footR: [0, 64],
      kneeL: [8, 47], footL: [5, 59],
      elbowL: [-3, 25], handL: [-4, 34],
      elbowR: [7, 25], handR: [9, 35],
    },
  },
})
