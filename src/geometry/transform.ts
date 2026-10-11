import { type Line3, foot } from './lines'
import { type Vec3, add, cross, dot, scale, sub } from './vec'

/** Resolved transformation (geometry only, refs already evaluated). */
export type Tf =
  | { kind: 'pointReflect'; c: Vec3 }
  | { kind: 'lineReflect'; l: Line3 }
  | { kind: 'rotate'; c: Vec3; axis: Vec3; rad: number }
  | { kind: 'translate'; v: Vec3 }
  | { kind: 'dilate'; c: Vec3; k: number }

export function applyTf(tf: Tf, p: Vec3): Vec3 {
  switch (tf.kind) {
    case 'pointReflect':
      return sub(scale(tf.c, 2), p)
    case 'lineReflect':
      // In a plane: reflection in the line; in space: half-turn about it.
      return sub(scale(foot(tf.l, p), 2), p)
    case 'rotate': {
      // Rodrigues' formula about the unit axis through c.
      const v = sub(p, tf.c)
      const k = tf.axis
      const cos = Math.cos(tf.rad)
      const sin = Math.sin(tf.rad)
      const r = add(add(scale(v, cos), scale(cross(k, v), sin)), scale(k, dot(k, v) * (1 - cos)))
      return add(tf.c, r)
    }
    case 'translate':
      return add(p, tf.v)
    case 'dilate':
      return add(tf.c, scale(sub(p, tf.c), tf.k))
  }
}
