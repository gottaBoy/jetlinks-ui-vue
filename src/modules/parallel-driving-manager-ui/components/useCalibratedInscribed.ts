import { ref, watchEffect, computed, type Ref } from 'vue'

/**
 * 将「标定参考画幅」rw×rh 在容器内做 contain 内接，与标定表归一化坐标 (px/rw, py/rh) 的语义一致。
 * 前视参考见 front-camera-guide-config（960×768）；左右鱼眼 960×768 见 side-camera-guide-config。
 */
export function getCalibratedInscribedBox(
  containerW: number,
  containerH: number,
  refW: number,
  refH: number
) {
  if (containerW <= 0 || containerH <= 0 || refW <= 0 || refH <= 0) return null
  const k = Math.min(containerW / refW, containerH / refH)
  const w = refW * k
  const h = refH * k
  const left = (containerW - w) / 2
  const top = (containerH - h) / 2
  return { k, w, h, left, top }
}

export function useCalibratedInscribed(
  hostRef: Ref<HTMLElement | null>,
  spec: Ref<{ rw: number; rh: number } | null>
) {
  const size = ref({ w: 0, h: 0 })

  watchEffect((onCleanup) => {
    if (!spec.value) {
      size.value = { w: 0, h: 0 }
      return
    }
    const el = hostRef.value
    if (!el) {
      size.value = { w: 0, h: 0 }
      return
    }
    const update = () => {
      const pw = el.clientWidth
      const ph = el.clientHeight
      if (pw > 0 && ph > 0) size.value = { w: pw, h: ph }
    }
    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  const wrapperStyle = computed(() => {
    const s = spec.value
    if (!s) return undefined
    const m = getCalibratedInscribedBox(size.value.w, size.value.h, s.rw, s.rh)
    if (!m) return undefined
    return { width: `${m.w}px`, height: `${m.h}px`, flex: '0 0 auto' as const }
  })

  /** 与内接矩形重合（子元素 position:absolute; inset:0 即铺满标定区） */
  const inscribedBoxStyle = computed<Record<string, string> | undefined>(() => {
    const s = spec.value
    if (!s) return undefined
    const m = getCalibratedInscribedBox(size.value.w, size.value.h, s.rw, s.rh)
    if (!m) return undefined
    return {
      position: 'absolute',
      left: `${m.left}px`,
      top: `${m.top}px`,
      width: `${m.w}px`,
      height: `${m.h}px`,
      right: 'auto',
      bottom: 'auto',
      boxSizing: 'border-box',
    }
  })

  return { wrapperStyle, inscribedBoxStyle }
}
