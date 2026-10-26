import {
  definePose,
  lerpPoints,
  posePoints,
  type CameraKeyframe,
  type EasingName,
  type Keyframe,
  type PartKeyframe,
  type Pose,
  type Vec2,
} from 'dotscene'
import { FLOOR, carryGeometry, posePoint, round, withTail } from './kit.ts'
import { person } from './person.ts'

/**
 * Staging for a deck's world: one long scene the presenter walks through, stopping at a
 * station per slide.
 *
 * The camera rides with the walker, so on the page the figure stays put and the ground,
 * trees and props slide past behind them — that is the "advance". Distant layers move with
 * the camera at a fraction of its speed, which is all parallax is.
 *
 * Everything here writes plain dotscene keyframes. A slide is a `mark`: a named keyframe the
 * deck's player seeks to, and the transition between two slides is simply the stretch of
 * timeline between their marks, played forward.
 */

export { FLOOR }
/** Half a stride, in the person's own units. Matches the foot separation in stepA/stepB. */
export const HALF = 10
const CYCLE = ['stepA', 'passA', 'stepB', 'passB'] as const

/** Milliseconds per gait phase. Brisker than dotscene's 190 — a slide change should not dawdle. */
export const STEP_MS = 150

/** The person at any point in the gait, phase counted in quarter-cycles. From dotscene's exchange scene. */
export const gaitPose = (() => {
  const cache = new Map<string, Pose>()
  return (phase: number): Pose => {
    const wrapped = ((phase % 4) + 4) % 4
    const key = wrapped.toFixed(3)
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    const index = Math.floor(wrapped)
    const points = lerpPoints(
      posePoints(person, CYCLE[index]!),
      posePoints(person, CYCLE[(index + 1) % 4]!),
      wrapped - index,
    )
    const pose = definePose(person, `gait${key}`, points)
    cache.set(key, pose)
    return pose
  }
})()

const r2 = round

/** A point of the person's pose, in scene space, for a person standing at `x` on the floor. */
export const handAt = (x: number, pose: string | Pose, point: 'handL' | 'handR' = 'handR', flipX = false): Vec2 => {
  const local = posePoint(pose, point)
  return [r2(x + (flipX ? -local[0] : local[0])), r2(local[1])]
}

export interface StepSpec {
  readonly name?: string
  /** Transition into this step, ms. */
  readonly duration?: number
  readonly hold?: number
  readonly easing?: EasingName
  readonly parts?: Record<string, PartKeyframe>
  readonly camera?: CameraKeyframe
}

export interface Carry {
  /** Part id of the thing in hand. */
  readonly id: string
  /** Rotation of the carried part while walking. */
  readonly rotate?: number
}

export interface WalkSpec {
  readonly to: number
  /** Something hanging from the right hand, kept on it through every phase of the gait. */
  readonly carry?: Carry
  readonly stepMs?: number
  /** Keep the camera with the walker (the default). Off, the walker crosses a still frame. */
  readonly follow?: boolean
}

export interface StageSpec {
  /** Part id of the presenter. */
  readonly walker: string
  /** Where the walker starts. */
  readonly from: number
  /** Where the camera looks, given where the walker stands. */
  readonly camera: (walkerX: number) => CameraKeyframe
  /** Parallax layers: part id → how much of the camera's travel it follows (1 = pinned to the frame). */
  readonly parallax?: Readonly<Record<string, number>>
  /** Where each parallax layer sits when the camera is at x = 0. */
  readonly parallaxY?: Readonly<Record<string, number>>
}

interface MutableKeyframe {
  name: string
  duration: number
  hold: number
  easing: EasingName
  parts: Record<string, PartKeyframe>
  camera?: CameraKeyframe
}

/**
 * A timeline written in order, one step after another.
 *
 * dotscene's keyframes are sparse — a part only needs mentioning where it changes — so a
 * step names what moves and everything else holds or glides between its own mentions.
 */
export const stage = (spec: StageSpec) => {
  const frames: MutableKeyframe[] = []
  const marks: string[] = []
  let x = spec.from
  let phase = 0
  let facing: 'profile' | 'front' = 'front'
  let clock = 0
  /** The walker's state as last stated, restated on any step that does not mention them. */
  let held: PartKeyframe | undefined

  const parallaxParts = (cameraX: number): Record<string, PartKeyframe> =>
    Object.fromEntries(
      Object.entries(spec.parallax ?? {}).map(([id, follow]) => [
        id,
        { at: [r2(cameraX * follow), spec.parallaxY?.[id] ?? 0] as Vec2 },
      ]),
    )

  const cameraX = (walkerX: number): number => spec.camera(walkerX).at?.[0] ?? walkerX

  /**
   * One keyframe. Keyframes are sparse, so a walker left out of a step would glide from their
   * last mention towards their next one — on the following slide — through a beat that only
   * moves a prop. Every step therefore restates the walker where they were last put.
   */
  const step = (s: StepSpec): string => {
    const name = s.name ?? `k${frames.length}`
    const duration = frames.length === 0 ? 0 : (s.duration ?? 400)
    clock += duration + (s.hold ?? 0)
    const parts = { ...(s.parts ?? {}) }
    const stated = parts[spec.walker]
    if (stated !== undefined) {
      // A part's own easing belongs to the step that stated it, not to the restatements.
      const { easing: _own, ...state } = stated
      held = { ...held, ...state }
    }
    else if (held !== undefined) parts[spec.walker] = held
    frames.push({
      name,
      duration,
      hold: s.hold ?? 0,
      easing: s.easing ?? 'easeInOut',
      parts,
      ...(s.camera === undefined ? {} : { camera: s.camera }),
    })
    return name
  }

  /** Mention the camera and the parallax layers where they are now, so a move starts from here. */
  const pin = (): void => {
    const last = frames[frames.length - 1]
    if (last === undefined) return
    last.camera ??= spec.camera(x)
    Object.assign(last.parts, { ...parallaxParts(cameraX(x)), ...last.parts })
  }

  /** Walk to `to`, in profile, the camera travelling with the walker. */
  const walk = ({ to, carry, stepMs = STEP_MS, follow = true }: WalkSpec): void => {
    const dir = to >= x ? 1 : -1
    const count = Math.max(1, Math.round(Math.abs(to - x) / HALF))
    const flipX = dir < 0
    if (follow) pin()
    const from = x
    for (let i = 1; i <= count; i++) {
      phase += 1
      const at = r2(from + ((to - from) * i) / count)
      const pose = gaitPose(phase)
      const parts: Record<string, PartKeyframe> = {
        [spec.walker]: { at: [at, 0], pose, flipX },
      }
      if (carry !== undefined) {
        parts[carry.id] = { at: handAt(at, pose, 'handR', flipX), rotate: carry.rotate ?? 0 }
      }
      const last = follow && i === count
      step({
        duration: stepMs,
        easing: 'linear',
        parts: last ? { ...parts, ...parallaxParts(cameraX(at)) } : parts,
        ...(last ? { camera: spec.camera(at) } : {}),
      })
      x = at
    }
    facing = 'profile'
  }

  /** Strike a pose where the walker stands. `flipX` defaults to the way they last faced. */
  const pose = (name: string, options: Omit<StepSpec, 'parts'> & { flipX?: boolean; parts?: Record<string, PartKeyframe> } = {}): string => {
    const { flipX = false, parts = {}, ...rest } = options
    facing = posePoints(person, name).head![0] === 0 ? 'front' : 'profile'
    return step({ duration: 350, ...rest, parts: { [spec.walker]: { at: [x, 0], pose: name, flipX }, ...parts } })
  }

  /**
   * Tell the stage where the walker is now, after something else moved them: a boat they
   * rode, a lift they stood on. The step that moved them stated their new place; this makes
   * the next `walk` start from it instead of from the last walk's end.
   */
  const place = (walkerX: number): void => {
    x = walkerX
  }

  /** Name the last step, so a slide can rest on it. */
  const mark = (name: string): void => {
    const last = frames[frames.length - 1]
    if (last === undefined) throw new Error(`mark '${name}' before any step`)
    last.name = name
    marks.push(name)
  }

  return {
    step,
    walk,
    pose,
    mark,
    pin,
    place,
    /** Where the walker stands now. */
    at: (): number => x,
    facing: (): typeof facing => facing,
    clock: (): number => clock,
    /**
     * The finished keyframes: each part's geometry carried forward through the steps that
     * only fade or re-layer it (`carryGeometry`), and a short tail after the last mark — the
     * runtime wraps its clock at the end of the lap, so the last slide must not sit on it.
     */
    keyframes: (): Keyframe[] => withTail(carryGeometry(frames.map((f) => ({ ...f })))),
    marks: (): readonly string[] => marks,
  }
}
