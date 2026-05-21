/**
 * 前摄像头距离引导线校准（归一化坐标）
 *
 * 标定参考画幅：960×768（与车端/推流及 UI 内接层一致）
 *   nx = 像素 x / 960,  ny = 像素 y / 768
 *
 * 渲染：FrontCameraDistanceGuide 在 SVG viewBox 0~960×0~768 上按上述逻辑画线，
 * 再用 preserveAspectRatio="xMidYMid meet" 与视频同层等比缩放（「在 960×768 上画好、整体缩小/放大」）。
 *
 * 距离档：0.5、1、2、3、5、8、10 m（横线 + 注记；左右纵线由同侧点 PCA/折线/延长）
 */

export type NormPoint = { x: number; y: number }

export type FrontGuideRow = {
  /** 物理距离（米），仅用于展示 */
  distanceM: number
  /** 可选文案；界面默认仅显示 distanceM 数字（无单位） */
  metersLabel: string
  left: NormPoint
  right: NormPoint
  /** 该档水平标线颜色（WCAG 对比度建议在动态视频上配合描边使用） */
  color: string
}

/** 与标定参考画幅 960×768 一致（内接层与 normFromPx 分母） */
export const REF_CALIBRATION_W = 960
export const REF_CALIBRATION_H = 768

/**
 * 归一化 y 上整体微调（+ 更靠画面下方，曲线下移）。与侧视 `SIDE_GUIDE_NY_GLOBAL_OFFSET` 同语义。
 * 不改动各档点表，仅在渲染时加在 ny 上；需要时再改（常见量级 0～0.04）。默认 0 不下移。
 */
export const FRONT_GUIDE_NY_GLOBAL_OFFSET = 0

/** 从标定参考画幅下的像素坐标（宽 960、高 768）转为归一化坐标 */
export function normFromPx(px: number, py: number): NormPoint {
  return { x: px / REF_CALIBRATION_W, y: py / REF_CALIBRATION_H }
}

/**
 * 默认各档点（0.5 / 1 / … m）：下式与在 960×768 上写 px/960、py/768 等价；分数写法保留与早期 252×200 记点同一比例，避免重标前漂移。
 * 左右「纵向」引导：同侧各点 PCA 校准直线段（fitCalibratedBoundarySegment）
 */
export const DEFAULT_FRONT_GUIDE_ROWS: FrontGuideRow[] = [
  {
    distanceM: 0.5,
    metersLabel: '0.5',
    left: { x: 89 / 252, y: 187 / 200 },
    right: { x: 176 / 252, y: 187 / 200 },
    color: '#5eead4',
  },
  {
    distanceM: 1,
    metersLabel: '1',
    left: { x: 96 / 252, y: 167 / 200 },
    right: { x: 163 / 252, y: 167 / 200 },
    color: '#facc15',
  },
  {
    distanceM: 2,
    metersLabel: '2',
    left: { x: 102 / 252, y: 152 / 200 },
    right: { x: 155 / 252, y: 152 / 200 },
    color: '#86efac',
  },
  {
    distanceM: 3,
    metersLabel: '3',
    left: { x: 107 / 252, y: 137 / 200 },
    right: { x: 146 / 252, y: 137 / 200 },
    color: '#c4b5fd',
  },
  {
    distanceM: 5,
    metersLabel: '5',
    left: { x: 111 / 252, y: 127 / 200 },
    right: { x: 140 / 252, y: 127 / 200 },
    color: '#fdba74',
  },
  {
    distanceM: 8,
    metersLabel: '8',
    left: { x: 115 / 252, y: 117 / 200 },
    right: { x: 134 / 252, y: 117 / 200 },
    color: '#7dd3fc',
  },
  {
    distanceM: 10,
    metersLabel: '10',
    left: { x: 116 / 252, y: 114 / 200 },
    right: { x: 132 / 252, y: 114 / 200 },
    color: '#f0abfc',
  },
]

/** 边界线颜色（左右车道线走向） */
export const DEFAULT_BOUNDARY_STROKE = 'rgba(255,255,255,0.82)'
