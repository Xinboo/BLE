import { detectEngine } from './diagnose.js';
import { ChromeBleEngine } from './ble-chrome.js';
import { BluefyBleEngine } from './ble-bluefy.js';
export { KNOWN_SERVICES } from './services.js';

export function createEngine() {
  const type = detectEngine();
  return type === 'bluefy' ? new BluefyBleEngine() : new ChromeBleEngine();
}

export function describeError(e) {
  if (!e) return '未知错误';
  const name = e.name || e.code || '(无错误类型)';
  const msg = e.message || String(e);
  return `${name} — ${msg}`;
}

export function fmtUuid(u) {
  const m = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i.exec(u);
  return m ? '0x' + m[1].toUpperCase() : u;
}
