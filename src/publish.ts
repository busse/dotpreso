import { execFile } from 'node:child_process'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { buildDeck } from './build.ts'
import { checkPublish, pagesUrl, type Deck, type Publish } from './deck.ts'

/**
 * A talk's public copy: one repo per talk, served by GitHub Pages.
 *
 *   export <deck>    build the public copy into ../<repo>/ (a sibling of dotpreso)
 *   publish <deck>   export, commit, create the public repo if it is new, push, and turn on Pages
 *
 * The copy is the same single file the presenter uses, plus a README and `.nojekyll`. Speaker
 * notes stay out unless the deck's `publish.notes` says otherwise. Pages serves the `main`
 * branch's root, so there is no workflow to maintain: a push is a deploy.
 */

const run = promisify(execFile)

const sh = async (command: string, args: readonly string[], cwd: string): Promise<string> => {
  process.stdout.write(`  $ ${command} ${args.join(' ')}\n`)
  const { stdout } = await run(command, [...args], { cwd })
  return stdout.trim()
}

const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false)

/** The repo's owner: the deck's say, else whoever `gh` is signed in as. */
const ownerOf = async (publish: Publish): Promise<string> => {
  if (publish.owner !== undefined) return publish.owner
  const { stdout } = await run('gh', ['api', 'user', '--jq', '.login']).catch(() => {
    throw new Error('publish.owner is not set and `gh` is not signed in: name the GitHub user or organisation to publish under')
  })
  return stdout.trim()
}

const dateline = (publish: Publish): string | undefined => {
  if (publish.date === undefined) return publish.venue
  const [year, month, day] = publish.date.split('-').map(Number) as [number, number, number | undefined]
  const when = new Date(Date.UTC(year, month - 1, day ?? 1)).toLocaleDateString('en-US', {
    month: 'long',
    ...(day === undefined ? {} : { day: 'numeric' }),
    year: 'numeric',
    timeZone: 'UTC',
  })
  return publish.venue === undefined ? when : `${when} · ${publish.venue}`
}

const readme = (deck: Deck, publish: Publish, url: string, source: string): string => `# ${deck.title}

${[deck.author, publish.event, dateline(publish)].filter((part) => part !== undefined).join(' · ')}

**Slides: ${url}**

${deck.description ?? ''}

## Viewing

The deck is one self-contained file, \`index.html\`: open the link above, or download the file and open it from disk. It needs no network.

| Key | |
|---|---|
| → · space · click · swipe left | next slide |
| ← · click the left edge · swipe right | previous slide |
| a number, then Enter | go to that slide |
| f | fullscreen |
${publish.notes === true ? '| s | speaker notes |\n| p | presenter window |\n' : ''}
${deck.slides.some((slide) => (slide.cites?.length ?? 0) > 0) ? "Every claim is cited on its slide; the sources are linked in each slide's footer.\n" : ''}
---

Built with [dotpreso](https://github.com/busse/dotpreso-public) (${source}). Illustrations drawn and animated with [dotscene](https://github.com/busse/dotscene).
`

/** The commit the copy was built from, marked if the working tree had changes. */
const sourceRevision = async (): Promise<string> => {
  try {
    const sha = await run('git', ['rev-parse', '--short', 'HEAD']).then((r) => r.stdout.trim())
    const dirty = await run('git', ['status', '--porcelain']).then((r) => r.stdout.trim() !== '')
    return dirty ? `${sha}, with uncommitted changes` : sha
  } catch {
    return 'an unversioned tree'
  }
}

export const exportDeck = async (name: string): Promise<{ readonly dir: string; readonly deck: Deck; readonly publish: Publish; readonly url: string; readonly slug: string }> => {
  const deckFile = resolve('decks', name, 'deck.ts')
  const { deck: probe } = (await import(`file://${deckFile}`)) as { deck: Deck }
  const publish = probe.publish
  if (publish === undefined) throw new Error(`deck '${name}' has no \`publish\` block: give it a repo, an event and a date`)
  checkPublish(publish)
  const owner = await ownerOf(publish)
  const url = pagesUrl(owner, publish.repo)

  const dir = resolve('..', publish.repo)
  await mkdir(dir, { recursive: true })
  const { bytes, slides, deck } = await buildDeck(deckFile, resolve(dir, 'index.html'), {
    notes: publish.notes === true,
    url,
    public: true,
  })
  await writeFile(resolve(dir, '.nojekyll'), '')
  await writeFile(resolve(dir, 'README.md'), readme(deck, publish, url, await sourceRevision()))
  process.stdout.write(
    `${name} → ${dir}: ${slides} slides, ${(bytes / 1024).toFixed(0)} kB, notes ${publish.notes === true ? 'in' : 'out'}\n`,
  )
  return { dir, deck, publish, url, slug: `${owner}/${publish.repo}` }
}

export const publishDeck = async (name: string): Promise<void> => {
  const { dir, deck, publish, url, slug } = await exportDeck(name)

  if (!(await exists(resolve(dir, '.git')))) await sh('git', ['init', '-b', 'main'], dir)
  await sh('git', ['add', '-A'], dir)
  const staged = await sh('git', ['status', '--porcelain'], dir)
  if (staged === '') process.stdout.write('  nothing changed since the last publish\n')
  else await sh('git', ['commit', '-m', `publish: ${deck.title} (${await sourceRevision()})`], dir)

  const known = await run('gh', ['repo', 'view', slug, '--json', 'name']).then(() => true, () => false)
  if (!known) {
    await sh('gh', ['repo', 'create', slug, '--public', '--source', '.', '--remote', 'origin', '--push',
      '--description', [deck.title, publish.event, publish.date].filter((part) => part !== undefined).join(' — '),
      '--homepage', url], dir)
    await sh('gh', ['repo', 'edit', slug, '--add-topic', 'talk', '--add-topic', 'slides', '--add-topic', 'dotpreso', '--add-topic', 'dotscene'], dir)
  } else {
    await sh('git', ['push', '-u', 'origin', 'main'], dir)
  }

  // Pages from the main branch's root; a no-op after the first time.
  const pages = await run('gh', ['api', `repos/${slug}/pages`]).then(() => true, () => false)
  if (!pages) await sh('gh', ['api', '-X', 'POST', `repos/${slug}/pages`, '-f', 'source[branch]=main', '-f', 'source[path]=/'], dir)

  process.stdout.write(`published: ${url} (Pages can take a minute to build)\n`)
}
