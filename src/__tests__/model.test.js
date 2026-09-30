import { expect, test } from 'vitest'
import { createObject, freeSpot } from '../model/objects'
import { snapValue, clampToPlayground } from '../model/snap'

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
