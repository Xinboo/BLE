var engine = null;
var device = null, server = null, rxChar = null, txChar = null;
var txBytes = 0, rxBytes = 0;
var writeWithoutResponse = false;

function pickEngine() {
  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (/Bluefy|WebBLE/i.test(ua) || (isIOS && 'bluetooth' in navigator)) {
    return BluefyEngine;
  }
  return ChromeEngine;
}

var $ = function(id) { return document.getElementById(id); };
var logEl = $('log');

function log(text, cls) {
  cls = cls || 'l-sys';
  var t = new Date().toTimeString().slice(0, 8);
  var d = document.createElement('div');
  d.className = cls;
  d.innerHTML = '<span class="t">[' + t + ']</span> ';
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
  $('stats').textContent = 'TX ' + txBytes + ' B / RX ' + rxBytes + ' B';
}

function toHex(buf) {
  var arr = new Uint8Array(buf);
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    out.push(arr[i].toString(16).padStart(2, '0').toUpperCase());
  }
  return out.join(' ');
}

function hexToBytes(str) {
  var clean = str.replace(/0x/gi, '').replace(/[\s,]+/g, '');
  if (!clean.length) throw new Error('HEX 内容为空');
  if (clean.length % 2) throw new Error('HEX 长度必须为偶数');
  if (/[^0-9a-f]/i.test(clean)) throw new Error('HEX 含非法字符');
  var bytes = new Uint8Array(clean.length / 2);
  for (var i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}

function fmtUuid(u) {
  var m = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i.exec(u);
  return m ? '0x' + m[1].toUpperCase() : u;
}

function errMsg(e) {
  if (!e) return '未知错误';
  var n = e.name || e.code || '';
  var m = e.message || String(e);
  return n ? n + ' — ' + m : m;
}

// ── 扫描 ──

function scan() {
  if (!navigator.bluetooth) {
    log('当前浏览器不支持 Web Bluetooth，请用 Chrome / Edge。', 'l-err');
    return;
  }
  engine = pickEngine();
  log('正在打开设备选择器…（' + engine.name + ' 引擎）');
  engine.scan().then(function(dev) {
    device = dev;
    device.addEventListener('gattserverdisconnected', onDisconnected);
    log('已选择：' + (device.name || '(无名称)') + ' [' + device.id + ']');
    connect();
  }).catch(function(e) {
    if (engine.isCancellation(e)) { log('已取消选择。'); return; }
    log('扫描失败：' + errMsg(e), 'l-err');
    setStatus('错误', 'err');
  });
}

// ── 连接 ──

function connect() {
  setStatus('连接中…');
  engine.connect(device).then(function(srv) {
    server = srv;
    log('GATT 已连接，正在识别串口服务…');
    return engine.getServices(server);
  }).then(function(services) {
    return discoverSerialPair(services);
  }).then(function(found) {
    if (!found) {
      log('未找到串口透传服务。', 'l-err');
      setStatus('无可用服务', 'err');
      engine.disconnect(device);
      return;
    }
    rxChar.addEventListener('characteristicvaluechanged', onReceive);
    return engine.enableNotifications(rxChar).then(function() {
      var lines = [
        '<div>设备：<code>' + (device.name || '(无名称)') + '</code></div>',
        '<div>服务：<code>' + fmtUuid(found.uuid) + '</code></div>',
        '<div>接收(Notify)：<code>' + fmtUuid(rxChar.uuid) + '</code></div>',
        '<div>发送(Write)：<code>' + fmtUuid(txChar.uuid) + '</code>' +
          ' — ' + (writeWithoutResponse ? '无应答写' : '有应答写') + '</div>'
      ];
      $('info').innerHTML = lines.join('');
      log('识别到串口服务 ' + fmtUuid(found.uuid));
      setStatus('已连接：' + (device.name || device.id), 'on');
      setConnected(true);
      log('串口通道就绪，可以收发数据了。');
    });
  }).catch(function(e) {
    log('连接失败：' + errMsg(e), 'l-err');
    setStatus('连接失败', 'err');
    setConnected(false);
  });
}

function discoverSerialPair(services) {
  rxChar = null;
  txChar = null;
  var known = services.filter(function(svc) {
    return KNOWN_SERVICES.indexOf(svc.uuid) !== -1;
  });
  var i = 0;
  function tryNext() {
    if (i >= known.length) return Promise.resolve(null);
    var svc = known[i++];
    return svc.getCharacteristics().then(function(chars) {
      var notify = null, write = null;
      for (var j = 0; j < chars.length; j++) {
        if (!notify && (chars[j].properties.notify || chars[j].properties.indicate)) notify = chars[j];
        if (!write && (chars[j].properties.write || chars[j].properties.writeWithoutResponse)) write = chars[j];
      }
      if (notify && write) {
        rxChar = notify;
        txChar = write;
        writeWithoutResponse = write.properties.writeWithoutResponse;
        return svc;
      }
      return tryNext();
    }).catch(function() { return tryNext(); });
  }
  return tryNext();
}

// ── 接收 ──

function onReceive(e) {
  var dv = e.target.value;
  var buf = dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength);
  rxBytes += buf.byteLength;
  updateStats();
  var text;
  if ($('rxHex').checked) {
    text = toHex(buf);
  } else {
    text = new TextDecoder().decode(buf);
  }
  log('← ' + text, 'l-rx');
}

// ── 发送 ──

function send() {
  var raw = $('txInput').value;
  if (!raw) return;
  var bytes;
  try {
    if ($('txMode').value === 'hex') {
      bytes = hexToBytes(raw);
    } else {
      bytes = new TextEncoder().encode(raw + ($('txCRLF').checked ? '\r\n' : ''));
    }
  } catch (e) {
    log('输入错误：' + e.message, 'l-err');
    return;
  }

  var CHUNK = 20;
  var queue = Promise.resolve();
  for (var i = 0; i < bytes.length; i += CHUNK) {
    (function(part) {
      queue = queue.then(function() {
        return engine.write(txChar, part, writeWithoutResponse);
      });
    })(bytes.slice(i, i + CHUNK));
  }
  queue.then(function() {
    txBytes += bytes.length;
    updateStats();
    log('→ ' + ($('txMode').value === 'hex' ? toHex(bytes) : raw), 'l-tx');
  }).catch(function(e) {
    log('发送失败：' + errMsg(e), 'l-err');
  });
}

// ── 断开 ──

function onDisconnected() {
  setStatus('已断开');
  setConnected(false);
  $('info').innerHTML = '';
  rxChar = txChar = server = null;
  log('设备已断开连接。');
}

// ── 绑定 ──

$('btnScan').onclick = scan;
$('btnDisc').onclick = function() { if (engine && device) engine.disconnect(device); };
$('btnSend').onclick = send;
$('btnClear').onclick = function() { logEl.innerHTML = ''; txBytes = rxBytes = 0; updateStats(); };
$('txInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') send(); });

setConnected(false);
updateStats();
log('就绪，点击「扫描并选择设备」开始。');
