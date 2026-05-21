import type { NormPoint } from './front-camera-guide-config'

export type LineSegment = { x1: number; y1: number; x2: number; y2: number }

/**
 * 纵线「校准后」显示：对同侧标定点做 PCA 得直线 L（过质心、沿第一主方向），
 * 将各点标量投影 t = dot(p - 质心, 方向)，取 [min(t), max(t)] 在 L 上的线段。
 * 抑制测量误差、不依赖折线拐点；线段覆盖各档标定点在拟合方向上的跨度，不拉满视口。
 */
export function fitCalibratedBoundarySegment(points: NormPoint[]): LineSegment | null {
  const fit = pcaLineThroughPoints(points)
  if (!fit) return segmentFallback(points)
  const { cx, cy, dx, dy } = fit
  let tMin = Infinity
  let tMax = -Infinity
  for (const p of points) {
    const t = (p.x - cx) * dx + (p.y - cy) * dy
    if (t < tMin) tMin = t
    if (t > tMax) tMax = t
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return segmentFallback(points)

  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return {
    x1: clamp(cx + tMin * dx),
    y1: clamp(cy + tMin * dy),
    x2: clamp(cx + tMax * dx),
    y2: clamp(cy + tMax * dy),
  }
}

/**
 * PCA 拟合直线后与单位正方形求交，纵线延长至视口边缘（可选展示模式）。
 */
export function fitBoundaryLineToUnitSquare(points: NormPoint[]): LineSegment | null {
  const fit = pcaLineThroughPoints(points)
  if (!fit) return segmentFallback(points)
  const clipped = clipInfiniteLineToUnitSquare(fit.cx, fit.cy, fit.dx, fit.dy)
  return clipped ?? segmentFallback(points)
}

/** 首尾两点连线（拟合失败时回退） */
export function segmentFallback(points: NormPoint[]): LineSegment | null {
  if (points.length < 2) return null
  const a = points[0]
  const b = points[points.length - 1]
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
}

function pcaLineThroughPoints(points: NormPoint[]): {
  cx: number
  cy: number
  dx: number
  dy: number
} | null {
  const n = points.length
  if (n < 2) return null

  let cx = 0
  let cy = 0
  for (const p of points) {
    cx += p.x
    cy += p.y
  }
  cx /= n
  cy /= n

  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of points) {
    const dx = p.x - cx
    const dy = p.y - cy
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }

  const tr = sxx + syy
  const det = sxx * syy - sxy * sxy
  if (tr < 1e-18) return null

  const disc = tr * tr - 4 * det
  if (disc < -1e-12) return null
  const sqrtDisc = Math.sqrt(Math.max(0, disc))
  const lambda1 = (tr + sqrtDisc) / 2

  let vx: number
  let vy: number
  if (Math.abs(sxy) > 1e-12) {
    vx = sxy
    vy = lambda1 - sxx
  } else {
    if (sxx >= syy) {
      vx = 1
      vy = 0
    } else {
      vx = 0
      vy = 1
    }
  }

  const len = Math.hypot(vx, vy)
  if (len < 1e-14) return null
  return { cx, cy, dx: vx / len, dy: vy / len }
}

/**
 * 无限直线 (cx,cy) + t*(ux,uy)，|u|=1，与单位正方形边求交，取最远的两交点作为线段端点。
 */
function clipInfiniteLineToUnitSquare(
  cx: number,
  cy: number,
  dx: number,
  dy: number
): LineSegment | null {
  const len = Math.hypot(dx, dy)
  if (len < 1e-14) return null
  const ux = dx / len
  const uy = dy / len

  const ts: number[] = []

  const pushT = (t: number, x: number, y: number) => {
    if (x >= -1e-7 && x <= 1 + 1e-7 && y >= -1e-7 && y <= 1 + 1e-7) {
      ts.push(t)
    }
  }

  if (Math.abs(ux) > 1e-12) {
    pushT((0 - cx) / ux, 0, cy + ((0 - cx) / ux) * uy)
    pushT((1 - cx) / ux, 1, cy + ((1 - cx) / ux) * uy)
  }
  if (Math.abs(uy) > 1e-12) {
    pushT((0 - cy) / uy, cx + ((0 - cy) / uy) * ux, 0)
    pushT((1 - cy) / uy, cx + ((1 - cy) / uy) * ux, 1)
  }

  if (ts.length < 2) return null

  const tMin = Math.min(...ts)
  const tMax = Math.max(...ts)

  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return {
    x1: clamp(cx + tMin * ux),
    y1: clamp(cy + tMin * uy),
    x2: clamp(cx + tMax * ux),
    y2: clamp(cy + tMax * uy),
  }
}
