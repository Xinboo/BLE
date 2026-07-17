import { diagnose } from './diagnose.js';
import { createEngine, describeError, fmtUuid } from './ble-engine.js';

const $ = (id) => document.getElementById(id);
const logEl = $('log');

let engine = null;
let device = null;
let server = null;
let rxChar = null;
let txChar = null;
let txBytes = 0;
let rxBytes = 0;

// ── 日志与状态 ──

function log(text, cls = 'l-sys') {
  const t = new Date().toTimeString().slice(0, 8);
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = `<span class="t">[${t}]</span> `;
  d.appendChild(document.createTextNode(text));
  logEl.appendChild(d);
  if ($('autoScroll').checked) logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text, state) {
  $('statusText').textContent = text;
  $('dot').className = 'dot' + (state ? ' ' + state : '');
}

function setConnected(on) {
  $('btnDisc').disabled = !on;
  $('btnSend').disabled = !on;
  $('txInput').disabled = !on;
  $('btnScan').disabled = on;
}

function updateStats() {
  $('stats').textContent = `TX ${txBytes} B / RX ${rxBytes} B`;
}

// ── 工具函数 ──

const toHex = (buf) =>
  [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

function hexToBytes(str) {
  const clean = str.replace(/0x/gi, '').replace(/[\s,]+/g, '');
  if (clean.length === 0) throw new Error('HEX 内容为空');
  if (clean.length % 2) throw new Error('HEX 长度必须为偶数');
  if (/[^0-9a-f]/i.test(clean)) throw new Error('HEX 含非法字符');
  return new Uint8Array(clean.match(/../g).map(h => parseInt(h, 16)));
}

// ── 扫描与连接 ──

async function scan() {
  try {
    const diag = await diagnose();
    if (!diag.ok) {
      log(diag.reason, 'l-err');
      return;
    }

    engine = createEngine();
    log(`正在打开设备选择器…（${engine.name} 引擎）`);

    device = await engine.scan();
    device.addEventListener('gattserverdisconnected', onDisconnected);
    log(`已选择：${device.name || '(无名称)'} [${device.id}]`);

    await connect();
  } catch (e) {
    if (engine?.isCancellation(e)) {
      log('已取消选择。');
      return;
    }
    log('扫描失败：' + describeError(e), 'l-err');
    setStatus('错误', 'err');
  }
}

async function connect() {
  try {
    setStatus('连接中…');
    server = await engine.connect(device);
    log('GATT 已连接，正在识别串口服务…');

    const pair = await engine.discoverUART(server);
    if (!pair) {
      log('未找到可用的串口透传服务。该模块的 UUID 可能不在预置白名单中。', 'l-err');
      setStatus('无可用服务', 'err');
      engine.disconnect(device);
      return;
    }

    rxChar = pair.rxChar;
    txChar = pair.txChar;

    await engine.startNotify(rxChar, onReceive);

    showDeviceInfo(pair);
    setStatus('已连接：' + (device.name || device.id), 'on');
    setConnected(true);
    log('串口通道就绪，可以收发数据了。');
  } catch (e) {
    log('连接失败：' + describeError(e), 'l-err');
    setStatus('连接失败', 'err');
    setConnected(false);
  }
}

function showDeviceInfo(pair) {
  $('info').innerHTML = [
    `<div>设备：<code>${device.name || '(无名称)'}</code></div>`,
    `<div>服务：<code>${fmtUuid(pair.service.uuid)}</code></div>`,
    `<div>接收(Notify)：<code>${fmtUuid(pair.rxChar.uuid)}</code></div>`,
    `<div>发送(Write)：<code>${fmtUuid(pair.txChar.uuid)}</code>` +
      ` — ${pair.writeWithoutResponse ? '无应答写' : '有应答写'}</div>`,
  ].join('');
  log(`自动识别到串口服务 ${fmtUuid(pair.service.uuid)}`);
}

// ── 收发 ──

function onReceive(buffer) {
  rxBytes += buffer.byteLength;
  updateStats();
  const text = $('rxHex').checked
    ? toHex(buffer)
    : new TextDecoder().decode(buffer);
  log('← ' + text, 'l-rx');
}

async function send() {
  const raw = $('txInput').value;
  if (!raw) return;

  try {
    let bytes;
    if ($('txMode').value === 'hex') {
      bytes = hexToBytes(raw);
    } else {
      bytes = new TextEncoder().encode(raw + ($('txCRLF').checked ? '\r\n' : ''));
    }

    const CHUNK = 20;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      await engine.write(txChar, bytes.slice(i, i + CHUNK));
    }

    txBytes += bytes.length;
    updateStats();
    log('→ ' + ($('txMode').value === 'hex' ? toHex(bytes.buffer) : raw), 'l-tx');
  } catch (e) {
    log('发送失败：' + describeError(e), 'l-err');
  }
}

// ── 断开 ──

function onDisconnected() {
  setStatus('已断开');
  setConnected(false);
  $('info').innerHTML = '';
  rxChar = txChar = server = null;
  log('设备已断开连接。');
}

// ── 事件绑定 ──

$('btnScan').onclick = scan;
$('btnDisc').onclick = () => engine?.disconnect(device);
$('btnSend').onclick = send;
$('btnClear').onclick = () => {
  logEl.innerHTML = '';
  txBytes = rxBytes = 0;
  updateStats();
};
$('txInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send();
});

// ── 初始化 ──

setConnected(false);
updateStats();

diagnose().then((d) => {
  if (d.ok) {
    log('就绪，点击「扫描并选择设备」开始。');
    log(d.reason);
    if (d.warn) log('⚠ ' + d.warn, 'l-err');
    return;
  }
  $('noticeTitle').textContent = d.title;
  $('noticeBody').textContent = d.reason;
  $('noticeHint').innerHTML = '<b>怎么办：</b>' + d.hint;
  $('notice').hidden = false;
  $('btnScan').disabled = true;
  $('btnScan').title = d.title;
  setStatus('此浏览器不可用');
  log(d.title + '——详见上方说明。');
});
