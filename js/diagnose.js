export async function diagnose() {
  const ua = navigator.userAgent;
  const isChromium = !!window.chrome && /Chrome|Chromium|Edg/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!window.isSecureContext) {
    return {
      ok: false,
      title: '需要通过 HTTPS 访问',
      reason: `当前地址是 ${location.protocol}//${location.host}，不属于 secure context。` +
        '浏览器只在 HTTPS、localhost 或 file:// 下开放蓝牙接口。',
      hint: '换用 HTTPS 域名打开本页即可。',
    };
  }

  if (!('bluetooth' in navigator)) {
    if (isIOS) {
      return {
        ok: false,
        title: '在 iPhone / iPad 上需要换一个浏览器',
        reason: 'iOS 与 iPadOS 强制所有浏览器使用系统的 WebKit 引擎，而 WebKit 至今没有实现 ' +
          'Web Bluetooth（相关提案自 2012 年起一直搁置）。因此 iOS 上的 Chrome、Edge、' +
          'Firefox 与 Safari 一样都无法访问蓝牙——这与网页写法无关，任何网页在这里都做不到。',
        hint: '可安装 Bluefy 或 WebBLE，它们自带 Web Bluetooth 实现，本页在其中可正常使用；' +
          '或改用电脑 / 安卓上的 Chrome、Edge。',
      };
    }
    if (!isChromium) {
      return {
        ok: false,
        title: '当前浏览器未实现 Web Bluetooth',
        reason: 'Firefox 与 Safari 均已明确表示不实现该标准。',
        hint: '请改用 Chrome 或 Edge。',
      };
    }
    return {
      ok: false,
      title: '此 Chromium 浏览器未开放蓝牙接口',
      reason: '内核是 Chromium，但 navigator.bluetooth 不存在。',
      hint: 'Linux 下可能需在 chrome://flags/#enable-web-bluetooth 开启；' +
        '部分二次开发的浏览器会裁剪该接口；若本页被嵌在 iframe 中，需授予 bluetooth 权限。',
    };
  }

  let warn = null;
  try {
    if (navigator.bluetooth.getAvailability) {
      const available = await navigator.bluetooth.getAvailability();
      if (!available) {
        warn = '系统报告未检测到可用的蓝牙适配器。若确认蓝牙已开启，可以照常点击扫描——' +
          '该检测在部分系统上会误报。';
      }
    }
  } catch { /* 不可用时忽略 */ }

  const engine = detectEngine();
  return {
    ok: true,
    warn,
    engine,
    reason: `环境正常（${engine}，已在 secure context）`,
  };
}

export function detectEngine() {
  const ua = navigator.userAgent;
  if (/Bluefy/i.test(ua)) return 'bluefy';
  if (/WebBLE/i.test(ua)) return 'bluefy';
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && 'bluetooth' in navigator) return 'bluefy';
  if (!!window.chrome && /Chrome|Chromium|Edg/i.test(ua)) return 'chrome';
  return 'chrome';
}
