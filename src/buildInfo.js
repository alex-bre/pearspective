// Build identity, injected by vite.config.js `define` at build time. Shown as a
// tooltip on the app name, in the About dialog, and logged once at startup.

export const APP_VERSION = __APP_VERSION__
export const COMMIT_SHA = __COMMIT_SHA__

/** e.g. `v0.1.0 (7317901)`, or `v0.1.0 (a1b2c3d-dirty)` for an uncommitted build. */
export const BUILD_LABEL = `v${APP_VERSION} (${COMMIT_SHA})`

/** Where the project lives. */
export const SOURCE_URL = __SOURCE_URL__

/**
 * The source of *this* build, which is what AGPL §13 asks for. Only a clean
 * commit can be pointed at: 'unknown' and '-dirty' builds fall back to the
 * project root rather than a link that 404s.
 */
export const BUILD_SOURCE_URL = /^[0-9a-f]{7,40}$/.test(COMMIT_SHA) ? `${SOURCE_URL}/tree/${COMMIT_SHA}` : SOURCE_URL
