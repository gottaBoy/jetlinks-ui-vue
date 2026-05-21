import {
  computed,
  onBeforeUnmount,
  ref,
  watchEffect,
  type ComputedRef,
  type Ref,
} from 'vue'
import { sideGuideOverlayRectInWrapper } from './side-camera-guide-config'

export type OverlayRect = { left: number; top: number; width: number; height: number }

const ZERO: OverlayRect = { left: 0, top: 0, width: 0, height: 0 }

/**
 * 从详情页/VideoCell 根节点找到与侧视 `video-wrapper` 同语义的层：`object-fit:contain` 的视口（多为 `.video-wrapper`）；
 * layout C 为 `.layout-c-paint`；`root` 自身已是 `video-wrapper` 时直接返回。
 */
export function resolveCalibrationVideoWrapper(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  if (root.classList.contains('video-wrapper') || root.classList.contains('layout-c-paint')) return root
  const cPaint = root.querySelector<HTMLElement>(':scope .layout-c-paint')
  if (cPaint) return cPaint
  const vw = root.querySelector<HTMLElement>(':scope .video-wrapper')
  if (vw) return vw
  const v = root.querySelector('video')
  return (v?.parentElement as HTMLElement) ?? null
}

/**
 * HUD/叠层 与 `sideGuideOverlayRectInWrapper` 同一标定区时，定位参考元素（`position: absolute` 的 containing block）。
 */
export function resolveFrontOverlayAlignElement(
  host: HTMLElement,
  videoWrapper: HTMLElement
): HTMLElement {
  const vh = host.closest('.video-with-hud')
  if (vh) return vh as HTMLElement
  const cWrap = host.closest('.layout-c-video-wrap')
  if (cWrap && videoWrapper.parentElement === cWrap) return videoWrapper
  const lec = host.closest('.layout-e-center')
  if (lec) return lec as HTMLElement
  if (host.classList.contains('video-box') && host.contains(videoWrapper)) return host
  return host
}

/**
 * `ref="frontVideoCalibHostRef"`：任意布局下包住前视 VideoCell/内联前视 的壳；
 * 内部解析 `.video-wrapper` 或与 video 同层标定，再把叠层 rect 变到 `resolveFrontOverlayAlignElement` 的坐标系。
 * 与 `SideCameraParallelGuide` / `FrontCameraDistanceGuide` 同一套 `sideGuideOverlayRectInWrapper` 语义。
 */
export function useVideoCalibrationOverlayRect(
  hostRef: Ref<HTMLElement | null>,
  enabled: Ref<boolean>
) {
  const rect = ref<OverlayRect>({ ...ZERO })
  const videoCleanups: Array<() => void> = []
  let raf = 0

  function measure() {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      if (!enabled.value) {
        rect.value = { ...ZERO }
        return
      }
      const host = hostRef.value
      if (!host) {
        rect.value = { ...ZERO }
        return
      }
      const w = resolveCalibrationVideoWrapper(host)
      if (!w) {
        rect.value = { ...ZERO }
        return
      }
      const v = w.querySelector('video') as HTMLVideoElement | null
      const r0 = sideGuideOverlayRectInWrapper(w, v)
      const align = resolveFrontOverlayAlignElement(host, w)
      const a = align.getBoundingClientRect()
      const b = w.getBoundingClientRect()
      rect.value = {
        left: b.left - a.left + r0.left,
        top: b.top - a.top + r0.top,
        width: r0.width,
        height: r0.height,
      }
    })
  }

  function bindVideoListeners(vw: HTMLElement) {
    const v = vw.querySelector('video')
    if (!v || v.dataset.vcorBound === '1') return
    v.dataset.vcorBound = '1'
    const onVid = () => measure()
    v.addEventListener('loadedmetadata', onVid)
    v.addEventListener('loadeddata', onVid)
    v.addEventListener('emptied', onVid)
    videoCleanups.push(() => {
      v.removeEventListener('loadedmetadata', onVid)
      v.removeEventListener('loadeddata', onVid)
      v.removeEventListener('emptied', onVid)
      delete v.dataset.vcorBound
    })
  }

  const overlayStyle: ComputedRef<Record<string, string> | undefined> = computed(() => {
    if (!enabled.value) return undefined
    const { left, top, width, height } = rect.value
    if (width <= 0 || height <= 0) return undefined
    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      right: 'auto',
      bottom: 'auto',
      boxSizing: 'border-box',
    }
  })

  const onWinResize = () => measure()

  watchEffect((onCleanup) => {
    if (!enabled.value) {
      rect.value = { ...ZERO }
      onCleanup(() => {
        for (const u of videoCleanups) u()
        videoCleanups.length = 0
        window.removeEventListener('resize', onWinResize)
        cancelAnimationFrame(raf)
      })
      return
    }
    const host = hostRef.value
    if (!host) {
      onCleanup(() => {
        for (const u of videoCleanups) u()
        videoCleanups.length = 0
        window.removeEventListener('resize', onWinResize)
        cancelAnimationFrame(raf)
      })
      return
    }
    const w = resolveCalibrationVideoWrapper(host)
    if (w) {
      bindVideoListeners(w)
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(host)
    if (w) ro.observe(w)
    const mo = new MutationObserver(() => {
      const w2 = resolveCalibrationVideoWrapper(host)
      if (w2) bindVideoListeners(w2)
      measure()
    })
    mo.observe(host, { childList: true, subtree: true })
    window.addEventListener('resize', onWinResize)
    onCleanup(() => {
      for (const u of videoCleanups) u()
      videoCleanups.length = 0
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', onWinResize)
      cancelAnimationFrame(raf)
    })
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
    for (const u of videoCleanups) u()
    videoCleanups.length = 0
  })

  return { rect, overlayStyle, measure }
}
