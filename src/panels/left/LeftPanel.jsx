import { useStore } from '../../state/store'
import { Tabs } from '../common/Controls'
import ShapeLibrary from './ShapeLibrary'
import BooleanTools from './BooleanTools'
import styles from './LeftPanel.module.css'

const TABS = [
  { id: 'shapes', label: 'Shapes' },
  { id: 'boolean', label: 'Boolean' },
]

/** Left tool panel: shapes to add, and boolean operations on the selection. */
export default function LeftPanel() {
  const tab = useStore((s) => s.ui.leftTab)
  const setTab = useStore((s) => s.setLeftTab)

  return (
    <aside className={`${styles.panel} no-select`}>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <div className={styles.content}>{tab === 'shapes' ? <ShapeLibrary /> : <BooleanTools />}</div>
    </aside>
  )
}
