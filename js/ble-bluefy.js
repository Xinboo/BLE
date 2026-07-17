var BluefyEngine = {
  name: 'Bluefy',

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
    return server.getPrimaryServices().catch(function() {
      var found = [];
      var i = 0;
      function next() {
        if (i >= KNOWN_SERVICES.length) return Promise.resolve(found);
        var uuid = KNOWN_SERVICES[i++];
        return server.getPrimaryService(uuid)
          .then(function(svc) { found.push(svc); return next(); })
          .catch(function() { return next(); });
      }
      return next();
    });
  },

  enableNotifications: function(char) {
    return char.startNotifications();
  },

  write: function(char, bytes) {
    if (typeof char.writeValue === 'function') return char.writeValue(bytes);
    if (typeof char.writeValueWithoutResponse === 'function') return char.writeValueWithoutResponse(bytes);
    if (typeof char.writeValueWithResponse === 'function') return char.writeValueWithResponse(bytes);
    return Promise.reject(new Error('该特征不支持写入'));
  },

  disconnect: function(device) {
    try { device && device.gatt.disconnect(); } catch(e) {}
  },

  isCancellation: function(e) {
    if (!e) return false;
    if (e.name === 'NotFoundError') return true;
    var msg = (e.message || String(e)).toLowerCase();
    return /cancel|abort|dismiss|user denied|no device/.test(msg);
  }
};
