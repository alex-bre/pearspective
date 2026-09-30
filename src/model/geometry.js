import * as THREE from 'three'

// Every geometry an object renders with is a unit box's worth centred on the
// origin; the object's size becomes its mesh scale.
const PRIMITIVES = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 48, 32),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 48),
  cone: () => new THREE.ConeGeometry(0.5, 1, 48),
}

const primitives = new Map()

// Geometry of 'mesh' objects (boolean results, imports), by meshId. Read-only
// once registered, so duplicates and undo snapshots can share it.
// ponytail: never freed, so memory grows with every boolean/import in a session;
// reference-count from the document + undo stacks if that ever matters.
const meshes = new Map()
let meshSeq = 0

/** The geometry an object renders with. Shared between objects — never dispose it. */
export function geometryFor(obj) {
  if (obj.meshId) return meshes.get(obj.meshId)
  if (!primitives.has(obj.type)) primitives.set(obj.type, PRIMITIVES[obj.type]())
  return primitives.get(obj.type)
}

/** Keep a normalized geometry for 'mesh' objects; returns its meshId. */
export function registerGeometry(geometry) {
  const id = `g${++meshSeq}`
  meshes.set(id, geometry)
  return id
}

const clean = (v) => Math.round(v * 1e6) / 1e6 // to the micrometre

/**
 * Centre `geo` on the origin and squash it into a unit box, in place. Returns
 * the box's former centre and size — what the object's position (in the same
 * frame) and size must be to put it back where it was.
 */
export function normalizeGeometry(geo) {
  geo.computeBoundingBox()
  const center = geo.boundingBox.getCenter(new THREE.Vector3())
  const size = geo.boundingBox.getSize(new THREE.Vector3()).max(new THREE.Vector3(1e-6, 1e-6, 1e-6))
  geo.translate(-center.x, -center.y, -center.z)
  geo.scale(1 / size.x, 1 / size.y, 1 / size.z) // normals are corrected for the non-uniform scale
  if (!geo.attributes.normal) geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return { geometry: geo, center: center.toArray().map(clean), size: size.toArray().map(clean) }
}
