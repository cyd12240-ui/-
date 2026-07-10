/**
 * table.js - 牌桌绘制模块
 * 绘制木质桌面 + 等待状态
 * 挂载在 PK.TableRenderer.Table 下
 */
window.PK = window.PK || {};
PK.TableRenderer = PK.TableRenderer || {};

(function () {
  var T = {};

  function drawTable(ctx, cx, cy, rx, ry) {
    // 桌面（暖木色，拒绝绿色毡面）
    var g = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy, rx);
    g.addColorStop(0, "#D4B896");
    g.addColorStop(0.5, "#C9AD84");
    g.addColorStop(1, "#B8996A");
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // 内圈墨线边框
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 6, ry - 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(120,90,50,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // 四角墨渍装饰
    ctx.fillStyle = "rgba(80,60,30,0.08)";
    [[-rx*0.7,0],[rx*0.7,0],[0,-ry*0.6],[0,ry*0.6]].forEach(function(p){
      ctx.beginPath();
      ctx.arc(cx + p[0], cy + p[1], 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawStatic() {
    var __ = PK.TableRenderer.__;
    if (!__.ctx) return;
    var W = __.W, H = __.H;
    var cx = W / 2, cy = H / 2;
    var rx = Math.min(W * 0.36, 260);
    var ry = Math.min(H * 0.28, 150);
    drawTable(__.ctx, cx, cy, rx, ry);
    __.ctx.fillStyle = "rgba(138,122,96,0.6)";
    __.ctx.font = "16px sans-serif";
    __.ctx.textAlign = "center";
    __.ctx.fillText("等待游戏开始...", cx, cy);
  }

  T.drawTable = drawTable;
  T.drawStatic = drawStatic;

  PK.TableRenderer.Table = T;
})();
