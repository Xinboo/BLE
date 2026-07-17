// 常见 BLE 串口透传模块的服务 UUID 白名单。
// 一律 128 位标准形式：Chrome 能自动补全 16 位数字，Bluefy 不能。
export const KNOWN_SERVICES = [
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART (NUS)
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / HC-08 / CC254x
  '0000fff0-0000-1000-8000-00805f9b34fb', // JDY-xx / BT-05
  '0000ffe5-0000-1000-8000-00805f9b34fb', // 部分 CC2541
  '0000af30-0000-1000-8000-00805f9b34fb', // BlueGiga
  '000018f0-0000-1000-8000-00805f9b34fb', // 打印 / 称重模块
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip RN4870 / BM70
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
];
