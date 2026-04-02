import { request } from '@jetlinks-web/core'

/**
 * 绑定驾驶舱到车端
 * @param params 绑定参数
 * @returns
 */
export const bind = (params: { cockpitDeviceId: string; vehicleDeviceId: string }) => {
  return request.post('/parallel-driving/bind', {}, { params })
}

/**
 * 解绑
 * @param params 解绑参数
 * @returns
 */
export const unbind = (params: { cockpitDeviceId: string; vehicleDeviceId: string }) => {
  // 将参数直接拼接在 URL 中作为查询参数
  const queryString = `cockpitDeviceId=${params.cockpitDeviceId}&vehicleDeviceId=${params.vehicleDeviceId}&force=true`
  return request.remove(`/parallel-driving/unbind?${queryString}`)
}

/**
 * 查询驾驶舱绑定的车
 * @param cockpitId 驾驶舱ID
 * @returns
 */
export const getBoundVehicle = (cockpitId: string) => {
  return request.get(`/parallel-driving/cockpit/${cockpitId}/vehicle`)
}

/**
 * 查询车被哪个驾驶舱绑定
 * @param vehicleId 车辆ID
 * @returns
 */
export const getBoundCockpit = (vehicleId: string) => {
  return request.get(`/parallel-driving/vehicle/${vehicleId}/cockpit`)
}

/**
 * 检查控制权限
 * @param params 权限检查参数
 * @returns
 */
export const checkPermission = (params: { cockpitDeviceId: string; vehicleDeviceId: string }) => {
  // 直接将参数对象作为查询参数传递，避免生成 params[cockpitDeviceId] 这种形式
  return request.get('/parallel-driving/permission/check', params)
}

/**
 * 查询绑定关系列表
 * @param data 查询条件
 * @returns
 */
export const queryBindList = (data: any) => {
  return request.post('/parallel-driving/bind/_query', data)
}

/**
 * 获取驾驶舱设备列表
 * @param data 查询条件
 * @returns
 */
export const getCockpitDevices = (data?: any) => {
  const terms = data?.terms || []
  // 仅查询并行驾驶驾驶舱产品：手柄 parallel-driving-joystick、驾驶舱 parallel-driving-cockpit
  terms.push({
    column: 'productId',
    termType: 'in',
    value: ['parallel-driving-joystick', 'parallel-driving-cockpit']
  })
  return request.post('/device-instance/_query/no-paging?paging=false', {
    terms,
    sorts: data?.sorts || [{ name: 'createTime', order: 'desc' }]
  })
}

/**
 * 获取车端设备列表
 * @param data 查询条件
 * @returns
 */
export const getVehicleDevices = (data?: any) => {
  const terms = data?.terms || []
  // 仅查询并行驾驶车辆产品：parallel-driving-vehicle
  terms.push({
    column: 'productId',
    termType: 'in',
    value: ['parallel-driving-vehicle', 'parallel-driving-product']
  })
  return request.post('/device-instance/_query/no-paging?paging=false', {
    terms,
    sorts: data?.sorts || [{ name: 'createTime', order: 'desc' }]
  })
}

/**
 * 查询车辆列表（带在线状态和绑定信息）
 * @param data 查询条件
 * @returns
 */
export const queryVehicles = (data: any) => {
  return request.post('/parallel-driving/vehicles/_query', data)
}

/**
 * 查询驾驶舱列表（带在线状态和绑定信息）
 * @param data 查询条件
 * @returns
 */
export const queryCockpits = (data: any) => {
  return request.post('/parallel-driving/cockpits/_query', data)
}

/**
 * 远程接管车辆
 * @param params 接管参数
 * @returns
 */
export const takeover = (params: { cockpitDeviceId: string; vehicleDeviceId: string }) => {
  return request.post('/parallel-driving/takeover', {}, { params })
}

/**
 * 释放控制
 * @param params 释放参数
 * @returns
 */
export const release = (params: { cockpitDeviceId: string; vehicleDeviceId: string }) => {
  return request.post('/parallel-driving/release', {}, { params })
}

/**
 * 发送控制指令
 * @param params 控制参数
 * @returns
 */
export const sendControlCommand = (params: {
  cockpitDeviceId: string
  vehicleDeviceId: string
  controlType: string
  params?: Record<string, any>
}) => {
  return request.post('/parallel-driving/control/command', params.params || {}, {
    params: {
      cockpitDeviceId: params.cockpitDeviceId,
      vehicleDeviceId: params.vehicleDeviceId,
      controlType: params.controlType
    }
  })
}

/**
 * 转向控制
 */
export const steering = (params: {
  cockpitDeviceId: string
  vehicleDeviceId: string
  angle: number
}) => {
  return request.post('/parallel-driving/control/steering', {}, {
    params: {
      cockpitDeviceId: params.cockpitDeviceId,
      vehicleDeviceId: params.vehicleDeviceId,
      angle: params.angle
    }
  })
}

/**
 * 加速控制
 */
export const accelerator = (params: {
  cockpitDeviceId: string
  vehicleDeviceId: string
  value: number
}) => {
  return request.post('/parallel-driving/control/accelerator', {}, {
    params: {
      cockpitDeviceId: params.cockpitDeviceId,
      vehicleDeviceId: params.vehicleDeviceId,
      value: params.value
    }
  })
}

/**
 * 制动控制
 */
export const brake = (params: {
  cockpitDeviceId: string
  vehicleDeviceId: string
  value: number
}) => {
  return request.post('/parallel-driving/control/brake', {}, {
    params: {
      cockpitDeviceId: params.cockpitDeviceId,
      vehicleDeviceId: params.vehicleDeviceId,
      value: params.value
    }
  })
}

/**
 * 档位控制
 */
export const gear = (params: {
  cockpitDeviceId: string
  vehicleDeviceId: string
  gear: number
}) => {
  return request.post('/parallel-driving/control/gear', {}, {
    params: {
      cockpitDeviceId: params.cockpitDeviceId,
      vehicleDeviceId: params.vehicleDeviceId,
      gear: params.gear
    }
  })
}

/**
 * 紧急停车
 */
export const emergencyStop = (params: {
  cockpitDeviceId: string
  vehicleDeviceId: string
}) => {
  return request.post('/parallel-driving/control/emergency-stop', {}, {
    params: {
      cockpitDeviceId: params.cockpitDeviceId,
      vehicleDeviceId: params.vehicleDeviceId
    }
  })
}

/**
 * 设置速度
 */
export const setSpeed = (params: {
  cockpitDeviceId: string
  vehicleDeviceId: string
  speed: number
}) => {
  return request.post('/parallel-driving/control/set-speed', {}, {
    params: {
      cockpitDeviceId: params.cockpitDeviceId,
      vehicleDeviceId: params.vehicleDeviceId,
      speed: params.speed
    }
  })
}

/**
 * 获取车辆 OTA 状态（从设备属性中读取 firmware_version, ota_status 等）
 */
export const getVehicleOTAStatus = (deviceId: string) => {
  return request.post(`/device-instance/${deviceId}/properties/_query/no-paging`, {
    terms: [
      {
        column: 'property',
        termType: 'in',
        value: ['firmware_version', 'image_ref', 'ota_status', 'ota_message', 'ota_agent_version', 'last_update_time']
      }
    ],
    sorts: [{ name: 'timestamp', order: 'desc' }]
  })
}

/**
 * 获取控制日志
 */
export const getControlLogs = (params: {
  cockpitDeviceId?: string
  vehicleDeviceId?: string
  limit?: number
}) => {
  // 对应后端 ParallelDrivingControlLogController#getControlLogs: GET /parallel-driving/control/logs
  return request.get('/parallel-driving/control/logs', { params })
}

/**
 * 获取控制统计信息
 */
export const getControlStatistics = (params: {
  cockpitDeviceId?: string
  vehicleDeviceId?: string
}) => {
  // 对应后端 ParallelDrivingControlLogController#getControlStatistics: GET /parallel-driving/control/statistics
  return request.get('/parallel-driving/control/statistics', { params })
}
