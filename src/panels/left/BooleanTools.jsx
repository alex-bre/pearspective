import { SquaresUnite, SquaresSubtract, SquaresIntersect } from 'lucide-react'
import { useStore } from '../../state/store'
import { Group, Hint } from '../common/Controls'
import styles from './LeftPanel.module.css'

const OPS = [
  { op: 'union', label: 'Union', math: 'A ∪ B', Icon: SquaresUnite },
  { op: 'subtract', label: 'Subtract', math: 'A − B', Icon: SquaresSubtract },
  { op: 'intersect', label: 'Intersect', math: 'A ∩ B', Icon: SquaresIntersect },
]

export default function BooleanTools() {
  const selection = useStore((s) => s.selection)
  const objects = useStore((s) => s.document.objects)
  const busy = useStore((s) => s.ui.busy)
  const booleanSelected = useStore((s) => s.booleanSelected)
  const ready = selection.length === 2 && !busy

  return (
    <Group title="Boolean">
      <div className={styles.opList}>
        {OPS.map(({ op, label, math, Icon }) => (
          <button key={op} className={styles.op} disabled={!ready} onClick={() => booleanSelected(op)}>
            <Icon size={16} />
            <span className={styles.opLabel}>{label}</span>
            <span className={styles.opMath}>{math}</span>
          </button>
        ))}
      </div>
      <Hint>
        {selection.length === 2
          ? `A = ${objects[selection[0]].name}, B = ${objects[selection[1]].name}`
          : 'Select two objects (Ctrl-click) to combine them. The first one picked is A.'}
      </Hint>
    </Group>
  )
}
