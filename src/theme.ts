import type { FontFace } from './deck.ts'

/**
 * A theme: the look a deck inherits before it says anything of its own. Colours and type
 * for the player's frame (the custom properties `player.css` reads), web fonts to inline,
 * the colours dotscene draws in unless a scene says otherwise, and a stylesheet for the copy.
 *
 * A deck names its theme once; its own `css` comes after and overrides what it likes. Build
 * one for an organisation from its style guide — see `docs/theming.md` — and keep it in
 * `themes/<name>/theme.ts` with its font files beside it.
 */
export interface Theme {
  readonly name: string
  /** The player's palette, as `--paper`, `--ink`, `--muted`, `--accent`, `--rule` and `--letterbox`. */
  readonly colors: {
    /** The stage: the ground the copy and the drawing sit on. */
    readonly paper: string
    /** Text, and the default stroke of every line and dot. */
    readonly ink: string
    /** Citations, the slide counter, anything secondary. */
    readonly muted: string
    /** Kickers, markers, the progress bar: one colour that says "look here". */
    readonly accent: string
    /** Hairlines and underlines. */
    readonly rule: string
    /** The bars either side of the stage when the window is not 16:9. Defaults to `paper`. */
    readonly letterbox?: string
  }
  /** Font stacks for the three roles the player and the copy use. */
  readonly fonts: {
    /** Headlines. */
    readonly display: string
    /** Running text. */
    readonly text: string
    /** Kickers, labels, citations, the counter. */
    readonly mono: string
  }
  /** Web fonts to inline, so the built file needs no network. Files are relative to `dir`. */
  readonly faces?: readonly FontFace[]
  /** Where `faces` resolve from: the theme's own folder, `import.meta.dirname`. */
  readonly dir?: string
  /** What dotscene draws in when a scene's own stylesheet is silent. */
  readonly scene: {
    readonly line: string
    readonly dot: string
    /** A face exists to hide what is behind it, so it is usually the paper. */
    readonly face: string
    /**
     * Bare rules for the roles the illustration kit uses (`figures/scenery.ts`: ground, soil,
     * trunk, crown, grass, ridge, hillsNear, hillsFar). A scene passes them as its `css`, and
     * dotscene scopes them to that scene.
     */
    readonly roles: string
  }
  /**
   * The copy's typography and layout. Element rules must be scoped inside the copy
   * (`.copy h1`, `.text p`), as in a deck's own `css`; the build checks.
   */
  readonly css?: string
}

export const defineTheme = (theme: Theme): Theme => theme

/** The theme as a stylesheet: the player's custom properties, dotscene's defaults, then the theme's own rules. */
export const themeCss = (theme: Theme): string => {
  const c = theme.colors
  const f = theme.fonts
  return [
    `:root{--paper:${c.paper};--ink:${c.ink};--muted:${c.muted};--accent:${c.accent};--rule:${c.rule};--letterbox:${c.letterbox ?? c.paper};--font-display:${f.display};--font-text:${f.text};--font-mono:${f.mono}}`,
    `.layers{--ds-line-stroke:${theme.scene.line};--ds-dot-fill:${theme.scene.dot};--ds-face-fill:${theme.scene.face};color:${theme.scene.line}}`,
    theme.css ?? '',
  ].join('\n')
}
