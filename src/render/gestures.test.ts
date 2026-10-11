import { describe, expect, it } from 'vitest'
import { type P2, pinch } from './gestures'

const center: P2 = [400, 300]
const start = { a: [300, 300] as P2, b: [500, 300] as P2, zoom: 1, pan: [0, 0] as P2 }

describe('pinch', () => {
  it('spreading the fingers twice as far doubles the zoom around their midpoint', () => {
    const r = pinch(start, [200, 300], [600, 300], center)
    expect(r.zoom).toBeCloseTo(2, 9)
    // Midpoint (400,300) is the canvas centre, so the view does not shift.
    expect(r.pan[0]).toBeCloseTo(0, 9)
    expect(r.pan[1]).toBeCloseTo(0, 9)
  })

  it('moving both fingers pans by the same amount', () => {
    const r = pinch(start, [330, 260], [530, 260], center)
    expect(r.zoom).toBeCloseTo(1, 9)
    expect(r.pan).toEqual([30, -40])
  })

  it('zooming around an off-centre point keeps that point fixed', () => {
    const s = { a: [100, 100] as P2, b: [200, 100] as P2, zoom: 1, pan: [0, 0] as P2 }
    const r = pinch(s, [50, 100], [250, 100], center)
    // A world point under (150,100) was at offset (150−400, 100−300) from the origin.
    const before: P2 = [150 - 400, 100 - 300]
    const o: P2 = [center[0] + r.pan[0], center[1] + r.pan[1]]
    expect(o[0] + before[0] * r.zoom).toBeCloseTo(150, 9)
    expect(o[1] + before[1] * r.zoom).toBeCloseTo(100, 9)
  })

  it('zoom is clamped', () => {
    expect(pinch(start, [399, 300], [401, 300], center).zoom).toBe(0.3)
  })
})
