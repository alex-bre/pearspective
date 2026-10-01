import { useEffect, useRef, useState } from 'react'
import { Undo2, Redo2, Upload, Download, ChevronDown, Sun, Moon } from 'lucide-react'
import { useStore } from '../state/store'
import { undo, redo } from '../state/history'
import styles from './TopBar.module.css'

/* The pear mark. Filled from theme tokens so it lifts in dark mode. */
function PearMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="12.2" y="1" width="1.6" height="5.5" rx="0.8" fill="var(--leaf)" />
      <ellipse cx="17.2" cy="4.2" rx="3.6" ry="1.6" transform="rotate(-25 17.2 4.2)" fill="var(--leaf)" />
      <circle cx="13" cy="10.8" r="5" fill="var(--pear)" />
      <circle cx="13" cy="17.6" r="7.4" fill="var(--pear)" />
    </svg>
  )
}

// Kept in step with io/importFiles' IMPORT_EXTENSIONS, which loads on demand.
const IMPORT_ACCEPT = '.stl,.glb,.gltf'

const EXPORTS = [
  { kind: 'stl', label: 'STL', sub: 'Mesh for 3D printing · mm · Z-up' },
  { kind: 'glb', label: 'GLB', sub: 'glTF binary with colours · meters' },
]

export default function TopBar() {
  const theme = useStore((s) => s.ui.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const importFiles = useStore((s) => s.importFiles)
  const exportScene = useStore((s) => s.exportScene)
  const [exportOpen, setExportOpen] = useState(false)
  const menuRef = useRef(null)
  const fileRef = useRef(null)

  // Close the export menu on any press outside it.
  useEffect(() => {
    if (!exportOpen) return
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setExportOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [exportOpen])

  return (
    <header className={`${styles.topbar} no-select`}>
      <div className={styles.brand}>
        <PearMark />
        <span className={styles.wordmark}>
          <span className={styles.pear}>pear</span>spective
        </span>
      </div>

      <div className={styles.group}>
        <button className={styles.iconBtn} title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={16} />
        </button>
        <button className={styles.iconBtn} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={16} />
        </button>
      </div>

      <div className={styles.group}>
        <button className={styles.btn} title="Import STL or GLB" onClick={() => fileRef.current.click()}>
          <Upload size={15} />
          <span className={styles.btnLabel}>Import</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={IMPORT_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            importFiles(e.target.files)
            e.target.value = '' // so picking the same file again still fires
          }}
        />
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            className={`${styles.btn} ${styles.menuBtn}`}
            title="Export scene"
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((o) => !o)}
          >
            <Download size={15} />
            <span className={styles.btnLabel}>Export</span>
            <ChevronDown size={13} />
          </button>
          {exportOpen && (
            <div className={styles.menu} role="menu">
              {EXPORTS.map((x) => (
                <button
                  key={x.kind}
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    setExportOpen(false)
                    exportScene(x.kind)
                  }}
                >
                  <span className={styles.menuLabel}>{x.label}</span>
                  <span className={styles.menuSub}>{x.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.spacer} />

      <button className={styles.iconBtn} title="Toggle light / dark" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </header>
  )
}
