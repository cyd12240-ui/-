/**
 * prop-throw.js - 道具飞行动画模块
 * DOM overlay + requestAnimationFrame 抛物线飞行 + Audio pool 互不干扰音效
 */
window.PK = window.PK || {};

PK.PropAnim = (function () {
  var container = null;
  var initialized = false;

  // 道具配置
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
    // 创建动画容器（覆盖全屏，不响应指针事件）
    container = document.createElement("div");
    container.id = "prop-animation-container";
    container.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;overflow:visible;";
    document.body.appendChild(container);
  }

  // 获取玩家在屏幕上的坐标（优先从 PixiJS seatPos 获取）
  function getPlayerScreenPos(playerId) {
    // 尝试从 PixiJS 获取座位坐标
    if (PK.TableRenderer && typeof PK.TableRenderer.getSeatPos === "function") {
      var sp = PK.TableRenderer.getSeatPos(playerId);
      if (sp) return sp;
    }
    // 备用：从 DOM player-list 元素获取
    var playerEl = document.querySelector("[data-player-id=\"" + playerId + "\"]");
    if (playerEl) {
      var rect = playerEl.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  }

  // 播放道具动画（单发或十连）
  function playItemAnimation(data) {
    if (!data || !container) { if (!container) init(); }
    var propId = data.itemType;
    var prop = props[propId];
    if (!prop) return;

    var fromPlayerId = data.fromPlayerId;
    var toPlayerId = data.toPlayerId;
    var count = data.count || 1;
    var isX10 = count >= 10;

    // 获取起点终点坐标
    var fromPos = getPlayerScreenPos(fromPlayerId);
    var toPos = getPlayerScreenPos(toPlayerId);

    // 备用坐标（无法获取时）
    var fx = fromPos ? fromPos.x : window.innerWidth * 0.3;
    var fy = fromPos ? fromPos.y : window.innerHeight * 0.7;
    var tx = toPos ? toPos.x : window.innerWidth * 0.7;
    var ty = toPos ? toPos.y : window.innerHeight * 0.3;

    if (isX10) {
      // 十连模式
      playSound(prop.x10ThrowSound);
      for (var i = 0; i < Math.min(count, 10); i++) {
        (function(idx) {
          setTimeout(function() {
            var offsetX = (Math.random() - 0.5) * 60;
            var offsetY = (Math.random() - 0.5) * 60;
            var dur = 500 + idx * 30;
            var oy = Math.random() * 40;
            // 最后几个鸡蛋用 special 图
            var imgSrc = (propId === "egg" && idx >= 7) ? prop.x10SpecialImg : prop.fly;
            var hs = (propId === "egg" && idx >= 7) ? prop.x10HitSound : prop.hitSound;
            spawnFlying(imgSrc, fx + offsetX, fy + offsetY, tx + offsetX, ty + offsetY, dur, oy, function() {
              playSound(hs);
              showHitEffect(tx + offsetX, ty + offsetY, propId);
            });
          }, idx * 80);
        })(i);
      }
    } else {
      // 单发模式
      playSound(prop.throwSound);
      spawnFlying(prop.fly, fx, fy, tx, ty, 500, Math.random() * 40, function() {
        playSound(prop.hitSound);
        showHitEffect(tx, ty, propId);
      });
    }
  }

  // 播放音效（每次 new Audio，互不干扰）
  function playSound(soundName) {
    if (!soundName) return;
    try {
      var src = "/assets/sounds/" + soundName + ".mp3";
      // 使用 HTMLAudioElement，每次新建确保不重叠
      var a = new Audio(src);
      a.volume = 1;
      a.play().catch(function(e) {
        // 静默忽略无法播放
      });
    } catch(e) {}
  }

  // 抛物线飞行（requestAnimationFrame）
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
        if (!hitCalled && onHit) {
          hitCalled = true;
          onHit();
        }
        setTimeout(function() { if (el.parentNode) el.remove(); }, 200);
        return;
      }
      // X 线性
      var x = fx + (tx - fx) * t;
      // Y 二次贝塞尔弧线（控制点取最小值上方）
      var my2 = Math.min(fy, ty) - 60 - oy;
      var y = (1 - t) * (1 - t) * fy + 2 * (1 - t) * t * my2 + t * t * ty;
      // 旋转
      var rotation = t * Math.PI * 6;
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.transform = "translate(-50%, -50%) rotate(" + rotation + "rad)";
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  // 击中效果
  function showHitEffect(x, y, propId) {
    var el = document.createElement("div");
    el.className = "prop-hit-effect";

    // 内圈爆发
    var burst = document.createElement("div");
    burst.className = "prop-hit-burst";
    el.appendChild(burst);

    // 根据类型加粒子颜色
    var color = propId === "egg" ? "255,235,59" : "255,182,193";
    burst.style.background = "radial-gradient(circle, rgba(" + color + ",0.9) 0%, rgba(" + color + ",0.3) 40%, transparent 70%)";

    el.style.left = x + "px";
    el.style.top = y + "px";
    container.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.remove(); }, 600);
  }

  // 清除蛋液效果
  function clearEggSplat() {
    // 由 PixiJS 管理
  }

  return {
    init: init,
    playItemAnimation: playItemAnimation
  };
})();
