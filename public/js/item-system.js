/**
 * item-system.js - 道具与快捷发言系统
 * 道具选择、目标选择浮层、使用、取消；发言面板；角色选择浮层（动态）
 * 挂载在 PK.ItemSystem 下
 */
window.PK = window.PK || {};

PK.ItemSystem = (function () {
  var characters = [
    { id: "liubei", name: "刘备", gender: "male", icon: "/assets/sprites/char_liubei.png" },
    { id: "xiaosha", name: "小杀", gender: "female", icon: "/assets/sprites/char_xiaosha.png" },
    { id: "zhangfei", name: "张飞", gender: "male", icon: "/assets/sprites/char_zhangfei.png" },
    { id: "guanyu", name: "关羽", gender: "male", icon: "/assets/sprites/char_guanyu.png" },
    { id: "zhangchunhua", name: "张春华", gender: "female", icon: "/assets/sprites/char_zhangchunhua.png" }
  ];

  var phrases = [
    {t:"惟贤惟德，能服于人",m:"SKILL_31_1_2",f:"SKILL_31_1_2",c:0},
    {t:"以德服人",m:"SKILL_31_1_1",f:"SKILL_31_1_1",c:0},
    {t:"燕人张飞在此",m:"SKILL_34_3_1",f:"SKILL_34_3_1",c:2},
    {t:"啊...",m:"SKILL_34_3_2",f:"SKILL_34_3_2",c:2},
    {t:"看尔乃插标卖首",m:"SKILL_33_2_1",f:"SKILL_33_2_1",c:3},
    {t:"关羽在此尔等受死",m:"SKILL_33_2_2",f:"SKILL_33_2_2",c:3},
    {t:"女人也该对自己狠一点",m:"SKILL_16105_shangshi_2",f:"SKILL_16105_shangshi_2",c:4},
    {t:"酒不醉人，人自醉，情不伤人，人自负",m:"SKILL_16105_shangshi_1",f:"SKILL_16105_shangshi_1",c:4},
    {t:"花与年华逝，因妒自绝情",m:"SKILL_16105_jueqing_2",f:"SKILL_16105_jueqing_2",c:4},
    {t:"多情不若绝情好",m:"SKILL_16105_jueqing_1",f:"SKILL_16105_jueqing_1",c:4},
    {t:"能不能快点啊？兵贵神速啊！",m:"words_0_1",f:"words_0_2"},
    {t:"你们忍心就这么让我酱油了？",m:"words_3_1",f:"words_3_2"},
    {t:"我、我惹你们了吗？",m:"words_4_1",f:"words_4_2"},
    {t:"姑娘你真是条汉子",m:"words_5_1",f:"words_5_2"},
    {t:"三十六计走为上，容我去去便回",m:"words_6_1",f:"words_6_2"},
    {t:"风吹鸡蛋壳，牌去人安乐",m:"words_9_1",f:"words_9_2"}
  ];

  function getState() { return PK.GameClient ? PK.GameClient.state : null; }
  function getDom() { return PK.GameClient ? PK.GameClient.dom : null; }

  // ===== 道具系统 =====
  function selectItem(itemType, count) {
    var state = getState();
    if (!state) return;
    state.selectedItem = itemType;
    state.selectedItemCount = count;
    state.selectingTarget = true;
    var dom = getDom();
    if (dom) dom.itemTargetHint.style.display = "block";
    showTargetOverlay();
  }

  function showTargetOverlay() {
    var state = getState();
    var dom = getDom();
    if (!state || !dom) return;
    var players = (state.room && state.room.players) || [];
    var list = dom.targetList;
    list.innerHTML = "";
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (p.id === state.playerId || p.eliminated) continue;
      var item = document.createElement("div");
      item.className = "target-item slide-up";
      item.textContent = p.nickname;
      item.style.animationDelay = (i * 0.05) + "s";
      (function (pid) { item.addEventListener("click", function() { useItem(pid); }); })(p.id);
      list.appendChild(item);
    }
    dom.targetOverlay.style.display = "flex";
  }

  function useItem(targetId) {
    var state = getState();
    var dom = getDom();
    if (!state || !dom) return;
    dom.targetOverlay.style.display = "none";
    dom.itemTargetHint.style.display = "none";
    state.selectingTarget = false;
    var cost = state.selectedItemCount || 1;
    if (state.room && state.room.players) {
      for (var ui = 0; ui < state.room.players.length; ui++) {
        if (state.room.players[ui].id === state.playerId) { state.room.players[ui].score -= cost; break; }
      }
    }
    if (state.game && state.game.players) {
      for (var ui = 0; ui < state.game.players.length; ui++) {
        if (state.game.players[ui].id === state.playerId) { state.game.players[ui].score -= cost; break; }
      }
      if (PK.TableRenderer && PK.TableRenderer.update) PK.TableRenderer.update(state.game);
    }
    if (PK.WSClient) PK.WSClient.send("use_item", {
      itemType: state.selectedItem,
      targetPlayerId: targetId,
      count: state.selectedItemCount
    });
    state.selectedItem = null;
  }

  function cancelItemTarget() {
    var state = getState();
    var dom = getDom();
    if (!state || !dom) return;
    dom.targetOverlay.style.display = "none";
    dom.itemTargetHint.style.display = "none";
    state.selectingTarget = false;
    state.selectedItem = null;
  }

  // ===== 快捷发言 =====
  function onQuickSpeech() {
    var state = getState();
    var ov = document.getElementById("speech-overlay");
    if (ov && ov.style.display !== "none") { ov.style.display = "none"; return; }
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "speech-overlay";
      ov.style.cssText = "position:fixed;bottom:calc(50px + env(safe-area-inset-bottom,0px));left:8px;z-index:10001;pointer-events:auto;background:rgba(0,0,0,0.88);border-radius:10px;padding:10px;min-width:280px;max-width:92vw;max-height:50vh;display:flex;flex-direction:column;";

      // 道具快捷行
      var itemRow = document.createElement("div");
      itemRow.style.cssText = "display:flex;gap:4px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);";
      var defs = [
        {id:"egg",l:"🥚 -1分",c:1},{id:"egg",l:"🥚×10 -10分",c:10},
        {id:"flower",l:"🌹 -1分",c:1},{id:"flower",l:"🌹×10 -10分",c:10}
      ];
      for (var di = 0; di < defs.length; di++) (function(d){
        var b = document.createElement("button");
        b.textContent = d.l;
        b.style.cssText = "flex:1;padding:8px 2px;border:none;border-radius:6px;font-size:12px;cursor:pointer;background:rgba(255,255,255,0.15);color:white;text-align:center;";
        b.onclick = function(e){ e.stopPropagation(); selectItem(d.id, d.c); ov.style.display = "none"; };
        itemRow.appendChild(b);
      })(defs[di]);
      ov.appendChild(itemRow);

      // 发言列表
      var sc = document.createElement("div"); ov._sc = sc;
      sc.style.cssText = "overflow-y:auto;max-height:35vh;padding:6px 0;-webkit-overflow-scrolling:touch;";
      var myCharId = 0;
      if (state && state.room && state.room.players) {
        for (var ci = 0; ci < state.room.players.length; ci++) {
          if (state.room.players[ci].id === state.playerId) { myCharId = state.room.players[ci].avatarId || 0; break; }
        }
      }
      for (var pi = 0; pi < phrases.length; pi++) {
        if (phrases[pi].c !== undefined && phrases[pi].c !== myCharId) continue;
        var d = document.createElement("div");
        d.textContent = phrases[pi].t;
        d.dataset.idx = pi;
        d.style.cssText = "padding:8px 10px;color:#FFE082;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.08);cursor:pointer;pointer-events:auto;";
        sc.appendChild(d);
      }
      sc.onclick = function(e) {
        var t = e.target.closest("[data-idx]");
        if (!t) return;
        var pi = parseInt(t.dataset.idx);
        var p = phrases[pi];
        if (!p) return;
        var text = p.t.replace(/^\d+\.\s*/,"");
        var gender = "male";
        if (state && state.room && state.room.players) {
          for (var j = 0; j < state.room.players.length; j++) {
            if (state.room.players[j].id === state.playerId) {
              gender = (characters[state.room.players[j].avatarId] && characters[state.room.players[j].avatarId].gender === "female") ? "female" : "male";
              break;
            }
          }
        }
        var soundName = gender === "female" ? p.f : p.m;
        if (soundName && PK.Sound) PK.Sound.play(soundName);
        if (PK.WSClient) PK.WSClient.send("send_speech", { text: text, soundName: soundName });
        // 显示气泡
        var bp = PK.TableRenderer && PK.TableRenderer.getSeatPos ? PK.TableRenderer.getSeatPos(state ? state.playerId : "") : null;
        var bx = bp ? bp.x : window.innerWidth / 2;
        var by = bp ? bp.y - 80 : window.innerHeight * 0.65;
        var el = document.createElement("div");
        el.textContent = text;
        el.style.cssText = "position:fixed;left:"+bx+"px;top:"+by+"px;transform:translate(-50%,-100%);background:rgba(0,0,0,0.85);color:#FFE082;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:bold;z-index:10002;max-width:70vw;text-align:center;pointer-events:none;";
        document.body.appendChild(el);
        setTimeout(function(){if(el.parentNode)el.remove();},3000);
      };
      ov.appendChild(sc);

      var cb = document.createElement("div");
      cb.textContent = "关闭";
      cb.style.cssText = "text-align:center;color:#999;font-size:13px;padding:8px 8px 2px;cursor:pointer;border-top:1px solid rgba(255,255,255,0.1);";
      cb.onclick = function(){ov.style.display="none";};
      ov.appendChild(cb);
      document.body.appendChild(ov);
    } else {
      var sc = ov._sc;
      if (sc) {
        sc.innerHTML = "";
        var myCharId = 0;
        if (state && state.room && state.room.players) {
          for (var ci = 0; ci < state.room.players.length; ci++) {
            if (state.room.players[ci].id === state.playerId) { myCharId = state.room.players[ci].avatarId || 0; break; }
          }
        }
        for (var pi = 0; pi < phrases.length; pi++) {
          if (phrases[pi].c !== undefined && phrases[pi].c !== myCharId) continue;
          var d = document.createElement("div");
          d.textContent = phrases[pi].t;
          d.dataset.idx = pi;
          d.style.cssText = "padding:8px 10px;color:#FFE082;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.08);cursor:pointer;pointer-events:auto;";
          sc.appendChild(d);
        }
      }
    }
    ov.style.display = "flex";
    // 更新按钮状态
    var ms = 0;
    if (state && state.room && state.room.players) {
      for (var k = 0; k < state.room.players.length; k++) {
        if (state.room.players[k].id === state.playerId) { ms = state.room.players[k].score; break; }
      }
    }
    var disableItems = state ? state.selectingTarget : false;
    var btns = ov.querySelectorAll("button");
    for (var k = 0; k < btns.length; k++) {
      var t = btns[k].textContent;
      if (t.indexOf("×10") >= 0) { btns[k].disabled = disableItems || ms < 10; }
      else { btns[k].disabled = disableItems || ms < 1; }
      btns[k].style.opacity = btns[k].disabled ? "0.3" : "1";
    }
  }

  return {
    selectItem: selectItem,
    showTargetOverlay: showTargetOverlay,
    useItem: useItem,
    cancelItemTarget: cancelItemTarget,
    onQuickSpeech: onQuickSpeech
  };
})();
