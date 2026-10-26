import { execFile } from 'node:child_process'
import { createReadStream, watch } from 'node:fs'
import { readdir, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDeck } from './build.ts'
import { exportDeck, publishDeck } from './publish.ts'

/**
 *   dotpreso build [deck]     build one deck, or every deck in decks/
 *   dotpreso present <deck>   build it and open it in the default browser
 *   dotpreso dev [deck]       build, serve, rebuild on every save, reload the page
 *   dotpreso export <deck>    build the public copy into ../<publish.repo>/
 *   dotpreso publish <deck>   export it, then commit, push and serve it on GitHub Pages
 *
 * A deck is a folder under decks/ (in the current directory) with a deck.ts exporting
 * `deck`. Output goes to dist/<deck>/index.html — one file, openable straight from disk.
 */

const here = dirname(fileURLToPath(import.meta.url))
const decksDir = resolve('decks')
/** What a rebuild watches: the decks, and the engine, kit and themes wherever they are installed. */
const WATCHED = [decksDir, here, resolve(here, '../figures'), resolve(here, '../themes')]

const allDecks = async (): Promise<string[]> => {
  const names = await readdir(decksDir)
  const decks: string[] = []
  for (const name of names) {
    const file = resolve(decksDir, name, 'deck.ts')
    if (await stat(file).then(() => true, () => false)) decks.push(name)
  }
  return decks.sort()
}

const buildOne = async (name: string): Promise<string> => {
  const out = resolve('dist', name, 'index.html')
  const { bytes, slides } = await buildDeck(resolve(decksDir, name, 'deck.ts'), out)
  process.stdout.write(`${name}: ${slides} slides, ${(bytes / 1024).toFixed(0)} kB → ${out}\n`)
  return out
}

const open = (target: string): void => {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
  execFile(opener, [target])
}

/** Pick the one deck to work on: the one named, or the only one there is. */
const pickDeck = async (target: string | undefined): Promise<string> => {
  const decks = await allDecks()
  const name = target ?? (decks.length === 1 ? decks[0] : undefined)
  if (name === undefined) {
    process.stderr.write(`which deck? one of: ${decks.join(', ')}\n`)
    process.exit(1)
  }
  return name
}

// ── the dev loop ───────────────────────────────────────────────────────────────────────

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
}

/**
 * Build once, then rebuild on every save under the decks, the engine and the themes, stamping
 * dist/<deck>/version.txt so a page opened with `?dev` knows to reload. Serve the output
 * over a tiny HTTP server (fetch cannot read a version file from `file://`).
 */
const dev = async (name: string): Promise<void> => {
  const dir = resolve('dist', name)
  const stamp = resolve(dir, 'version.txt')
  let builds = 0
  let building = false
  let queued = false

  const rebuild = async (): Promise<void> => {
    if (building) {
      queued = true
      return
    }
    building = true
    try {
      // In a fresh process: Node caches ES modules, so an in-process rebuild would import the
      // deck (and every scene and figure under it) as it was when the server started.
      await new Promise<void>((done, fail) => {
        execFile(process.execPath, [fileURLToPath(import.meta.url), 'build', name], (error, stdout, stderr) => {
          process.stdout.write(stdout)
          if (error !== null) fail(new Error(stderr || error.message))
          else done()
        })
      })
      builds++
      await writeFile(stamp, `${builds} ${Date.now()}\n`)
    } catch (error) {
      process.stderr.write(`build failed: ${error instanceof Error ? error.message : String(error)}\n`)
    } finally {
      building = false
      if (queued) {
        queued = false
        void rebuild()
      }
    }
  }
  await rebuild()

  let timer: NodeJS.Timeout | undefined
  const changed = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => void rebuild(), 150)
  }
  for (const folder of WATCHED) {
    if (!(await stat(folder).then((s) => s.isDirectory(), () => false))) continue
    watch(folder, { recursive: true }, (_event, file) => {
      if (file === null || file === undefined || /\.tsx?$|\.css$/.test(file)) changed()
    })
  }

  const port = Number(process.env.PORT ?? 4321)
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0]!)
    const file = join(dir, path === '/' ? 'index.html' : path)
    if (!file.startsWith(dir)) {
      response.writeHead(403).end()
      return
    }
    try {
      const type = TYPES[extname(file)] ?? 'application/octet-stream'
      const { size } = await stat(file)
      // A video seeks with byte ranges; answer them, or the browser can only play it through.
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '')
      if (range !== null) {
        const start = range[1] === '' ? size - Number(range[2]) : Number(range[1])
        const end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), size - 1) : size - 1
        response.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' })
        createReadStream(file, { start, end }).pipe(response)
        return
      }
      response.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' })
      createReadStream(file).pipe(response)
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found')
    }
  })
  server.listen(port, () => {
    const url = `http://localhost:${port}/?dev`
    process.stdout.write(`serving ${dir} at ${url} — rebuilding on save\n`)
    open(url)
  })
}

// ── commands ───────────────────────────────────────────────────────────────────────────

const [command = 'build', target] = process.argv.slice(2)

switch (command) {
  case 'build': {
    const names = target === undefined ? await allDecks() : [target]
    if (names.length === 0) process.stdout.write('no decks found in decks/\n')
    for (const name of names) await buildOne(name)
    break
  }
  case 'present': {
    const out = await buildOne(await pickDeck(target))
    open(out)
    break
  }
  case 'dev': {
    await dev(await pickDeck(target))
    break
  }
  case 'export': {
    await exportDeck(await pickDeck(target))
    break
  }
  case 'publish': {
    await publishDeck(await pickDeck(target))
    break
  }
  default:
    process.stderr.write(`unknown command '${command}'. Try: build [deck] | present [deck] | dev [deck] | export <deck> | publish <deck>\n`)
    process.exit(1)
}
