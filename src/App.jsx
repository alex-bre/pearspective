import { useEffect } from 'react'
import { useThemeEffect } from './state/useTheme'
import { initHistory } from './state/history'
import { initResponsiveLayout } from './state/responsiveLayout'
import { useStore } from './state/store'
import { useShortcuts } from './useShortcuts'
import TopBar from './panels/TopBar'
import LeftPanel from './panels/left/LeftPanel'
import RightPanel from './panels/right/RightPanel'
import StatusBar from './panels/StatusBar'
import Viewport from './viewport/Viewport'
import styles from './App.module.css'

export default function App() {
  useThemeEffect()
  useShortcuts()
  useEffect(initHistory, []) // returns its unsubscribe, so StrictMode's double mount records once
  useEffect(() => initResponsiveLayout(), [])

  const leftCollapsed = useStore((s) => s.ui.leftCollapsed)
  const rightCollapsed = useStore((s) => s.ui.rightCollapsed)

  const cls = [styles.app, leftCollapsed && styles.leftCollapsed, rightCollapsed && styles.rightCollapsed]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <TopBar />
      <LeftPanel />
      <Viewport />
      <RightPanel />
      <StatusBar />
    </div>
  )
}
