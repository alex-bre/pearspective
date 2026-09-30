/** Display names per object type. */
export const LABELS = {
  cube: 'Cube',
  sphere: 'Sphere',
  cylinder: 'Cylinder',
  cone: 'Cone',
  mesh: 'Mesh',
}

export const SWATCHES = ['#a9c43f', '#d9bf4a', '#c97a3a', '#8a5a3c', '#5f7d2b', '#ece4cc', '#8f8f86', '#3b3d35']

/** Material presets: roughness / metalness. */
export const FINISH = {
  matte: { r: 0.92, m: 0 },
  satin: { r: 0.5, m: 0.05 },
  gloss: { r: 0.14, m: 0.1 },
}

/** Edge length of a new shape, in meters. */
export const DEFAULT_SIZE = 1

// Ids and per-type name numbers only ever count up, so an undo that brings an
// object back can never collide with one created since.
let seq = 0
const typeCounts = {}

/** A new shape resting on the ground at (x, z). */
export function createObject(type, x, z) {
  seq++
  typeCounts[type] = (typeCounts[type] || 0) + 1
  const size = [DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_SIZE]
  return {
    id: `o${seq}`,
    type,
    name: `${LABELS[type]} ${typeCounts[type]}`,
    position: [x, size[1] / 2, z],
    rotation: [0, 0, 0],
    size,
    color: SWATCHES[(seq - 1) % 5],
    finish: 'satin',
    opacity: 1,
  }
}

/**
 * A 'mesh' object (a boolean result or an import) named "<label> n", placed at
 * `position` with `rotation`/`size`, styled like `style` (color, finish, opacity).
 */
export function meshObject(label, meshId, { position, rotation = [0, 0, 0], size }, style) {
  seq++
  typeCounts[label] = (typeCounts[label] || 0) + 1
  return {
    id: `o${seq}`,
    type: 'mesh',
    meshId,
    name: `${label} ${typeCounts[label]}`,
    position,
    rotation,
    size,
    color: style.color,
    finish: style.finish,
    opacity: style.opacity,
  }
}

/** A copy of `obj` under a fresh id, shifted `dx` along X. */
export function duplicateObject(obj, dx) {
  seq++
  const [x, y, z] = obj.position
  return { ...obj, id: `o${seq}`, name: `${obj.name} copy`, position: [x + dx, y, z] }
}

/**
 * The spot nearest the origin, on grid-aligned rings, where a `size`-wide shape
 * fits inside the playground without touching any footprint. Falls back to the
 * origin when the playground is full.
 * ponytail: footprints ignore rotation; use rotated boxes if tight packing matters.
 */
export function freeSpot(doc, grid, size = DEFAULT_SIZE) {
  const step = Math.ceil((size * 1.5) / grid) * grid
  const gap = size / 4
  const maxX = doc.playground.w / 2 - size / 2
  const maxZ = doc.playground.d / 2 - size / 2
  const free = (x, z) =>
    doc.order.every((id) => {
      const o = doc.objects[id]
      return (
        Math.abs(o.position[0] - x) >= (o.size[0] + size) / 2 + gap ||
        Math.abs(o.position[2] - z) >= (o.size[2] + size) / 2 + gap
      )
    })

  for (let r = 0; r * step <= Math.max(maxX, maxZ); r++) {
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue // ring only
        const x = i * step || 0 // no -0 from the centre ring
        const z = j * step || 0
        if (Math.abs(x) <= maxX && Math.abs(z) <= maxZ && free(x, z)) return [x, z]
      }
    }
  }
  return [0, 0]
}
