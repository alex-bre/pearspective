import { useEffect } from 'react'
import { useStore } from './state/store'

/** App-wide keyboard shortcuts. Ignored while typing in a field. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const { selection, select, removeSelected } = useStore.getState()
      if (e.key === 'Escape') select([])
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
        e.preventDefault()
        removeSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
