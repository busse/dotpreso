import type { Scene } from 'dotscene'
import type { Theme } from './theme.ts'

/**
 * A deck: slides in order, forward and back, nothing else.
 *
 * Each slide carries its copy as HTML and a list of cues — which dotscene scenes are on
 * stage while it shows, and which named keyframe each one rests on. Advancing plays every
 * scene's timeline from where the last slide left it to where this one rests, so an
 * illustration can walk, open, or fly from one slide to the next instead of cutting.
 */

export interface Cite {
  /** Shown in the slide's footer, e.g. "NIST AI 100-1 (2023)". */
  readonly text: string
  readonly url?: string
}

/**
 * A slide's citations, numbered by first use. `ref(key)` returns the superscript marker and
 * records the order; `list()` returns the cites in that order, for the slide's `cites`.
 * Write the `html` before the `cites` in the slide literal, so the markers are counted first.
 * An unknown key throws at build time, so a renamed source cannot leave a stale number.
 */
export const cites = <K extends string>(sources: Readonly<Record<K, Cite>>) => {
  const used: K[] = []
  return {
    ref: (key: K): string => {
      if (!(key in sources)) throw new Error(`no source named '${String(key)}'`)
      let index = used.indexOf(key)
      if (index < 0) index = used.push(key) - 1
      return `<sup class="ref">[${index + 1}]</sup>`
    },
    list: (): readonly Cite[] => used.map((key) => sources[key]),
  }
}

/** A web font to inline into the built file, so it opens from disk with no network. */
export interface FontFace {
  readonly family: string
  /** A weight, or a range for a variable font: `'400 800'`. */
  readonly weight: number | string
  readonly style?: 'normal' | 'italic'
  /** A .woff2 file, relative to the deck file. */
  readonly file: string
  /** Restrict the face to a character range, as a subsetted file expects. */
  readonly unicodeRange?: string
}

export interface Cue {
  readonly scene: Scene
  /** The keyframe this slide rests on. Omit it for a static scene, which has no timeline. */
  readonly at?: string
  /**
   * Where playback starts when this slide is reached from one that does not show the scene.
   * Omit it and the scene simply appears at `at`.
   */
  readonly from?: string
  /** Milliseconds after the slide begins before the scene's layer fades in. */
  readonly delay?: number
  /** Play the scene's own loop for as long as the slide is up — a holding slide's ambient scene. */
  readonly loop?: boolean
}

export interface Slide {
  /** A stable name, used in the URL hash and in speaker notes. */
  readonly id: string
  /** Extra classes on the slide, for the deck's own layout rules. Scope element rules under `.copy` or a class inside it, never under these: the slide holds the citations too. */
  readonly layout?: string
  /** The copy. Positioned over the stage; the stage is 1600 × 900 CSS pixels. */
  readonly html: string
  /** What the public copy shows instead, when `html` needs something that isn't published (a video in `media`). */
  readonly publicHtml?: string
  readonly cites?: readonly Cite[]
  /** For the presenter only: the `s` key shows them. */
  readonly notes?: string
  readonly cues: readonly Cue[]
}

/**
 * Where a deck is published once it has been given: its own public repo, served by GitHub
 * Pages at https://<owner>.github.io/<repo>/.
 *
 * A repo per talk keeps each one at a stable address that outlives the deck's source. Name
 * the repo as your own talks sort best; one convention is `talk-YYMM-<event>` (the year and
 * month given, then a short lowercase slug for the organiser), which the export checks
 * against `date` when a repo is named that way.
 */
export interface Publish {
  /** The repo, lowercase: `talk-2610-acme`, `river-crossing`. */
  readonly repo: string
  /** The GitHub user or organisation the repo lives under. Defaults to whoever `gh` is signed in as. */
  readonly owner?: string
  /** The event as people would name it: "ACME Annual Convention". */
  readonly event: string
  /** When the talk is given: `YYYY-MM-DD`, or `YYYY-MM` until the day is known. */
  readonly date?: string
  /** Where it was given: "The Boar's Head Inn, Charlottesville, Va." */
  readonly venue?: string
  /** Keep the speaker notes in the public copy. Off unless a deck says so. */
  readonly notes?: boolean
}

export const pagesUrl = (owner: string, repo: string): string => `https://${owner}.github.io/${repo}/`

/** The name, checked: a misnamed repo fails the export rather than the URL living forever. */
export const checkPublish = (publish: Publish): void => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(publish.repo)) throw new Error(`publish.repo '${publish.repo}' should be lowercase words joined by hyphens`)
  const dated = publish.date === undefined ? null : /^20(\d{2})-(\d{2})(-\d{2})?$/.exec(publish.date)
  if (publish.date !== undefined && dated === null) throw new Error(`publish.date '${publish.date}' should be YYYY-MM-DD, or YYYY-MM`)
  const named = /^talk-(\d{2})(\d{2})-/.exec(publish.repo)
  if (named !== null && dated !== null && (named[1] !== dated[1] || named[2] !== dated[2])) {
    throw new Error(`publish.repo '${publish.repo}' says 20${named[1]}-${named[2]}, but publish.date is ${publish.date}`)
  }
}

export interface Deck {
  readonly title: string
  readonly author: string
  readonly description?: string
  /** Its public copy, if it has one. */
  readonly publish?: Publish
  /** The look the deck starts from: colours, type, fonts and the copy's layout. `themes/paper` unless said otherwise. */
  readonly theme?: Theme
  /** Stylesheet for this deck's slides, appended after the player's and the theme's. */
  readonly css?: string
  /** Extra markup for `<head>`. */
  readonly head?: string
  /** Web fonts beyond the theme's, inlined into the built file ahead of `css`. */
  readonly fonts?: readonly FontFace[]
  /**
   * Files too big to inline (a video), relative to the deck: the build copies each next to
   * index.html, and a slide refers to it by its file name. The one place a built deck is
   * more than one file; keep such files in the deck's `media` folder, which git ignores.
   */
  readonly media?: readonly string[]
  /**
   * The link-preview card (og:image), relative to the deck: 1200 × 630, the size chat and social apps,
   * Slack and the rest crop to. The build copies it next to index.html.
   */
  readonly preview?: { readonly file: string; readonly alt: string; readonly width: number; readonly height: number }
  readonly slides: readonly Slide[]
}

export const defineDeck = (deck: Deck): Deck => deck

/** Where a point in a scene lands on the 1600 × 900 stage, for a camera at `at` of `width`. */
export const toStage = (
  camera: { readonly at: readonly [number, number]; readonly width: number },
  point: readonly [number, number],
  stage: { readonly width: number; readonly height: number } = { width: 1600, height: 900 },
): { readonly left: number; readonly top: number } => {
  const scale = stage.width / camera.width
  const height = camera.width * (stage.height / stage.width)
  return {
    left: Math.round((point[0] - (camera.at[0] - camera.width / 2)) * scale),
    top: Math.round((point[1] - (camera.at[1] - height / 2)) * scale),
  }
}
