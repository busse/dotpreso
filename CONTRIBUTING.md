# Contributing

Everything goes through GitHub: **Issues** for bugs, ideas and adjustments, **pull requests** for changes. There is no other channel.

## Before opening a pull request

```sh
npm run check && npm run typecheck && npm run build
```

`check` validates every scene and runs the framing check over every slide. Then look at it: `npm run dev <deck>`, step through every slide, press `p` for the presenter window, add `?debug` for the horizon.

## What is welcome

- **Themes** for other organisations, as `themes/<name>/theme.ts` with font files beside it. State each font's licence in the theme's header comment; only fonts licensed for embedding can be inlined. [docs/theming.md](docs/theming.md) is the guide.
- **Figures and scenery** for the kit in `figures/`, drawn in the person module (feet at y = 64) so they compose with the presenter.
- **Engine changes** in `src/`. Keep the built file self-contained: no network at runtime.
- **Example decks**, kept small and free of anyone's client material.

## Style

TypeScript strict, named exports, functional. Conventional commits (`feat:`, `fix:`, `docs:`). Element rules in a deck's or theme's CSS must be scoped inside the copy (`.copy h1`, `.text p`); the build refuses bare ones.
