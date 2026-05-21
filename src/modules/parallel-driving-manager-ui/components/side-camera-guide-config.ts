/**
 * 左/右鱼眼侧视：车身旁 0.25 m、0.5 m 平行线（地面直线在鱼眼上的投影）。
 *
 * 标定参考分辨率 960×768（宽×高）：归一化
 *   nx = px / 960,  ny = py / 768
 *
 * 默认曲线来自 `fisheye_pts_0.25.txt` / `fisheye_pts_0.5.txt`（每行像素 x y），
 * 嵌入 `side-fisheye-pts.generated.ts`；更新 txt 后执行 `node scripts/gen-side-fisheye-pts.cjs`。
 *
 * 可选：仍支持多项式 ny=f(nx)（与 polylineNorm 二选一，优先折线）。
 *
 * ── 当「标定 = 整幅 960×768、页面原始流 = 真 960×768、只等比缩放显示」时，理论为何仍可能不一致？──
 *
 * 1) 数学上（先忽略 bias）：`object-fit: contain` 的绘制区有 contentW = iw·scale, contentH = ih·scale，故
 *    contentW/contentH = iw/ih，与**显示框 CSS 子像素**无关。若 **iw/ih = 960/768 = 5/4**（与标定同宽高比），
 *    则 rbox=rcal，**不会**走进「在 content 里再内接 5:4」的分支，叠层就是整块 contain 矩形；此时 ny = py/768
 *    与标定 960×768 上点的 **比例坐标一致**，**纯等比缩放**下应与标定样张一致。
 * 2) 因此若仍对不齐，**不是**「等比缩放少算了一步」，而是以下之一：
 *    - 运行时 **videoWidth/videoHeight 实际不是 960×768**（或不是 5:4），与「原始流就是 960×768」的假设矛盾；
 *    - 代码里对 ny 有 **SIDE_GUIDE_NY_BIAS / GLOBAL_OFFSET**（**不是**标定里给的 y），与**纯** py/768 的标定图相比会整体错开；
 *    - 叠层 **left/top** 未对准 `<video>` 的 **contain 内容矩形**（黑边/父子尺寸不一致/未解码完成时的 fallback 路径等）；
 *    - 对比的两张图**不是**同一路镜头、同畸变/同一次曝光，或标定与在线视频内容本身有变。
 * 3) 与标定 5:4 不一致的推流（如 16:9）时才会需要「在 content 内再内接 5:4」，此时才和「整幅 960×768
 *    标定图」出现几何语义差；**仅 960×768 场景不经过该附加几何**（见下 `videoIntrinsicMatchesSideGuideAspect` 早退）。
 * `SIDE_GUIDE_NY_GLOBAL_OFFSET` 仅作验算/临时拉齐，不替代上述根因。
 */

import { SIDE_FISHEYE_025M_NORM, SIDE_FISHEYE_05M_NORM } from './side-fisheye-pts.generated'

export type SideGuideCurve = {
  distanceM: number
  /** 该档曲线颜色 */
  color: string
  /** 归一化折线点（优先使用） */
  polylineNorm?: readonly { readonly x: number; readonly y: number }[]
  /** 多项式系数 [c4,c3,c2,c1,c0]；无 polylineNorm 时使用 */
  polyNyHighToLow?: readonly number[]
  /** 与多项式联用 */
  nxMin?: number
  nxMax?: number
}

/** 与实测标注一致 */
export const SIDE_GUIDE_REF_W = 960
export const SIDE_GUIDE_REF_H = 768

/**
 * 归一化 ny 整体微调（+ 表示更靠画面下方）。几何贴底后若仍偏差可改，典型 0～0.04；可先试 0 再微调。
 */
export const SIDE_GUIDE_NY_BIAS = 0.015

/**
 * 应急/验算用：在归一化 y 上统一加一个常数，整条线相对叠层整体下移（+ = 更靠画面下方，量纲 0～1 与 ny 相同）。
 * 你遇到的「标定图更靠下、远控页更靠上」应优先按文件头里四条原因排；**不要**把本项当长期正解。默认 0。
 */
export const SIDE_GUIDE_NY_GLOBAL_OFFSET = 0

export function sideNormFromPx(px: number, py: number): { x: number; y: number } {
  return { x: px / SIDE_GUIDE_REF_W, y: py / SIDE_GUIDE_REF_H }
}

/**
 * 解码后宽高是否与标定画幅 960×768 **同一宽高比**（5:4）。
 * 用 `iw*768 ≈ ih*960`（叉积）避免除法，排除「看似 720p 实则是 1280×720」等比例不一致。
 * 为真时，contain 的 content 高宽比 = iw/ih = rcal，**无需**在 content 里再做 5:4 内接。
 */
export function videoIntrinsicMatchesSideGuideAspect(iw: number, ih: number): boolean {
  if (iw <= 0 || ih <= 0) return false
  return Math.abs(iw * SIDE_GUIDE_REF_H - ih * SIDE_GUIDE_REF_W) < 0.5
}

/**
 * `object-fit: contain`（默认居中）下，视频画面在元素内的绘制矩形（CSS 像素）。
 * 必须用此矩形对齐引导层；仅用 getBoundingClientRect(video) 会包含两侧/上下黑边，曲线会画进留白区。
 */
export function videoObjectFitContainContentRect(
  video: HTMLVideoElement
): { contentLeft: number; contentTop: number; contentW: number; contentH: number; elW: number; elH: number } {
  const vr = video.getBoundingClientRect()
  const elW = Math.max(0, vr.width)
  const elH = Math.max(0, vr.height)
  const iw = video.videoWidth
  const ih = video.videoHeight
  if (iw <= 0 || ih <= 0 || elW <= 0 || elH <= 0) {
    return { contentLeft: 0, contentTop: 0, contentW: elW, contentH: elH, elW, elH }
  }
  const scale = Math.min(elW / iw, elH / ih)
  const contentW = iw * scale
  const contentH = ih * scale
  const contentLeft = (elW - contentW) / 2
  const contentTop = (elH - contentH) / 2
  return { contentLeft, contentTop, contentW, contentH, elW, elH }
}

/**
 * 侧视引导层在 `.video-wrapper` 内应对齐的矩形：与 `video` 的 **contain** 绘制区一致，
 * 并在绘制区内用 **960×768 标定宽高比** 内接，使 nx、ny 与像素网格等比。
 * 无 video 元数据时，在 wrapper 内按 960×768 contain 推算。
 */
export function sideGuideOverlayRectInWrapper(
  wrapper: HTMLElement,
  video: HTMLVideoElement | null
): { left: number; top: number; width: number; height: number } {
  const w = wrapper.clientWidth
  const h = wrapper.clientHeight
  if (w <= 0 || h <= 0) return { left: 0, top: 0, width: 0, height: 0 }

  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
    const wr = wrapper.getBoundingClientRect()
    const vr = video.getBoundingClientRect()
    if (vr.width > 1 && vr.height > 1) {
      const { contentLeft, contentTop, contentW, contentH } = videoObjectFitContainContentRect(video)
      const iw = video.videoWidth
      const ih = video.videoHeight

      /** 与 5:4 同比例：整幅即标定，叠层=contain 全矩形，ny 与 960×768 上 py/768 一一对应 */
      if (videoIntrinsicMatchesSideGuideAspect(iw, ih)) {
        return {
          left: vr.left - wr.left + contentLeft,
          top: vr.top - wr.top + contentTop,
          width: contentW,
          height: contentH,
        }
      }

      /**
       * 与标定 5:4 不同比例：在 content 内再内接 5:4；横向多留白时水平居中，竖向多留白时贴底（见注）。
       */
      const rcal = SIDE_GUIDE_REF_W / SIDE_GUIDE_REF_H
      const rbox = contentH > 0 ? contentW / contentH : rcal
      let ow = contentW
      let oh = contentH
      let insetX = 0
      let insetY = 0
      if (Math.abs(rbox - rcal) > 1e-3) {
        if (rbox > rcal) {
          ow = contentH * rcal
          oh = contentH
          insetX = (contentW - ow) / 2
        } else {
          ow = contentW
          oh = contentW / rcal
          insetY = contentH - oh
        }
      }
      return {
        left: vr.left - wr.left + contentLeft + insetX,
        top: vr.top - wr.top + contentTop + insetY,
        width: ow,
        height: oh,
      }
    }
  }

  const scale = Math.min(w / SIDE_GUIDE_REF_W, h / SIDE_GUIDE_REF_H)
  const dispW = SIDE_GUIDE_REF_W * scale
  const dispH = SIDE_GUIDE_REF_H * scale
  return {
    left: (w - dispW) / 2,
    top: h - dispH,
    width: dispW,
    height: dispH,
  }
}

function evalPolyHorner(coef: readonly number[], x: number): number {
  let v = coef[0]
  for (let k = 1; k < coef.length; k++) v = v * x + coef[k]
  return v
}

/**
 * 得到 viewBox 0..1 下的折线点（可选水平镜像，用于右摄像头）。
 * 有 polylineNorm 时沿用标定顶点；否则在 [nxMin, nxMax] 上按多项式均匀采样。
 */
export function sampleSideGuidePolyline(
  curve: SideGuideCurve,
  numSteps: number,
  flipX: boolean
): { x: number; y: number }[] {
  const raw = curve.polylineNorm
  if (raw && raw.length >= 2) {
    return raw.map((p) => {
      const xRaw = flipX ? 1 - p.x : p.x
      return {
        x: Math.min(1, Math.max(0, xRaw)),
        y: Math.min(
          1,
          Math.max(0, p.y + SIDE_GUIDE_NY_BIAS + SIDE_GUIDE_NY_GLOBAL_OFFSET)
        ),
      }
    })
  }

  const { polyNyHighToLow, nxMin = 0, nxMax = 1 } = curve
  if (!polyNyHighToLow || nxMax <= nxMin) return []

  const pts: { x: number; y: number }[] = []
  const n = Math.max(8, Math.floor(numSteps))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const nx = nxMin + (nxMax - nxMin) * t
    const ny = evalPolyHorner(polyNyHighToLow, nx)
    const clampedY = Math.min(
      1,
      Math.max(0, ny + SIDE_GUIDE_NY_BIAS + SIDE_GUIDE_NY_GLOBAL_OFFSET)
    )
    const xRaw = flipX ? 1 - nx : nx
    const clampedX = Math.min(1, Math.max(0, xRaw))
    pts.push({ x: clampedX, y: clampedY })
  }
  return pts
}

function pointsToPolylineAttr(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
}

export function sideGuidePolylineAttr(
  curve: SideGuideCurve,
  numSteps: number,
  flipX: boolean
): string {
  return pointsToPolylineAttr(sampleSideGuidePolyline(curve, numSteps, flipX))
}

/**
 * 默认侧向平行线：0.25 m / 0.5 m，与 fisheye_pts_*.txt 像素折线一致（960×768 归一化）
 * 界面用色保持红(0.25)/黄(0.5)。标定样张上黄/蓝点线只表示档位，与 UI 色不同属正常。
 * 需整体竖直微调时先查上面「两图一高一低」；临时补偿见 `SIDE_GUIDE_NY_GLOBAL_OFFSET`（默认 0）。
 */
export const DEFAULT_SIDE_PARALLEL_CURVES: SideGuideCurve[] = [
  {
    distanceM: 0.25,
    color: 'rgba(248, 113, 113, 0.92)',
    polylineNorm: SIDE_FISHEYE_025M_NORM,
  },
  {
    distanceM: 0.5,
    color: 'rgba(250, 204, 21, 0.92)',
    polylineNorm: SIDE_FISHEYE_05M_NORM,
  },
]

export const DEFAULT_SIDE_GUIDE_STROKE_W = 0.004
