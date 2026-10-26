import { pathToFileURL } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compile, keyframeTime, resolveAt, type ResolvedScene } from 'dotscene'
import type { Deck } from '../src/deck.ts'

/**
 *   node scripts/framing.ts [deck.ts]
 *
 * With no argument, checks every deck under `decks/`.
 * Looks at every slide the way the player will: each cued scene resolved at its mark, and
 * every label the slide writes on the drawing. Reports
 *
 *   - a prop straddling the frame's edge: partly in, partly out, so it reads as cut off
 *     (the landscape — ground, hills, clouds, strewn trees — is meant to run off the edge
 *     and is skipped);
 *   - a label (`.tag`) landing off the stage, or on the presenter;
 *   - a part still gliding through a slide's mark because the mark's keyframe doesn't state it.
 *
 * Exit 1 on any finding, so `npm run check` can carry it.
 */

const STAGE = { width: 1600, height: 900 } as const
/** Parts that are landscape, not props: expected to cross the frame's edges. */
const SCENERY = /^(ground\w*|tree\d+|tuft\d+|sun|river)$/
/** Anything wider than this share of the frame is a backdrop (hills, a mat), not a prop. */
const BACKDROP = 0.6
/** A prop this close to the edge, in scene units, is reported even if it fits. `FRAMING_MARGIN` widens it to see what is near. */
const MARGIN = Number(process.env.FRAMING_MARGIN ?? 2)
/**
 * Where the presenter stands on the stage when the journey's camera frames them: 62% across,
 * feet on the horizon, arms out to about 24 units either side (person module, 1600/420 px a unit).
 */
const PRESENTER = { x0: 992 - 95, x1: 992 + 95, y0: 440, y1: 712 } as const
/** The walks a presenter stands in, framed as above: one per deck, named `<deck>Journey`. */
const JOURNEY = /Journey$/

interface Finding {
  readonly slide: string
  readonly message: string
}

const extent = (resolved: ResolvedScene): Map<string, { x0: number; y0: number; x1: number; y1: number }> => {
  const boxes = new Map<string, { x0: number; y0: number; x1: number; y1: number }>()
  const grow = (part: string, [x, y]: readonly [number, number]): void => {
    const box = boxes.get(part)
    if (box === undefined) boxes.set(part, { x0: x, y0: y, x1: x, y1: y })
    else {
      box.x0 = Math.min(box.x0, x)
      box.y0 = Math.min(box.y0, y)
      box.x1 = Math.max(box.x1, x)
      box.y1 = Math.max(box.y1, y)
    }
  }
  for (const dot of resolved.dots) grow(dot.part, dot.at)
  for (const line of resolved.lines) {
    grow(line.part, line.a)
    grow(line.part, line.b)
  }
  for (const face of resolved.faces) for (const at of face.at) grow(face.part, at)
  return boxes
}

/** The fields of a part's keyframe that change what is seen. */
const FIELDS = ['at', 'pose', 'rotate', 'scale', 'flipX', 'opacity'] as const

/**
 * Parts caught mid-glide at a slide's mark. Keyframes are sparse: a part not mentioned at the
 * mark keyframe slides from its last mention towards its next one straight through the mark,
 * so the slide rests on an in-between state — a hand half lowered, a prop half faded. Any
 * field whose last mention before the mark differs from its next mention after it is drifting.
 */
const drifting = (scene: Deck['slides'][number]['cues'][number]['scene'], mark: string): string[] => {
  const keyframes = scene.animate?.keyframes ?? []
  const m = keyframes.findIndex((k) => k.name === mark)
  if (m < 0) return []
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
  const found: string[] = []
  const parts = new Set(keyframes.flatMap((k) => Object.keys(k.parts ?? {})))
  for (const part of parts) {
    for (const field of FIELDS) {
      let before: unknown
      let beforeAt = -1
      for (let i = m; i >= 0; i--) {
        const v = keyframes[i]!.parts?.[part]?.[field]
        if (v !== undefined) {
          before = v
          beforeAt = i
          break
        }
      }
      if (beforeAt < 0 || beforeAt === m) continue
      let after: unknown
      for (let i = m + 1; i < keyframes.length; i++) {
        const v = keyframes[i]!.parts?.[part]?.[field]
        if (v !== undefined) {
          after = v
          break
        }
      }
      if (after !== undefined && !same(before, after)) found.push(`${part}.${field}`)
    }
  }
  return found
}

const framing = (deck: Deck): Finding[] => {
  const findings: Finding[] = []
  const compiled = new Map<string, ReturnType<typeof compile>>()
  for (const slide of deck.slides) {
    for (const cue of slide.cues) {
      if (cue.loop === true || cue.at === undefined) continue
      const c = compiled.get(cue.scene.name) ?? compile(cue.scene, { styles: false })
      compiled.set(cue.scene.name, c)
      const ms = keyframeTime(c.resolved, cue.at)
      if (ms === undefined) continue
      const drift = drifting(cue.scene, cue.at)
      if (drift.length > 0) findings.push({ slide: slide.id, message: `still moving at ${cue.scene.name}@${cue.at}, not stated at the mark: ${drift.join(', ')}` })
      const frame = resolveAt(cue.scene, ms)
      const [vx, vy, vw, vh] = frame.viewBox
      const right = vx + vw
      const bottom = vy + vh
      for (const [part, box] of extent(frame)) {
        if (SCENERY.test(part)) continue
        if (box.x1 - box.x0 > vw * BACKDROP) continue
        if ((frame.opacities?.[part] ?? 1) <= 0.01) continue
        const inside = box.x1 > vx && box.x0 < right && box.y1 > vy && box.y0 < bottom
        if (!inside) continue
        const over: string[] = []
        if (box.x0 < vx + MARGIN) over.push(`left by ${(vx - box.x0).toFixed(1)}`)
        if (box.x1 > right - MARGIN) over.push(`right by ${(box.x1 - right).toFixed(1)}`)
        if (box.y0 < vy + MARGIN) over.push(`top by ${(vy - box.y0).toFixed(1)}`)
        if (over.length > 0) findings.push({ slide: slide.id, message: `'${part}' in ${cue.scene.name}@${cue.at} runs past the frame's ${over.join(', ')} (units; negative = clear by that much)` })
      }
    }
    for (const tag of slide.html.matchAll(/class="tag[^"]*" style="left:(-?\d+)px;top:(-?\d+)px"[^>]*>([^<]*)/g)) {
      const x = Number(tag[1])
      const y = Number(tag[2])
      const text = tag[3]!.trim()
      if (x < 40 || x > STAGE.width - 40 || y < 20 || y > STAGE.height - 20) findings.push({ slide: slide.id, message: `label '${text}' lands off the stage at (${x}, ${y})` })
      // Only when the walk is all there is: an overlay (a knolled mat) covers the presenter.
      const journeyCued = slide.cues.length === 1 && JOURNEY.test(slide.cues[0]!.scene.name)
      if (journeyCued && x > PRESENTER.x0 && x < PRESENTER.x1 && y > PRESENTER.y0 && y < PRESENTER.y1) {
        findings.push({ slide: slide.id, message: `label '${text}' sits on the presenter at (${x}, ${y})` })
      }
    }
  }
  return findings
}

const files = process.argv[2] === undefined
  ? readdirSync('decks', { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join('decks', entry.name, 'deck.ts')))
    .map((entry) => join('decks', entry.name, 'deck.ts'))
  : [process.argv[2]]
let failed = false
for (const file of files) {
  const { deck } = (await import(pathToFileURL(resolve(file)).href)) as { deck: Deck }
  const findings = framing(deck)
  if (findings.length === 0) {
    process.stdout.write(`${file}: framing ok — ${deck.slides.length} slides, every prop inside its frame and every label clear\n`)
  } else {
    for (const f of findings) process.stdout.write(`${file} ${f.slide}: ${f.message}\n`)
    failed = true
  }
}
if (failed) process.exit(1)
