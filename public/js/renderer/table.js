/**
 * table.js - 背景绘制模块
 * 绘制全屏背景图 + 等待状态
 * 挂载在 PK.TableRenderer.Table 下
 */
window.PK = window.PK || {};
PK.TableRenderer = PK.TableRenderer || {};

(function () {
  var T = {};

  function drawBackground(ctx, W, H) {
    // 全屏背景
    var tableBg = PK.TableRenderer.__.tableBgCanvas;
    if (tableBg) {
      ctx.drawImage(tableBg, 0, 0, W, H);
    } else {
      // 回退：图片尚未加载时填暖色
      var g = ctx.createRadialGradient(W/2, H/2 - 30, 10, W/2, H/2, Math.max(W, H) * 0.7);
      g.addColorStop(0, "#D4B896");
      g.addColorStop(0.5, "#C9AD84");
      g.addColorStop(1, "#B8996A");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawStatic() {
    var __ = PK.TableRenderer.__;
    if (!__.ctx) return;
    drawBackground(__.ctx, __.W, __.H);
    __.ctx.fillStyle = "rgba(138,122,96,0.6)";
    __.ctx.font = "16px sans-serif";
    __.ctx.textAlign = "center";
    __.ctx.fillText("等待游戏开始...", __.cx, __.cy);
  }

  T.drawBackground = drawBackground;
  T.drawStatic = drawStatic;

  PK.TableRenderer.Table = T;
})();
