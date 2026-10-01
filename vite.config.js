import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` keeps asset paths relative so the build can be served from any sub-path.
export default defineConfig({
  plugins: [react()],
  base: './',
  // The first paint needs three.js (~700 kB minified); loaders, exporters and CSG
  // are split off with import(). Warn only if the main chunk grows well past that.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    // three-bvh-csg has no `exports` map, so tests would load its CJS build and,
    // through it, a second (CJS) copy of three. Use its ESM source, as the app does.
    alias: { 'three-bvh-csg': 'three-bvh-csg/src/index.js' },
  },
})
