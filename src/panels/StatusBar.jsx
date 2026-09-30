import { useEffect } from 'react'
import { useStore } from '../state/store'
import { toUnit, formatLength } from '../model/units'
import styles from './StatusBar.module.css'

const HINTS = {
  select:
    'Click to select · Drag to move · Drag a handle to resize · Shift-click to multi-select · Drag empty space to orbit · Right-drag to pan · Scroll to zoom',
  rotate: 'Drag a ring to rotate the selected object',
}

export default function StatusBar() {
  const mode = useStore((s) => s.ui.mode)
  const count = useStore((s) => s.document.order.length)
  const playground = useStore((s) => s.document.playground)
  const settings = useStore((s) => s.settings)
  const busy = useStore((s) => s.ui.busy)
  const setBusy = useStore((s) => s.setBusy)

  // A finished message (not one ending in …) clears itself.
  useEffect(() => {
    if (!busy || busy.endsWith('…')) return
    const t = setTimeout(() => setBusy(''), 3500)
    return () => clearTimeout(t)
  }, [busy, setBusy])
  const u = settings.unit

  const hint = HINTS[mode] + (mode === 'rotate' && settings.snap ? ' · Snaps to 15°' : '')

  return (
    <footer className={`${styles.status} no-select`}>
      <span className={styles.hint} data-busy={busy || undefined} role="status">
        {busy || hint}
      </span>
      <span className="mono">
        {count} object{count === 1 ? '' : 's'} · {toUnit(playground.w, u)} × {toUnit(playground.d, u)} {u} · grid{' '}
        {formatLength(settings.grid, u)} · snap {settings.snap ? 'on' : 'off'}
      </span>
    </footer>
  )
}
