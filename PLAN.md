# Pearspective — implementation plan

A web-based 3D editor. The code structure and feel come from `../lulogo`,
which has the same `src/` tree as `../infinite-canvas-editor`.

## Approach

Build it in lulogo's structure:

- React 19 + Vite
- a zustand + immer store
- CSS modules
- lucide-react icons
- vitest

The key structural rule: **the store's document holds the state, and the
three.js scene only draws it.** The meshes are never the state. With the
document in charge, lulogo's snapshot undo (`state/history.js`) works almost
unchanged.

## Decisions

1. **Plain three.js, not react-three-fiber.** One `engine.js` owns the
   renderer, camera and controls, and exposes `sync(document, selection)`.
2. **Unit geometry; the object's size is its scale.** Every primitive is a
   1×1×1 geometry, and `size` becomes `mesh.scale`. Size fields, resize
   snapping, imported meshes and boolean results then share one code path:
   normalize any geometry to a unit box once.
3. **Mesh geometry lives outside the store.** It sits in a read-only registry
   keyed by `meshId`; the document stores only the `meshId`. Undo snapshots stay
   tiny, and duplicates share the geometry. Known limit: the registry is never
   freed during a session.
4. **Select mode handles both move and resize.**
   - Dragging an object's body moves it along the ground.
   - Handles on the selection box resize it: 4 footprint corners change width
     and depth, and 1 top handle changes height.
   - The opposite side stays anchored during a resize. Handles sit on the
     object's own box, so a rotated object resizes along its own axes.
   - Rotating is a separate mode: three.js TransformControls rings with 15°
     snap.
   - The mode toolbar is **Select | Rotate**.
5. **Meters are the unit.**
   - Internal values are in meters, with Y pointing up.
   - The General tab has a Units selector (m / cm / mm), default **m**. Only
     what the fields display changes; the document is always stored in meters.
   - GLB is exported and imported in meters, as the glTF spec defines, so no
     scaling is needed.
   - STL files carry no unit, and slicers read them as mm. STL is therefore
     exported in **mm**, Z-up, and imported as mm.
   - Defaults: a 10 × 10 m playground, a 0.5 m grid, and 1 m shapes.
6. **Licence: AGPL-3.0-only**, like lulogo.
7. **Two cameras, one orbit.**
   - Axis views (Top / Front / Right / Bottom / Back / Left) are
     **orthographic**; Home is the default 3/4 view in **perspective**.
   - A Persp | Ortho toggle (key 5) switches projection in place. "Zoom level"
     (1 = the home framing) is shared by both cameras, so a switch keeps the
     view the same size.
   - A resize handle whose drag plane is edge-on to the view is hidden (the top
     handle in Top view, the corners in side views).

## Structure

```
pearspective/
  index.html                 theme script that runs before first paint, fonts
  vite.config.js
  LICENSE                    AGPL-3.0
  public/favicon.svg         pear mark
  src/
    main.jsx, App.jsx, App.module.css   grid: top / left · viewport · right / status
    styles/  theme.css (reference tokens, --x/--y/--z axis colours), layout.css, global.css
    state/
      store.js         document, selection, ui, settings + actions
      history.js       from lulogo (one undo step per drag)
      useTheme.js      from lulogo
      responsiveLayout.js  from lulogo: collapse the side panels on narrow viewports
    model/
      units.js         m / cm / mm conversion for display
      objects.js       createObject, LABELS, SWATCHES, FINISH, freeSpot
      geometry.js      unit primitives, mesh registry, normalizeGeometry
      transform.js     world boxes, groundY, resize handles and resizeTo
      snap.js          snapValue, clampToPlayground
      boolean.js       bake → three-bvh-csg → normalize (loaded on demand)
    viewport/
      Viewport.jsx     canvas host + overlays: mode bar, view panel, zoom bar, measure label
      engine.js        renderer, camera, orbit/transform controls, lights, ground/grid, sync, flyTo, fit
      input.js         pointer + drop input: picking, move drag, resize handles
    panels/
      TopBar.jsx       logo, undo/redo, Import, Export ▾, theme
      StatusBar.jsx    mode hint or progress message · object counts
      common/Controls.jsx   from lulogo
      left/LeftPanel.jsx    tabs: Shapes | Boolean
      left/ShapeLibrary.jsx, left/BooleanTools.jsx
      right/RightPanel.jsx  tabs: General | Arrange | Style | Objects
      right/tabs/GeneralTab.jsx, ArrangeTab.jsx, StyleTab.jsx, ObjectsTab.jsx
    io/  download.js, exportScene.js, importFiles.js
    useShortcuts.js
    __tests__/
```

Files get created in the phase that first needs them, not earlier.

**Dependencies:** `react react-dom zustand immer lucide-react three
 three-bvh-csg three-mesh-bvh`. **Dev:**
`vite @vitejs/plugin-react vitest`.
Loaders, exporters and CSG are loaded with `import()`.

## Data model

```js
document = {
  playground: { w: 10, d: 10 },                    // m, undoable
  order: ['o1', 'o2'],
  objects: {
    o1: { id, type: 'cube'|'sphere'|'cylinder'|'cone'|'mesh', name,
          position: [x, y, z] /* m */, rotation: [rx, ry, rz] /* deg */, size: [w, h, d] /* m */,
          color: '#a9c43f', finish: 'matte'|'satin'|'gloss', opacity: 1, meshId? }
  }
}
settings  = { unit: 'm', grid: 0.5, showGrid: true, snap: true, snapGround: true }  // not undoable
selection = ['o2', 'o1']        // order matters: the first one picked is boolean A
ui = { mode: 'select'|'rotate', leftTab, rightTab, view, theme, busy }
```

## Phases

The app runs at the end of every phase.

- [x] **1. Shell.**
  - Scaffold, theme tokens and grid layout.
  - Top bar, left and right panels with tabs, status bar, light/dark toggle.
  - The General tab is wired to the settings (units, playground, grid,
    snapping).
  - The viewport overlays (mode bar, view panel, zoom bar) render but have no
    3D view behind them yet.
- [x] **2. Scene and selection.**
  - Ground, grid (every 5th line stronger), X/Z axis lines, playground edge,
    lights and shadows.
  - `sync()` keeps the scene in step with the document.
  - Add shapes by clicking a tile (placed in a free spot) or by dragging a tile
    onto the ground.
  - Click, Shift-click, click on empty space and Esc select or clear; Delete
    removes the selection.
  - Orbit by dragging empty space, pan with right-drag, zoom with the wheel.
  - Selection box, Objects tab, and the right panel switches General → Arrange
    on select. The Arrange tab has the name field so far.
- [x] **3. Move and guides.**
  - Drag the selection along the ground: it snaps to the grid, stays inside
    the playground, and snaps to the ground (bottom of the box at y = 0, rotated
    objects included).
  - Guides while dragging:
    - the footprint outline
    - dashed extensions to the playground edge
    - a drop line when the object is lifted
    - alignment lines when an edge or centre matches another object
  - A floating position label and grab/grabbing cursors.
- [x] **4. Resize and rotate.**
  - Resize handles (decision 4) with grid snap and a live `W × D × H` label.
  - Rotate mode with 15° snap.
  - Arrange tab: name, position (Y locked while snap to ground is on), size,
    rotation, and Drop to ground / Center / Duplicate / Delete.
  - Shortcuts: V / R switch mode, Ctrl+D duplicates.
- [x] **5. Camera.**
  - View panel: Top / Front / Right / Bottom / Back / Left / Home, each with a
    short animated move. Keys 7 / 1 / 3 / 0.
  - Orthographic projection (decision 7): axis views use it, Persp | Ortho
    toggle and key 5.
  - Zoom −, %, + and Fit. Orbiting, panning or scrolling by hand leaves the
    named view.
- [x] **6. Style tab.**
  - Swatches, colour picker with hex field, finish, opacity.
  - Changes apply to every selected object.
- [x] **7. Undo/redo.**
  - lulogo `history.js`, with one batch per drag, resize or gizmo turn.
  - Continuous controls (opacity slider, colour picker) coalesce: changes with
    the same key less than a second apart are one step.
  - Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, and the top-bar buttons.
- [x] **8. Boolean.**
  - Enabled when exactly 2 objects are selected; a hint shows which is A and
    which is B.
  - Union / Subtract / Intersect replace both objects with one `mesh` object,
    as one undo step. The result takes A's place in the list and keeps A's
    rotation and style.
  - Errors show in the status bar.
- [x] **9. Import/export.**
  - Import from the button or by dropping files on the viewport:
    - STL is converted from mm and from Z-up to Y-up.
    - GLB is baked into one mesh, in meters, with the first material's colour.
    - Imported objects are placed in a free spot on the ground.
  - Export ▾:
    - STL: binary, mm, Z-up.
    - GLB: with colours, in meters.
- [x] **10. Tests and polish.**
  - Model tests: cube − cube bounding box, normalize. (Snap, clamp, free spot,
    groundY and resize are covered already.)
  - IO test: STL round trip.
  - Free spots take an object's width × depth, so a long import fits beside
    another instead of on top of it.

## Deferred (not requested; add when needed)

- **Autosave.** Mesh geometry would need to be serialized, and stored in
  IndexedDB, since STL imports quickly exceed localStorage's 5 MB.
- **Resizing several objects at once.** Handles appear for a single selection.
- **Snapping objects to each other** (lulogo `objectSnap.js`). Alignment guides
  show exact matches only.
- **Source link / About dialog.** AGPL §13 requires offering the source to
  network users, so add it once the app is hosted and has a repo URL.
- **Also from lulogo:** THIRD-PARTY-NOTICES, self-hosted fonts.
