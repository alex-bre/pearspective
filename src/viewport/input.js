import { useStore } from '../state/store'
import { snapValue, clampToPlayground } from '../model/snap'

/** Drag-and-drop type carried by the shape tiles in the left panel. */
export const SHAPE_MIME = 'application/x-pearspective-shape'

const CLICK_SLOP = 4 // px a press may travel and still count as a click

/**
 * Wires pointer and drop input on the viewport to the store.
 *  - press an object: select it (Shift toggles); the press never orbits
 *  - click empty space: clear the selection; drag it: orbit (OrbitControls)
 *  - drop a shape tile: add that shape where it lands
 * Returns a cleanup function.
 */
export function attachInput(host, engine) {
  const { canvas, controls } = engine
  let down = null

  // Capture phase on the host, so this runs before OrbitControls' own listener
  // on the canvas and can switch it off for presses on objects.
  const onDown = (e) => {
    if (e.button !== 0 || e.target !== canvas) return
    const id = engine.pickObject(e)
    down = { x: e.clientX, y: e.clientY, id }
    if (id == null) return
    controls.enabled = false
    const { selection, select, toggleSelected } = useStore.getState()
    if (e.shiftKey) toggleSelected(id)
    else if (!selection.includes(id)) select([id])
  }

  const onUp = (e) => {
    if (!down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    if (down.id == null && moved < CLICK_SLOP && !e.shiftKey) useStore.getState().select([])
    controls.enabled = true
    down = null
  }

  const onHover = (e) => {
    if (down || e.target !== canvas) return
    canvas.style.cursor = engine.pickObject(e) != null ? 'pointer' : ''
  }

  const onDragOver = (e) => {
    if (!e.dataTransfer.types.includes(SHAPE_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (e) => {
    const type = e.dataTransfer.getData(SHAPE_MIME)
    if (!type) return
    e.preventDefault()
    const { settings, document, addObject } = useStore.getState()
    const p = engine.groundPoint(e)
    addObject(type, p && clampToPlayground(p.map((v) => snapValue(v, settings.grid, settings.snap)), document.playground))
  }

  // Right-drag pans; keep the browser menu out of the way.
  const onMenu = (e) => e.target === canvas && e.preventDefault()

  host.addEventListener('pointerdown', onDown, true)
  host.addEventListener('pointermove', onHover)
  host.addEventListener('dragover', onDragOver)
  host.addEventListener('drop', onDrop)
  host.addEventListener('contextmenu', onMenu)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)

  return () => {
    host.removeEventListener('pointerdown', onDown, true)
    host.removeEventListener('pointermove', onHover)
    host.removeEventListener('dragover', onDragOver)
    host.removeEventListener('drop', onDrop)
    host.removeEventListener('contextmenu', onMenu)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
}
