import * as THREE from 'three'
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg'
import { geometryFor, normalizeGeometry, registerGeometry } from './geometry'
import { quaternionOf } from './transform'
import { meshObject } from './objects'

// Loaded on demand (store.booleanSelected imports it), so the CSG library stays
// out of the first paint.

const OPS = {
  union: [ADDITION, 'Union'],
  subtract: [SUBTRACTION, 'Subtraction'],
  intersect: [INTERSECTION, 'Intersection'],
}

/** Thrown when an operation leaves nothing, e.g. intersecting shapes that don't touch. */
export class EmptyResult extends Error {
  name = 'EmptyResult'
}

function brushOf(obj) {
  // A clone: the brush hangs its BVH off the geometry, and primitives are shared.
  const brush = new Brush(geometryFor(obj).clone())
  brush.position.fromArray(obj.position)
  brush.quaternion.copy(quaternionOf(obj))
  brush.scale.fromArray(obj.size)
  brush.updateMatrixWorld()
  return brush
}

/**
 * A new 'mesh' object: A op B. It keeps A's rotation and style, so a turned A
 * gives a turned result whose handles follow the same axes.
 */
export function combine(a, b, op) {
  const [operation, label] = OPS[op]
  const evaluator = new Evaluator()
  evaluator.attributes = ['position', 'normal']
  evaluator.useGroups = false
  const geo = evaluator.evaluate(brushOf(a), brushOf(b), operation).geometry
  if (!geo.attributes.position?.count) throw new EmptyResult('Nothing left — the shapes don’t overlap')

  // The result comes back in A's local, unscaled frame. Scale it to meters (still
  // turned like A), normalize, then carry the centre back into world space.
  geo.scale(...a.size)
  const { geometry, center, size } = normalizeGeometry(geo)
  const position = new THREE.Vector3(...center).applyQuaternion(quaternionOf(a)).add(new THREE.Vector3(...a.position))
  return meshObject(label, registerGeometry(geometry), { position: position.toArray(), rotation: [...a.rotation], size }, a)
}
