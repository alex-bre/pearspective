import { expect, test } from 'vitest'
import { createObject, freeSpot } from '../model/objects'
import { snapValue, clampToPlayground } from '../model/snap'
import * as THREE from 'three'
import { groundY, resizeTo, HANDLES } from '../model/transform'

const docOf = (objs) => ({
  playground: { w: 10, d: 10 },
  order: objs.map((o) => o.id),
  objects: Object.fromEntries(objs.map((o) => [o.id, o])),
})

test('snapValue rounds to the grid without float noise', () => {
  expect(snapValue(0.29, 0.1)).toBe(0.3)
  expect(snapValue(-1.26, 0.5)).toBe(-1.5)
  expect(snapValue(0.29, 0.1, false)).toBe(0.29)
})

test('clampToPlayground keeps a point inside', () => {
  expect(clampToPlayground([7, -9], { w: 10, d: 10 })).toEqual([5, -5])
  expect(clampToPlayground([1, 2], { w: 10, d: 10 })).toEqual([1, 2])
})

test('freeSpot starts at the origin, stays inside, and never overlaps', () => {
  const placed = []
  for (let i = 0; i < 20; i++) {
    const [x, z] = freeSpot(docOf(placed), 0.5)
    expect(Math.abs(x)).toBeLessThanOrEqual(4.5)
    expect(Math.abs(z)).toBeLessThanOrEqual(4.5)
    for (const o of placed) {
      expect(Math.abs(o.position[0] - x) >= 1 || Math.abs(o.position[2] - z) >= 1).toBe(true)
    }
    placed.push(createObject('cube', x, z))
  }
  expect(placed[0].position).toEqual([0, 0.5, 0])
})

const cube = (over = {}) => ({ ...createObject('cube', 0, 0), ...over })
const handle = (id) => HANDLES.find((h) => h.id === id)
const snapped = { grid: 0.5, snap: true, min: 0.5 }

test('groundY rests rotated objects on their lowest point', () => {
  expect(groundY(cube())).toBeCloseTo(0.5)
  expect(groundY(cube({ rotation: [0, 0, 45] }))).toBeCloseTo(Math.SQRT1_2)
  const sphere = { ...createObject('sphere', 0, 0), rotation: [30, 0, 20] }
  expect(groundY(sphere)).toBeCloseTo(0.5, 2) // a turned sphere must not float on a box corner
})

test('resizeTo keeps the opposite corner fixed and snaps sizes', () => {
  const r = resizeTo(cube(), handle('corner+x+z'), new THREE.Vector3(1.2, 0, 0.8), snapped)
  expect(r.size).toEqual([1.5, 1, 1.5])
  expect(r.position).toEqual([0.25, 0.5, 0.25]) // left/back sides stay at -0.5
})

test('resizeTo grows height from the bottom', () => {
  const r = resizeTo(cube(), handle('top'), new THREE.Vector3(0, 2.2, 0), snapped)
  expect(r.size).toEqual([1, 2, 1])
  expect(r.position).toEqual([0, 1, 0])
})

test('resizeTo works along a rotated object’s own axes', () => {
  // Turned 90° about Y, the object's +X points along world −Z.
  const r = resizeTo(cube({ rotation: [0, 90, 0] }), handle('corner+x+z'), new THREE.Vector3(0, 0.5, -1.5), snapped)
  expect(r.size).toEqual([2, 1, 0.5])
  r.position.forEach((v, i) => expect(v).toBeCloseTo([-0.25, 0.5, -0.5][i]))
})

test('resizeTo never collapses below the minimum', () => {
  const r = resizeTo(cube(), handle('corner-x-z'), new THREE.Vector3(3, 0, 3), snapped)
  expect(r.size).toEqual([0.5, 1, 0.5])
})
