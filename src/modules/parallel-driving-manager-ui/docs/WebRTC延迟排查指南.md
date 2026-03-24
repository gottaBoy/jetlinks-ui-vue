# WVP + ZLMediaKit + WebRTC 延迟排查指南

## 一、链路与延迟来源

```
摄像头/设备 --[GB28181]--> WVP --[RTSP订阅]--> ZLMediaKit --[WebRTC]--> 浏览器
```

延迟主要来自：
1. **设备编码**：GOP、B 帧、编码器缓冲
2. **WVP 订阅**：RTSP 拉流缓冲
3. **ZLMediaKit**：协议转换、合并写入、RTP 打包
4. **浏览器**：jitter buffer、解码、渲染

---

## 二、ZLMediaKit 低延迟配置

编辑 `config.ini`（实际生效路径：`release/xxx/config.ini`）：

### 2.1 合并写入（最重要）

```ini
[general]
# 合并写入缓冲，单位毫秒。0=关闭，低延迟必须为 0
mergeWriteMS=0
```

### 2.2 RTP 打包

```ini
[rtp]
# 视频 MTU，越大延迟越高，建议不超过 1400
videoMtuSize=1400
# 音频 MTU
audioMtuSize=600
# H.264 低延迟打包，开启可能多 slice 时闪屏，可尝试 1
lowLatency=1
```

### 2.3 RTSP 拉流

```ini
[rtsp]
# 低延迟转发：1=不缓存 RTP，减少一帧延迟
lowLatency=1
# 非直连模式更利于 WebRTC（保证 sps/pps），若 WebRTC 无法播放再试 directProxy=1
directProxy=0
```

### 2.4 协议转换

```ini
[protocol]
# 2=使用源流相对时间戳，利于低延迟
modify_stamp=2
```

---

## 三、WVP 配置

在 `application.yml` 中关注：

- **play-timeout**：点播超时，不宜过大
- **媒体端口**：确保与 ZLMediaKit 互通
- **流代理**：若 WVP 对 RTSP 有二次缓冲，会加大延迟

---

## 四、设备/摄像头编码

| 参数 | 建议 | 说明 |
|------|------|------|
| **GOP / 关键帧间隔** | 1–2 秒 | 越大延迟越高，2 秒 GOP 至少约 1 秒延迟 |
| **B 帧** | 关闭 | B 帧会明显增加编码延迟 |
| **编码延迟** | 尽量低 | 部分编码器有“低延迟”模式 |

---

## 五、排查步骤

### 5.1 确认 ZLMediaKit 配置

```bash
# 查看实际加载的配置
grep -E "mergeWriteMS|lowLatency|directProxy" config.ini
```

重点确认：`mergeWriteMS=0`，`rtsp.lowLatency=1`。

### 5.2 测 RTSP 直连延迟

用 ffplay 测 ZLMediaKit 的 RTSP 输出延迟：

```bash
ffplay -fflags nobuffer -flags low_delay -framedrop -rtsp_transport tcp rtsp://ZLMediaKit地址/流路径
```

若此处延迟就大，问题在 ZLMediaKit 之前（WVP 或设备）。

### 5.3 测 WebRTC 延迟

用 ZLMediaKit 自带 WebRTC 测试页：`http://服务器/index/webrtc/`，对比同一路流的 WebRTC 与 RTSP 延迟差异。

### 5.4 抓包看缓冲

- 用 Wireshark 抓 RTP，看包间隔是否均匀
- 包间隔忽大忽小、成批到达，说明有缓冲堆积

### 5.5 浏览器端

- Chrome 的 jitter buffer 无法直接配置
- 可尝试 `chrome://flags` 中与 WebRTC 相关的实验选项
- 不同浏览器延迟可能不同，可对比测试

---

## 六、常见原因速查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 延迟 3–5 秒 | GOP 偏大 | 设备端将 GOP 调为 1–2 秒 |
| 延迟 1–2 秒 | 合并写入或 RTSP 缓冲 | 检查 mergeWriteMS、rtsp.lowLatency |
| 延迟且卡顿 | 网络抖动、丢包 | 检查网络、适当增加缓冲（会提高延迟） |
| 首帧慢 | 等待关键帧 | 确保 GOP 不要过大 |
| WebRTC 比 RTSP 更卡 | 浏览器 jitter buffer | 换浏览器或接受一定延迟 |

---

## 七、预期延迟

同内网、配置合理时，大致范围：

- **理想**：300–800ms
- **一般**：1–2 秒
- **偏高**：2 秒以上，需按上述项逐项排查
