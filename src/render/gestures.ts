export type P2 = [number, number]

const midpoint = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const distance = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1])

export interface PinchStart {
  /** Two touch points at the start, in canvas coordinates. */
  a: P2
  b: P2
  zoom: number
  pan: P2
}

/**
 * Two-finger pinch / pan: the zoom follows the finger distance and the content
 * under the fingers' midpoint stays under it. `center` is the canvas centre
 * (screen origin of the view before panning).
 */
export function pinch(start: PinchStart, a: P2, b: P2, center: P2, minZoom = 0.3, maxZoom = 5): { zoom: number; pan: P2 } {
  const d0 = Math.max(distance(start.a, start.b), 1)
  const zoom = Math.min(maxZoom, Math.max(minZoom, (start.zoom * distance(a, b)) / d0))
  const f = zoom / start.zoom
  const m0 = midpoint(start.a, start.b)
  const m = midpoint(a, b)
  // Screen origin before: O0 = center + pan0. Keep (m0 − O0) scaled by f under m.
  const o0: P2 = [center[0] + start.pan[0], center[1] + start.pan[1]]
  const o: P2 = [m[0] - (m0[0] - o0[0]) * f, m[1] - (m0[1] - o0[1]) * f]
  return { zoom, pan: [o[0] - center[0], o[1] - center[1]] }
}

/** A touch counts as a tap when it moved less than this (px). */
export const TAP_SLOP = 10
/** Holding still this long (ms) is a long press. */
export const LONG_PRESS_MS = 500
