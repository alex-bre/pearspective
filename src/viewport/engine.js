import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { geometryFor } from '../model/geometry'
import { FINISH } from '../model/objects'

// Scene colours per theme (from the design reference). WebGL can't read the CSS
// tokens, so the scene keeps its own copy.
const SCENE_COLORS = {
  light: { bg: 0xe9e8e0, ground: 0xfbfaf5, grid: 0xe0ded3, gridStrong: 0xc9c6b8, edge: 0xb0ad9c, sel: 0x5f7d17, ax: 0xc8553d, az: 0x3d6fb0 },
  dark: { bg: 0x23241e, ground: 0x2a2b24, grid: 0x34362d, gridStrong: 0x464a3c, edge: 0x5d604f, sel: 0xb3cd4c, ax: 0xe0735c, az: 0x6d9be0 },
}

const HOME_DIR = new THREE.Vector3(0.62, 0.55, 0.78).normalize()
const DEG = Math.PI / 180

/**
 * The three.js side of the viewport. It owns no editor state: `sync(state)`
 * makes the scene match the store, and everything else only reads the scene.
 */
export function createEngine(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const canvas = renderer.domElement
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none'
  host.prepend(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.14
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }

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
  scene.add(env, world, outlines)

  const meshes = new Map() // object id → mesh
  const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
  const outlineMat = new THREE.LineBasicMaterial({ depthTest: false, transparent: true })
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  let envKey = ''
  let framed = false

  /* ---- environment ---- */

  function disposeChildren(group) {
    for (const c of group.children) {
      c.geometry.dispose()
      c.material.dispose()
    }
    group.clear()
  }

  function buildEnv({ w: W, d: D }, settings, C) {
    disposeChildren(env)
    scene.background = new THREE.Color(C.bg)
    const S = Math.max(W, D)
    const lift = S * 2.5e-4 // keeps lines above the ground without z-fighting

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
      segments(fine, C.grid, lift)
      segments(strong, C.gridStrong, lift)
      segments([[-W / 2, 0], [W / 2, 0]], C.ax, lift * 1.6, 0.7)
      segments([[0, -D / 2], [0, D / 2]], C.az, lift * 1.6, 0.7)
    }

    const [a, b, c, d] = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]]
    segments([a, b, b, c, c, d, d, a], C.edge, lift * 2)

    // Light, shadows and clipping planes all scale with the playground.
    sun.position.set(0.7 * S, 1.4 * S, 0.9 * S)
    fill.position.set(-S, 0.6 * S, -0.6 * S)
    Object.assign(sun.shadow.camera, { left: -1.6 * S, right: 1.6 * S, top: 1.6 * S, bottom: -1.6 * S, near: 0.05 * S, far: 4.5 * S })
    sun.shadow.camera.updateProjectionMatrix()
    camera.near = S / 500
    camera.far = S * 50
    camera.updateProjectionMatrix()

    outlineMat.color.set(C.sel)
  }

  function frameHome({ w, d }) {
    camera.position.copy(HOME_DIR).multiplyScalar(Math.max(w, d) * 1.95)
    controls.target.set(0, 0, 0)
    controls.update()
  }

  /* ---- store → scene ---- */

  function sync({ document: doc, selection, settings, ui }) {
    const key = [doc.playground.w, doc.playground.d, settings.grid, settings.showGrid, ui.theme].join('|')
    if (key !== envKey) {
      envKey = key
      buildEnv(doc.playground, settings, SCENE_COLORS[ui.theme])
      if (!framed) {
        framed = true
        frameHome(doc.playground)
      }
    }

    for (const [id, mesh] of meshes) {
      if (doc.objects[id]) continue
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

  /** Where the pointer meets the ground plane as [x, z], or null above the horizon. */
  function groundPoint(e) {
    aim(e)
    const p = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3())
    return p && [p.x, p.z]
  }

  /* ---- lifecycle ---- */

  const resize = () => {
    const w = host.clientWidth
    const h = Math.max(host.clientHeight, 1)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  let raf
  const loop = () => {
    raf = requestAnimationFrame(loop)
    controls.update()
    renderer.render(scene, camera)
  }
  loop()

  function dispose() {
    cancelAnimationFrame(raf)
    ro.disconnect()
    controls.dispose()
    disposeChildren(env)
    for (const mesh of meshes.values()) mesh.material.dispose()
    outlineGeo.dispose()
    outlineMat.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }

  return { canvas, controls, sync, pickObject, groundPoint, dispose }
}
