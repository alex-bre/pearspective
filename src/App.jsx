import { useThemeEffect } from './state/useTheme'
import TopBar from './panels/TopBar'
import LeftPanel from './panels/left/LeftPanel'
import RightPanel from './panels/right/RightPanel'
import StatusBar from './panels/StatusBar'
import Viewport from './viewport/Viewport'
import styles from './App.module.css'

export default function App() {
  useThemeEffect()

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
