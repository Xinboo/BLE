# BLE 串口透传调试台

浏览器端的 BLE 串口透传（串口转蓝牙模块）调试页面，基于 Web Bluetooth API，单文件无依赖。

## 功能

- 扫描并选择 BLE 设备，连接后**自动识别**串口透传服务，无需手填 UUID
- 文本 / HEX 双向收发，可选追加 `\r\n`
- 超过 20 字节自动分片发送（BLE 默认 MTU 限制）
- TX / RX 字节计数，发送后保留输入内容便于重复下发

## 浏览器要求

需要 Chrome / Edge 内核浏览器。Firefox 与 Safari 不支持 Web Bluetooth。

> **Web Bluetooth 只在 secure context 下可用**：即 HTTPS、`localhost`，或直接以 `file://` 打开。
> 通过 `http://<局域网IP>` 访问时 `navigator.bluetooth` 不存在，页面无法扫描设备。
> 详见下方「局域网访问」。

## 运行

直接用浏览器打开 `index.html` 即可，无需服务器。

或使用容器：

```bash
docker run --rm -p 8080:8080 ghcr.io/xinboo/ble:latest
```

然后访问 <http://localhost:8080>。

## 局域网访问

`localhost` 之外的 HTTP 地址无法使用 Web Bluetooth，需要 TLS。static-web-server 自带 TLS 支持，
准备好证书后挂载进容器即可：

```bash
docker run --rm -p 8443:8443 \
  -v /path/to/certs:/certs:ro \
  -e SERVER_PORT=8443 \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/certs/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/certs/key.pem \
  ghcr.io/xinboo/ble:latest
```

自签名证书会被浏览器拦截，需要在客户端信任该证书，否则仍不是 secure context。

## 支持的模块

预置了常见串口透传模块的服务 UUID 白名单（见 `index.html` 中的 `KNOWN_SERVICES`）：

| UUID | 模块 |
| --- | --- |
| `6e400001-…` | Nordic UART (NUS) 及兼容模块 |
| `0xFFE0` | HM-10 / HC-08 / CC254x |
| `0xFFF0` | JDY 系列 / BT-05 |
| `0xFFE5` | 部分写通道独立的 CC2541 模块 |
| `49535343-…` | Microchip RN4870 / BM70 |

Web Bluetooth 不允许访问未事先声明的 service，因此白名单是必需的。若你的模块使用私有 UUID，
页面会提示"UUID 不在预置白名单中"，把它的 service UUID 加入 `KNOWN_SERVICES` 数组即可。

## 镜像

`main` 分支每次推送都会构建并发布到 GHCR，同时提供 `linux/amd64` 与 `linux/arm64`。
