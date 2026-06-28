/**
 * useAdaptiveStream — 前端自适应码率降级
 *
 * 在 ZLM 不支持原生 WebRTC simulcast 的情况下，通过监听 getStats() 的丢包率，
 * 自动在 _high / _mid / _low 三个独立流之间切换，实现弱网自适应。
 *
 * 设计原则：
 * - 纯逻辑，不依赖 Vue/DOM，可在任何环境使用
 * - 阈值按摄像头优先级区分（前视 > 后视 > 侧视 > 挂后）
 * - 降级激进、恢复保守（避免来回抖动）
 * - 冷却期内不重复切换
 */

export type AbrLayer = '_high' | '_mid' | '_low'

export interface AbrStats {
  packetsLost: number
  packetsReceived: number
}

export interface AbrConfig {
  /** 可用层级列表，按优先级降序 */
  layers: AbrLayer[]
  /**
   * 丢包率阈值 %（降级：超过即切到下一层）
   * [toMid, toLow] — e.g. [10, 20] 表示 >10% → _mid, >20% → _low
   */
  downgradeThresholds: [number, number]
  /**
   * 丢包率阈值 %（恢复：低于此值才考虑升一级）
   */
  recoveryThreshold: number
  /** 连续满足恢复条件的采样次数后才升级 */
  recoveryWindow: number
  /** 切换冷却时间 ms，两次切换之间至少间隔 */
  switchCooldownMs: number
}

/**
 * 预置策略：按摄像头优先级
 */
export const ABR_PRESETS = {
  /** 前视：极高容错，H.264 丢包 15% 以内画质几乎无影响 */
  critical: {
    downgradeThresholds: [25, 40] as [number, number],
    recoveryThreshold: 5,
    recoveryWindow: 5,
    switchCooldownMs: 10_000,
  },
  /** 后视 */
  high: {
    downgradeThresholds: [20, 35] as [number, number],
    recoveryThreshold: 4,
    recoveryWindow: 4,
    switchCooldownMs: 10_000,
  },
  /** 左/右视 */
  normal: {
    downgradeThresholds: [18, 30] as [number, number],
    recoveryThreshold: 3,
    recoveryWindow: 4,
    switchCooldownMs: 10_000,
  },
  /** 挂后摄像头 */
  low: {
    downgradeThresholds: [15, 25] as [number, number],
    recoveryThreshold: 3,
    recoveryWindow: 4,
    switchCooldownMs: 10_000,
  },
} as const satisfies Record<string, Omit<AbrConfig, 'layers'>>

const DEFAULT_LAYERS: AbrLayer[] = ['_high', '_mid', '_low']

export interface AdaptiveStreamState {
  /** 当前激活的层级后缀 */
  currentLayer: AbrLayer
  /** 当前丢包率 % */
  lossRate: number
  /** 当前层级索引 (0=_high, 1=_mid, 2=_low) */
  layerIndex: number
}

export function createAdaptiveStream(
  presetKey: keyof typeof ABR_PRESETS = 'normal',
  layers: AbrLayer[] = DEFAULT_LAYERS,
) {
  const preset = ABR_PRESETS[presetKey]
  const config: AbrConfig = {
    layers,
    ...preset,
  }

  let _currentLayer: AbrLayer = layers[0]
  let _lastLossRate = 0
  let _recoveryStreak = 0
  let _lastSwitchAt = 0
  let _onLayerChange: ((layer: AbrLayer, prev: AbrLayer, reason: string) => void) | null = null

  const layerIndex = (layer: AbrLayer) => config.layers.indexOf(layer)

  const getState = (): AdaptiveStreamState => ({
    currentLayer: _currentLayer,
    lossRate: _lastLossRate,
    layerIndex: layerIndex(_currentLayer),
  })

  const getCurrentStream = (baseStream: string) => `${baseStream}${_currentLayer}`

  const onLayerChange = (cb: (layer: AbrLayer, prev: AbrLayer, reason: string) => void) => {
    _onLayerChange = cb
  }

  /**
   * 每采样周期调用一次，传入最新的 WebRTC 统计。
   * @returns 如果需要切换流（当前层级变了），返回新的流名；否则返回 null。
   */
  const feedStats = (stats: AbrStats, baseStream: string): string | null => {
    const total = stats.packetsReceived + stats.packetsLost
    if (total < 50) return null // 样本太少，不判断

    const lossRate = (stats.packetsLost / total) * 100
    _lastLossRate = lossRate

    const now = Date.now()
    const inCooldown = now - _lastSwitchAt < config.switchCooldownMs
    if (inCooldown) {
      // 冷却期内不切换，但恢复计数正常走（冷却结束可立即恢复）
      if (lossRate < config.recoveryThreshold) {
        _recoveryStreak++
      } else {
        _recoveryStreak = 0
      }
      return null
    }

    const idx = layerIndex(_currentLayer)
    if (idx < 0) return null

    // 降级判断
    const [toMid, toLow] = config.downgradeThresholds
    if (lossRate > toLow && idx < 2) {
      return commitSwitch(layers[2], 'loss_high', baseStream)
    }
    if (lossRate > toMid && idx < 1) {
      return commitSwitch(layers[1], 'loss_mid', baseStream)
    }

    // 恢复判断
    if (lossRate < config.recoveryThreshold && idx > 0) {
      _recoveryStreak++
      if (_recoveryStreak >= config.recoveryWindow) {
        _recoveryStreak = 0
        return commitSwitch(layers[idx - 1], 'recovery', baseStream)
      }
    } else {
      _recoveryStreak = 0
    }

    return null
  }

  const commitSwitch = (
    newLayer: AbrLayer,
    reason: string,
    baseStream: string,
  ): string | null => {
    const prev = _currentLayer
    if (newLayer === prev) return null

    _currentLayer = newLayer
    _lastSwitchAt = Date.now()
    _recoveryStreak = 0

    const newStream = getCurrentStream(baseStream)
    _onLayerChange?.(newLayer, prev, reason)
    return newStream
  }

  /** 重置到最高层级（例如重新连接时） */
  const reset = () => {
    _currentLayer = layers[0]
    _recoveryStreak = 0
    _lastLossRate = 0
  }

  return {
    getState,
    getCurrentStream,
    feedStats,
    onLayerChange,
    reset,
    config,
  }
}
