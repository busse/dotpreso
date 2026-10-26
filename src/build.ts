import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DEFAULT_CSS, compile, keyframeTime, type Scene } from 'dotscene'
import type { Deck, FontFace } from './deck.ts'
import { themeCss } from './theme.ts'
import { paper } from '../themes/paper/theme.ts'

/**
 * Build a deck into one self-contained HTML file: every scene, the dotscene runtime, the
 * player and the styles inlined, so it opens from disk with no server and no network
 * — the web fonts too, as data URIs.
 */

const here = dirname(fileURLToPath(import.meta.url))

const bundle = async (entry: string, globalName?: string): Promise<string> => {
  const { build } = await import('esbuild')
  const result = await build({
    entryPoints: [entry],
    write: false,
    bundle: true,
    minify: true,
    format: 'iife',
    ...(globalName === undefined ? {} : { globalName }),
    target: 'es2020',
    legalComments: 'none',
  })
  return result.outputFiles[0]?.text ?? ''
}

const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

/** A `</script>` inside inlined code would end the tag early. */
const scriptSafe = (code: string): string => code.replaceAll('</script', '<\\/script')

/** Web fonts as `@font-face` rules over data URIs: the built file needs no network. */
const fontFaces = async (fonts: readonly FontFace[], dir: string): Promise<string> => {
  const faces = await Promise.all(
    fonts.map(async (font) => {
      const data = await readFile(resolve(dir, font.file))
      const range = font.unicodeRange === undefined ? '' : `unicode-range:${font.unicodeRange};`
      return `@font-face{font-family:"${font.family}";font-style:${font.style ?? 'normal'};font-weight:${font.weight};font-display:swap;${range}src:url(data:font/woff2;base64,${data.toString('base64')}) format("woff2")}`
    }),
  )
  return faces.join('\n')
}

const ELEMENT = /^(a|abbr|blockquote|cite|code|div|em|h[1-6]|i|li|ol|p|pre|q|small|span|strong|sub|sup|table|td|th|tr|ul)(?![\w-])/

/**
 * Element rules in a deck's stylesheet must be scoped inside the copy. A `li` rule scoped
 * only by a layout class (`.tiers li`) or by nothing (`h1`) also hits the citations and the
 * speaker notes, which share the slide. Returns the offending selectors.
 */
export const unscopedSelectors = (css: string, layoutClasses: ReadonlySet<string>): string[] => {
  const slideLevel = new Set([...layoutClasses, 'slide', 'slides', 'stage', 'deck', 'active'])
  const bad: string[] = []
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of stripped.matchAll(/(^|[}])([^{}]+)\{/g)) {
    for (const selector of match[2]!.split(',')) {
      const text = selector.trim()
      if (text === '' || text.startsWith('@') || text.startsWith(':root')) continue
      let scoped = false
      for (const token of text.split(/\s*[\s>+~]\s*/)) {
        if (token === '') continue
        if (!scoped && ELEMENT.test(token)) {
          bad.push(text)
          break
        }
        for (const cls of token.matchAll(/\.([\w-]+)/g)) if (!slideLevel.has(cls[1]!)) scoped = true
      }
    }
  }
  return bad
}

export interface PlayerCue {
  readonly scene: string
  readonly at: number
  readonly from?: number
  readonly delay?: number
  readonly loop?: boolean
}

export interface PlayerConfig {
  readonly scenes: readonly string[]
  /** The scenes with a timeline — the ones the runtime mounts, and the player waits for. */
  readonly animated: readonly string[]
  readonly slides: readonly { readonly id: string; readonly cues: readonly PlayerCue[] }[]
}

/** A canonical link and the tags a chat app or social site reads for a link preview. */
const sharing = (deck: Deck, url: string): string => {
  const title = deck.publish === undefined ? deck.title : `${deck.title} · ${deck.publish.event}`
  const image = deck.preview === undefined ? undefined : new URL(basename(deck.preview.file), url).href
  return [
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:site_name" content="${escapeHtml(deck.author)}">`,
    deck.description === undefined ? '' : `<meta property="og:description" content="${escapeHtml(deck.description)}">`,
    ...(deck.preview === undefined || image === undefined
      ? [`<meta name="twitter:card" content="summary">`]
      : [
          `<meta property="og:image" content="${escapeHtml(image)}">`,
          `<meta property="og:image:width" content="${deck.preview.width}">`,
          `<meta property="og:image:height" content="${deck.preview.height}">`,
          `<meta property="og:image:alt" content="${escapeHtml(deck.preview.alt)}">`,
          `<meta name="twitter:card" content="summary_large_image">`,
          `<meta name="twitter:image" content="${escapeHtml(image)}">`,
          `<meta name="twitter:image:alt" content="${escapeHtml(deck.preview.alt)}">`,
        ]),
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/** How a build differs from the presenter's own: the public copy of a published talk. */
export interface BuildOptions {
  /** Leave the speaker notes out of the file. */
  readonly notes?: boolean
  /** The address the file will be served from: adds a canonical link and link-preview tags. */
  readonly url?: string
  /** The public copy: leave the deck's `media` behind and show each slide's `publicHtml` where it has one. */
  readonly public?: boolean
}

export const buildDeck = async (
  deckFile: string,
  outFile: string,
  options: BuildOptions = {},
): Promise<{ readonly bytes: number; readonly slides: number; readonly deck: Deck }> => {
  const { deck } = (await import(pathToFileURL(resolve(deckFile)).href)) as { deck: Deck }
  const withNotes = options.notes ?? true

  const theme = deck.theme ?? paper
  const layouts = new Set(deck.slides.flatMap((slide) => (slide.layout ?? '').split(/\s+/).filter((c) => c !== '')))
  for (const [what, css] of [['deck css', deck.css], [`theme '${theme.name}'`, theme.css]] as const) {
    const unscoped = unscopedSelectors(css ?? '', layouts)
    if (unscoped.length > 0) {
      throw new Error(
        `${what}: element rules must be scoped inside the copy (\`.copy li\`, \`.text p\`, \`.tiers .copy li\`), or they style the citations too:\n  ${unscoped.join('\n  ')}`,
      )
    }
  }

  // Every scene any slide cues, compiled once.
  const scenes = new Map<string, Scene>()
  for (const slide of deck.slides) for (const cue of slide.cues) scenes.set(cue.scene.name, cue.scene)
  // Styles come out of the blocks and go in <head>: the defaults once, then each scene's
  // own scoped rules. Every block would otherwise repeat the defaults. Before dotscene
  // 6d6a7ec (busse/dotscene#1) that repetition was a bug — a later copy reset an earlier
  // scene's colours; now the defaults weigh nothing and it only costs bytes.
  const compiled = new Map([...scenes].map(([name, scene]) => [name, compile(scene, { styles: false })]))
  const sceneCss = [DEFAULT_CSS, ...[...compiled.values()].map((c) => c.css.replace(DEFAULT_CSS, ''))].join('\n')

  const time = (scene: string, mark: string | undefined, slide: string): number => {
    const c = compiled.get(scene)!
    if (!c.animated) return 0
    if (mark === undefined) throw new Error(`slide '${slide}': scene '${scene}' is animated, so its cue needs an \`at\``)
    const ms = keyframeTime(c.resolved, mark)
    if (ms === undefined) throw new Error(`slide '${slide}': scene '${scene}' has no keyframe named '${mark}'`)
    return ms
  }

  const config: PlayerConfig = {
    scenes: [...scenes.keys()],
    animated: [...compiled.values()].filter((c) => c.animated).map((c) => c.name),
    slides: deck.slides.map((slide) => ({
      id: slide.id,
      cues: slide.cues.map((cue) => ({
        scene: cue.scene.name,
        // A looping cue plays the scene's own clock, so it needs no mark.
        at: cue.loop === true ? 0 : time(cue.scene.name, cue.at, slide.id),
        ...(cue.from === undefined ? {} : { from: time(cue.scene.name, cue.from, slide.id) }),
        ...(cue.delay === undefined ? {} : { delay: cue.delay }),
        ...(cue.loop === true ? { loop: true } : {}),
      })),
    })),
  }

  // The block's own runtime tag goes: the page loads the runtime once, inline.
  const layers = [...compiled.values()]
    .map((c) => `<div class="layer" data-scene="${c.name}">\n${c.html.replace(/\n<script src="[^"]*dotscene\.min\.js" defer><\/script>/, '')}\n</div>`)
    .join('\n')

  const slides = deck.slides
    .map((slide, index) => {
      // A footer the copy never points at (no `[n]` marker) is a plain line, not a numbered list.
      const html = options.public === true ? (slide.publicHtml ?? slide.html) : slide.html
      const numbered = html.includes('class="ref"')
      const cites =
        slide.cites === undefined || slide.cites.length === 0
          ? ''
          : `<footer class="cites${numbered ? '' : ' plain'}"><ol>${slide.cites
              .map((cite) => `<li>${cite.url === undefined ? escapeHtml(cite.text) : `<a href="${escapeHtml(cite.url)}" target="_blank" rel="noopener">${escapeHtml(cite.text)}</a>`}</li>`)
              .join('')}</ol></footer>`
      const notes = slide.notes === undefined || !withNotes ? '' : `<template class="notes">${slide.notes}</template>`
      return `<section class="slide ${slide.layout ?? ''}" data-index="${index}" data-id="${escapeHtml(slide.id)}" aria-roledescription="slide" aria-label="${index + 1} of ${deck.slides.length}">
<div class="copy">${html}</div>
${cites}${notes}
</section>`
    })
    .join('\n')

  const [runtime, player, playerCss, themeFonts, deckFonts] = await Promise.all([
    bundle(fileURLToPath(import.meta.resolve('dotscene/runtime')), 'dotscene'),
    bundle(resolve(here, 'player/player.ts')),
    readFile(resolve(here, 'player/player.css'), 'utf8'),
    fontFaces(theme.faces ?? [], theme.dir ?? here),
    fontFaces(deck.fonts ?? [], dirname(resolve(deckFile))),
  ])

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(deck.title)}</title>
<meta name="author" content="${escapeHtml(deck.author)}">
${deck.description === undefined ? '' : `<meta name="description" content="${escapeHtml(deck.description)}">`}
${options.url === undefined ? '' : sharing(deck, options.url)}
${deck.head ?? ''}
<style>
${themeFonts}
${deckFonts}
${sceneCss}
${playerCss}
${themeCss(theme)}
${deck.css ?? ''}
</style>
</head>
<body>
<main class="deck" aria-label="${escapeHtml(deck.title)}">
<div class="stage">
<div class="layers">
${layers}
</div>
<div class="slides">
${slides}
</div>
<div class="chrome" aria-hidden="true"><div class="progress"><span></span></div><div class="counter"></div></div>
<aside class="speaker" hidden><h2>Notes</h2><div class="speaker-body"></div><p class="speaker-next"></p></aside>
</div>
</main>
<script type="application/json" id="dotpreso-config">${scriptSafe(JSON.stringify(config))}</script>
<script>${scriptSafe(runtime)}</script>
<script>${scriptSafe(player)}</script>
</body>
</html>
`
  await mkdir(dirname(outFile), { recursive: true })
  await writeFile(outFile, html)
  // Media and the preview card ride alongside the page (the public copy leaves media behind);
  // a file already there at the same size is left alone, so a dev rebuild doesn't recopy a video.
  const alongside = [...(options.public === true ? [] : deck.media ?? []), ...(deck.preview === undefined ? [] : [deck.preview.file])]
  for (const file of alongside) {
    const from = resolve(dirname(resolve(deckFile)), file)
    const to = resolve(dirname(outFile), basename(file))
    const [source, target] = await Promise.all([stat(from), stat(to).catch(() => undefined)])
    if (target?.size !== source.size) await copyFile(from, to)
  }
  return { bytes: Buffer.byteLength(html), slides: deck.slides.length, deck }
}
