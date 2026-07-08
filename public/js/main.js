/**
 * main.js - 应用入口
 * 初始化所有模块，连接 WebSocket
 */
(function () {
  function init() {
    // 初始化音效
    PK.Sound.init();

    // 初始化游戏客户端
    PK.GameClient.init();

    // 注册 WebSocket 事件
    PK.GameClient.registerWSEvents();

    // 连接 WebSocket
    PK.WSClient.connect();

    // 点击页面任意位置恢复 AudioContext（微信策略）
    document.addEventListener("touchstart", function () {
      PK.Sound.ensureResumed();
    }, { once: true });
    document.addEventListener("click", function () {
      PK.Sound.ensureResumed();
    }, { once: true });

    console.log("[App] Initialized");
  }

  // DOM 就绪后初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
