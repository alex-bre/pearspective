import * as THREE from 'three'
import { geometryFor } from './geometry'
import { snapValue } from './snap'

const DEG = Math.PI / 180
const _v = new THREE.Vector3()

/** An object's rotation (stored in degrees, XYZ order) as a quaternion. */
export function quaternionOf(obj) {
  const [x, y, z] = obj.rotation
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x * DEG, y * DEG, z * DEG))
}

/** The object's own X, Y and Z axes in world space. */
export function axesOf(obj) {
  const q = quaternionOf(obj)
  return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((a) => a.applyQuaternion(q))
}

/** World-space bounds from the geometry's vertices, so a rotated sphere's box stays tight. */
export function worldBox(obj) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...obj.position), quaternionOf(obj), new THREE.Vector3(...obj.size))
  const pos = geometryFor(obj).attributes.position
  const box = new THREE.Box3()
  for (let i = 0; i < pos.count; i++) box.expandByPoint(_v.fromBufferAttribute(pos, i).applyMatrix4(m))
  return box
}

/** The y position that puts the object's lowest point on the ground. */
export const groundY = (obj) => obj.position[1] - worldBox(obj).min.y

/**
 * Resize handles in the unit box's frame: `at` is where the handle sits, `dir`
 * the direction each axis grows when the handle is dragged outward (0 = that
 * axis is left alone). Corners sit on the bottom face and set width and depth;
 * the top handle sets height.
 */
export const HANDLES = [
  { id: 'corner+x+z', at: [0.5, -0.5, 0.5], dir: [1, 0, 1] },
  { id: 'corner-x+z', at: [-0.5, -0.5, 0.5], dir: [-1, 0, 1] },
  { id: 'corner+x-z', at: [0.5, -0.5, -0.5], dir: [1, 0, -1] },
  { id: 'corner-x-z', at: [-0.5, -0.5, -0.5], dir: [-1, 0, -1] },
  { id: 'top', at: [0, 0.5, 0], dir: [0, 1, 0] },
]

/** Where a handle sits in world space. */
export function handlePoint(obj, handle) {
  return new THREE.Vector3(...handle.at)
    .multiply(new THREE.Vector3(...obj.size))
    .applyQuaternion(quaternionOf(obj))
    .add(new THREE.Vector3(...obj.position))
}

/**
 * Resize `start` so its handle follows world point `p` (a Vector3) while the
 * opposite side stays put. Each axis is measured along the object's own axis,
 * so a rotated object resizes in its own frame. Sizes snap to the grid and
 * never drop below `min`. Returns { position, size }.
 */
export function resizeTo(start, handle, p, { grid, snap, min }) {
  const axes = axesOf(start)
  const center = new THREE.Vector3(...start.position)
  const rel = p.clone().sub(center)
  const size = [...start.size]
  const position = center.clone()
  for (let a = 0; a < 3; a++) {
    const dir = handle.dir[a]
    if (!dir) continue
    const anchor = (-dir * start.size[a]) / 2 // the fixed side, along this axis
    const s = Math.max(min, snapValue(dir * (rel.dot(axes[a]) - anchor), grid, snap))
    size[a] = s
    position.addScaledVector(axes[a], anchor + (dir * s) / 2)
  }
  return { position: position.toArray(), size }
}
