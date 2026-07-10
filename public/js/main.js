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

// ===== Lobby Liquid Glass Highlight
(function() {
  var c = document.getElementById('glassCard');
  if (!c) return;
  var r = document.documentElement;
  function h(x,y) { r.style.setProperty('--mx',x+'%'); r.style.setProperty('--my',y+'%'); }
  window.addEventListener('pointermove',function(e){ h((e.clientX/innerWidth*100).toFixed(1),(e.clientY/innerHeight*100).toFixed(1)); });
  var t=0,u=false; window.addEventListener('pointermove',function(){u=true;},{once:true});
  (function L(){ if(!u){ t+=0.006; h((50+Math.sin(t)*20).toFixed(1),(35+Math.cos(t*0.8)*15).toFixed(1)); } requestAnimationFrame(L); })();
})();
