import { KNOWN_SERVICES } from './services.js';

export class ChromeBleEngine {
  get name() { return 'Chrome'; }

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
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      const pair = await this._findPair(svc);
      if (pair) return pair;
    }
    return null;
  }

  async startNotify(char, callback) {
    await char.startNotifications();
    char.addEventListener('characteristicvaluechanged', (e) => {
      const dv = e.target.value;
      callback(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
    });
  }

  async write(char, data) {
    if (char.properties.writeWithoutResponse) {
      await char.writeValueWithoutResponse(data);
    } else {
      await char.writeValueWithResponse(data);
    }
  }

  disconnect(device) {
    if (device?.gatt.connected) {
      device.gatt.disconnect();
    }
  }

  isCancellation(e) {
    return e?.name === 'NotFoundError';
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
