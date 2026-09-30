import { useStore } from '../state/store'
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

/**
 * Wires pointer and drop input on the viewport to the store. One gesture runs
 * from pointerdown to pointerup:
 *  - gizmo  : a rotate ring (Rotate mode) — TransformControls does the work
 *  - resize : a handle on the selected object (Select mode)
 *  - object : press an object to select it (Shift toggles); drag to move the
 *             selection along the ground (Select mode)
 *  - empty  : click clears the selection; drag orbits (OrbitControls)
 * Dropping a shape tile adds that shape where it lands. Returns a cleanup.
 */
export function attachInput(host, engine) {
  const { canvas, controls, gizmo } = engine
  let g = null // the gesture in progress

  const travelled = (e) => Math.hypot(e.clientX - g.x, e.clientY - g.y)

  /* ---- press ---- */

  // Capture phase on the host, so this runs before OrbitControls' own listener
  // on the canvas and can switch it off for presses that aren't orbits.
  const onDown = (e) => {
    if (e.button !== 0 || e.target !== canvas) return
    const at = { x: e.clientX, y: e.clientY }
    if (engine.gizmoHovered()) {
      controls.enabled = false
      g = { kind: 'gizmo', ...at }
      return
    }
    const handle = engine.pickHandle(e)
    if (handle) {
      controls.enabled = false
      g = { kind: 'resize', ...at, ...startResize(e, handle) }
      return
    }
    const id = engine.pickObject(e)
    if (id == null) {
      g = { kind: 'empty', ...at }
      return
    }
    controls.enabled = false
    const s = store()
    if (e.shiftKey) {
      s.toggleSelected(id)
      g = { kind: 'object', id, shift: true, ...at }
      return
    }
    if (!s.selection.includes(id)) s.select([id])
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
    if (!g) return
    const s = store()
    if (g.kind === 'empty' && travelled(e) < CLICK_SLOP && !e.shiftKey) s.select([])
    // A plain click on one object of a multi-selection narrows it to that object.
    if (g.kind === 'object' && !g.moving && !g.shift && s.selection.length > 1) s.select([g.id])
    engine.clearGuides()
    engine.hideLabel()
    controls.enabled = true
    g = null
    hover(e)
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
    if (!e.value) engine.hideLabel()
  }
  const onGizmoChange = () => {
    const mesh = gizmo.object
    if (!mesh || !gizmo.dragging) return
    const rotation = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map((r) => Math.round((r / DEG) * 1e6) / 1e6)
    store().updateObject(mesh.userData.id, { rotation })
    engine.showLabel(rotation.map((r, i) => `${'XYZ'[i]} ${Math.round(r)}°`).join('   '), [mesh.userData.id])
  }

  /* ---- drop a shape tile ---- */

  const onDragOver = (e) => {
    if (!e.dataTransfer.types.includes(SHAPE_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (e) => {
    const type = e.dataTransfer.getData(SHAPE_MIME)
    if (!type) return
    e.preventDefault()
    const { settings, document, addObject } = store()
    const p = engine.groundPoint(e)
    addObject(type, p && clampToPlayground(p.map((v) => snapValue(v, settings.grid, settings.snap)), document.playground))
  }

  // Right-drag pans; keep the browser menu out of the way.
  const onMenu = (e) => e.target === canvas && e.preventDefault()

  host.addEventListener('pointerdown', onDown, true)
  host.addEventListener('dragover', onDragOver)
  host.addEventListener('drop', onDrop)
  host.addEventListener('contextmenu', onMenu)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  gizmo.addEventListener('dragging-changed', onGizmoDragging)
  gizmo.addEventListener('objectChange', onGizmoChange)

  return () => {
    host.removeEventListener('pointerdown', onDown, true)
    host.removeEventListener('dragover', onDragOver)
    host.removeEventListener('drop', onDrop)
    host.removeEventListener('contextmenu', onMenu)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    gizmo.removeEventListener('dragging-changed', onGizmoDragging)
    gizmo.removeEventListener('objectChange', onGizmoChange)
  }
}
