/**
 * items.js - 道具动画与粒子系统模块
 * 包含 Canvas 动画（粒子/浮动文字/飞行轨迹）和 DOM 飞行动画
 * 挂载在 PK.TableRenderer.Items 下
 * 注：PK.PropAnim 保留向后兼容
 */
window.PK = window.PK || {};
PK.TableRenderer = PK.TableRenderer || {};

(function () {
  var Items = {};

  // ===== Canvas 动画累加器 =====
  Items.drawAnims = function (ctx) {
    var animItems = PK.TableRenderer.__.animItems;
    var now = Date.now();
    for (var i = animItems.length - 1; i >= 0; i--) {
      var a = animItems[i], t = (now - a.start) / a.dur;
      if (t >= 1) { animItems.splice(i, 1); continue; }
      var x = a.fx + (a.tx - a.fx) * t;
      var peak = Math.min(a.fy, a.ty) - 60 - a.oy;
      var y = (1 - t) * (1 - t) * a.fy + 2 * (1 - t) * t * peak + t * t * a.ty;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * Math.PI * 6);
      ctx.font = Math.round(28 * (1 + Math.sin(t * Math.PI) * 0.3)) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.sym, 0, 0);
      ctx.restore();
    }
  };

  Items.drawParticles = function (ctx) {
    var particles = PK.TableRenderer.__.particles;
    var now = Date.now();
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i], age = now - p.start;
      if (age > p.life) { particles.splice(i, 1); continue; }
      var pr = age / p.life;
      p.x += p.vx; p.y += p.vy; p.vy += 0.1;
      ctx.globalAlpha = 1 - pr;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - pr * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  Items.drawFloats = function (ctx) {
    var floatTexts = PK.TableRenderer.__.floatTexts;
    var now = Date.now();
    for (var i = floatTexts.length - 1; i >= 0; i--) {
      var ft = floatTexts[i], age = now - ft.start;
      if (age > ft.dur) { floatTexts.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - age / ft.dur;
      ctx.fillStyle = ft.color;
      ctx.font = ft.font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y - age / ft.dur * 40);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };

  Items.spawnParticles = function (x, y, color, cnt) {
    var particles = PK.TableRenderer.__.particles;
    for (var i = 0; i < (cnt || 15); i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 2,
        color: color || "#FFD700",
        size: Math.random() * 4 + 2,
        start: Date.now(),
        life: 800 + Math.random() * 400
      });
    }
  };

  Items.addFloatText = function (x, y, text, color, font, dur) {
    var floatTexts = PK.TableRenderer.__.floatTexts;
    floatTexts.push({
      x: x, y: y, text: text,
      color: color || "#fff",
      font: font || "20px sans-serif",
      start: Date.now(),
      dur: dur || 2000
    });
  };

  // ===== Canvas 道具飞行（向后兼容，但 DOM 版优先） =====
  Items.playItemAnimation = function (data) {
    if (!data || !PK.TableRenderer.__.currentData) return;
    var currentData = PK.TableRenderer.__.currentData;
    var seatPos = PK.TableRenderer.__.seatPos;
    var fi = -1, ti = -1;
    var pls = currentData.players || [];
    for (var i = 0; i < pls.length; i++) {
      if (pls[i].id === data.fromPlayerId) fi = i;
      if (pls[i].id === data.toPlayerId) ti = i;
    }
    if (fi < 0 || ti < 0 || fi >= seatPos.length || ti >= seatPos.length) return;
    var f = seatPos[fi], t = seatPos[ti];
    var sym = data.itemType === "egg" ? "🥚" : "💐";
    var hc = data.itemType === "egg" ? "#FFB300" : "#FF6F00";
    var cnt = data.count || 1, delay = 0;
    for (var i = 0; i < Math.min(cnt, 10); i++) (function (idx, d) {
      setTimeout(function () {
        PK.TableRenderer.__.animItems.push({fx:f.x,fy:f.y-20,tx:t.x,ty:t.y-20,sym:sym,oy:Math.random()*40,start:Date.now(),dur:500});
        setTimeout(function () {
          Items.spawnParticles(t.x, t.y, hc, data.itemType === "egg" ? 20 : 25);
          Items.addFloatText(t.x, t.y - 30, data.itemType === "egg" ? "💥" : "✨", "#FFD700", "28px bold", 1000);
          if (data.itemType === "egg") {
            PK.TableRenderer.__.eggSplat[data.toPlayerId] = true;
            if (window._eggTimer) clearTimeout(window._eggTimer);
            window._eggTimer = setTimeout(function () { PK.TableRenderer.__.eggSplat = {}; }, 8000);
          }
        }, 500);
      }, d);
    })(i, delay), delay += 280;
  };

  Items.clearEggSplat = function () { PK.TableRenderer.__.eggSplat = {}; };
  Items.setEggSplat = function (pid) { PK.TableRenderer.__.eggSplat[pid] = true; };

  PK.TableRenderer.Items = Items;
})();

// ===== DOM 飞行动画（保留 PK.PropAnim 向后兼容） =====
PK.PropAnim = PK.PropAnim || (function () {
  var container = null;
  var initialized = false;

  var props = {
    egg: {
      fly: "/assets/sprites/egg.png",
      hit: "/assets/sprites/egg.png",
      throwSound: "egg_throw",
      hitSound: "egg_hit",
      x10SpecialImg: "/assets/sprites/tuoxie.png",
      x10ThrowSound: "Tuoxie1",
      x10HitSound: "Tuoxie2"
    },
    flower: {
      fly: "/assets/sprites/flower_fly.png",
      hit: "/assets/sprites/flower_icon.png",
      throwSound: "flower_throw",
      hitSound: "flower_hit",
      x10ThrowSound: "flower_throw",
      x10HitSound: "flower_hit"
    }
  };

  function init() {
    if (initialized) return;
    initialized = true;
    container = document.createElement("div");
    container.id = "prop-animation-container";
    container.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;overflow:visible;";
    document.body.appendChild(container);
  }

  function getPlayerScreenPos(playerId) {
    if (PK.TableRenderer && typeof PK.TableRenderer.getSeatPos === "function") {
      var sp = PK.TableRenderer.getSeatPos(playerId);
      if (sp) return sp;
    }
    var playerEl = document.querySelector("[data-player-id=\"" + playerId + "\"]");
    if (playerEl) {
      var rect = playerEl.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  }

  function playItemAnimation(data) {
    if (!data || !container) { if (!container) init(); }
    var propId = data.itemType;
    var prop = props[propId];
    if (!prop) return;
    var fromPlayerId = data.fromPlayerId;
    var toPlayerId = data.toPlayerId;
    var count = data.count || 1;
    var isX10 = count >= 10;
    var fromPos = getPlayerScreenPos(fromPlayerId);
    var toPos = getPlayerScreenPos(toPlayerId);
    var fx = fromPos ? fromPos.x : window.innerWidth * 0.3;
    var fy = fromPos ? fromPos.y : window.innerHeight * 0.7;
    var tx = toPos ? toPos.x : window.innerWidth * 0.7;
    var ty = toPos ? toPos.y : window.innerHeight * 0.3;

    if (isX10) {
      playSound(prop.x10ThrowSound);
      for (var i = 0; i < Math.min(count, 10); i++) (function(idx){
        setTimeout(function() {
          var ox = (Math.random() - 0.5) * 60;
          var oy = (Math.random() - 0.5) * 60;
          var dur = 500 + idx * 30;
          var imgSrc = (propId === "egg" && idx >= 7) ? prop.x10SpecialImg : prop.fly;
          var hs = (propId === "egg" && idx >= 7) ? prop.x10HitSound : prop.hitSound;
          spawnFlying(imgSrc, fx+ox, fy+oy, tx+ox, ty+oy, dur, Math.random()*40, function() {
            playSound(hs);
            showHitEffect(tx+ox, ty+oy, propId);
          });
        }, idx * 80);
      })(i);
    } else {
      playSound(prop.throwSound);
      spawnFlying(prop.fly, fx, fy, tx, ty, 500, Math.random()*40, function() {
        playSound(prop.hitSound);
        showHitEffect(tx, ty, propId);
      });
    }
  }

  function playSound(soundName) {
    if (!soundName) return;
    try {
      var a = new Audio("/assets/sounds/" + soundName + ".mp3");
      a.volume = 1;
      a.play().catch(function(){});
    } catch(e) {}
  }

  function spawnFlying(imgSrc, fx, fy, tx, ty, dur, oy, onHit) {
    var el = document.createElement("div");
    el.className = "prop-flying";
    el.innerHTML = "<img src=\"" + imgSrc + "\" alt=\"fly\">";
    el.style.left = fx + "px";
    el.style.top = fy + "px";
    container.appendChild(el);
    var startTime = performance.now();
    var hitCalled = false;
    function animate(now) {
      var t = (now - startTime) / dur;
      if (t >= 1) {
        t = 1;
        el.style.left = tx + "px";
        el.style.top = ty + "px";
        el.style.transform = "translate(-50%, -50%) rotate(3600deg)";
        if (!hitCalled && onHit) { hitCalled = true; onHit(); }
        setTimeout(function() { if (el.parentNode) el.remove(); }, 200);
        return;
      }
      var easeT = 1 - Math.pow(1 - t, 1.5);
      var x = fx + (tx - fx) * easeT;
      var peak = Math.min(fy, ty) - 80 - oy;
      var y = (1 - t) * (1 - t) * fy + 2 * (1 - t) * t * peak + t * t * ty;
      var rotation = t * Math.PI * 8;
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.transform = "translate(-50%, -50%) rotate(" + rotation + "rad)";
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  function showHitEffect(x, y, propId) {
    var el = document.createElement("div");
    el.className = "prop-hit-effect";
    var burst = document.createElement("div");
    burst.className = "prop-hit-burst";
    el.appendChild(burst);
    var color = propId === "egg" ? "255,235,59" : "255,182,193";
    burst.style.background = "radial-gradient(circle, rgba(" + color + ",0.9) 0%, rgba(" + color + ",0.3) 40%, transparent 70%)";
    el.style.left = x + "px";
    el.style.top = y + "px";
    var ring = document.createElement("div");
    ring.className = "prop-hit-burst";
    ring.style.cssText = "position:absolute;top:50%;left:50%;width:80px;height:80px;transform:translate(-50%,-50%);border-radius:50%;border:2px solid rgba(" + color + ",0.5);animation:propRipple 0.5s ease-out 0.1s forwards;opacity:0;";
    el.appendChild(ring);
    container.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.remove(); }, 600);
  }

  return {
    init: init,
    playItemAnimation: playItemAnimation
  };
})();
