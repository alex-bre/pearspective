import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { initResponsiveLayout } from '../state/responsiveLayout'

// Width the panels are sized at, and the two collapse thresholds
// (state/responsiveLayout.js: left < 1000, right < 820).
const WIDE = 1400
const NARROW = 900 // left only
const TIGHT = 700 // both

// A stand-in window: just a width and resize events.
const win = Object.assign(new EventTarget(), { innerWidth: WIDE })
let stop = () => {}

const start = () => (stop = initResponsiveLayout(win))
const resizeTo = (w) => {
  win.innerWidth = w
  win.dispatchEvent(new Event('resize'))
}
const collapsed = () => {
  const { leftCollapsed, rightCollapsed } = useStore.getState().ui
  return { left: leftCollapsed, right: rightCollapsed }
}

beforeEach(() => {
  win.innerWidth = WIDE
  useStore.getState().setLeftCollapsed(false)
  useStore.getState().setRightCollapsed(false)
})

afterEach(() => stop())

describe('responsive panel collapse', () => {
  it('collapses the tools panel, then both panels, as the viewport narrows', () => {
    start()
    expect(collapsed()).toEqual({ left: false, right: false })

    resizeTo(NARROW)
    expect(collapsed()).toEqual({ left: true, right: false })

    resizeTo(TIGHT)
    expect(collapsed()).toEqual({ left: true, right: true })
  })

  it('restores the panels it auto-collapsed when the viewport grows back', () => {
    start()
    resizeTo(TIGHT)
    expect(collapsed()).toEqual({ left: true, right: true })

    resizeTo(WIDE)
    expect(collapsed()).toEqual({ left: false, right: false })
  })

  it('collapses at start when the viewport starts out narrow', () => {
    win.innerWidth = TIGHT
    start()
    expect(collapsed()).toEqual({ left: true, right: true })
  })

  it('leaves a panel the user re-opened on a narrow viewport alone', () => {
    win.innerWidth = NARROW
    start()
    expect(collapsed().left).toBe(true)

    // The user expands it by hand, then nudges the window (still narrow).
    useStore.getState().toggleLeftPanel()
    resizeTo(NARROW - 20)
    expect(collapsed().left).toBe(false)
  })

  it('does not re-open a panel the user collapsed themselves', () => {
    start()
    useStore.getState().toggleLeftPanel()
    expect(collapsed().left).toBe(true)

    // Crossing the threshold both ways must not undo a manual collapse.
    resizeTo(TIGHT)
    resizeTo(WIDE)
    expect(collapsed().left).toBe(true)
  })

  it('stops listening once unsubscribed', () => {
    start()
    stop()
    resizeTo(TIGHT)
    expect(collapsed()).toEqual({ left: false, right: false })
  })
})
