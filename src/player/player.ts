/**
 * The deck player: forward and back, one slide at a time.
 *
 * It owns every scene's clock. On an advance, each scene the next slide cues plays from
 * where the current slide left it to where the next one rests — the presenter walks, the
 * lid opens — by seeking the dotscene runtime frame by frame. Going back rewinds the same
 * stretch at triple speed. Pressing again mid-transition finishes it at once and moves on,
 * so a presenter is never made to wait.
 *
 * Keys: → Space PageDown Enter = next · ← PageUp Backspace = back · Home End ·
 *       f fullscreen · s speaker notes · b blank the screen · p presenter window ·
 *       a number then Enter = go to it.
 *
 * The same file opened with `?presenter` is the presenter's window: notes, the next slide
 * and a clock, no stage. A BroadcastChannel links it to the main window, so keys pressed in
 * either drive both. `?debug` draws the horizon and outlines the copy; `?dev` reloads the
 * page whenever `npm run dev` rebuilds it.
 */

interface SceneHandle {
  readonly seek: (ms: number) => void
  readonly pause: () => void
  readonly play: () => void
  readonly duration: number
}

interface PlayerCue {
  readonly scene: string
  readonly at: number
  readonly from?: number
  readonly delay?: number
  readonly loop?: boolean
}

interface PlayerConfig {
  readonly scenes: readonly string[]
  readonly animated: readonly string[]
  readonly slides: readonly { readonly id: string; readonly cues: readonly PlayerCue[] }[]
}

/** What the two windows say to each other. */
type Message =
  | { readonly type: 'hello' }
  | { readonly type: 'slide'; readonly index: number }
  | { readonly type: 'next' }
  | { readonly type: 'back' }
  | { readonly type: 'go'; readonly index: number }

declare global {
  interface Window {
    dotscene?: { scenes: Map<string, SceneHandle> }
  }
}

const STAGE_WIDTH = 1600
const STAGE_HEIGHT = 900
const REWIND = 3
/** The copy never waits longer than this for the illustration to arrive. */
const MAX_COPY_DELAY = 1800
/** Where the ground is drawn on the stage, unless the deck says otherwise (`--horizon`). */
const DEFAULT_HORIZON = 702

const flags = new URLSearchParams(location.search)
const presenterMode = flags.has('presenter')
const debugMode = flags.has('debug')
const devMode = flags.has('dev')

const config = JSON.parse(document.getElementById('dotpreso-config')!.textContent ?? '{}') as PlayerConfig
const deck = document.querySelector<HTMLElement>('.deck')!
const stageEl = document.querySelector<HTMLElement>('.stage')!
const slideEls = [...document.querySelectorAll<HTMLElement>('.slide')]
const layerEls = new Map([...document.querySelectorAll<HTMLElement>('.layer')].map((el) => [el.dataset.scene!, el]))
const progress = document.querySelector<HTMLElement>('.progress span')!
const counter = document.querySelector<HTMLElement>('.counter')!
const speaker = document.querySelector<HTMLElement>('.speaker')!
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('dotpreso')

const last = slideEls.length - 1
let current = -1

const post = (message: Message): void => channel?.postMessage(message)

const headingOf = (index: number): string | undefined => slideEls[index]?.querySelector('h1, h2')?.textContent?.trim()
const notesOf = (index: number): string => {
  const notes = slideEls[index]?.querySelector('template.notes')
  return notes instanceof HTMLTemplateElement ? notes.innerHTML : '<p><em>No notes.</em></p>'
}

// ── fitting the 16:9 stage to the window ───────────────────────────────────────────────

const fit = (): void => {
  const scale = Math.min(innerWidth / STAGE_WIDTH, innerHeight / STAGE_HEIGHT)
  stageEl.style.setProperty('--scale', String(scale))
}
addEventListener('resize', fit)
fit()

// ── driving the scenes ─────────────────────────────────────────────────────────────────

interface Tween {
  readonly handle: SceneHandle
  readonly from: number
  readonly to: number
  readonly duration: number
}

let running: { readonly finish: () => void } | undefined

const play = (tweens: readonly Tween[]): void => {
  const settle = (): void => {
    for (const tween of tweens) tween.handle.seek(tween.to)
  }
  if (tweens.every((tween) => tween.duration <= 0)) {
    settle()
    return
  }
  const start = performance.now()
  let frame = 0
  const tick = (now: number): void => {
    const elapsed = now - start
    let done = true
    for (const tween of tweens) {
      const t = tween.duration <= 0 ? 1 : Math.min(1, elapsed / tween.duration)
      tween.handle.seek(tween.from + (tween.to - tween.from) * t)
      if (t < 1) done = false
    }
    if (done) running = undefined
    else frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  running = {
    finish: () => {
      cancelAnimationFrame(frame)
      settle()
      running = undefined
    },
  }
}

type Mode = 'step' | 'cut'

const go = (target: number, mode: Mode = 'step'): void => {
  target = Math.max(0, Math.min(last, target))
  if (target === current) return
  running?.finish()
  const previous = current
  current = target
  const forward = target > previous
  const cut = mode === 'cut' || reducedMotion.matches || Math.abs(target - previous) > 1
  const before = config.slides[previous]
  const after = config.slides[target]!

  const tweens: Tween[] = []
  for (const name of config.scenes) {
    const layer = layerEls.get(name)
    const handle = window.dotscene?.scenes.get(name)
    const next = after.cues.find((cue) => cue.scene === name)
    const prior = before?.cues.find((cue) => cue.scene === name)
    if (layer === undefined) continue
    if (next === undefined) {
      layer.style.transitionDelay = '0ms'
      layer.classList.remove('on')
      if (prior?.loop === true) handle?.pause()
      continue
    }
    // A looping scene runs on its own clock while its slide is up.
    if (next.loop === true) {
      layer.style.transitionDelay = '0ms'
      layer.classList.add('on')
      handle?.play()
      continue
    }
    const from = cut ? next.at : prior !== undefined ? prior.at : forward ? (next.from ?? next.at) : next.at
    if (prior === undefined) {
      handle?.seek(from)
      layer.style.transitionDelay = `${forward && !cut ? (next.delay ?? 0) : 0}ms`
      layer.classList.add('on')
    }
    if (handle !== undefined) tweens.push({ handle, from, to: next.at, duration: Math.abs(next.at - from) / (forward ? 1 : REWIND) })
  }

  const longest = Math.max(0, ...tweens.map((tween) => tween.duration))
  const copyDelay = cut ? 0 : Math.min(MAX_COPY_DELAY, forward ? longest * 0.6 : longest * 0.8)
  slideEls.forEach((el, i) => {
    const active = i === target
    el.classList.toggle('active', active)
    // A video stops when its slide does.
    if (!active) el.querySelectorAll('video').forEach((video) => video.pause())
    el.setAttribute('aria-hidden', String(!active))
    if ('inert' in el) el.inert = !active
    if (active) {
      el.style.setProperty('--enter-delay', `${Math.round(copyDelay)}ms`)
      // `.after` elements wait for the illustration itself to arrive.
      el.style.setProperty('--arrive', `${cut ? 0 : Math.round(longest)}ms`)
    }
  })
  play(tweens)

  progress.style.width = `${((target + 1) / slideEls.length) * 100}%`
  counter.textContent = `${target + 1} / ${slideEls.length}`
  history.replaceState(null, '', `#${target + 1}`)
  renderNotes()
  if (debugMode) checkHorizon()
  if (!presenterMode) post({ type: 'slide', index: target })
}

const next = (): void => go(current + 1)
const back = (): void => go(current - 1)

// ── speaker notes (in the main window, over the stage) ─────────────────────────────────

const renderNotes = (): void => {
  if (speaker.hidden) return
  speaker.querySelector('.speaker-body')!.innerHTML = notesOf(current)
  const upcoming = headingOf(current + 1)
  speaker.querySelector('.speaker-next')!.textContent = upcoming === undefined ? 'Last slide.' : `Next: ${upcoming}`
}

// ── the presenter's window ─────────────────────────────────────────────────────────────

const presenter = (() => {
  if (!presenterMode) return undefined
  deck.classList.add('presenter')
  const el = document.createElement('section')
  el.className = 'presenter-view'
  el.innerHTML = `<header class="presenter-head"><span class="presenter-counter"></span><button type="button" class="presenter-clock" title="Click or press r to reset">00:00</button></header>
<h1 class="presenter-title"></h1>
<div class="presenter-notes"></div>
<p class="presenter-next"></p>`
  deck.append(el)
  const clock = el.querySelector<HTMLElement>('.presenter-clock')!
  let started = performance.now()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const tickClock = (): void => {
    const seconds = Math.floor((performance.now() - started) / 1000)
    clock.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
  }
  setInterval(tickClock, 250)
  const reset = (): void => {
    started = performance.now()
    tickClock()
  }
  clock.addEventListener('click', reset)
  const show = (index: number): void => {
    el.querySelector('.presenter-counter')!.textContent = `${index + 1} / ${slideEls.length}`
    el.querySelector('.presenter-title')!.textContent = headingOf(index) ?? slideEls[index]?.dataset.id ?? ''
    el.querySelector('.presenter-notes')!.innerHTML = notesOf(index)
    const upcoming = headingOf(index + 1)
    el.querySelector('.presenter-next')!.textContent = upcoming === undefined ? 'Last slide.' : `Next: ${upcoming}`
    history.replaceState(null, '', `#${index + 1}`)
  }
  return { show, reset }
})()

/** Open (or focus) the presenter's window on the same file. */
const openPresenter = (): void => {
  const url = `${location.href.split(/[?#]/)[0]}?presenter#${current + 1}`
  window.open(url, 'dotpreso-presenter')
}

channel?.addEventListener('message', (event: MessageEvent<Message>) => {
  const message = event.data
  if (presenterMode) {
    if (message.type === 'slide') presenter?.show(message.index)
    return
  }
  switch (message.type) {
    case 'hello':
      if (current >= 0) post({ type: 'slide', index: current })
      break
    case 'next':
      next()
      break
    case 'back':
      back()
      break
    case 'go':
      go(message.index, 'cut')
      break
    default:
      break
  }
})

// ── debugging the layout ───────────────────────────────────────────────────────────────

const horizon = (): number => {
  const declared = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--horizon'))
  return Number.isFinite(declared) ? declared : DEFAULT_HORIZON
}

if (debugMode) {
  deck.classList.add('debug')
  const line = document.createElement('div')
  line.className = 'debug-horizon'
  line.style.top = `${horizon()}px`
  stageEl.append(line)
}

/** Warn when the active slide's copy runs past the ground line. */
const checkHorizon = (): void => {
  const slide = slideEls[current]
  const text = slide?.querySelector<HTMLElement>('.text')
  if (slide === undefined || text === null || text === undefined) return
  // Measure once the copy has its final layout; fonts and transitions do not move it.
  requestAnimationFrame(() => {
    const scale = parseFloat(getComputedStyle(stageEl).getPropertyValue('--scale')) || 1
    const bottom = (text.getBoundingClientRect().bottom - stageEl.getBoundingClientRect().top) / scale
    const over = Math.round(bottom - horizon())
    if (over > 0) console.warn(`dotpreso: copy crosses the horizon on slide ${slide.dataset.id ?? current + 1} by ${over}px`)
  })
}

// ── input ──────────────────────────────────────────────────────────────────────────────

let typed = ''

addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (/^[0-9]$/.test(event.key)) {
    typed += event.key
    return
  }
  const number = typed
  typed = ''
  // The presenter's window drives the main one rather than its own stage.
  if (presenterMode) {
    switch (event.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        post({ type: 'next' })
        break
      case 'Enter':
        if (number !== '') post({ type: 'go', index: Number(number) - 1 })
        else post({ type: 'next' })
        break
      case 'ArrowLeft':
      case 'PageUp':
      case 'Backspace':
        post({ type: 'back' })
        break
      case 'Home':
        post({ type: 'go', index: 0 })
        break
      case 'End':
        post({ type: 'go', index: last })
        break
      case 'r':
        presenter?.reset()
        break
      case 'f':
        if (document.fullscreenElement === null) void document.documentElement.requestFullscreen?.()
        else void document.exitFullscreen()
        break
      default:
        return
    }
    event.preventDefault()
    return
  }
  // On a slide with a video, space plays and pauses it; the arrows and a clicker still advance.
  const video = event.key === ' ' ? slideEls[current]?.querySelector('video') : null
  if (video !== null && video !== undefined) {
    if (video.paused) void video.play()
    else video.pause()
    event.preventDefault()
    return
  }
  switch (event.key) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      next()
      break
    case 'Enter':
      if (number !== '') go(Number(number) - 1, 'cut')
      else next()
      break
    case 'ArrowLeft':
    case 'PageUp':
    case 'Backspace':
      back()
      break
    case 'Home':
      go(0, 'cut')
      break
    case 'End':
      go(last, 'cut')
      break
    case 'f':
      if (document.fullscreenElement === null) void document.documentElement.requestFullscreen?.()
      else void document.exitFullscreen()
      break
    case 's':
      speaker.hidden = !speaker.hidden
      renderNotes()
      break
    case 'b':
    case '.':
      deck.classList.toggle('blank')
      break
    case 'p':
      openPresenter()
      break
    default:
      return
  }
  event.preventDefault()
})

if (!presenterMode) {
  deck.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a, button, video, .speaker') !== null) return
    if (event.clientX < innerWidth * 0.2) back()
    else next()
  })

  let touchX: number | undefined
  deck.addEventListener('touchstart', (event) => {
    touchX = event.touches[0]?.clientX
  }, { passive: true })
  deck.addEventListener('touchend', (event) => {
    const endX = event.changedTouches[0]?.clientX
    if (touchX === undefined || endX === undefined) return
    const dx = endX - touchX
    touchX = undefined
    if (Math.abs(dx) < 40) return
    if (dx < 0) next()
    else back()
  })

  addEventListener('hashchange', () => {
    const index = Number(location.hash.slice(1)) - 1
    if (Number.isInteger(index) && index !== current) go(index, 'cut')
  })
}

// ── the dev loop: reload when the file is rebuilt ──────────────────────────────────────

if (devMode) {
  let known: string | undefined
  const poll = async (): Promise<void> => {
    try {
      const response = await fetch('version.txt', { cache: 'no-store' })
      if (!response.ok) return
      const version = (await response.text()).trim()
      if (known === undefined) known = version
      else if (version !== known) location.reload()
    } catch {
      // The server is between builds, or gone; try again next tick.
    }
  }
  setInterval(() => void poll(), 500)
}

// ── start ──────────────────────────────────────────────────────────────────────────────

/** The runtime mounts on DOMContentLoaded; wait for every scene, then take their clocks. */
const whenMounted = (): Promise<void> =>
  new Promise((resolve) => {
    // The presenter's window shows no stage: nothing to wait for, no clocks to take.
    if (presenterMode) {
      resolve()
      return
    }
    const started = performance.now()
    const poll = (): void => {
      const scenes = window.dotscene?.scenes
      // Static scenes are plain SVG: nothing mounts, so only the animated ones are waited for.
      const ready = scenes !== undefined && config.animated.every((name) => scenes.has(name))
      if (ready || performance.now() - started > 4000) {
        for (const name of config.animated) scenes?.get(name)?.pause()
        resolve()
      } else setTimeout(poll, 50) // a timer, not rAF: rAF does not run in a background tab
    }
    poll()
  })

void whenMounted().then(() => {
  const fromHash = Number(location.hash.slice(1)) - 1
  deck.classList.add('ready')
  if (presenterMode) {
    presenter?.show(Number.isInteger(fromHash) && fromHash >= 0 ? Math.min(last, fromHash) : 0)
    post({ type: 'hello' })
    return
  }
  if (Number.isInteger(fromHash) && fromHash > 0) go(fromHash, 'cut')
  else setTimeout(() => go(0), 350)
})

export {}
