var ChromeEngine = {
  name: 'Chrome',

  scan: function() {
    return navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICES
    });
  },

  connect: function(device) {
    return device.gatt.connect();
  },

  getServices: function(server) {
    return server.getPrimaryServices();
  },

  enableNotifications: function(char) {
    return char.startNotifications();
  },

  write: function(char, bytes, withoutResponse) {
    if (withoutResponse) return char.writeValueWithoutResponse(bytes);
    return char.writeValueWithResponse(bytes);
  },

  disconnect: function(device) {
    if (device && device.gatt.connected) device.gatt.disconnect();
  },

  isCancellation: function(e) {
    return e && e.name === 'NotFoundError';
  }
};
