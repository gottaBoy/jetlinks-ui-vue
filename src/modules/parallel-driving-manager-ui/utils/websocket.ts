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
    const socket = new WebSocket(url)
    ws = socket

    socket.onopen = () => {
      if (ws !== socket) return
      console.log('平行驾驶 WebSocket 连接成功')
      reconnectCount = 0
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      onOpen?.()
    }

    socket.onmessage = (event) => {
      if (ws !== socket) return
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch (error) {
        console.error('解析 WebSocket 消息失败:', error)
      }
    }

    socket.onerror = (error) => {
      if (ws !== socket) return
      console.error('平行驾驶 WebSocket 错误:', error)
      onError?.(error)
    }

    // 必须用 socket 引用判断：旧连接异步 onclose 不能清空已替换的新 ws，否则会误触发重连、控制台刷屏
    socket.onclose = () => {
      if (ws !== socket) return
      ws = null
      onClose?.()
      if (!intentionallyClosed) {
        scheduleReconnect(vehicleId, cockpitId, onMessage, onError, onClose, onOpen)
      }
    }

    return socket
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

/** 已建立或正在握手，避免重复 init 把正在连的 socket 关掉 */
export const isParallelDrivingWebSocketActive = (): boolean => {
  return (
    ws !== null &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  )
}
