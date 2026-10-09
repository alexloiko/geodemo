export type Vec3 = readonly [number, number, number]

export const vec = (x: number, y: number, z: number): Vec3 => [x, y, z]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b))
export const normalize = (a: Vec3): Vec3 => {
  const l = len(a)
  return l === 0 ? a : scale(a, 1 / l)
}
/** Linear interpolation: a + (b - a) * t */
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t))
export const centroid = (pts: readonly Vec3[]): Vec3 => {
  let s: Vec3 = [0, 0, 0]
  for (const p of pts) s = add(s, p)
  return scale(s, 1 / Math.max(pts.length, 1))
}
