import { MousePointer2, RotateCw, Box, Minus, Plus } from 'lucide-react'
import { useStore } from '../state/store'
import styles from './Viewport.module.css'

const MODES = [
  { id: 'select', label: 'Select', title: 'Select, move & resize (V)', Icon: MousePointer2 },
  { id: 'rotate', label: 'Rotate', title: 'Rotate (R)', Icon: RotateCw },
]

const VIEWS = [
  { id: 'top', label: 'Top', title: 'Top (7)' },
  { id: 'front', label: 'Front', title: 'Front (1)' },
  { id: 'right', label: 'Right', title: 'Right (3)' },
  { id: 'bottom', label: 'Bottom', title: 'Bottom' },
  { id: 'back', label: 'Back', title: 'Back' },
  { id: 'left', label: 'Left', title: 'Left' },
]

/** The 3D viewport and its floating controls. The scene itself arrives in phase 2. */
export default function Viewport() {
  const mode = useStore((s) => s.ui.mode)
  const setMode = useStore((s) => s.setMode)
  const view = useStore((s) => s.ui.view)
  const setView = useStore((s) => s.setView)

  return (
    <main className={styles.viewport}>
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
            <span>{label}</span>
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
          title="Perspective (0)"
          onClick={() => setView('home')}
        >
          <Box size={13} />
          Perspective
        </button>
      </div>

      <div className={`${styles.floating} ${styles.zoomBar} no-select`}>
        <button className={styles.zoomBtn} title="Zoom out">
          <Minus size={14} />
        </button>
        <span className={`${styles.zoomLabel} mono`}>100%</span>
        <button className={styles.zoomBtn} title="Zoom in">
          <Plus size={14} />
        </button>
        <button className={styles.fitBtn} title="Fit scene to view">
          Fit
        </button>
      </div>
    </main>
  )
}
