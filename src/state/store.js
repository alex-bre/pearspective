import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createObject, duplicateObject, freeSpot } from '../model/objects'
import { groundY } from '../model/transform'
import { snapValue } from '../model/snap'

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

// Selecting something moves the right panel from General to Arrange, where the
// selection's properties are.
function selectIds(s, ids) {
  s.selection = ids
  if (ids.length && s.ui.rightTab === 'general') s.ui.rightTab = 'arrange'
}

// With snap to ground on, any change that could lift or sink an object (a
// resize, a rotation, a typed Y) puts its lowest point back on the ground.
function settle(s, o) {
  if (s.settings.snapGround) o.position[1] = groundY(o)
}

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
      // The named view the camera sits in, or null once the user orbits away.
      view: 'home',
      projection: 'perspective', // or 'orthographic'
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
    /** Go to a named view. Axis views are orthographic; Home is perspective. null = left the view. */
    setView: (view) =>
      set((s) => {
        s.ui.view = view
        if (view) s.ui.projection = view === 'home' ? 'perspective' : 'orthographic'
      }),
    setProjection: (projection) => set((s) => void (s.ui.projection = projection)),
    toggleProjection: () =>
      set((s) => void (s.ui.projection = s.ui.projection === 'perspective' ? 'orthographic' : 'perspective')),

    /* ---- objects ---- */
    /** Add a shape at ground point [x, z], or at the nearest free spot. */
    addObject: (type, at) =>
      set((s) => {
        const [x, z] = at ?? freeSpot(s.document, s.settings.grid)
        const obj = createObject(type, x, z)
        s.document.objects[obj.id] = obj
        s.document.order.push(obj.id)
        selectIds(s, [obj.id])
      }),
    removeSelected: () =>
      set((s) => {
        for (const id of s.selection) delete s.document.objects[id]
        s.document.order = s.document.order.filter((id) => s.document.objects[id])
        s.selection = []
      }),
    renameObject: (id, name) => set((s) => void (s.document.objects[id].name = name)),
    /** Merge `patch` (position / size / rotation …) into an object, then settle it. */
    updateObject: (id, patch) =>
      set((s) => {
        const o = s.document.objects[id]
        Object.assign(o, patch)
        settle(s, o)
      }),
    /** Shift objects from their drag-start positions: starts = [[id, [x, y, z]], …]. */
    moveObjects: (starts, dx, dz) =>
      set((s) => {
        for (const [id, [x, y, z]] of starts) {
          const o = s.document.objects[id]
          if (o) o.position = [x + dx, y, z + dz]
        }
      }),
    /** Put an object on the ground whether or not snap to ground is on. */
    dropToGround: (id) =>
      set((s) => {
        const o = s.document.objects[id]
        o.position[1] = groundY(o)
      }),
    centerObject: (id) =>
      set((s) => {
        const o = s.document.objects[id]
        o.position = [0, o.position[1], 0]
      }),
    /** Copy the selection one width (plus a grid step) along X and select the copies. */
    duplicateSelected: () => {
      const { document: doc, selection, settings } = get()
      const copies = selection.map((id) => {
        const o = doc.objects[id]
        const x = Math.min(o.position[0] + snapValue(o.size[0] + settings.grid, settings.grid), doc.playground.w / 2)
        return duplicateObject(o, x - o.position[0])
      })
      set((s) => {
        for (const c of copies) {
          s.document.objects[c.id] = c
          s.document.order.push(c.id)
        }
        selectIds(s, copies.map((c) => c.id))
      })
    },

    /* ---- selection ---- */
    select: (ids) => set((s) => selectIds(s, ids)),
    /** Shift-click: add to or remove from the selection, keeping pick order. */
    toggleSelected: (id) =>
      set((s) =>
        selectIds(s, s.selection.includes(id) ? s.selection.filter((i) => i !== id) : [...s.selection, id]),
      ),

    /* ---- settings / playground ---- */
    setSetting: (key, value) =>
      set((s) => {
        s.settings[key] = value
        if (key === 'snapGround' && value) for (const id of s.document.order) settle(s, s.document.objects[id])
      }),
    setPlayground: (key, value) => set((s) => void (s.document.playground[key] = value)),
  })),
)
