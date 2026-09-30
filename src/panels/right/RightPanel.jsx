import { useStore } from '../../state/store'
import { Tabs } from '../common/Controls'
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

/** Right properties panel. */
export default function RightPanel() {
  const tab = useStore((s) => s.ui.rightTab)
  const setTab = useStore((s) => s.setRightTab)
  const hasSelection = useStore((s) => s.selection.length > 0)

  return (
    <aside className={`${styles.panel} no-select`}>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
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
