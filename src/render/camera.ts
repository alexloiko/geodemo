import type { Vec3 } from '../geometry/vec'

export type Projection = 'oblique' | 'orthographic'

export interface Camera {
  /** Rotation about the vertical (z) axis, degrees. */
  yaw: number
  /** Tilt about the screen x axis, degrees. */
  pitch: number
  zoom: number
  projection: Projection
}

export const TEXTBOOK_CAMERA: Camera = { yaw: 0, pitch: 0, zoom: 1, projection: 'oblique' }
export const ORTHO_CAMERA: Camera = { yaw: -28, pitch: 18, zoom: 1, projection: 'orthographic' }

/** Cabinet projection: receding axis drawn at 45°, foreshortened by half. */
const K = 0.5
const ALPHA = Math.PI / 4

export interface Projector {
  /** World → screen units (y up; caller flips for SVG). */
  project(p: Vec3): [number, number]
  /** Unit-ish world direction pointing from the scene towards the viewer. */
  toViewer: Vec3
}

export function makeProjector(cam: Camera): Projector {
  const cy = Math.cos((cam.yaw * Math.PI) / 180)
  const sy = Math.sin((cam.yaw * Math.PI) / 180)
  const cp = Math.cos((cam.pitch * Math.PI) / 180)
  const sp = Math.sin((cam.pitch * Math.PI) / 180)
  // R = Rx(pitch) · Rz(yaw)
  const rot = (p: Vec3): Vec3 => {
    const x = cy * p[0] - sy * p[1]
    const y = sy * p[0] + cy * p[1]
    const z = p[2]
    return [x, cp * y - sp * z, sp * y + cp * z]
  }
  // Inverse rotation (transpose) for directions.
  const rotInv = (p: Vec3): Vec3 => {
    const x = p[0]
    const y = cp * p[1] + sp * p[2]
    const z = -sp * p[1] + cp * p[2]
    return [cy * x + sy * y, -sy * x + cy * y, z]
  }
  if (cam.projection === 'oblique') {
    const kc = K * Math.cos(ALPHA)
    const ks = K * Math.sin(ALPHA)
    return {
      project: (p) => {
        const r = rot(p)
        return [r[0] + kc * r[1], r[2] + ks * r[1]]
      },
      toViewer: rotInv([kc, -1, ks]),
    }
  }
  return {
    project: (p) => {
      const r = rot(p)
      return [r[0], r[2]]
    },
    toViewer: rotInv([0, -1, 0]),
  }
}
