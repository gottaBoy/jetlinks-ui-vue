/**
 * 平行驾驶 WebSocket 工具
 * 用于实时接收车辆状态
 * 支持指数退避重连（集群模式下节点重启时自动恢复）
 */

import { BASE_API } from '@jetlinks-web/constants'
import { getToken } from '@jetlinks-web/utils'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectCount = 0
let intentionallyClosed = false

const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000
const JITTER_FACTOR = 0.3

function getReconnectDelay(): number {
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, reconnectCount), MAX_DELAY_MS)
  const jitter = exponential * JITTER_FACTOR * (Math.random() * 2 - 1)
  return Math.max(BASE_DELAY_MS, exponential + jitter)
}

export const initParallelDrivingWebSocket = (
  vehicleId?: string,
  cockpitId?: string,
  onMessage?: (data: any) => void,
  onError?: (error: Event) => void,
  onClose?: () => void,
  onOpen?: () => void
): WebSocket | null => {
  const token = getToken()
  if (!token) {
    console.warn('未找到 Token，无法建立 WebSocket 连接')
    return null
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    return ws
  }

  intentionallyClosed = false

  const params = new URLSearchParams()
  if (vehicleId) {
    params.append('vehicleId', vehicleId)
  }
  if (cockpitId) {
    params.append('cockpitId', cockpitId)
  }

  const protocol = window.location.protocol.replace('http', 'ws')
  const host = document.location.host
  const url = `${protocol}//${host}${BASE_API}/parallel-driving/ws?${params.toString()}`

  try {
    ws = new WebSocket(url)

    ws.onopen = () => {
      console.log('平行驾驶 WebSocket 连接成功')
      reconnectCount = 0
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      onOpen?.()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch (error) {
        console.error('解析 WebSocket 消息失败:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('平行驾驶 WebSocket 错误:', error)
      onError?.(error)
    }

    ws.onclose = () => {
      ws = null
      onClose?.()
      if (!intentionallyClosed) {
        scheduleReconnect(vehicleId, cockpitId, onMessage, onError, onClose, onOpen)
      }
    }

    return ws
  } catch (error) {
    console.error('创建 WebSocket 连接失败:', error)
    if (!intentionallyClosed) {
      scheduleReconnect(vehicleId, cockpitId, onMessage, onError, onClose, onOpen)
    }
    return null
  }
}

const scheduleReconnect = (
  vehicleId?: string,
  cockpitId?: string,
  onMessage?: (data: any) => void,
  onError?: (error: Event) => void,
  onClose?: () => void,
  onOpen?: () => void
) => {
  if (intentionallyClosed) return

  const delay = getReconnectDelay()
  reconnectCount++

  console.log(
    `WebSocket 重连中... 第 ${reconnectCount} 次，${Math.round(delay / 1000)}s 后重试`
  )

  reconnectTimer = setTimeout(() => {
    if (!intentionallyClosed) {
      initParallelDrivingWebSocket(vehicleId, cockpitId, onMessage, onError, onClose, onOpen)
    }
  }, delay)
}

export const closeParallelDrivingWebSocket = () => {
  intentionallyClosed = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectCount = 0

  if (ws) {
    ws.close()
    ws = null
  }
}

export const isWebSocketConnected = (): boolean => {
  return ws !== null && ws.readyState === WebSocket.OPEN
}
