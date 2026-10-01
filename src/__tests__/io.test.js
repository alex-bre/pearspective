import { expect, test } from 'vitest'
import { createObject } from '../model/objects'
import { worldBox } from '../model/transform'
import { toStl, toGlb } from '../io/exportScene'
import { parseModel } from '../io/importFiles'
import { useStore } from '../state/store'
import { initHistory, undo } from '../state/history'

const close = (got, want) => got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 4))
const docOf = (objs) => ({
  playground: { w: 10, d: 10 },
  order: objs.map((o) => o.id),
  objects: Object.fromEntries(objs.map((o) => [o.id, o])),
})

// A 1 × 2 × 3 m box resting on the ground at x = 2.
const box = { ...createObject('cube', 2, 0), size: [1, 2, 3], position: [2, 1, 0] }

/** Bounds of a binary STL's vertices: [minX, minY, minZ, maxX, maxY, maxZ]. */
function stlBounds(view) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const count = view.getUint32(80, true)
  for (let t = 0; t < count; t++) {
    for (let v = 0; v < 3; v++) {
      for (let a = 0; a < 3; a++) {
        const x = view.getFloat32(84 + t * 50 + 12 + v * 12 + a * 4, true)
        min[a] = Math.min(min[a], x)
        max[a] = Math.max(max[a], x)
      }
    }
  }
  return [...min, ...max]
}

test('STL is exported in mm, Z-up', () => {
  // Y-up (x, y, z) → Z-up (x, −z, y), times 1000.
  close(stlBounds(toStl(docOf([box]))), [1500, -1500, 0, 2500, 1500, 2000])
})

test('STL round trip gives back the same box', async () => {
  const m = await parseModel('part.stl', toStl(docOf([box])).buffer)
  expect(m.name).toBe('part')
  expect(m.color).toBe(null)
  close(m.size, [1, 2, 3])
  close(m.center, [2, 1, 0])
})

test('GLB round trip keeps meters and the first colour', async () => {
  // GLTFExporter reads its output back through FileReader, which Node lacks.
  globalThis.FileReader ??= class {
    async readAsArrayBuffer(blob) {
      this.result = await blob.arrayBuffer()
      this.onloadend?.()
    }
  }
  const sphere = { ...createObject('sphere', 2, 0), size: [1, 2, 3], position: [2, 1, 0], color: '#3b3d35' }
  const cube = { ...createObject('cube', -2, 0), position: [-2, 0.5, 0] }
  const m = await parseModel('scene.glb', await toGlb(docOf([sphere, cube])))
  close(m.size, [5, 2, 3])
  close(m.center, [0, 1, 0])
  expect(m.color).toBe('#3b3d35')
})

test('unsupported files are rejected', async () => {
  await expect(parseModel('model.obj', new ArrayBuffer(0))).rejects.toThrow(/Unsupported/)
})

test('importFiles adds grounded objects in one undo step and names the failures', async () => {
  const stop = initHistory()
  const S = useStore.getState
  const buf = toStl(docOf([box])).buffer
  const file = (name) => ({ name, arrayBuffer: async () => buf })

  await S().importFiles([file('a.stl'), file('b.stl'), file('c.obj')])
  const objs = S().selection.map((id) => S().document.objects[id])
  expect(objs.map((o) => o.name)).toEqual(['a', 'b'])
  for (const o of objs) {
    expect(o.type).toBe('mesh')
    close(o.size, [1, 2, 3])
    expect(worldBox(o).min.y).toBeCloseTo(0, 5)
  }
  expect(objs[0].position).not.toEqual(objs[1].position) // each in its own free spot
  expect(S().ui.busy).toBe('Could not import c.obj')

  undo()
  expect(S().document.order).toEqual([])
  stop()
})
