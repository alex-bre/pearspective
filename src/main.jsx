import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BUILD_LABEL } from './buildInfo'
import './styles/global.css'
import './styles/theme.css'
import './styles/layout.css'

// So a user can read back exactly which build they hit a bug on.
console.info(`Build ${BUILD_LABEL}`)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
