import { KNOWN_SERVICES } from './services.js';

export class BluefyBleEngine {
  get name() { return 'Bluefy'; }

  async scan() {
    return await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICES,
    });
  }

  async connect(device) {
    return await device.gatt.connect();
  }

  async discoverUART(server) {
    // 优先尝试无参数调用，Bluefy 可能不支持，退回逐个 UUID 查询
    let services = [];
    try {
      services = await server.getPrimaryServices();
    } catch {
      services = await this._queryServicesOneByOne(server);
    }

    for (const svc of services) {
      const pair = await this._findPair(svc);
      if (pair) return pair;
    }
    return null;
  }

  async startNotify(char, callback) {
    try {
      await char.startNotifications();
    } catch {
      // Bluefy 对某些特征的 startNotifications 可能失败，
      // 但设备端仍会主动推数据，不阻断流程。
    }
    char.addEventListener('characteristicvaluechanged', (e) => {
      const value = e.target.value;
      // Bluefy 的 DataView 可能是大 ArrayBuffer 上的一个切片，
      // 直接取 .buffer 会从 offset 0 开始而不是实际数据位置。
      // 必须用 byteOffset + byteLength 精确提取。
      let buf;
      if (value instanceof DataView) {
        buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      } else if (value instanceof ArrayBuffer) {
        buf = value;
      } else {
        buf = value.buffer ? value.buffer.slice(0) : value;
      }
      callback(buf);
    });
  }

  async write(char, data) {
    // 先检测方法是否存在，Bluefy 可能只实现了其中一种
    if (char.properties.writeWithoutResponse && typeof char.writeValueWithoutResponse === 'function') {
      try {
        await char.writeValueWithoutResponse(data);
        return;
      } catch {
        // 回退到有应答写
      }
    }
    if (typeof char.writeValueWithResponse === 'function') {
      await char.writeValueWithResponse(data);
      return;
    }
    // 最后兜底：旧版 API
    if (typeof char.writeValue === 'function') {
      await char.writeValue(data);
      return;
    }
    throw new Error('该特征不支持写入');
  }

  disconnect(device) {
    // 不依赖 gatt.connected 属性，直接尝试断开
    try {
      device?.gatt.disconnect();
    } catch { /* 已断开或不支持，静默 */ }
  }

  isCancellation(e) {
    if (e?.name === 'NotFoundError') return true;
    const text = (e?.message || String(e) || '').toLowerCase();
    return /cancel|abort|dismiss|user denied|no device selected/.test(text);
  }

  async _queryServicesOneByOne(server) {
    const found = [];
    for (const uuid of KNOWN_SERVICES) {
      try {
        const svc = await server.getPrimaryService(uuid);
        found.push(svc);
      } catch { /* 该服务不存在，跳过 */ }
    }
    return found;
  }

  async _findPair(service) {
    let chars;
    try { chars = await service.getCharacteristics(); } catch { return null; }

    const notify = chars.find(c => c.properties.notify || c.properties.indicate);
    const write = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);
    if (!notify || !write) return null;

    return {
      service,
      rxChar: notify,
      txChar: write,
      writeWithoutResponse: write.properties.writeWithoutResponse,
    };
  }
}
