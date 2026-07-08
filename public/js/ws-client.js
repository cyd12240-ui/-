/**
 * ws-client.js - WebSocket 客户端
 * 负责与服务端的实时通信
 */
window.PK = window.PK || {};

PK.WSClient = (function () {
  let ws = null;
  let playerId = null;
  let connected = false;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let pingInterval = null;
  const handlers = {};
  let onOpenCallback = null;

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = protocol + "//" + location.host;

    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error("[WS] Connection failed:", e);
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      console.log("[WS] Connected");
      connected = true;
      reconnectAttempts = 0;
      startPing();
      if (onOpenCallback) onOpenCallback();
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onclose = function () {
      console.log("[WS] Disconnected");
      connected = false;
      stopPing();
      scheduleReconnect();
    };

    ws.onerror = function (err) {
      console.error("[WS] Error:", err ? err.message : "unknown");
    };
  }

  function handleMessage(msg) {
    var type = msg.type;
    var data = msg.data;

    // 特殊处理：connected（含 playerId）
    if (type === "connected") {
      playerId = data.playerId;
      console.log("[WS] Assigned playerId:", playerId);
    }

    // 分发到注册的处理器
    var list = handlers[type];
    if (list) {
      for (var i = 0; i < list.length; i++) {
        try { list[i](data); } catch (e) { console.error("[WS] Handler error:", type, e); }
      }
    }

    // 也分发到通配处理器
    var anyList = handlers["*"];
    if (anyList) {
      for (var i = 0; i < anyList.length; i++) {
        try { anyList[i](type, data); } catch (e) { console.error("[WS] Wildcard handler error:", e); }
      }
    }
  }

  function send(type, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send, not connected:", type);
      return false;
    }
    var msg = JSON.stringify({ type: type, data: data || {} });
    ws.send(msg);
    return true;
  }

  function on(type, callback) {
    if (!handlers[type]) handlers[type] = [];
    handlers[type].push(callback);
    return function () {
      var idx = handlers[type].indexOf(callback);
      if (idx >= 0) handlers[type].splice(idx, 1);
    };
  }

  function off(type, callback) {
    if (!handlers[type]) return;
    if (callback) {
      var idx = handlers[type].indexOf(callback);
      if (idx >= 0) handlers[type].splice(idx, 1);
    } else {
      delete handlers[type];
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectAttempts++;
    var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
    console.log("[WS] Reconnecting in " + delay + "ms (attempt " + reconnectAttempts + ")");
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function startPing() {
    stopPing();
    pingInterval = setInterval(function () {
      send("ping");
    }, 10000);
  }

  function stopPing() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  function disconnect() {
    stopPing();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    connected = false;
  }

  function getPlayerId() { return playerId; }
  function isConnected() { return connected; }
  function onOpen(cb) { onOpenCallback = cb; }

  return {
    connect: connect,
    send: send,
    on: on,
    off: off,
    disconnect: disconnect,
    getPlayerId: getPlayerId,
    isConnected: isConnected,
    onOpen: onOpen
  };
})();
