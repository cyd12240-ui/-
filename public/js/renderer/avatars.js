/**
 * avatars.js - 角色形象绘制模块
 * 人物头像绘制 + 蛋液效果 + 昵称/积分/筹码显示
 * 挂载在 PK.TableRenderer.Avatars 下
 */
window.PK = window.PK || {};
PK.TableRenderer = PK.TableRenderer || {};

(function () {
  var A = {};

  function drawPerson(ctx, x, y, p, isMe) {
    if (!p) return;
    var __ = PK.TableRenderer.__;
    var W = __.W, H = __.H;
    var hr = Math.min(20, W * 0.035);

    var isFolded = p.folded;
    var charIds = ["liubei", "xiaosha", "zhangfei", "guanyu", "zhangchunhua"];
    var charId = charIds[p.avatarId] || charIds[0];
    var charCanvas = __.charImages[charId];

    if (charCanvas) {
      ctx.save();
      ctx.translate(x, y);
      if (isFolded) ctx.globalAlpha = 0.5;
      var sc = Math.min(72 / charCanvas.width, 72 / charCanvas.height);
      ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 4;
      ctx.drawImage(charCanvas, -charCanvas.width * sc / 2, -charCanvas.height * sc / 2, charCanvas.width * sc, charCanvas.height * sc);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      // 无角色贴图时绘制卡通简笔画
      ctx.save();
      ctx.translate(x, y);
      if (isFolded) ctx.globalAlpha = 0.5;
      ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 4;
      var bw = hr * 1.5, bh = hr * 1.6;
      ctx.fillStyle = "#5DADE2";
      roundRect(ctx, -bw/2, hr+4, bw, bh, 5); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI*2);
      ctx.fillStyle = "#FFE0B2"; ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = p.avatarId === 1 ? "#4A148C" : "#3E2723";
      ctx.beginPath(); ctx.arc(0, -hr*0.25, hr*0.9, Math.PI, 0); ctx.fill();
      ctx.fillRect(-hr*0.9, -hr*0.05, hr*1.8, hr*0.18);
      var ey = -hr*0.1, eo = hr*0.25;
      if (isFolded) {
        ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-eo-2, ey-2); ctx.lineTo(-eo+2, ey+2);
        ctx.moveTo(-eo+2, ey-2); ctx.lineTo(-eo-2, ey+2);
        ctx.moveTo(eo-2, ey-2); ctx.lineTo(eo+2, ey+2);
        ctx.moveTo(eo+2, ey-2); ctx.lineTo(eo-2, ey+2); ctx.stroke();
      } else {
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(-eo, ey, hr*0.08, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eo, ey, hr*0.08, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(-eo+1, ey-1, hr*0.03, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eo+1, ey-1, hr*0.03, 0, Math.PI*2); ctx.fill();
      }
      ctx.strokeStyle = "#C62828"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, hr*0.2, hr*0.15, 0.1, Math.PI-0.1); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // 蛋液效果
    var eggSplat = __.eggSplat;
    if (eggSplat[p.id]) {
      ctx.save();
      ctx.fillStyle = "rgba(255,235,59,0.5)";
      ctx.beginPath(); ctx.arc(x-3, y-hr*0.2, hr*1.1, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(255,193,7,0.35)";
      ctx.beginPath(); ctx.arc(x+5, y-hr*0.3, hr*0.8, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // 昵称
    ctx.fillStyle = "#FFF8E7";
    ctx.font = "bold " + Math.min(13, W*0.024) + "px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
    ctx.fillText(p.nickname, x, y + 52);
    ctx.shadowBlur = 0;

    // 积分
    ctx.fillStyle = p.score > 0 ? "#A5D6A7" : "#EF9A9A";
    ctx.font = Math.min(12, W*0.022) + "px sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 3;
    ctx.fillText(p.score + "分", x, y + 68);
    ctx.shadowBlur = 0;

    if (p.currentBet > 0) {
      ctx.fillStyle = "#FFD54F";
      ctx.font = "bold " + Math.min(16, W*0.025) + "px sans-serif";
      ctx.textBaseline = "bottom";
      ctx.fillText("+" + p.currentBet, x, y - 30);
    }
    if (p.allIn) {
      ctx.fillStyle = "#FF5252";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("ALL IN", x, y - 50);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  A.drawPerson = drawPerson;

  PK.TableRenderer.Avatars = A;
})();
