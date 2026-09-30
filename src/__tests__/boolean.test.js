import { expect, test } from 'vitest'
import { createObject } from '../model/objects'
import { combine, EmptyResult } from '../model/boolean'
import { worldBox } from '../model/transform'
import { useStore } from '../state/store'
import { initHistory, undo } from '../state/history'

const cube = (x, over = {}) => ({ ...createObject('cube', x, 0), ...over })
const close = (got, want) => got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 4))
const boxOf = (o) => {
  const b = worldBox(o)
  return [...b.min.toArray(), ...b.max.toArray()]
}

// Two unit cubes overlapping by half: A spans x −0.5…0.5, B spans 0…1.
test('union spans both', () => {
  const r = combine(cube(0), cube(0.5), 'union')
  expect(r.type).toBe('mesh')
  expect(r.name).toMatch(/^Union \d+$/)
  close(r.size, [1.5, 1, 1])
  close(r.position, [0.25, 0.5, 0])
})

test('subtract keeps the part of A outside B', () => {
  const r = combine(cube(0), cube(0.5), 'subtract')
  close(r.size, [0.5, 1, 1])
  close(boxOf(r), [-0.5, 0, -0.5, 0, 1, 0.5])
})

test('intersect keeps the overlap', () => {
  const r = combine(cube(0), cube(0.5), 'intersect')
  close(boxOf(r), [0, 0, -0.5, 0.5, 1, 0.5])
})

test('the result keeps A’s place, rotation and style', () => {
  const a = cube(3, { rotation: [0, 90, 0], color: '#123456', finish: 'gloss', opacity: 0.5 })
  const r = combine(a, cube(30), 'subtract') // B far away: A minus nothing is A
  expect(r.rotation).toEqual([0, 90, 0])
  expect([r.color, r.finish, r.opacity]).toEqual(['#123456', 'gloss', 0.5])
  close(r.size, [1, 1, 1])
  close(boxOf(r), boxOf(a))
})

test('an empty result is reported, not returned', () => {
  expect(() => combine(cube(0), cube(5), 'intersect')).toThrow(EmptyResult)
})

test('booleanSelected swaps A and B for the result, in one undo step', async () => {
  const stop = initHistory()
  const S = useStore.getState
  S().addObject('cube', [0, 0])
  const a = S().selection[0]
  S().addObject('sphere', [3, 3])
  const other = S().selection[0]
  S().addObject('cube', [0.5, 0])
  const b = S().selection[0]

  S().select([a, b])
  await S().booleanSelected('subtract')
  const [first, second] = S().document.order
  expect(S().document.objects[first].type).toBe('mesh') // took A's place in the list
  expect(second).toBe(other)
  expect(S().selection).toEqual([first])
  expect(S().ui.busy).toBe('')

  undo()
  expect(S().document.order).toEqual([a, other, b])

  // Shapes that don't touch: nothing changes, and the status bar says why.
  S().select([a, other])
  await S().booleanSelected('intersect')
  expect(S().document.order).toEqual([a, other, b])
  expect(S().ui.busy).toMatch(/don’t overlap/)
  stop()
})
