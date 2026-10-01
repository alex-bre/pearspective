import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useStore } from '../../state/store'
import { PanelToggle, Tabs } from '../common/Controls'
import GeneralTab from './tabs/GeneralTab'
import ArrangeTab from './tabs/ArrangeTab'
import ObjectsTab from './tabs/ObjectsTab'
import StyleTab from './tabs/StyleTab'
import styles from './RightPanel.module.css'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'arrange', label: 'Arrange' },
  { id: 'style', label: 'Style' },
  { id: 'objects', label: 'Objects' },
]

/** Right properties panel. Collapses to a thin rail with an expand button. */
export default function RightPanel() {
  const tab = useStore((s) => s.ui.rightTab)
  const setTab = useStore((s) => s.setRightTab)
  const hasSelection = useStore((s) => s.selection.length > 0)
  const collapsed = useStore((s) => s.ui.rightCollapsed)
  const toggle = useStore((s) => s.toggleRightPanel)

  if (collapsed) {
    return (
      <aside className={`${styles.rail} no-select`}>
        <PanelToggle Icon={PanelRightOpen} title="Expand properties panel" onClick={toggle} />
      </aside>
    )
  }

  return (
    <aside className={`${styles.panel} no-select`}>
      <Tabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
        start={<PanelToggle Icon={PanelRightClose} title="Collapse properties panel" onClick={toggle} />}
      />
      <div className={styles.content}>
        {tab === 'general' && <GeneralTab />}
        {tab === 'arrange' && (hasSelection ? <ArrangeTab /> : <NothingSelected />)}
        {tab === 'style' && (hasSelection ? <StyleTab /> : <NothingSelected />)}
        {tab === 'objects' && <ObjectsTab />}
      </div>
    </aside>
  )
}

function NothingSelected() {
  return (
    <div className={styles.nothing}>
      <span className={styles.nothingTitle}>Nothing selected</span>
      <span className={styles.nothingText}>Click an object in the viewport or pick one from the Objects tab.</span>
    </div>
  )
}
