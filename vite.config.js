import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` keeps asset paths relative so the build can be served from any sub-path.
export default defineConfig({
  plugins: [react()],
  base: './',
})
