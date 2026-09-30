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
  const ready = selection.length === 2

  return (
    <Group title="Boolean">
      <div className={styles.opList}>
        {OPS.map(({ op, label, math, Icon }) => (
          <button key={op} className={styles.op} disabled={!ready}>
            <Icon size={16} />
            <span className={styles.opLabel}>{label}</span>
            <span className={styles.opMath}>{math}</span>
          </button>
        ))}
      </div>
      <Hint>
        {ready
          ? `A = ${objects[selection[0]].name}, B = ${objects[selection[1]].name}`
          : 'Select two objects (Shift-click) to combine them. The first one picked is A.'}
      </Hint>
    </Group>
  )
}
