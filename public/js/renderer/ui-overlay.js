/**
 * ui-overlay.js - HTML/CSS UI 控制层
 * 管理游戏界面的 HTML overlay（操作栏、道具栏、浮层等）
 * 挂载在 PK.UIOverlay 下
 */
window.PK = window.PK || {};

PK.UIOverlay = (function () {
  var initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    // 绑定全局 UI 事件（空格跳过动画）
    document.addEventListener("keydown", function(e) {
      if (e.key === " " || e.key === "Space") {
        var btn = document.getElementById("btn-skip-anim");
        if (btn && btn.style.display !== "none") {
          // 触发跳过
          btn.click();
        }
      }
    });
  }

  function showOverlay(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "flex";
  }

  function hideOverlay(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  return {
    init: init,
    showOverlay: showOverlay,
    hideOverlay: hideOverlay
  };
})();
