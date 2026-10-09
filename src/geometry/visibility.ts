import type { halfSpaces } from './polyhedron'
import { type Vec3, dot, lerp } from './vec'

export type HalfSpaces = ReturnType<typeof halfSpaces>

/**
 * True when point q is occluded by the convex solid for a viewer looking along
 * -toViewer (parallel projection): the ray q + s·toViewer (s > 0) passes through
 * the solid's interior.
 */
export function isHidden(hs: HalfSpaces, toViewer: Vec3, q: Vec3, scaleRef: number): boolean {
  const eps = 1e-6 * scaleRef
  let s0 = -Infinity
  let s1 = Infinity
  for (const { n, d } of hs) {
    const nv = dot(n, toViewer)
    const nq = dot(n, q) - d
    if (Math.abs(nv) < 1e-12) {
      if (nq > -eps) return false // ray runs outside (or along) this face
      continue
    }
    const s = -nq / nv
    if (nv > 0) s1 = Math.min(s1, s)
    else s0 = Math.max(s0, s)
    if (s1 - Math.max(s0, 0) <= eps) return false
  }
  return s1 - Math.max(s0, 0) > eps
}

export interface Piece {
  a: Vec3
  b: Vec3
  hidden: boolean
}

/**
 * Split segment a–b into visible / hidden pieces. The occluded set of a convex
 * solid under parallel projection is convex, so the hidden part is one interval.
 */
export function splitByVisibility(
  hs: HalfSpaces,
  toViewer: Vec3,
  a: Vec3,
  b: Vec3,
  scaleRef: number,
): Piece[] {
  const N = 48
  const hid = (t: number) => isHidden(hs, toViewer, lerp(a, b, t), scaleRef)
  let first = -1
  let last = -1
  for (let i = 0; i <= N; i++) {
    const t = (i + 0.5) / (N + 1)
    if (hid(t)) {
      if (first < 0) first = i
      last = i
    }
  }
  // Also check endpoints exactly.
  const ha = hid(0)
  const hb = hid(1)
  if (first < 0 && !ha && !hb) return [{ a, b, hidden: false }]
  const tAt = (i: number) => (i + 0.5) / (N + 1)
  let t0: number
  let t1: number
  if (first < 0) {
    t0 = ha ? 0 : 1
    t1 = hb ? 1 : 0
    if (ha && !hb) t1 = refine(hid, 0, tAt(0))
    if (hb && !ha) t0 = refine(hid, 1, tAt(N))
  } else {
    t0 = ha ? 0 : refine(hid, tAt(first), first > 0 ? tAt(first - 1) : 0)
    t1 = hb ? 1 : refine(hid, tAt(last), last < N ? tAt(last + 1) : 1)
  }
  const pieces: Piece[] = []
  const pa = lerp(a, b, t0)
  const pb = lerp(a, b, t1)
  if (t0 > 1e-6) pieces.push({ a, b: pa, hidden: false })
  if (t1 - t0 > 1e-6) pieces.push({ a: pa, b: pb, hidden: true })
  if (t1 < 1 - 1e-6) pieces.push({ a: pb, b, hidden: false })
  return pieces
}

/** Bisection between a hidden parameter `inT` and a visible parameter `outT`. */
function refine(hid: (t: number) => boolean, inT: number, outT: number): number {
  let lo = inT
  let hi = outT
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2
    if (hid(m)) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}
