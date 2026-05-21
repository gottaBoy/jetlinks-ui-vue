/**
 * 与 aura VehicleMode::TransToWheelAngleFromSteerAngle 一致：
 * 方向盘转角(°) → 转向节/前轮转角(°)，非线性传动比由查表+线性插值得到。
 */

const STEERING_WHEEL_ANGLE_DEG: readonly number[] = [
  0.0, 22.06, 44.283, 66.669, 89.447, 112.623, 135.736, 159.483, 183.404, 207.498, 232.004,
  256.928, 282.032, 307.56, 333.272, 359.415, 385.995, 412.765, 440.232, 467.897, 496.017,
  524.597, 553.642, 583.159, 613.152, 643.894, 675.128, 706.86, 739.368, 772.664, 806.76,
  841.668, 876.402, 914.255,
]

const STEER_RATIO_VECTOR_KA: readonly number[] = [
  22.2, 22.059675, 22.14135, 22.223025, 22.36185208, 22.52454, 22.62267222, 22.78333333,
  22.92550417, 23.05534815, 23.20044083, 23.35709167, 23.50265625, 23.65846154, 23.80513393,
  23.96100056, 24.12466875, 24.28030637, 24.45735, 24.62617939, 24.80085375, 24.9808,
  25.16555152, 25.354725, 25.54800313, 25.75576033, 25.96646667, 26.18001111, 26.40601071,
  26.6435908, 26.892, 27.15059032, 27.41880104, 27.70470328,
]

function linearInterpolation(x0: number, x1: number, y0: number, y1: number, x: number): number {
  if (Math.abs(x1 - x0) < 1e-12) return y0
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

function transmissionRateFromAbsSteerWheelDeg(absSteerDeg: number): number {
  const sw = STEERING_WHEEL_ANGLE_DEG
  const ratios = STEER_RATIO_VECTOR_KA
  if (absSteerDeg < sw[0]) return ratios[0]
  const last = sw.length - 1
  if (absSteerDeg >= sw[last]) return ratios[last]
  for (let i = 0; i < last; i++) {
    if (absSteerDeg >= sw[i] && absSteerDeg < sw[i + 1]) {
      return linearInterpolation(sw[i], sw[i + 1], ratios[i], ratios[i + 1], absSteerDeg)
    }
  }
  return ratios[last]
}

/**
 * @param steerAngleDeg 方向盘转角（度），符号与车端 vcu_steer_angle 一致
 * @returns 前轮（转向节）转角（度），同号；无效输入返回 null
 */
export function wheelAngleDegFromSteerAngleDeg(steerAngleDeg: number): number | null {
  if (!Number.isFinite(steerAngleDeg)) return null
  const absSteer = Math.abs(steerAngleDeg)
  const rate = transmissionRateFromAbsSteerWheelDeg(absSteer)
  if (!Number.isFinite(rate) || Math.abs(rate) < 1e-9) return null
  return steerAngleDeg / rate
}
