<p align="center">
  <img src="public/favicon.svg" width="120" alt="Pearspective">
</p>

<p align="center">
  A 3D editor that runs in your browser.<br>
</p>

<p align="center">
  <a href="https://alex-bre.github.io/pearspective/"><strong>Open the editor →</strong></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-AGPL--3.0--only-blue" alt="Licence: AGPL-3.0-only"></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/static/v1?label=version&message=0.1.0&color=blue" alt="Version"></a>
</p>

---

## Features

- **Model**
  - Cube, sphere, cylinder and cone primitives — click to place, or drag onto the ground
  - Move along the ground, resize with handles, rotate with 15° snap
- **Combine**
  - Boolean operations: union, subtract, and intersect
- **Arrange**
  - Grid and ground snapping with alignment guides
  - Exact position, size and rotation in m, cm or mm
- **Style**
  - Colour, finish (matte, satin, gloss) and opacity
- **View**
  - Axis views and a home view, perspective or orthographic
  - Light and dark theme
- **Import and export**
  - STL (mm, Z-up, as slicers expect) and GLB (m, with colours)
- Undo and redo for every edit

## Running it locally

```bash
npm install
npm run dev        # dev server with HMR
npm test           # test suite, single run
npm run build      # static build into dist/
npm run preview    # serve that build locally
```

Node 22 or newer.

## Releases and deployment

Three workflows under the repository's **Actions** tab, all started by hand.

**The site** deploys on the branch picked (normally `main`). `.github/workflows/pages.yml`
tests, builds, and publishes `dist/` to
[GitHub Pages](https://alex-bre.github.io/pearspective/). Pushes to `main` do not
change the live site.

**The tests** run on demand. Deploy and release run them too, before they publish anything.

**A release** can be cut either on GitHub or locally. Both write the
CHANGELOG entry, bump the version in `package.json`, `package-lock.json` and
the README badge, commit, and tag `vX.Y.Z`.

*On GitHub:* *Actions → Release → Run workflow*, then choose the bump
(`minor`, `patch`, `major`, or `custom` with a version such as `0.2.0` in the
version field). Tick *dry run* first to see the changelog entry in the run
summary without changing anything. A real run tests, cuts the release on
`main`, pushes the commit and tag, and publishes the GitHub Release — one run
does it all. `custom` with an existing tag (e.g. `v0.1.0`) skips the cutting
and only publishes that tag, for a tag that has no release yet.

*Locally:*

```bash
npm run release -- --minor      # or --patch / --major / an explicit 0.2.0
npm run release -- --minor --dry-run   # see the changelog entry first
git push --follow-tags          # after reviewing the commit
```

Pushing the tag starts the same workflow, which publishes it.

Either way the GitHub Release gets that version's CHANGELOG entry as its notes
and the static build attached as a zip. The site is not redeployed by a
release; run Pages afterwards if it should show the new version.

Only conventional-commit subjects (`feat:`, `fix:`, `perf:`, `revert:`,
`refactor:`, `docs:`) reach the changelog; `chore:`, `ci:` and `test:` are
deliberately left out.

## Self-hosting

The build output is a folder of static files — put `dist/` behind any web
server. `base` is `'./'`, so it works from a domain root or a sub-path, and
there is no client-side router, so no SPA fallback rewrite is needed.
`dist/assets/*` carry a content hash and can be cached forever; `index.html`
should not be.

A two-stage Dockerfile is included — the final image is nginx and the static
files, no Node:

```bash
docker compose up -d --build     # http://localhost:8080
```

It serves plain HTTP; put a reverse proxy in front for TLS.

## Licence

**GNU Affero General Public License v3.0 only** — see [LICENSE](LICENSE).

The clause worth knowing about is §13: if you modify Pearspective and let other
people use your version *over a network*, you have to offer those users its
source. Self-hosting an unmodified copy carries no such obligation.

The licence covers the code. It grants no rights to the Pearspective name or logo.
