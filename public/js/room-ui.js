/**
 * room-ui.js - 房间 UI 渲染模块
 * 玩家列表、机器人添加/移除、设置面板、角色选择
 * 挂载在 PK.RoomUI 下
 */
window.PK = window.PK || {};

PK.RoomUI = (function () {
  var characters = [
    { id: "liubei", name: "刘备", gender: "male", icon: "/assets/sprites/char_liubei.png" },
    { id: "xiaosha", name: "小杀", gender: "female", icon: "/assets/sprites/char_xiaosha.png" },
    { id: "zhangfei", name: "张飞", gender: "male", icon: "/assets/sprites/char_zhangfei.png" },
    { id: "guanyu", name: "关羽", gender: "male", icon: "/assets/sprites/char_guanyu.png" },
    { id: "zhangchunhua", name: "张春华", gender: "female", icon: "/assets/sprites/char_zhangchunhua.png" }
  ];

  var avatarImages = [
    "/assets/sprites/char_liubei.png",
    "/assets/sprites/char_xiaosha.png",
    "/assets/sprites/char_zhangfei.png",
    "/assets/sprites/char_guanyu.png",
    "/assets/sprites/char_zhangchunhua.png"
  ];

  function getState() { return PK.GameClient ? PK.GameClient.state : null; }
  function getDom() { return PK.GameClient ? PK.GameClient.dom : null; }

  function renderRoom() {
    var state = getState();
    var dom = getDom();
    if (!state || !state.room || !dom) return;
    var players = state.room.players || [];
    var list = dom.playerList;
    list.innerHTML = "";

    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var item = document.createElement("div");
      item.className = "player-item slide-up";
      item.style.animationDelay = (i * 0.08) + "s";

      var isBot = p.isBot || false;
      var statusClass = "status-waiting";
      var statusText = isBot ? "🤖 机器人" : (p.isHost ? "房主" : (p.isReady ? "已准备" : "等待中"));
      if (p.isHost) { statusClass = "status-host"; statusText = "房主"; }
      else if (p.isReady) { statusClass = "status-ready"; statusText = "已准备"; }

      var avatarImg = avatarImages[p.avatarId] || avatarImages[0];
      item.innerHTML =
        "<div class=\"avatar avatar-img\"><img src=\"" + avatarImg + "\" alt=\"\"></div>" +
        "<div class=\"info\"><div class=\"name\">" + escapeHtml(p.nickname) + (p.id === state.playerId ? " (你)" : "") + "</div>" +
        "<div class=\"score\">积分: " + p.score + "</div></div>" +
        "<div class=\"status " + statusClass + "\">" + statusText + "</div>" +
        (state.isHost && isBot ? "<button class=\"rm-bot-btn\" data-botid=\"" + p.id + "\">✕</button>" : "");
      list.appendChild(item);
    }

    // 机器人移除按钮委托
    list.onclick = function(e) {
      var btn = e.target.closest(".rm-bot-btn");
      if (btn) {
        var bid = btn.getAttribute("data-botid");
        if (bid && PK.WSClient) PK.WSClient.send("remove_bot", { botId: bid });
      }
    };

    // 按钮状态
    var amReady = players.some(function(p) { return p.id === state.playerId && p.isReady; });
    dom.btnReady.style.display = state.isHost ? "none" : "";
    dom.btnReady.textContent = amReady ? "取消准备" : "准备";

    // 机器人添加按钮（房主可见）
    var oldBot = document.getElementById("bot-section");
    if (oldBot) oldBot.remove();
    if (state.isHost) {
      var bd = document.createElement("div");
      bd.id = "bot-section";
      bd.style.cssText = "display:flex;gap:8px;padding:10px 16px;justify-content:center;margin-top:4px;";
      var levels = [{n:"简单",l:0},{n:"普通",l:1},{n:"困难",l:2}];
      for (var bi = 0; bi < levels.length; bi++) (function(bl){
        var btn = document.createElement("button");
        btn.textContent = "🤖" + bl.n + "机器人";
        btn.style.cssText = "flex:1;padding:8px 12px;border:1px solid #4ECDC4;border-radius:8px;background:white;color:#4ECDC4;font-size:13px;cursor:pointer;text-align:center;";
        btn.onclick = function(){ if (PK.WSClient) PK.WSClient.send("add_bot",{level:bl.l}); };
        bd.appendChild(btn);
      })(levels[bi]);
      list.parentNode.appendChild(bd);
    }

    dom.btnStartGame.style.display = state.isHost ? "block" : "none";
    dom.btnStartGame.disabled = false;
  }

  function onRoomSettings() {
    var state = getState();
    var dom = getDom();
    if (!state || !state.room || !state.room.settings || !dom) return;
    var s = state.room.settings;
    document.getElementById("setting-sb").value = s.smallBlind || 10;
    document.getElementById("setting-bb").value = s.bigBlind || 20;
    document.getElementById("setting-score").value = s.initialScore || 2000;
    document.getElementById("setting-max").value = s.maxPlayers || 6;
    document.getElementById("setting-auto").value = s.autoStartDelay || 3;
    document.getElementById("setting-hands").value = s.maxHands || 0;
    dom.settingsOverlay.style.display = "flex";
  }

  function onSaveSettings() {
    var dom = getDom();
    var settings = {
      smallBlind: parseInt(document.getElementById("setting-sb").value) || 10,
      bigBlind: parseInt(document.getElementById("setting-bb").value) || 20,
      initialScore: parseInt(document.getElementById("setting-score").value) || 2000,
      maxPlayers: parseInt(document.getElementById("setting-max").value) || 6,
      autoStartDelay: parseInt(document.getElementById("setting-auto").value) || 3,
      maxHands: parseInt(document.getElementById("setting-hands").value) || 0
    };
    if (PK.WSClient) PK.WSClient.send("update_settings", settings);
    if (dom) dom.settingsOverlay.style.display = "none";
  }

  function bindCharSelect() {
    // 角色选择浮层
    var charOv = document.getElementById("char-select-overlay");
    if (!charOv) return;
    document.getElementById("btn-change-char").onclick = function() {
      charOv.style.display = charOv.style.display === "flex" ? "none" : "flex";
    };
    document.getElementById("btn-close-char-select").onclick = function() {
      charOv.style.display = "none";
    };
    charOv.onclick = function(e) {
      var cot = e.target.closest(".cot");
      if (!cot) return;
      var avatarId = parseInt(cot.getAttribute("data-avatar"));
      if (!isNaN(avatarId)) {
        if (PK.WSClient) PK.WSClient.send("change_character", { avatarId: avatarId });
        charOv.style.display = "none";
      }
    };
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str || ""));
    return div.innerHTML;
  }

  return {
    renderRoom: renderRoom,
    onRoomSettings: onRoomSettings,
    onSaveSettings: onSaveSettings,
    bindCharSelect: bindCharSelect,
    characters: characters,
    escapeHtml: escapeHtml
  };
})();
