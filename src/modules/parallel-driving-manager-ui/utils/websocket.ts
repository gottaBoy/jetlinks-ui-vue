/**
 * 平行驾驶 WebSocket 工具
 * 用于实时接收车辆状态
 */

import { BASE_API } from '@jetlinks-web/constants'
import { getToken } from '@jetlinks-web/utils'

let ws: WebSocket | null = null
let reconnectTimer: NodeJS.Timeout | null = null
let reconnectCount = 0
const MAX_RECONNECT_COUNT = 10
const RECONNECT_DELAY = 3000

/**
 * 初始化 WebSocket 连接
 * @param vehicleId 车辆设备ID（可选）
 * @param cockpitId 驾驶舱设备ID（可选）
 * @param onMessage 消息回调
 * @param onError 错误回调
 * @param onClose 关闭回调
 */
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
    console.log('WebSocket 已连接，复用现有连接')
    return ws
  }

  // 构建查询参数
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
        if (onMessage) {
          onMessage(data)
        }
      } catch (error) {
        console.error('解析 WebSocket 消息失败:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('平行驾驶 WebSocket 错误:', error)
      if (onError) {
        onError(error)
      }
      // 尝试重连
      reconnect(vehicleId, cockpitId, onMessage, onError, onClose, onOpen)
    }

    ws.onclose = () => {
      console.log('平行驾驶 WebSocket 连接关闭')
      ws = null
      if (onClose) {
        onClose()
      }
      // 尝试重连
      reconnect(vehicleId, cockpitId, onMessage, onError, onClose, onOpen)
    }

    return ws
  } catch (error) {
    console.error('创建 WebSocket 连接失败:', error)
    return null
  }
}

/**
 * 重连 WebSocket
 */
const reconnect = (
  vehicleId?: string,
  cockpitId?: string,
  onMessage?: (data: any) => void,
  onError?: (error: Event) => void,
  onClose?: () => void,
  onOpen?: () => void
) => {
  if (reconnectCount >= MAX_RECONNECT_COUNT) {
    console.error('WebSocket 重连次数已达上限，停止重连')
    return
  }

  reconnectCount++
  console.log(`WebSocket 重连中... (${reconnectCount}/${MAX_RECONNECT_COUNT})`)

  reconnectTimer = setTimeout(() => {
    initParallelDrivingWebSocket(vehicleId, cockpitId, onMessage, onError, onClose, onOpen)
  }, RECONNECT_DELAY * reconnectCount)
}

/**
 * 关闭 WebSocket 连接
 */
export const closeParallelDrivingWebSocket = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectCount = 0

  if (ws) {
    ws.close()
    ws = null
    console.log('平行驾驶 WebSocket 连接已关闭')
  }
}

/**
 * 检查 WebSocket 连接状态
 */
export const isWebSocketConnected = (): boolean => {
  return ws !== null && ws.readyState === WebSocket.OPEN
}
