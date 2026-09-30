import { beforeAll, expect, test } from 'vitest'
import { useStore } from '../state/store'
import { initHistory, undo, redo, beginHistoryBatch, endHistoryBatch, coalesce } from '../state/history'

const S = () => useStore.getState()
const count = () => S().document.order.length
const posOf = (id) => S().document.objects[id].position

beforeAll(() => initHistory())

test('undo and redo step through document changes and trim the selection', () => {
  S().addObject('cube')
  S().addObject('sphere')
  expect(count()).toBe(2)
  const sphere = S().selection[0]

  undo()
  expect(count()).toBe(1)
  expect(S().selection).not.toContain(sphere) // the undone object can't stay selected
  redo()
  expect(count()).toBe(2)

  undo()
  S().addObject('cone') // a new change clears the redo stack
  expect(S().future).toEqual([])
})

test('selection and settings are not undo steps', () => {
  const steps = S().past.length
  S().select([])
  S().setSetting('grid', 0.25)
  expect(S().past.length).toBe(steps)
})

test('a batch is one step however many changes it holds', () => {
  const id = S().document.order[0]
  const start = posOf(id)
  const steps = S().past.length
  beginHistoryBatch()
  for (const dx of [1, 2, 3]) S().moveObjects([[id, start]], dx, 0)
  endHistoryBatch()
  expect(S().past.length).toBe(steps + 1)
  undo()
  expect(posOf(id)).toEqual(start)
})

test('coalesced changes with the same key merge; a different change breaks the run', () => {
  S().select([S().document.order[0]])
  const steps = S().past.length
  for (const opacity of [0.9, 0.8, 0.7]) {
    coalesce('opacity')
    S().styleSelected({ opacity })
  }
  expect(S().past.length).toBe(steps + 1)

  S().styleSelected({ finish: 'gloss' }) // uncoalesced: its own step
  coalesce('opacity')
  S().styleSelected({ opacity: 0.5 }) // same key, but the run was broken
  expect(S().past.length).toBe(steps + 3)

  undo()
  undo()
  undo()
  expect(S().document.objects[S().selection[0]].opacity).toBe(1)
})
