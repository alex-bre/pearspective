import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './ContextMenu.module.css'

/**
 * A floating right-click menu anchored at a screen position. `items` is a list
 * of either `{ separator: true }` or
 * `{ label, icon?, shortcut?, disabled?, danger?, onClick }`.
 *
 * The menu clamps itself inside the window and closes on an outside press, any
 * key, scroll, resize, or after an item is chosen. Positioned `fixed`, so
 * `x`/`y` are client (screen) coordinates.
 */
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x, y, ready: false })

  // Clamp into the window once the rendered menu can be measured.
  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect()
    const m = 6
    const nx = x + r.width + m > window.innerWidth ? Math.max(m, window.innerWidth - r.width - m) : x
    const ny = y + r.height + m > window.innerHeight ? Math.max(m, window.innerHeight - r.height - m) : y
    setPos({ x: nx, y: ny, ready: true })
  }, [x, y, items])

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose()
    }
    // Any key closes the menu: a shortcut such as Del may change the selection
    // it was opened for. Escape stops here, or useShortcuts would also clear
    // the selection.
    const onKey = (e) => {
      if (e.key === 'Escape') e.stopPropagation()
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    window.addEventListener('wheel', onClose, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('wheel', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className={`${styles.menu} no-select`}
      style={{ left: pos.x, top: pos.y, visibility: pos.ready ? 'visible' : 'hidden' }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className={styles.sep} />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={styles.item}
            data-danger={item.danger || undefined}
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onClick?.()
            }}
          >
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            <span className={styles.label}>{item.label}</span>
            {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  )
}
