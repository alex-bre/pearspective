import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

/**
 * Where an explicit light/dark choice is remembered. Absent means "follow the
 * OS". The pre-paint script in index.html reads this same key.
 */
export const THEME_KEY = 'pearspective.theme'

/** The OS light/dark preference; 'light' wherever it can't be read. */
export function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function storedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}

const initialPref = storedTheme()

/**
 * Central app store. All lengths are in meters; model/units.js converts for display.
 *  - document  : the scene (undoable)
 *  - selection : ids of selected objects, in pick order (first = boolean A)
 *  - settings  : grid and snapping preferences (not undoable)
 *  - ui        : editor chrome
 */
export const useStore = create(
  immer((set, get) => ({
    document: {
      playground: { w: 10, d: 10 },
      order: [],
      objects: {},
    },

    selection: [],

    settings: {
      unit: 'm',
      grid: 0.5,
      showGrid: true,
      snap: true,
      snapGround: true,
    },

    ui: {
      // `themePref` is what the user asked for ('system' until they pick a
      // side); `theme` is the light/dark actually applied.
      themePref: initialPref ?? 'system',
      theme: initialPref ?? systemTheme(),
      leftTab: 'shapes',
      rightTab: 'general',
      mode: 'select',
      view: 'home',
    },

    /* ---- theme ---- */
    toggleTheme: () => {
      const theme = get().ui.theme === 'light' ? 'dark' : 'light'
      set((s) => {
        s.ui.themePref = theme
        s.ui.theme = theme
      })
      try {
        localStorage.setItem(THEME_KEY, theme)
      } catch {
        /* storage unavailable — the choice just won't outlive the session */
      }
    },
    systemThemeChanged: (theme) =>
      set((s) => {
        if (s.ui.themePref === 'system') s.ui.theme = theme
      }),

    /* ---- ui ---- */
    setLeftTab: (tab) => set((s) => void (s.ui.leftTab = tab)),
    setRightTab: (tab) => set((s) => void (s.ui.rightTab = tab)),
    setMode: (mode) => set((s) => void (s.ui.mode = mode)),
    setView: (view) => set((s) => void (s.ui.view = view)),

    /* ---- settings / playground ---- */
    setSetting: (key, value) => set((s) => void (s.settings[key] = value)),
    setPlayground: (key, value) => set((s) => void (s.document.playground[key] = value)),
  })),
)
