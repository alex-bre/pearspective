import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const git = (args) => execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()

/**
 * Which commit a build came from, so a bug report names the code it was hit on.
 *
 * Git first: the Release workflow builds a tag it has just cut, while
 * GITHUB_SHA still names the commit the run started from. GITHUB_SHA is the
 * fallback, then 'unknown' — the Docker build has no `.git` (`.dockerignore`
 * excludes it), so that is an expected state and not a build error.
 */
function commitSha() {
  try {
    // A dirty tree means the bundle matches no commit. Tracked files only:
    // Vite writes a `vite.config.js.timestamp-*.mjs` beside this file while
    // loading it, which would otherwise mark every build dirty.
    const dirty = git(['status', '--porcelain', '--untracked-files=no'])
    return git(['rev-parse', '--short', 'HEAD']) + (dirty ? '-dirty' : '')
  } catch {
    return process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'unknown'
  }
}

/**
 * Licence texts that ship inside the build, as `[source, servedAs]`. The About
 * dialog links to them: AGPL §4 and the MIT/ISC notice clauses attach to the
 * distributed build, and minified bundles carry no notices. The root copies
 * stay the single source of truth. `.txt` so a static host shows them rather
 * than offering an extensionless file as a download.
 */
const SHIPPED_LICENCE_FILES = [
  ['LICENSE', 'LICENSE.txt'],
  ['THIRD-PARTY-NOTICES', 'THIRD-PARTY-NOTICES.txt'],
]

function shipLicenceFiles() {
  const read = (src) => readFileSync(new URL(`./${src}`, import.meta.url), 'utf8')
  return {
    name: 'ship-licence-files',
    // Emitted rather than copied, so they follow `outDir`.
    generateBundle() {
      for (const [src, fileName] of SHIPPED_LICENCE_FILES) {
        this.emitFile({ type: 'asset', fileName, source: read(src) })
      }
    },
    // Served in `vite dev` too, so a broken link shows up before a release.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0]
        const entry = SHIPPED_LICENCE_FILES.find(([, fileName]) => path === `/${fileName}`)
        if (!entry) return next()
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(read(entry[0]))
      })
    },
  }
}

// `base: './'` keeps asset paths relative so the build can be served from any sub-path.
export default defineConfig({
  plugins: [react(), shipLicenceFiles()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_SHA__: JSON.stringify(commitSha()),
    // AGPL §13: network users are offered the source. From package.json, so
    // moving the repository is a one-line change.
    __SOURCE_URL__: JSON.stringify(pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')),
  },
  // The first paint needs three.js (~700 kB minified); loaders, exporters and CSG
  // are split off with import(). Warn only if the main chunk grows well past that.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    // three-bvh-csg has no `exports` map, so tests would load its CJS build and,
    // through it, a second (CJS) copy of three. Use its ESM source, as the app does.
    alias: { 'three-bvh-csg': 'three-bvh-csg/src/index.js' },
  },
})
