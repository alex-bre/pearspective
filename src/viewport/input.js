import { useStore } from '../state/store'
import { beginHistoryBatch, endHistoryBatch } from '../state/history'
import { snapValue, clampToPlayground } from '../model/snap'
import { axesOf, handlePoint, resizeTo, worldBox } from '../model/transform'
import { toUnit } from '../model/units'

/** Drag-and-drop type carried by the shape tiles in the left panel. */
export const SHAPE_MIME = 'application/x-pearspective-shape'

const CLICK_SLOP = 4 // px a press may travel and still count as a click
const MIN_SIZE = 0.001 // m, the smallest a resize may go with snapping off
const DEG = Math.PI / 180

const store = () => useStore.getState()
const fmt = (m) => toUnit(m, store().settings.unit)
/** Ctrl (Cmd on a Mac) adds to or removes from the selection. */
const multi = (e) => e.ctrlKey || e.metaKey

/**
 * Wires pointer and drop input on the viewport to the store. One gesture runs
 * from pointerdown to pointerup:
 *  - gizmo  : a rotate ring (Rotate mode) — TransformControls does the work
 *  - resize : a handle on the selected object (Select mode)
 *  - object : press an object to select it (Ctrl toggles); drag to move the
 *             selection along the ground (Select mode)
 *  - box    : on empty space, click clears the selection; drag selects every
 *             object the box touches (Ctrl adds them to the selection)
 *  - orbit  : Alt-drag or a touch on empty space orbits (OrbitControls), as
 *             does a middle-drag, which never reaches this handler
 *  - menu   : a right-click on an object selects it (unless it already is)
 *             and calls `onMenu({ x, y })`; a right-drag pans (OrbitControls)
 * A whole gesture is one undo step. Dropping a shape tile adds that shape
 * where it lands; dropping STL / GLB files imports them. `marquee` is the
 * element drawn as the selection box. Returns a cleanup.
 */
export function attachInput(host, engine, { marquee, onMenu }) {
  const { canvas, controls, gizmo } = engine
  let g = null // the gesture in progress
  let rightPress = null // where the right button went down, until it comes up

  const travelled = (e) => Math.hypot(e.clientX - g.x, e.clientY - g.y)

  /* ---- press ---- */

  // Capture phase on the host, so this runs before OrbitControls' own listener
  // on the canvas and can switch it off for presses that aren't orbits.
  const onDown = (e) => {
    if (e.target !== canvas) return
    if (e.button === 2) rightPress = { x: e.clientX, y: e.clientY }
    if (e.button !== 0) return
    const at = { x: e.clientX, y: e.clientY }
    if (engine.gizmoHovered()) {
      controls.enabled = false
      g = { kind: 'gizmo', ...at }
      return
    }
    const handle = engine.pickHandle(e)
    if (handle) {
      controls.enabled = false
      beginHistoryBatch()
      g = { kind: 'resize', ...at, ...startResize(e, handle) }
      return
    }
    const id = engine.pickObject(e)
    if (id == null) {
      // Touch keeps one-finger orbiting; a mouse or pen drags a selection box.
      if (e.altKey || e.pointerType === 'touch') {
        g = { kind: 'orbit', ...at }
        return
      }
      controls.enabled = false
      // The camera holds still until release, so the objects' screen bounds are taken once.
      g = { kind: 'box', ...at, multi: multi(e), before: store().selection, rects: engine.screenRects() }
      return
    }
    controls.enabled = false
    const s = store()
    if (multi(e)) {
      s.toggleSelected(id)
      g = { kind: 'object', id, multi: true, ...at }
      return
    }
    if (!s.selection.includes(id)) s.select([id])
    beginHistoryBatch() // selecting isn't a document change, so only a move gets recorded
    g = { kind: 'object', id, ...at, ...(s.ui.mode === 'select' ? startMove(e) : {}) }
  }

  // Everything a move needs, fixed at the press: where the pointer met the
  // ground, each selected object's start position, and their combined footprint.
  function startMove(e) {
    const p0 = engine.groundPoint(e)
    if (!p0) return {}
    const { document: doc, selection } = store()
    const box = worldBox(doc.objects[selection[0]])
    for (const id of selection.slice(1)) box.union(worldBox(doc.objects[id]))
    return { p0, box, starts: selection.map((id) => [id, doc.objects[id].position]) }
  }

  // A resize drags the handle across a plane through it: the object's own
  // horizontal plane for corners, an upright plane facing the camera for the top.
  function startResize(e, handle) {
    const { document: doc, selection } = store()
    const start = doc.objects[selection[0]]
    const origin = handlePoint(start, handle)
    const up = axesOf(start)[1]
    let normal = up
    if (handle.dir[1]) {
      const v = engine.viewDir()
      normal = v.sub(up.clone().multiplyScalar(v.dot(up)))
      if (normal.lengthSq() < 1e-6) return {} // looking straight down the axis: nothing to drag along
      normal.normalize()
    }
    return { id: start.id, start, handle, origin, normal, p0: engine.rayOnPlane(e, origin, normal) }
  }

  /* ---- drag ---- */

  const onMove = (e) => {
    if (!g) return hover(e)
    if (g.kind === 'object' && g.starts) move(e)
    else if (g.kind === 'resize' && g.p0) resize(e)
    else if (g.kind === 'box') box(e)
  }

  function box(e) {
    if (!g.moving && travelled(e) < CLICK_SLOP) return
    g.moving = true
    const r = {
      left: Math.min(g.x, e.clientX),
      right: Math.max(g.x, e.clientX),
      top: Math.min(g.y, e.clientY),
      bottom: Math.max(g.y, e.clientY),
    }
    const h = host.getBoundingClientRect()
    Object.assign(marquee.style, {
      display: 'block',
      transform: `translate(${r.left - h.left}px, ${r.top - h.top}px)`,
      width: `${r.right - r.left}px`,
      height: `${r.bottom - r.top}px`,
    })

    const { document: doc, selection, select } = store()
    const touched = (b) => b.left <= r.right && b.right >= r.left && b.top <= r.bottom && b.bottom >= r.top
    const hits = doc.order.filter((id) => g.rects.has(id) && touched(g.rects.get(id)))
    // Added after what was already selected, so the first pick stays boolean A.
    const next = g.multi ? [...new Set([...g.before, ...hits])] : hits
    if (next.join() !== selection.join()) select(next)
  }

  function move(e) {
    if (!g.moving && travelled(e) < CLICK_SLOP) return
    g.moving = true
    const p = engine.groundPoint(e)
    if (!p) return
    const { settings, document: doc, moveObjects } = store()
    const { w, d } = doc.playground
    const start = g.starts.find(([id]) => id === g.id)[1]
    // The grabbed object's centre snaps to the grid; the selection's footprint
    // [min, max] stays inside [-half, half] (unless it is wider than the playground).
    const fit = (delta, min, max, half) => (max - min > 2 * half ? delta : Math.min(half - max, Math.max(-half - min, delta)))
    const dx = fit(snapValue(start[0] + p[0] - g.p0[0], settings.grid, settings.snap) - start[0], g.box.min.x, g.box.max.x, w / 2)
    const dz = fit(snapValue(start[2] + p[1] - g.p0[1], settings.grid, settings.snap) - start[2], g.box.min.z, g.box.max.z, d / 2)
    moveObjects(g.starts, dx, dz)

    const ids = g.starts.map(([id]) => id)
    engine.showGuides(ids)
    engine.showLabel(`X ${fmt(start[0] + dx)}   Z ${fmt(start[2] + dz)}  ${settings.unit}`, ids)
    canvas.style.cursor = 'grabbing'
  }

  function resize(e) {
    const p = engine.rayOnPlane(e, g.origin, g.normal)
    if (!p) return
    const { settings, updateObject } = store()
    const min = settings.snap ? settings.grid : MIN_SIZE
    const r = resizeTo(g.start, g.handle, g.origin.clone().add(p.sub(g.p0)), { grid: settings.grid, snap: settings.snap, min })
    updateObject(g.id, r)
    const [w, h, d] = r.size
    engine.showLabel(`${fmt(w)} × ${fmt(d)} × ${fmt(h)}  ${settings.unit}`, [g.id])
  }

  /* ---- release ---- */

  const onUp = (e) => {
    if (e.button === 2 && rightPress) openMenu(e)
    if (!g) return
    const s = store()
    if (g.kind === 'orbit' && travelled(e) < CLICK_SLOP && !multi(e)) s.select([])
    if (g.kind === 'box' && !g.moving && !g.multi) s.select([])
    if (g.kind === 'box') marquee.style.display = 'none'
    // A plain click on one object of a multi-selection narrows it to that object.
    if (g.kind === 'object' && !g.moving && !g.multi && s.selection.length > 1) s.select([g.id])
    endHistoryBatch()
    engine.clearGuides()
    engine.hideLabel()
    controls.enabled = true
    g = null
    hover(e)
  }

  // On release rather than on `contextmenu`, which Linux and macOS fire at the
  // press — before it is known whether the press is a click or a pan.
  function openMenu(e) {
    const slid = Math.hypot(e.clientX - rightPress.x, e.clientY - rightPress.y) >= CLICK_SLOP
    rightPress = null
    if (slid || e.target !== canvas) return
    const id = engine.pickObject(e)
    if (id == null) return
    const s = store()
    if (!s.selection.includes(id)) s.select([id])
    onMenu({ x: e.clientX, y: e.clientY })
  }

  function hover(e) {
    if (e.target !== canvas) return
    let cursor = ''
    if (engine.gizmoHovered()) cursor = ''
    else if (engine.pickHandle(e)) cursor = 'pointer'
    else if (engine.pickObject(e) != null) cursor = store().ui.mode === 'select' ? 'grab' : 'pointer'
    canvas.style.cursor = cursor
  }

  /* ---- rotate gizmo ---- */

  const onGizmoDragging = (e) => {
    controls.enabled = !e.value
    e.value ? beginHistoryBatch() : endHistoryBatch()
    if (!e.value) engine.hideLabel()
  }
  const onGizmoChange = () => {
    const mesh = gizmo.object
    if (!mesh || !gizmo.dragging) return
    const rotation = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map((r) => Math.round((r / DEG) * 1e6) / 1e6)
    store().updateObject(mesh.userData.id, { rotation })
    engine.showLabel(rotation.map((r, i) => `${'XYZ'[i]} ${Math.round(r)}°`).join('   '), [mesh.userData.id])
  }

  /* ---- drop a shape tile or model files ---- */

  const onDragOver = (e) => {
    const { types } = e.dataTransfer
    if (!types.includes(SHAPE_MIME) && !types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (e) => {
    if (e.dataTransfer.files.length) {
      e.preventDefault() // or the browser opens the file
      store().importFiles(e.dataTransfer.files)
      return
    }
    const type = e.dataTransfer.getData(SHAPE_MIME)
    if (!type) return
    e.preventDefault()
    const { settings, document, addObject } = store()
    const p = engine.groundPoint(e)
    addObject(type, p && clampToPlayground(p.map((v) => snapValue(v, settings.grid, settings.snap)), document.playground))
  }

  // Right-drag pans and a right-click opens our menu; keep the browser's away.
  const onContextMenu = (e) => e.target === canvas && e.preventDefault()

  // Orbiting, panning or zooming by hand leaves the named view.
  const onCameraStart = () => store().ui.view && store().setView(null)

  host.addEventListener('pointerdown', onDown, true)
  host.addEventListener('dragover', onDragOver)
  host.addEventListener('drop', onDrop)
  host.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  gizmo.addEventListener('dragging-changed', onGizmoDragging)
  gizmo.addEventListener('objectChange', onGizmoChange)
  controls.addEventListener('start', onCameraStart)

  return () => {
    controls.removeEventListener('start', onCameraStart)
    host.removeEventListener('pointerdown', onDown, true)
    host.removeEventListener('dragover', onDragOver)
    host.removeEventListener('drop', onDrop)
    host.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    gizmo.removeEventListener('dragging-changed', onGizmoDragging)
    gizmo.removeEventListener('objectChange', onGizmoChange)
  }
}
