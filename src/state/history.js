import { useStore } from './store'

// Undo/redo by document snapshots (as in lulogo). Every document change pushes
// the *previous* document onto `past`. Two ways to fold many changes into one step:
//  - a batch, for gestures with a clear start and end (a drag, a gizmo turn);
//  - coalescing, for continuous controls with no clean end (a slider, the colour
//    picker): changes that carry the same key within MERGE_MS of each other merge.

const MAX = 100
const MERGE_MS = 1000

let suspend = false // applying an undo/redo
let batching = false
let batchRecorded = false
let nextKey = null // coalescing key for the next change
let lastKey = null
let lastAt = 0

/** Start recording. Returns the unsubscribe (call it on unmount). */
export function initHistory() {
  return useStore.subscribe((state, prev) => {
    if (state.document === prev.document || suspend) return
    if (batching) {
      if (!batchRecorded) pushPast(prev.document)
      batchRecorded = true
      lastKey = null
      return
    }
    const now = Date.now()
    const merge = nextKey !== null && nextKey === lastKey && now - lastAt < MERGE_MS
    lastKey = nextKey
    lastAt = now
    nextKey = null
    if (!merge) pushPast(prev.document)
  })
}

function pushPast(doc) {
  const { past } = useStore.getState()
  useStore.setState({ past: [...past.slice(-(MAX - 1)), doc], future: [] })
}

/** Collapse every document change until endHistoryBatch() into one undo step. */
export function beginHistoryBatch() {
  batching = true
  batchRecorded = false
}
export function endHistoryBatch() {
  batching = false
}

/** Let the next change merge into the previous step if that one carried the same key moments ago. */
export function coalesce(key) {
  nextKey = key
}

function restore(from, to) {
  const st = useStore.getState()
  if (!st[from].length) return
  const doc = st[from][st[from].length - 1]
  suspend = true
  useStore.setState({
    document: doc,
    [from]: st[from].slice(0, -1),
    [to]: [...st[to], st.document],
    selection: st.selection.filter((id) => doc.objects[id]),
  })
  suspend = false
  lastKey = null // a step taken after undo never merges into one from before it
}

export const undo = () => restore('past', 'future')
export const redo = () => restore('future', 'past')
