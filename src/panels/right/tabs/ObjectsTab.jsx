import { useStore } from '../../../state/store'
import { LABELS } from '../../../model/objects'
import styles from '../RightPanel.module.css'

/** Every object in the scene. Click selects, Ctrl-click (Cmd on a Mac) adds or removes. */
export default function ObjectsTab() {
  const order = useStore((s) => s.document.order)
  const objects = useStore((s) => s.document.objects)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const toggleSelected = useStore((s) => s.toggleSelected)

  if (!order.length) return <p className={styles.empty}>The scene is empty.</p>

  return (
    <div className={styles.list}>
      {order.map((id) => {
        const o = objects[id]
        return (
          <button
            key={id}
            className={styles.item}
            data-active={selection.includes(id) || undefined}
            onClick={(e) => (e.ctrlKey || e.metaKey ? toggleSelected(id) : select([id]))}
          >
            <span className={styles.itemSwatch} style={{ background: o.color }} />
            <span className={styles.itemName}>{o.name}</span>
            <span className={styles.itemTag}>{LABELS[o.type]}</span>
          </button>
        )
      })}
    </div>
  )
}
