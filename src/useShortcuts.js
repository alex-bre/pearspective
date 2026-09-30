import { useEffect } from 'react'
import { useStore } from './state/store'

const VIEW_KEYS = { 7: 'top', 1: 'front', 3: 'right', 0: 'home' }

/** App-wide keyboard shortcuts. Ignored while typing in a field. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const { selection, select, removeSelected, duplicateSelected, setMode, setView, toggleProjection } = useStore.getState()
      const key = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      if (key === 'escape') select([])
      else if ((key === 'delete' || key === 'backspace') && selection.length) {
        e.preventDefault()
        removeSelected()
      } else if (mod && key === 'd') {
        e.preventDefault() // the browser's bookmark shortcut
        if (selection.length) duplicateSelected()
      } else if (mod || e.altKey) return
      else if (key === 'v') setMode('select')
      else if (key === 'r') setMode('rotate')
      // Blender's numpad views.
      else if (VIEW_KEYS[key]) setView(VIEW_KEYS[key])
      else if (key === '5') toggleProjection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
