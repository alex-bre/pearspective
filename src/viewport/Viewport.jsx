import { useEffect, useRef, useState } from 'react'
import { MousePointer2, RotateCw, Box, Minus, Plus } from 'lucide-react'
import { useStore } from '../state/store'
import { createEngine, ZOOM_MIN, ZOOM_MAX } from './engine'
import { attachInput } from './input'
import styles from './Viewport.module.css'

const MODES = [
  { id: 'select', label: 'Select', title: 'Select, move & resize (V)', Icon: MousePointer2 },
  { id: 'rotate', label: 'Rotate', title: 'Rotate (R)', Icon: RotateCw },
]

// Axis views look straight along an axis, orthographically.
const VIEWS = [
  { id: 'top', label: 'Top', title: 'Top (7)' },
  { id: 'front', label: 'Front', title: 'Front (1)' },
  { id: 'right', label: 'Right', title: 'Right (3)' },
  { id: 'bottom', label: 'Bottom', title: 'Bottom' },
  { id: 'back', label: 'Back', title: 'Back' },
  { id: 'left', label: 'Left', title: 'Left' },
]

const PROJECTIONS = [
  { id: 'perspective', label: 'Persp', title: 'Perspective (5 toggles)' },
  { id: 'orthographic', label: 'Ortho', title: 'Orthographic (5 toggles)' },
]

/** The 3D viewport and its floating controls. */
export default function Viewport() {
  const hostRef = useRef(null)
  const labelRef = useRef(null)
  const engineRef = useRef(null) // for one-off camera commands: zoom and fit
  const [zoom, setZoom] = useState(100)
  const mode = useStore((s) => s.ui.mode)
  const setMode = useStore((s) => s.setMode)
  const view = useStore((s) => s.ui.view)
  const setView = useStore((s) => s.setView)
  const projection = useStore((s) => s.ui.projection)
  const setProjection = useStore((s) => s.setProjection)

  // The engine mirrors the store: synced once now, then on every change.
  useEffect(() => {
    const engine = createEngine(hostRef.current, { label: labelRef.current, onZoom: setZoom })
    engineRef.current = engine
    engine.sync(useStore.getState())
    const unsubscribe = useStore.subscribe(engine.sync)
    const detachInput = attachInput(hostRef.current, engine)
    return () => {
      detachInput()
      unsubscribe()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  return (
    <main ref={hostRef} className={styles.viewport}>
      {/* Position / size / angle readout while dragging; placed by the engine. */}
      <div ref={labelRef} className={`${styles.measure} mono`} />
      <div className={`${styles.floating} ${styles.modeBar} no-select`}>
        {MODES.map(({ id, label, title, Icon }) => (
          <button
            key={id}
            className={styles.modeBtn}
            data-active={mode === id || undefined}
            title={title}
            onClick={() => setMode(id)}
          >
            <Icon size={15} />
            <span className={styles.modeLabel}>{label}</span>
          </button>
        ))}
      </div>

      <div className={`${styles.floating} ${styles.viewPanel} no-select`}>
        <span className={styles.panelTitle}>View</span>
        <div className={styles.viewGrid}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={styles.viewBtn}
              data-active={view === v.id || undefined}
              title={v.title}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          className={`${styles.viewBtn} ${styles.homeBtn}`}
          data-active={view === 'home' || undefined}
          title="Home view, perspective (0)"
          onClick={() => setView('home')}
        >
          <Box size={13} />
          Home
        </button>
        <div className={styles.projRow}>
          {PROJECTIONS.map((p) => (
            <button
              key={p.id}
              className={styles.viewBtn}
              data-active={projection === p.id || undefined}
              title={p.title}
              onClick={() => setProjection(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${styles.floating} ${styles.zoomBar} no-select`}>
        <button className={styles.zoomBtn} title="Zoom out" onClick={() => engineRef.current?.zoomBy(0.8)}>
          <Minus size={14} />
        </button>
        <ZoomField zoom={zoom} onSet={(percent) => engineRef.current?.zoomTo(percent / 100)} />
        <button className={styles.zoomBtn} title="Zoom in" onClick={() => engineRef.current?.zoomBy(1.25)}>
          <Plus size={14} />
        </button>
        <button className={styles.fitBtn} title="Fit scene to view" onClick={() => engineRef.current?.fit()}>
          Fit
        </button>
      </div>
    </main>
  )
}

/** The zoom percentage; click it to type a level. Enter or leaving the field applies, Esc cancels. */
function ZoomField({ zoom, onSet }) {
  const [draft, setDraft] = useState(null) // the typed text while editing, else null
  const inputRef = useRef(null)
  const editing = draft !== null

  // Focus and select the whole number when editing starts, so typing replaces it.
  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  if (!editing) {
    return (
      <button
        className={`${styles.zoomLabel} mono`}
        title={`Set zoom (${ZOOM_MIN * 100}–${ZOOM_MAX * 100}%)`}
        onClick={() => setDraft(String(zoom))}
      >
        {zoom}%
      </button>
    )
  }

  const commit = () => {
    const percent = parseFloat(draft)
    if (Number.isFinite(percent) && percent > 0) onSet(percent)
    setDraft(null)
  }

  return (
    <input
      ref={inputRef}
      className={`${styles.zoomInput} mono`}
      type="text"
      inputMode="decimal"
      aria-label="Zoom percentage"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur() // blurring commits, once
        else if (e.key === 'Escape') setDraft(null)
      }}
    />
  )
}
