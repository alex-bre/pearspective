import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { geometryFor } from '../model/geometry'
import { FINISH } from '../model/objects'
import { HANDLES } from '../model/transform'

// Scene colours per theme (from the design reference). WebGL can't read the CSS
// tokens, so the scene keeps its own copy.
const SCENE_COLORS = {
  light: { bg: 0xe9e8e0, ground: 0xfbfaf5, grid: 0xe0ded3, gridStrong: 0xc9c6b8, edge: 0xb0ad9c, guide: 0xd0782a, align: 0x5f7d17, sel: 0x5f7d17, ax: 0xc8553d, az: 0x3d6fb0 },
  dark: { bg: 0x23241e, ground: 0x2a2b24, grid: 0x34362d, gridStrong: 0x464a3c, edge: 0x5d604f, guide: 0xeea04f, align: 0xb3cd4c, sel: 0xb3cd4c, ax: 0xe0735c, az: 0x6d9be0 },
}

// Where the camera looks from, per named view. Top and bottom lean a hair toward
// +Z so the orbit controls keep a defined "up" (screen-up is then −Z, north).
const VIEW_DIRS = Object.fromEntries(
  Object.entries({
    home: [0.62, 0.55, 0.78],
    top: [0, 1, 1e-4],
    bottom: [0, -1, 1e-4],
    front: [0, 0, 1],
    back: [0, 0, -1],
    right: [1, 0, 0],
    left: [-1, 0, 0],
  }).map(([k, v]) => [k, new THREE.Vector3(...v).normalize()]),
)
const FOV = 38
const TWEEN_MS = 450
const DEG = Math.PI / 180
const HANDLE_PX = 9 // on-screen size of a resize handle
const ALIGN_EPS = 1e-4 // m — edges this close count as aligned
const _v = new THREE.Vector3()
const _up = new THREE.Vector3()

/**
 * The three.js side of the viewport. It owns no editor state: `sync(state)`
 * makes the scene match the store, and everything else reads the scene or
 * draws transient feedback (guides, label) for the input layer.
 *
 * Two cameras share one orbit: perspective and orthographic. "Zoom level" is
 * what they have in common — 1 is the home framing — so switching keeps the
 * view the same size. `label` is the readout element; `onZoom(percent)` hears
 * zoom changes.
 */
export function createEngine(host, { label, onZoom }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const canvas = renderer.domElement
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none'
  host.prepend(canvas)

  const scene = new THREE.Scene()
  const persp = new THREE.PerspectiveCamera(FOV, 1, 0.01, 1000)
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1000)
  let camera = persp // the active one
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.14
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
  controls.addEventListener('start', () => (tween = null)) // the user takes over mid-flight

  // Rotate mode's rings. The input layer listens to its events.
  const gizmo = new TransformControls(camera, canvas)
  gizmo.setMode('rotate')
  gizmo.setSize(0.85)
  scene.add(gizmo.getHelper())

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a78, 1.15))
  const sun = new THREE.DirectionalLight(0xffffff, 1.7)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  const fill = new THREE.DirectionalLight(0xffffff, 0.35)
  scene.add(sun, fill)

  const env = new THREE.Group() // ground, grid, playground edge
  const world = new THREE.Group() // one mesh per object, nothing else
  const outlines = new THREE.Group() // selection boxes
  const guides = new THREE.Group() // move guides
  const handles = new THREE.Group() // resize handles, placed on the selected object
  scene.add(env, world, outlines, guides, handles)

  const meshes = new Map() // object id → mesh
  const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
  const outlineMat = new THREE.LineBasicMaterial({ depthTest: false, transparent: true })
  const handleGeo = new THREE.BoxGeometry(1, 1, 1)
  const handleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true })
  for (const h of HANDLES) {
    const m = new THREE.Mesh(handleGeo, handleMat)
    m.userData.handle = h
    m.renderOrder = 999
    const edge = new THREE.LineSegments(outlineGeo, outlineMat)
    edge.renderOrder = 1000
    m.add(edge)
    handles.add(m)
  }
  handles.visible = false

  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  let envKey = ''
  let framed = false
  let lastView = null
  let colors = SCENE_COLORS.light
  let playground = { w: 10, d: 10 }
  let labelIds = null
  let tween = null
  let lastZoom = null

  /* ---- environment ---- */

  function disposeChildren(group) {
    for (const c of group.children) {
      c.geometry.dispose()
      c.material.dispose()
    }
    group.clear()
  }

  // Lines sit this far above the ground so they never z-fight with it.
  const lift = () => Math.max(playground.w, playground.d) * 2.5e-4

  function buildEnv(settings) {
    disposeChildren(env)
    const C = colors
    const { w: W, d: D } = playground
    const S = Math.max(W, D)
    scene.background = new THREE.Color(C.bg)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: C.ground, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    env.add(ground)

    // pairs: [[x, z], [x, z], …] — every two points make one segment.
    const segments = (pairs, color, y, opacity = 1) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pairs.map(([x, z]) => new THREE.Vector3(x, y, z)))
      env.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })))
    }

    if (settings.showGrid) {
      // ponytail: caps the grid at ~1000 lines a side; a finer grid still snaps, it just isn't drawn.
      const step = Math.max(settings.grid, S / 1000)
      const fine = []
      const strong = []
      for (let i = 0; i * step <= W / 2 + 1e-9; i++) {
        for (const x of i ? [i * step, -i * step] : [0]) (i % 5 ? fine : strong).push([x, -D / 2], [x, D / 2])
      }
      for (let i = 0; i * step <= D / 2 + 1e-9; i++) {
        for (const z of i ? [i * step, -i * step] : [0]) (i % 5 ? fine : strong).push([-W / 2, z], [W / 2, z])
      }
      segments(fine, C.grid, lift())
      segments(strong, C.gridStrong, lift())
      segments([[-W / 2, 0], [W / 2, 0]], C.ax, lift() * 1.6, 0.7)
      segments([[0, -D / 2], [0, D / 2]], C.az, lift() * 1.6, 0.7)
    }

    const [a, b, c, d] = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]]
    segments([a, b, b, c, c, d, d, a], C.edge, lift() * 2)

    // Light, shadows and clipping planes all scale with the playground.
    sun.position.set(0.7 * S, 1.4 * S, 0.9 * S)
    fill.position.set(-S, 0.6 * S, -0.6 * S)
    Object.assign(sun.shadow.camera, { left: -1.6 * S, right: 1.6 * S, top: 1.6 * S, bottom: -1.6 * S, near: 0.05 * S, far: 4.5 * S })
    sun.shadow.camera.updateProjectionMatrix()
    persp.near = S / 500
    persp.far = S * 50
    persp.updateProjectionMatrix()
    updateOrtho()

    outlineMat.color.set(C.sel)
  }

  /* ---- camera ---- */

  const homeDist = () => Math.max(playground.w, playground.d) * 1.95
  // An orthographic camera only has to stand clear of the scene; its distance doesn't change the picture.
  const orthoBack = () => Math.max(playground.w, playground.d) * 10

  // At zoom 1 the orthographic frustum shows what the perspective camera shows at home distance.
  function updateOrtho() {
    const hb = homeDist() * Math.tan((FOV / 2) * DEG)
    Object.assign(ortho, { left: -hb * persp.aspect, right: hb * persp.aspect, top: hb, bottom: -hb, near: 0, far: orthoBack() * 2 })
    ortho.updateProjectionMatrix()
  }

  /** 1 is the home framing; bigger is closer. */
  const zoomLevel = () => (camera === ortho ? ortho.zoom : homeDist() / camera.position.distanceTo(controls.target))
  const lookDir = () => camera.position.clone().sub(controls.target).normalize()

  /** Put the active camera at `dir` from `target`, at zoom level `zoom`. */
  function place(target, dir, zoom) {
    controls.target.copy(target)
    if (camera === ortho) {
      ortho.position.copy(target).addScaledVector(dir, orthoBack())
      ortho.zoom = zoom
      ortho.updateProjectionMatrix()
    } else {
      persp.position.copy(target).addScaledVector(dir, homeDist() / zoom)
    }
    controls.update()
  }

  function setProjection(projection) {
    const next = projection === 'orthographic' ? ortho : persp
    if (next === camera) return
    const [target, dir, zoom] = [controls.target.clone(), lookDir(), zoomLevel()]
    camera = next
    controls.object = camera
    gizmo.camera = camera
    place(target, dir, zoom)
  }

  /** Glide to a framing: the direction turns along the sphere, zoom scales evenly. */
  function flyTo(target, dir, zoom) {
    const d0 = lookDir()
    tween = {
      t0: controls.target.clone(),
      t1: target.clone(),
      d0,
      turn: new THREE.Quaternion().setFromUnitVectors(d0, dir),
      z0: zoomLevel(),
      z1: zoom,
      start: performance.now(),
    }
  }
  function stepTween() {
    const k = Math.min(1, (performance.now() - tween.start) / TWEEN_MS)
    const e = 1 - (1 - k) ** 3 // ease out
    const dir = tween.d0.clone().applyQuaternion(new THREE.Quaternion().slerp(tween.turn, e))
    place(tween.t0.clone().lerp(tween.t1, e), dir, tween.z0 * (tween.z1 / tween.z0) ** e)
    if (k === 1) tween = null
  }

  const zoomBy = (factor) => flyTo(controls.target, lookDir(), zoomLevel() * factor)

  /** Frame the playground and every object, keeping the current direction. */
  function fit() {
    const { w: W, d: D } = playground
    const box = new THREE.Box3(new THREE.Vector3(-W / 2, 0, -D / 2), new THREE.Vector3(W / 2, 0, D / 2))
    for (const mesh of meshes.values()) box.union(boxOf(mesh))
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const half = Math.atan(Math.tan((FOV / 2) * DEG) * Math.min(1, persp.aspect)) // the narrower half-angle
    flyTo(sphere.center, lookDir(), homeDist() / ((sphere.radius / Math.sin(half)) * 1.05))
  }

  /* ---- store → scene ---- */

  function sync({ document: doc, selection, settings, ui }) {
    const key = [doc.playground.w, doc.playground.d, settings.grid, settings.showGrid, ui.theme].join('|')
    if (key !== envKey) {
      envKey = key
      colors = SCENE_COLORS[ui.theme]
      playground = doc.playground
      buildEnv(settings)
      if (!framed) {
        framed = true
        lastView = ui.view
        place(new THREE.Vector3(), VIEW_DIRS.home, 1)
      }
    }

    // Projection first, so a view change glides in the camera it ends in.
    setProjection(ui.projection)
    if (ui.view !== lastView) {
      lastView = ui.view
      if (ui.view) flyTo(new THREE.Vector3(), VIEW_DIRS[ui.view], 1)
    }

    for (const [id, mesh] of meshes) {
      if (doc.objects[id]) continue
      if (gizmo.object === mesh) gizmo.detach()
      world.remove(mesh)
      mesh.material.dispose() // geometry is shared — see model/geometry
      meshes.delete(id)
    }

    for (const id of doc.order) {
      const o = doc.objects[id]
      let mesh = meshes.get(id)
      if (!mesh) {
        mesh = new THREE.Mesh(geometryFor(o), new THREE.MeshStandardMaterial())
        mesh.castShadow = mesh.receiveShadow = true
        mesh.userData.id = id
        world.add(mesh)
        meshes.set(id, mesh)
      }
      // Immer keeps an untouched object's reference, so this skips all but the changed ones.
      if (mesh.userData.src === o) continue
      mesh.userData.src = o
      mesh.position.fromArray(o.position)
      mesh.rotation.set(o.rotation[0] * DEG, o.rotation[1] * DEG, o.rotation[2] * DEG)
      mesh.scale.fromArray(o.size)
      const m = mesh.material
      const f = FINISH[o.finish]
      m.color.set(o.color)
      m.roughness = f.r
      m.metalness = f.m
      m.opacity = o.opacity
      if (m.transparent !== o.opacity < 1) {
        m.transparent = o.opacity < 1
        m.needsUpdate = true
      }
    }

    // Selection boxes follow the object's own axes, so a rotated object keeps a snug box.
    outlines.clear()
    for (const id of selection) {
      const mesh = meshes.get(id)
      if (!mesh) continue
      const box = new THREE.LineSegments(outlineGeo, outlineMat)
      box.position.copy(mesh.position)
      box.quaternion.copy(mesh.quaternion)
      box.scale.copy(mesh.scale)
      box.renderOrder = 998
      outlines.add(box)
    }

    // One selected object: resize handles in Select mode, rotate rings in Rotate mode.
    const single = selection.length === 1 ? meshes.get(selection[0]) : null
    handles.visible = ui.mode === 'select' && !!single
    if (handles.visible) {
      handles.position.copy(single.position)
      handles.quaternion.copy(single.quaternion)
      for (const h of handles.children) h.position.fromArray(h.userData.handle.at).multiply(single.scale)
    }
    const target = ui.mode === 'rotate' ? single : null
    if ((gizmo.object ?? null) !== target) target ? gizmo.attach(target) : gizmo.detach()
    gizmo.setRotationSnap(settings.snap ? 15 * DEG : null)
  }

  /* ---- picking ---- */

  function aim(e) {
    const r = canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
  }

  /** Id of the object under the pointer, or null. */
  function pickObject(e) {
    aim(e)
    const hit = raycaster.intersectObjects(world.children, false)[0]
    return hit ? hit.object.userData.id : null
  }

  /** The resize handle under the pointer (an entry of HANDLES), or null. */
  function pickHandle(e) {
    if (!handles.visible) return null
    aim(e)
    const hit = raycaster.intersectObjects(
      handles.children.filter((h) => h.visible),
      false,
    )[0]
    return hit ? hit.object.userData.handle : null
  }

  /** Where the pointer meets the plane through `point` with `normal`, or null. */
  function rayOnPlane(e, point, normal) {
    aim(e)
    return raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point), new THREE.Vector3())
  }

  /** Where the pointer meets the ground as [x, z], or null above the horizon. */
  function groundPoint(e) {
    aim(e)
    const p = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3())
    return p && [p.x, p.z]
  }

  const viewDir = () => camera.getWorldDirection(new THREE.Vector3())
  const gizmoHovered = () => gizmo.object != null && gizmo.axis != null

  /* ---- transient feedback ---- */

  const boxOf = (mesh) => new THREE.Box3().setFromObject(mesh, true)

  /**
   * Guides for objects being moved: their footprint, dashed extensions to the
   * playground edge, a drop line when lifted, and alignment lines where an edge
   * or centre lines up with another object.
   */
  function showGuides(ids) {
    disposeChildren(guides)
    const C = colors
    const { w: W, d: D } = playground
    const S = Math.max(W, D)
    const y = lift() * 3
    const box = new THREE.Box3()
    for (const id of ids) if (meshes.has(id)) box.union(boxOf(meshes.get(id)))
    if (box.isEmpty()) return
    const { min, max } = box
    const cx = (min.x + max.x) / 2
    const cz = (min.z + max.z) / 2

    const add = (points, material) => {
      const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), material)
      line.computeLineDistances()
      line.renderOrder = 997
      guides.add(line)
    }
    const flat = (pairs) => pairs.map(([x, z]) => new THREE.Vector3(x, y, z))
    const solid = (color) => new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })
    const dashed = () =>
      new THREE.LineDashedMaterial({ color: C.guide, dashSize: S * 0.015, gapSize: S * 0.0125, depthTest: false, transparent: true, opacity: 0.6 })

    add(flat([[min.x, min.z], [max.x, min.z], [max.x, min.z], [max.x, max.z], [max.x, max.z], [min.x, max.z], [min.x, max.z], [min.x, min.z]]), solid(C.guide))
    add(
      flat([
        [min.x, -D / 2], [min.x, min.z], [min.x, max.z], [min.x, D / 2],
        [max.x, -D / 2], [max.x, min.z], [max.x, max.z], [max.x, D / 2],
        [-W / 2, min.z], [min.x, min.z], [max.x, min.z], [W / 2, min.z],
        [-W / 2, max.z], [min.x, max.z], [max.x, max.z], [W / 2, max.z],
      ]),
      dashed(),
    )
    if (min.y > S * 0.0025) add([new THREE.Vector3(cx, min.y, cz), new THREE.Vector3(cx, 0, cz)], dashed())

    const aligned = []
    const reach = S * 0.03
    for (const [id, mesh] of meshes) {
      if (ids.includes(id)) continue
      const b = boxOf(mesh)
      for (const v of [min.x, cx, max.x]) {
        for (const u of [b.min.x, (b.min.x + b.max.x) / 2, b.max.x]) {
          if (Math.abs(v - u) < ALIGN_EPS) aligned.push([v, Math.min(min.z, b.min.z) - reach], [v, Math.max(max.z, b.max.z) + reach])
        }
      }
      for (const v of [min.z, cz, max.z]) {
        for (const u of [b.min.z, (b.min.z + b.max.z) / 2, b.max.z]) {
          if (Math.abs(v - u) < ALIGN_EPS) aligned.push([Math.min(min.x, b.min.x) - reach, v], [Math.max(max.x, b.max.x) + reach, v])
        }
      }
    }
    if (aligned.length) add(flat(aligned), solid(C.align))
  }

  const clearGuides = () => disposeChildren(guides)

  /** A small readout above the objects `ids` (placed every frame, so it follows the camera). */
  function showLabel(text, ids) {
    label.textContent = text
    label.style.display = 'block'
    labelIds = ids
    placeLabel()
  }
  function hideLabel() {
    label.style.display = 'none'
    labelIds = null
  }
  function placeLabel() {
    const box = new THREE.Box3()
    for (const id of labelIds) if (meshes.has(id)) box.union(boxOf(meshes.get(id)))
    if (box.isEmpty()) return
    const p = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(camera)
    const x = ((p.x + 1) / 2) * canvas.clientWidth
    const y = ((1 - p.y) / 2) * canvas.clientHeight
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -150%)`
  }

  /* ---- lifecycle ---- */

  const resize = () => {
    const w = host.clientWidth
    const h = Math.max(host.clientHeight, 1)
    renderer.setSize(w, h, false)
    persp.aspect = w / h
    persp.updateProjectionMatrix()
    updateOrtho()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  let raf
  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (tween) stepTween()
    controls.update()
    // Handles keep a constant size on screen, whatever the zoom or projection.
    // One whose drag plane is edge-on to the view can't be dragged, so it hides:
    // the top handle when looking along the object's up axis, the corners when
    // looking across its base.
    if (handles.visible) {
      const px = HANDLE_PX / Math.max(canvas.clientHeight, 1)
      const along = Math.abs(camera.getWorldDirection(_v).dot(_up.set(0, 1, 0).applyQuaternion(handles.quaternion)))
      for (const h of handles.children) {
        h.visible = h.userData.handle.dir[1] ? along < 0.98 : along > 0.05
        const span = camera === ortho ? (ortho.top - ortho.bottom) / ortho.zoom : 2 * Math.tan((FOV / 2) * DEG) * h.getWorldPosition(_v).distanceTo(persp.position)
        h.scale.setScalar(span * px)
      }
    }
    if (labelIds) placeLabel()
    const zoom = Math.round(zoomLevel() * 100)
    if (zoom !== lastZoom) {
      lastZoom = zoom
      onZoom?.(zoom)
    }
    renderer.render(scene, camera)
  }
  loop()

  function dispose() {
    cancelAnimationFrame(raf)
    ro.disconnect()
    controls.dispose()
    gizmo.dispose()
    disposeChildren(env)
    disposeChildren(guides)
    for (const mesh of meshes.values()) mesh.material.dispose()
    for (const x of [outlineGeo, outlineMat, handleGeo, handleMat]) x.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }

  return {
    canvas,
    controls,
    gizmo,
    sync,
    pickObject,
    pickHandle,
    rayOnPlane,
    groundPoint,
    viewDir,
    gizmoHovered,
    showGuides,
    clearGuides,
    showLabel,
    hideLabel,
    zoomBy,
    fit,
    dispose,
  }
}
