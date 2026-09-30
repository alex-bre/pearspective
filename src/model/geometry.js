import * as THREE from 'three'

// Every primitive is a unit box's worth of geometry centred on the origin; an
// object's size becomes its mesh scale.
const PRIMITIVES = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 48, 32),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 48),
  cone: () => new THREE.ConeGeometry(0.5, 1, 48),
}

const primitives = new Map()

/** The geometry an object renders with. Shared between objects — never dispose it. */
export function geometryFor(obj) {
  if (!primitives.has(obj.type)) primitives.set(obj.type, PRIMITIVES[obj.type]())
  return primitives.get(obj.type)
}
