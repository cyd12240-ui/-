/**
 * cards.js - 卡牌渲染模块
 * 牌面 + 牌背绘制，公共牌布局
 * 挂载在 PK.TableRenderer.Cards 下
 */
window.PK = window.PK || {};
PK.TableRenderer = PK.TableRenderer || {};

(function () {
  var C = {};

  // 牌面
  function drawCard(ctx, x, y, rank, suit, scale) {
    if (!scale) scale = 0.6;
    var w = 50 * scale, h = 70 * scale, r = 4 * scale;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 4 * scale;
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, r); ctx.stroke();

    var red = suit === "h" || suit === "d";
    var color = red ? "#D32F2F" : "#212121";
    var rankStr = ({2:"2",3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K",14:"A"})[rank] || "?";
    var suitSym = ({h:"♥",d:"♦",c:"♣",s:"♠"})[suit] || "?";

    ctx.fillStyle = color;
    ctx.font = "bold " + Math.round(13 * scale) + "px sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(rankStr, x + 3 * scale, y + 2 * scale);
    ctx.font = Math.round(10 * scale) + "px sans-serif";
    ctx.fillText(suitSym, x + 3 * scale, y + 16 * scale);
    ctx.font = Math.round(22 * scale) + "px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(suitSym, x + w / 2, y + h / 2);
    ctx.restore();
  }

  // 牌背（珊瑚色 + 菱形纹）
  function drawCardBack(ctx, x, y, scale) {
    scale = scale || 0.6;
    var w = 50 * scale, h = 70 * scale, r = 4 * scale;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 4 * scale;
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = "#E8734A"; ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = "#C0603A"; ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, r); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(x + w/2, y + h*0.15);
    ctx.lineTo(x + w*0.85, y + h/2);
    ctx.lineTo(x + w/2, y + h*0.85);
    ctx.lineTo(x + w*0.15, y + h/2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // 公共牌布局
  function drawCommunity(ctx, cards, cx, cy, cardSize) {
    var cs = cardSize || Math.min(44, (PK.TableRenderer.__ ? PK.TableRenderer.__.W : window.innerWidth) * 0.08);
    var sx = cx - (cards.length * (cs + 4)) / 2;
    for (var i = 0; i < cards.length; i++) {
      drawCard(ctx, sx + i * (cs + 4), cy + 10, cards[i].rank, cards[i].suit, cs / 50);
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

  C.drawCard = drawCard;
  C.drawCardBack = drawCardBack;
  C.drawCommunity = drawCommunity;

  PK.TableRenderer.Cards = C;
})();
