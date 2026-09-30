/**
 * Round `v` to the nearest multiple of `grid` when snapping is on. The result is
 * cleaned to the micrometre so 3 × 0.1 lands on 0.3, not 0.30000000000000004.
 */
export function snapValue(v, grid, on = true) {
  if (!on) return v
  return Math.round(Math.round(v / grid) * grid * 1e6) / 1e6
}

/** Clamp a ground point [x, z] into the playground. */
export function clampToPlayground([x, z], { w, d }) {
  return [Math.min(w / 2, Math.max(-w / 2, x)), Math.min(d / 2, Math.max(-d / 2, z))]
}
