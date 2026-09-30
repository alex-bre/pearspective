import { useEffect } from 'react'
import { useThemeEffect } from './state/useTheme'
import { initHistory } from './state/history'
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

  return (
    <div className={styles.app}>
      <TopBar />
      <LeftPanel />
      <Viewport />
      <RightPanel />
      <StatusBar />
    </div>
  )
}
