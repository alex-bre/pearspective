import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useStore } from '../../state/store'
import { PanelToggle, Tabs } from '../common/Controls'
import ShapeLibrary from './ShapeLibrary'
import BooleanTools from './BooleanTools'
import styles from './LeftPanel.module.css'

const TABS = [
  { id: 'shapes', label: 'Shapes' },
  { id: 'boolean', label: 'Boolean' },
]

/**
 * Left tool panel: shapes to add, and boolean operations on the selection.
 * Collapses to a thin rail with an expand button.
 */
export default function LeftPanel() {
  const tab = useStore((s) => s.ui.leftTab)
  const setTab = useStore((s) => s.setLeftTab)
  const collapsed = useStore((s) => s.ui.leftCollapsed)
  const toggle = useStore((s) => s.toggleLeftPanel)

  if (collapsed) {
    return (
      <aside className={`${styles.rail} no-select`}>
        <PanelToggle Icon={PanelLeftOpen} title="Expand tools panel" onClick={toggle} />
      </aside>
    )
  }

  return (
    <aside className={`${styles.panel} no-select`}>
      <Tabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
        end={<PanelToggle Icon={PanelLeftClose} title="Collapse tools panel" onClick={toggle} />}
      />
      <div className={styles.content}>{tab === 'shapes' ? <ShapeLibrary /> : <BooleanTools />}</div>
    </aside>
  )
}
