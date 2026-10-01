import * as THREE from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { geometryFor } from '../model/geometry'
import { FINISH } from '../model/objects'

// Loaded on demand (store.exportScene imports it), so the exporters stay out of
// the first paint.

const DEG = Math.PI / 180

/** The document as a three.js group, in meters, Y-up — one mesh per object, in list order. */
export function sceneOf(doc) {
  const group = new THREE.Group()
  for (const id of doc.order) {
    const o = doc.objects[id]
    const f = FINISH[o.finish]
    const material = new THREE.MeshStandardMaterial({
      color: o.color,
      roughness: f.r,
      metalness: f.m,
      transparent: o.opacity < 1,
      opacity: o.opacity,
    })
    const mesh = new THREE.Mesh(geometryFor(o), material)
    mesh.name = o.name
    mesh.position.fromArray(o.position)
    mesh.rotation.set(o.rotation[0] * DEG, o.rotation[1] * DEG, o.rotation[2] * DEG)
    mesh.scale.fromArray(o.size)
    group.add(mesh)
  }
  return group
}

/** Binary STL in mm, Z-up — what slicers expect. Returns a DataView. */
export function toStl(doc) {
  const root = new THREE.Group()
  root.rotation.x = Math.PI / 2 // Y-up → Z-up: (x, y, z) → (x, −z, y)
  root.scale.setScalar(1000) // m → mm
  root.add(sceneOf(doc))
  root.updateMatrixWorld(true)
  return new STLExporter().parse(root, { binary: true })
}

/** GLB in meters (glTF's unit), with each object's colour and finish. Returns an ArrayBuffer. */
export function toGlb(doc) {
  const scene = new THREE.Scene()
  scene.name = 'Pearspective'
  scene.add(sceneOf(doc))
  return new GLTFExporter().parseAsync(scene, { binary: true })
}
