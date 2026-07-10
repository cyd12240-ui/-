/**
 * game-client.js - 客户端游戏管理
 * 负责屏幕切换、状态管理、UI 渲染
 */
window.PK = window.PK || {};

PK.GameClient = (function () {
  var state = {
    screen: "lobby",
    nickname: "",
    roomCode: null,
    playerId: null,
    isHost: false,
    room: null,
    game: null,
    myTurn: false,
    availableActions: [],
    selectedItem: null,
    selectedItemCount: 1,
    selectingTarget: false,
    hideButtons: false
  };

  var dom = {};
  var cachedRoomCode = "";
  var characters = [
    { id: "liubei", name: "刘备", gender: "male", icon: "/assets/sprites/char_liubei.png" },
    { id: "xiaosha", name: "小杀", gender: "female", icon: "/assets/sprites/char_xiaosha.png" },
    { id: "zhangfei", name: "张飞", gender: "male", icon: "/assets/sprites/char_zhangfei.png" },
    { id: "guanyu", name: "关羽", gender: "male", icon: "/assets/sprites/char_guanyu.png" },
    { id: "zhangchunhua", name: "张春华", gender: "female", icon: "/assets/sprites/char_zhangchunhua.png" }
  ];

  function init() {
    cacheDom();
    bindUI();
  }

  function cacheDom() {
    dom = {
      screenLobby: document.getElementById("screen-lobby"),
      screenRoom: document.getElementById("screen-room"),
      screenGame: document.getElementById("screen-game"),
      inputNickname: document.getElementById("input-nickname"),
      inputRoomCode: document.getElementById("input-room-code"),
      btnCreateRoom: document.getElementById("btn-create-room"),
      btnJoinRoom: document.getElementById("btn-join-room"),
      lobbyError: document.getElementById("lobby-error"),
      roomCodeDisplay: document.getElementById("room-code-display"),
      playerList: document.getElementById("player-list"),
      btnReady: document.getElementById("btn-ready"),
      btnStartGame: document.getElementById("btn-start-game"),
      btnLeaveRoom: document.getElementById("btn-leave-room"),
      btnChangeChar: document.getElementById("btn-change-char"),
      charSelectOverlay: document.getElementById("char-select-overlay"),
      btnCloseCharSelect: document.getElementById("btn-close-char-select"),
      gameTopBar: document.getElementById("game-top-bar"),
      gamePotDisplay: document.getElementById("game-pot-display"),
      gamePhaseDisplay: document.getElementById("game-phase-display"),
      actionLog: document.getElementById("action-log"),
      actionHistory: document.getElementById("action-history"),
      actionBar: document.getElementById("action-bar"),
      raiseSlider: document.getElementById("raise-slider"),
      raiseAmount: document.getElementById("raise-amount"),
      itemBar: document.getElementById("item-bar"),
      btnItemEgg: document.getElementById("item-egg"),
      btnItemEgg10: document.getElementById("item-egg-10"),
      btnItemFlower: document.getElementById("item-flower"),
      btnItemFlower10: document.getElementById("item-flower-10"),
      btnSpeech: document.getElementById("btn-speech"),
      btnRoomSettings: document.getElementById("btn-room-settings"),
      settingsOverlay: document.getElementById("room-settings-overlay"),
      btnSaveSettings: document.getElementById("btn-save-settings"),
      btnCloseSettings: document.getElementById("btn-close-settings"),
      itemTargetHint: document.getElementById("item-target-hint"),
      targetOverlay: document.getElementById("target-overlay"),
      targetList: document.getElementById("target-list"),
      btnCancelTarget: document.getElementById("btn-cancel-target"),
      btnLeaveGame: document.getElementById("btn-leave-game"),
      btnSkipAnim: document.getElementById("btn-skip-anim"),
      handRefModal: document.getElementById("hand-ref-modal")
    };
  }

  function bindUI() {
    dom.btnCreateRoom.addEventListener("click", onCreateRoom);
    dom.btnJoinRoom.addEventListener("click", onJoinRoom);
    dom.btnReady.addEventListener("click", onToggleReady);
    dom.btnStartGame.addEventListener("click", onStartGame);
    dom.btnLeaveRoom.addEventListener("click", onLeaveRoom);
    dom.btnLeaveGame.addEventListener("click", onLeaveRoom);
    dom.btnCancelTarget.addEventListener("click", cancelItemTarget);

    // 换角色按钮
    dom.btnChangeChar.addEventListener("click", function () {
      var ov = dom.charSelectOverlay;
      ov.style.display = ov.style.display === "flex" ? "none" : "flex";
    });
    dom.btnCloseCharSelect.addEventListener("click", function () {
      dom.charSelectOverlay.style.display = "none";
    });
    // 角色选择：事件委托，点击 .cot 元素
    dom.charSelectOverlay.addEventListener("click", function (e) {
      var cot = e.target.closest(".cot");
      if (!cot) return;
      var avatarId = parseInt(cot.getAttribute("data-avatar"));
      if (!isNaN(avatarId)) {
        PK.WSClient.send("change_character", { avatarId: avatarId });
        dom.charSelectOverlay.style.display = "none";
      }
    });

    dom.raiseSlider.addEventListener("input", function () {
      dom.raiseAmount.textContent = this.value;
    });

    dom.inputNickname.addEventListener("keydown", function (e) {
      if (e.key === "Enter") onCreateRoom();
    });
    dom.inputRoomCode.addEventListener("keydown", function (e) {
      if (e.key === "Enter") onJoinRoom();
    });

    // 道具按钮
    dom.btnItemEgg.addEventListener("click", function () { selectItem("egg", 1); });
    dom.btnItemEgg10.addEventListener("click", function () { selectItem("egg", 10); });
    dom.btnItemFlower.addEventListener("click", function () { selectItem("flower", 1); });
    dom.btnItemFlower10.addEventListener("click", function () { selectItem("flower", 10); });
    dom.btnSpeech.addEventListener("click", onQuickSpeech);
    dom.btnRoomSettings.addEventListener("click", onRoomSettings);
    dom.btnSaveSettings.addEventListener("click", onSaveSettings);
    dom.btnCloseSettings.addEventListener("click", function() {
      dom.settingsOverlay.style.display = "none";
    });

    // 操作按钮委托
    dom.actionBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".btn-action");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      if (action) sendAction(action);
    });

    // 复制房间码
    document.getElementById("room-code-tap").addEventListener("click", function () {
      if (cachedRoomCode) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(cachedRoomCode);
        }
        this.textContent = "已复制!";
        var self = this;
        setTimeout(function () { self.textContent = "点此复制"; }, 2000);
      }
    });
  }

  // ===== 屏幕管理 =====
  function showScreen(name) {
    var screens = ["screen-lobby", "screen-room", "screen-game"];
    for (var i = 0; i < screens.length; i++) {
      var el = document.getElementById(screens[i]);
      if (el) el.classList.toggle("active", screens[i] === "screen-" + name);
    }
    state.screen = name;
    if (name === "game" && PK.TableRenderer) PK.TableRenderer.start();
    if (name !== "game" && PK.TableRenderer) PK.TableRenderer.stop();
  }

  // ===== 输入验证 =====
  function getNickname() {
    var nick = (dom.inputNickname.value || "").trim();
    if (!nick) { showError("请输入昵称"); return null; }
    if (nick.length > 8) { showError("昵称最多8个字符"); return null; }
    return nick;
  }

  function showError(msg) {
    dom.lobbyError.textContent = msg || "";
  }

  // ===== 房间操作 =====
  function onCreateRoom() {
    var nick = getNickname();
    if (!nick) return;
    state.nickname = nick;
    PK.WSClient.send("create_room", { nickname: nick, avatarId: 0 });
    showError("");
  }

  function onJoinRoom() {
    var nick = getNickname();
    if (!nick) return;
    var code = (dom.inputRoomCode.value || "").trim().toUpperCase();
    if (code.length !== 4) { showError("房间码为4位数字"); return; }
    state.nickname = nick;
    PK.WSClient.send("join_room", { roomCode: code, nickname: nick, avatarId: 0 });
    showError("");
  }

  function onToggleReady() {
    var isReady = state.room && state.room.players && state.room.players.some(
      function (p) { return p.id === state.playerId && p.isReady; }
    );
    PK.WSClient.send("ready", { ready: !isReady });
  }

  function onStartGame() {
    PK.WSClient.send("start_game", {});
  }

  function onLeaveRoom() {
    PK.WSClient.send("leave_room", {});
    cachedRoomCode = "";
    showScreen("lobby");
  }

  // ===== 游戏操作 =====
  function sendAction(action) {
    if (!state.myTurn) return;
    // 立即禁用按钮防止重复点击
    state.myTurn = false;
    updateActionButtons();
    var payload = { action: action };
    if (action === "raise") {
      payload.amount = parseInt(dom.raiseAmount.textContent) || 40;
    }
    PK.WSClient.send("player_action", payload);
  }

  // ===== 道具系统 =====
  function selectItem(itemType, count) {
    state.selectedItem = itemType;
    state.selectedItemCount = count;
    state.selectingTarget = true;
    dom.itemTargetHint.style.display = "block";
    showTargetOverlay();
  }

  function showTargetOverlay() {
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
      (function (pid) {
        item.addEventListener("click", function () { useItem(pid); });
      })(p.id);
      list.appendChild(item);if(p.id===state.playerId){
var ch=document.createElement("span");
ch.style.cssText="position:absolute;top:2px;right:2px;cursor:pointer;z-index:5;";
      item.style.position="relative";
ch.onclick=function(){showCharSelect();};
ch.innerHTML="<img src='/assets/sprites/btn_change_char.png' style='width:22px;height:22px'>";
item.appendChild(ch);
}
    }
    dom.targetOverlay.style.display = "flex";
  }

  function useItem(targetId) {
    dom.targetOverlay.style.display = "none";
    dom.itemTargetHint.style.display = "none";
    state.selectingTarget = false;
    // 本地即时扣分
    var cost = state.selectedItemCount || 1;
    if (state.room && state.room.players) {
      for (var ui = 0; ui < state.room.players.length; ui++) {
        if (state.room.players[ui].id === state.playerId) {
          state.room.players[ui].score -= cost;
          break;
    }
  }
}
    if (state.game && state.game.players) {
      for (var ui = 0; ui < state.game.players.length; ui++) {
        if (state.game.players[ui].id === state.playerId) {
          state.game.players[ui].score -= cost;
          break;
    }
  }
      if (PK.TableRenderer && PK.TableRenderer.update) PK.TableRenderer.update(state.game);
    }
    PK.WSClient.send("use_item", {
      itemType: state.selectedItem,
      targetPlayerId: targetId,
      count: state.selectedItemCount
    });
    state.selectedItem = null;
  }

  function sendSpeech() {
  var gender = "male";
  if (state.room && state.room.players) {
    for (var i = 0; i < state.room.players.length; i++) {
      if (state.room.players[i].id === state.playerId) {
        gender = (characters[state.room.players[i].avatarId] && characters[state.room.players[i].avatarId].gender === "female") ? 'female' : 'male';
      }
    }
  }
  var soundName = gender === 'female' ? 'speech_01_female' : 'speech_01_male';
  if (PK.Sound) PK.Sound.play(soundName);
  if (PK.TableRenderer && PK.TableRenderer.addFloatText) {
    PK.TableRenderer.addFloatText(
      (PK.TableRenderer.cx ? PK.TableRenderer.cx() : window.innerWidth / 2),
      (PK.TableRenderer.cy ? PK.TableRenderer.cy() : window.innerHeight / 2 - 60),
      "????????????", "#FFF176", "bold 18px sans-serif", 3000
    );
  }
  var ov = document.getElementById("speech-overlay");
  if (ov) ov.style.display = "none";
}

function showCharSelect(){
var ov=document.getElementById("char-select-overlay");
if(ov&&ov.style.display!=="none"){ov.style.display="none";return;}
if(!ov){
ov=document.createElement("div");ov.className="cov";ov.id="char-select-overlay";
var box=document.createElement("div");box.className="cbx";
var title=document.createElement("div");title.className="cti";title.textContent="选择角色";
var opts=document.createElement("div");opts.className="cop";
    var ids=[["liubei","刘备","男",0],["xiaosha","小杀","女",1]];
    ids.push(["zhangfei","张飞","男",2]);
    ids.push(["guanyu","关羽","男",3]);
    ids.push(["zhangchunhua","张春华","女",4]);
ids.forEach(function(a){
var d=document.createElement("div");d.className="cot";
d.onclick=function(){PK.WSClient.send("change_character",{avatarId:a[3]});ov.style.display="none";};
var i=document.createElement("img");i.className="cim";i.src="/assets/sprites/char_"+a[0]+".png";
var n=document.createElement("div");n.className="cna";n.textContent=a[1];
var g=document.createElement("div");g.className="cge";g.textContent=a[2];
d.appendChild(i);d.appendChild(n);d.appendChild(g);opts.appendChild(d);
});
var close=document.createElement("button");close.className="ccl";close.textContent="关闭";
close.onclick=function(){ov.style.display="none";};
box.appendChild(title);box.appendChild(opts);box.appendChild(close);
ov.appendChild(box);document.body.appendChild(ov);
}
ov.style.display="flex";
}
function onQuickSpeech() {
  var ov = document.getElementById("speech-overlay");
  if (ov && ov.style.display !== "none") { ov.style.display = "none"; return; }
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "speech-overlay";
    ov.style.cssText = "position:fixed;bottom:calc(50px + env(safe-area-inset-bottom,0px));left:8px;z-index:10001;pointer-events:auto;background:rgba(0,0,0,0.88);border-radius:10px;padding:10px;min-width:280px;max-width:92vw;max-height:50vh;display:flex;flex-direction:column;";
    var itemRow = document.createElement("div");
    itemRow.style.cssText = "display:flex;gap:4px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);";
    var defs = [
      {id:"egg",l:"🥚 -1分",c:1},
      {id:"egg",l:"🥚×10 -10分",c:10},
      {id:"flower",l:"🌹 -1分",c:1},
      {id:"flower",l:"🌹×10 -10分",c:10}
    ];
    for (var di = 0; di < defs.length; di++) {(function(d){
      var b = document.createElement("button");
      b.textContent = d.l;
      b.style.cssText = "flex:1;padding:8px 2px;border:none;border-radius:6px;font-size:12px;cursor:pointer;background:rgba(255,255,255,0.15);color:white;text-align:center;";
      b.onclick = function(e){e.stopPropagation();selectItem(d.id,d.c);ov.style.display="none";};
      itemRow.appendChild(b);
    })(defs[di]);}
    ov.appendChild(itemRow);
    var sc = document.createElement("div");
    sc.style.cssText = "overflow-y:auto;max-height:35vh;padding:6px 0;-webkit-overflow-scrolling:touch;";
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
    var myCharId = 0;
    if (state.room && state.room.players) {
      for (var ci = 0; ci < state.room.players.length; ci++) {
        if (state.room.players[ci].id === state.playerId) {
          myCharId = state.room.players[ci].avatarId || 0;
          break;
        }
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
    sc.addEventListener("click", function(e) {
      var t = e.target.closest("[data-idx]");
      if (!t) return;
      var pi = parseInt(t.dataset.idx);
      var p = phrases[pi];
      if (!p) return;
      if (p.c !== undefined && p.c !== myCharId) return;
      var text = p.t.replace(/^\d+\.\s*/,"");
      var g = "male";
      if (state.room && state.room.players) {
        for (var j = 0; j < state.room.players.length; j++) {
          if (state.room.players[j].id === state.playerId) { g = (characters[state.room.players[j].avatarId] && characters[state.room.players[j].avatarId].gender === "female") ? "female" : "male"; break; }
        }
      }
      var sn = (g === "female" ? p.f : p.m);
      if (sn && PK.Sound) PK.Sound.play(sn);
      if (PK.WSClient) PK.WSClient.send("send_speech", { text: text, soundName: sn });
      // Show speech bubble above character
      var bp = PK.TableRenderer && PK.TableRenderer.getSeatPos ? PK.TableRenderer.getSeatPos(state.playerId) : null;
      var bx = bp ? bp.x : window.innerWidth / 2;
      var by = bp ? bp.y - 80 : window.innerHeight * 0.65;
      var el = document.createElement("div");
      el.textContent = text;
      el.style.cssText = "position:fixed;left:" + bx + "px;top:" + by + "px;transform:translate(-50%,-100%);background:rgba(0,0,0,0.85);color:#FFE082;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:bold;z-index:10002;max-width:70vw;text-align:center;pointer-events:none;";
      document.body.appendChild(el);
      setTimeout(function(){if(el.parentNode)el.remove();},3000);
    });
    ov.appendChild(sc);
    var cb = document.createElement("div");
    cb.textContent = "关闭";
    cb.style.cssText = "text-align:center;color:#999;font-size:13px;padding:8px 8px 2px;cursor:pointer;border-top:1px solid rgba(255,255,255,0.1);";
    cb.onclick = function(){ov.style.display="none";};
    ov.appendChild(cb);
    document.body.appendChild(ov);
  }
  ov.style.display = "flex";
  var ms = 0;
  if (state.room && state.room.players) {
    for (var k = 0; k < state.room.players.length; k++) {
      if (state.room.players[k].id === state.playerId) { ms = state.room.players[k].score; break; }
    }
  }
  var dis = state.selectingTarget;
  var btns = ov.querySelectorAll("button");
  for (var k = 0; k < btns.length; k++) {
    var t = btns[k].textContent;
    if (t.indexOf("×10") >= 0) { btns[k].disabled = dis || ms < 10; }
    else { btns[k].disabled = dis || ms < 1; }
    btns[k].style.opacity = btns[k].disabled ? "0.3" : "1";
  }
}function cancelItemTarget() {
    dom.targetOverlay.style.display = "none";
    dom.itemTargetHint.style.display = "none";
    state.selectingTarget = false;
    state.selectedItem = null;
  }

  // ===== 服务端事件处理 =====
  function handleRoomJoined(data) {
    state.playerId = data.you;
    state.isHost = data.players && data.players.some(function (p) { return p.id === data.you && p.isHost; });
    state.room = { code: data.code, players: data.players, settings: data.settings, phase: data.phase };
    cachedRoomCode = data.code;
    dom.roomCodeDisplay.textContent = data.code;
    dom.btnRoomSettings.style.display = state.isHost ? "" : "none";
    renderRoom();
    showScreen("room");
  }

  function handleRoomUpdate(data) {
    if (state.room) {
      state.room.players = data.players;
      state.room.phase = data.phase;
      state.isHost = data.players.some(function (p) { return p.id === state.playerId && p.isHost; });
    }
    renderRoom();
  }


  function renderRoom() {
    if (!state.room) return;
    var players = state.room.players || [];
    var list = dom.playerList;
    list.innerHTML = "";

    // avatarId -> 角色图片映射
    var avatarImages = [
      "/assets/sprites/char_liubei.png",  // 0: 刘备
      "/assets/sprites/char_xiaosha.png",  // 1: 小杀
      "/assets/sprites/char_zhangfei.png",  // 2: 张飞
      "/assets/sprites/char_guanyu.png",  // 3: 关羽
      "/assets/sprites/char_zhangchunhua.png"  // 4: 张春华
    ];

    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var item = document.createElement("div");
      item.className = "player-item slide-up";
      item.style.animationDelay = (i * 0.08) + "s";

      var statusClass = "status-waiting";
      var statusText = isBot ? "\U0001f916 \u673a\u5668\u4eba" : (p.isHost ? "\u623f\u4e3b" : (p.isReady ? "\u5df2\u51c6\u5907" : "\u7b49\u5f85\u4e2d"));
      if (p.isHost) { statusClass = "status-host"; statusText = "房主"; }
      else if (p.isReady) { statusClass = "status-ready"; statusText = "已准备"; }

      var isBot = p.isBot || false;
      var avatarImg = avatarImages[p.avatarId] || avatarImages[0];
      item.innerHTML =
        '<div class="avatar avatar-img"><img src="' + avatarImg + '" alt=""></div>' +
        '<div class="info"><div class="name">' + escapeHtml(p.nickname) + (p.id === state.playerId ? " (你)" : "") + "</div>" +
       '<div class="score">积分: ' + p.score + "</div></div>" +
        '<div class="status ' + statusClass + '">' + statusText + "</div>" +
        (state.isHost && isBot ? '<button class="rm-bot-btn" data-botid="' + p.id + '">✕</button>' : "");
      list.appendChild(item);
    }

    // 机器人移除按钮委托
    list.addEventListener("click", function(e) {
      var btn = e.target.closest(".rm-bot-btn");
      if (btn) {
        var bid = btn.getAttribute("data-botid");
        if (bid) PK.WSClient.send("remove_bot", { botId: bid });
      }
    });

    // 按钮状态
    var amReady = players.some(function (p) { return p.id === state.playerId && p.isReady; });
    dom.btnReady.style.display = state.isHost ? "none" : ""; dom.btnReady.textContent = amReady ? "取消准备" : "准备";
    // Bot section
    if (state.isHost) {
      var oldBot = document.getElementById("bot-section");
      if (oldBot) oldBot.remove();
      var bd = document.createElement("div");
      bd.id = "bot-section";
      bd.style.cssText = "display:flex;gap:8px;padding:10px 16px;justify-content:center;margin-top:4px;";
      var bls = [{n:"\u7b80\u5355",l:0},{n:"\u666e\u901a",l:1},{n:"\u56f0\u96be",l:2}];
      for (var bi = 0; bi < bls.length; bi++) {(function(bl){
        var btn = document.createElement("button");
        btn.textContent = "\U0001f916" + bl.n + "\u673a\u5668\u4eba";
        btn.style.cssText = "flex:1;padding:8px 12px;border:1px solid #4ECDC4;border-radius:8px;background:white;color:#4ECDC4;font-size:13px;cursor:pointer;text-align:center;";
        btn.onclick = function(){PK.WSClient.send("add_bot",{level:bl.l});};
        bd.appendChild(btn);
      })(bls[bi]);}
      list.parentNode.appendChild(bd);
    }

    dom.btnStartGame.style.display = state.isHost ? "block" : "none";
    dom.btnStartGame.disabled = false;
  }

  // ===== 游戏事件处理 =====
  function handleHandDealt(data) {
    if (state.screen !== 'game') { showScreen('game'); }
    state.game = data;
    renderGameOverlay(data);
    if (PK.TableRenderer) { PK.TableRenderer.clearEggSplat(); PK.TableRenderer.update(data); }
  }

  function handlePlayerTurn(data) {
    state.myTurn = (data.currentPlayerId === state.playerId);
    state.availableActions = data.availableActions || [];
    updateActionButtons();

    if (PK.TableRenderer) PK.TableRenderer.highlightPlayer(data.currentPlayerId);
  }

  function handleActionResult(data) {
    state.game = data;
    renderGameOverlay(data);
    if (PK.TableRenderer) PK.TableRenderer.update(data);
    addActionLog(data.actions ? data.actions[data.actions.length - 1] : null);
  }

  function handleRoundAdvanced(data) {
    state.game = data;
    renderGameOverlay(data);
    if (PK.TableRenderer) PK.TableRenderer.update(data);
  }

  function handleShowdown(data) {
    if (PK.TableRenderer) PK.TableRenderer.showShowdown(data);
  }

  function handleHandEnd(data) {
    state.game = data;
    if (PK.TableRenderer) PK.TableRenderer.clearEggSplat();
    if (data.scoreChanges) {
      for (var i = 0; i < data.scoreChanges.length; i++) {
        var sc = data.scoreChanges[i];
        if (sc.playerId === state.playerId) {
          // 更新个人积分显示
        }
      }
    }
    if (PK.TableRenderer) PK.TableRenderer.showHandResult(data);
  }

 function handleItemAnim(data) {
    if (PK.PropAnim) {
      PK.PropAnim.init();
      PK.PropAnim.playItemAnimation(data);
    }
    if (data.itemType === "egg" && PK.TableRenderer && PK.TableRenderer.setEggSplat) {
      PK.TableRenderer.setEggSplat(data.toPlayerId);
      // 4秒后自动清除蛋液黄色圈
      if (window._eggSplatTimer) clearTimeout(window._eggSplatTimer);
      window._eggSplatTimer = setTimeout(function() {
        if (PK.TableRenderer && PK.TableRenderer.clearEggSplat) {
          PK.TableRenderer.clearEggSplat();
        }
      }, 4000);
    }
  }

  function handleGameStarted(data) {
    showScreen("game");
    if (PK.TableRenderer) { PK.TableRenderer.clearEggSplat(); PK.TableRenderer.reset(); }
    // 移除结算画面
    var go = document.getElementById("gameover-overlay");
    if (go) go.remove();
  }

  function handlePlayerDisconnected(data) {
    if (PK.TableRenderer) PK.TableRenderer.setPlayerStatus(data.playerId, "disconnected");
  }

  function handleError(data) {
    var msg = data.message || "操作失败";
    if (state.screen === "lobby") {
      dom.lobbyError.textContent = msg;
    } else {
      // 短暂闪烁提示
      var el = document.createElement("div");
      el.className = "error-toast";
      el.textContent = msg;
      el.style.cssText = "position:fixed;top:20%;left:50%;transform:translateX(-50%);background:#E74C3C;color:white;padding:10px 24px;border-radius:8px;z-index:100;font-size:14px;";
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 2000);
    }
  }

  // ===== UI 渲染辅助 =====
  function renderGameOverlay(data) {
    var totalPot = 0;
    if (data.players) {
      for (var i = 0; i < data.players.length; i++) {
        totalPot += data.players[i].totalBetThisHand || 0;
      }
    }
    dom.gamePotDisplay.textContent = "奖池: " + totalPot;

    var phaseNames = {
      preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "摊牌"
    };
    dom.gamePhaseDisplay.textContent = phaseNames[data.phase] || data.phase || "";

    var hc = data.handCount || 0;
    var mh = data.maxHands || 0;
    if (mh > 0) { dom.gamePhaseDisplay.textContent += " 第" + hc + "/" + mh + "局"; } else if (hc > 0) { dom.gamePhaseDisplay.textContent += " 第" + hc + "局"; }
    // 更新道具按钮状态
    updateItemButtons();
  }

  function addActionLog(action) {
    if (!action) return;
    var entry = document.createElement("div");
    var playerName = "";
    if (state.room && state.room.players) {
      for (var i = 0; i < state.room.players.length; i++) {
        if (state.room.players[i].id === action.playerId) {
          playerName = state.room.players[i].nickname;
          break;
        }
      }
    }
    var actionNames = { fold: "弃牌", check: "过牌", call: "跟注", raise: "加注", allin: "全下", blind: "盲注" };
    var text = playerName + " " + (actionNames[action.type] || action.type);
    if (action.amount > 0) text += " " + action.amount + "分";
    entry.textContent = text;
    dom.actionLog.appendChild(entry);
    if (PK.TableRenderer && PK.TableRenderer.addFloatText && PK.TableRenderer.getSeatPos) {
      var sp = PK.TableRenderer.getSeatPos(action.playerId);
      if (sp) PK.TableRenderer.addFloatText(sp.x, sp.y - 80, text, "#FFF176", "bold 14px sans-serif", 3000);
    }
    dom.actionHistory.scrollTop = dom.actionHistory.scrollHeight;
    dom.actionHistory.style.display = "block";
  }

  function updateActionButtons() {
    var scoreData = state.game && state.game.players ? state.game.players : (state.room ? state.room.players : null);
    if (scoreData) { for (var si = 0; si < scoreData.length; si++) {
      if (scoreData[si].id === state.playerId) {
        dom.raiseSlider.setAttribute("max", scoreData[si].score || 2000);
        if (parseInt(dom.raiseAmount.textContent) > scoreData[si].score) dom.raiseAmount.textContent = scoreData[si].score;
        break; }
    } }
    var btns = dom.actionBar.querySelectorAll(".btn-action");
    var hasFold = false;
    for (var i = 0; i < btns.length; i++) {
      var action = btns[i].getAttribute("data-action");
      var visible = state.myTurn && (!state.availableActions.length || state.availableActions.indexOf(action) >= 0);
      if (action === "fold") hasFold = true;
      btns[i].style.display = (action === "fold" && !state.myTurn) ? "none" : (visible ? "" : "none");
    }
    // 特殊处理 fold：只在轮到且可用时显示
    if (state.myTurn && state.availableActions.indexOf("fold") >= 0) {
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute("data-action") === "fold") btns[i].style.display = "";
      }
    }
    // raise slider
    var raiseGroup = dom.actionBar.querySelector(".raise-group");
    if (raiseGroup) {
      raiseGroup.style.display = (state.myTurn && state.availableActions.indexOf("raise") >= 0) ? "" : "none";
    }
    dom.actionBar.style.display = state.myTurn ? "" : "none";
  }

    // 显示等待提示
    var waitEl = document.getElementById('waiting-prompt');
    if (!waitEl) {
      waitEl = document.createElement('div');
      waitEl.id = 'waiting-prompt';
      waitEl.style.cssText = 'position:absolute;bottom:70px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px;background:rgba(0,0,0,0.4);padding:6px 16px;border-radius:8px;z-index:5;';
      document.getElementById('action-bar').parentNode.appendChild(waitEl);
    }
    waitEl.textContent = state.myTurn ? '' : '⏳ 等待其他玩家操作...';
    waitEl.style.display = state.screen === 'game' && !state.myTurn ? '' : 'none';
  

  function updateItemButtons() {
    var myScore = 0;
    if (state.room && state.room.players) {
      for (var i = 0; i < state.room.players.length; i++) {
        if (state.room.players[i].id === state.playerId) {
          myScore = state.room.players[i].score;
          break;
        }
      }
    }
    var showItems = state.screen === "game" && !state.hideButtons;
    dom.btnItemEgg.style.display = showItems ? "" : "none";
    dom.btnItemEgg10.style.display = showItems ? "" : "none";
    dom.btnItemFlower.style.display = showItems ? "" : "none";
    dom.btnItemFlower10.style.display = showItems ? "" : "none";
    dom.btnSpeech.style.display = showItems ? "" : "none";
    dom.btnItemEgg.disabled = !showItems || state.myTurn || myScore < 1 || state.selectingTarget;
    dom.btnItemEgg10.disabled = !showItems || state.myTurn || myScore < 10 || state.selectingTarget;
    dom.btnItemFlower.disabled = !showItems || state.myTurn || myScore < 1 || state.selectingTarget;
    dom.btnItemFlower10.disabled = !showItems || state.myTurn || myScore < 10 || state.selectingTarget;
    dom.btnSpeech.disabled = !showItems || state.selectingTarget;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str || ""));
    return div.innerHTML;
  }

  // ===== 事件绑定（由 main.js 调用） =====
  function registerWSEvents() {
    PK.WSClient.on("room_joined", handleRoomJoined);
    PK.WSClient.on("room_update", handleRoomUpdate);
    PK.WSClient.on("room_disbanded", function() { showScreen("lobby"); });
    PK.WSClient.on("player_left", function (data) {
      if (state.screen === "room" && state.room && state.room.players) {
        state.room.players = state.room.players.filter(function (p) { return p.id !== data.playerId; });
        renderRoom();
      }
    });
    PK.WSClient.on("game_started", handleGameStarted);
    PK.WSClient.on("handDealt", handleHandDealt);
    PK.WSClient.on("playerTurn", handlePlayerTurn);
    PK.WSClient.on("actionResult", handleActionResult);
    PK.WSClient.on("roundAdvanced", handleRoundAdvanced);
    PK.WSClient.on("showdown", handleShowdown);
    PK.WSClient.on("handEnd", handleHandEnd);
    PK.WSClient.on("item_anim", handleItemAnim);
    PK.WSClient.on("player_disconnected", handlePlayerDisconnected);
    PK.WSClient.on("error", handleError);
    PK.WSClient.on("settings_updated", function(data) {
      if (state.room) state.room.settings = data.settings;
    });
    PK.WSClient.on("game_over", function(data) {
      showGameOver(data);
    });
    PK.WSClient.on("speech_received", function(data) {
      if (data && data.soundName && PK.Sound && data.playerId !== state.playerId) {
        PK.Sound.play(data.soundName);
      }
      if (data && data.message && data.playerId !== state.playerId && PK.TableRenderer && PK.TableRenderer.getSeatPos) {
        var bp = PK.TableRenderer.getSeatPos(data.playerId);
        if (bp) {
          var el = document.createElement("div");
          el.textContent = data.message;
          el.style.cssText = "position:fixed;left:" + bp.x + "px;top:" + (bp.y - 80) + "px;transform:translate(-50%,-100%);background:rgba(0,0,0,0.85);color:#FFE082;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:bold;z-index:10002;max-width:70vw;text-align:center;pointer-events:none;";
          document.body.appendChild(el);
          setTimeout(function(){if(el.parentNode)el.remove();},3000);
        }
      }
    });
    PK.WSClient.on("pong", function (d) {});
  }

  function onRoomSettings() {
    if (!state.room || !state.room.settings) return;
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
    var settings = {
      smallBlind: parseInt(document.getElementById("setting-sb").value) || 10,
      bigBlind: parseInt(document.getElementById("setting-bb").value) || 20,
      initialScore: parseInt(document.getElementById("setting-score").value) || 2000,
      maxPlayers: parseInt(document.getElementById("setting-max").value) || 6,
      autoStartDelay: parseInt(document.getElementById("setting-auto").value) || 3,
      maxHands: parseInt(document.getElementById("setting-hands").value) || 0
    };
    PK.WSClient.send("update_settings", settings);
    dom.settingsOverlay.style.display = "none";
  }

  function showGameOver(data) {
    // 移除旧的结算画面
    var old = document.getElementById("gameover-overlay");
    if (old) old.remove();
    var ov = document.createElement("div");
    ov.id = "gameover-overlay";
    ov.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:20000;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;";
    var title = document.createElement("div");
    title.textContent = "游戏结束 - " + (data.label || "");
    title.style.cssText = "color:#FFD700;font-size:24px;font-weight:bold;margin-bottom:20px;";
    ov.appendChild(title);
    var list = document.createElement("div");
    list.style.cssText = "background:rgba(255,255,255,0.1);border-radius:12px;padding:16px;width:280px;max-height:400px;overflow-y:auto;";
    var pdata = data.players || [];
    // 按积分从高到低排序
    pdata.sort(function(a,b) { return b.score - a.score; });
    for (var si = 0; si < pdata.length; si++) {
      var p = pdata[si];
      var row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;padding:10px 12px;border-bottom:" + (si < pdata.length-1 ? "1px solid rgba(255,255,255,0.1)" : "none") + ";align-items:center;";
      var nameEl = document.createElement("span");
      nameEl.textContent = p.nickname + (p.isEliminated ? " (已淘汰)" : "");
      nameEl.style.cssText = "color:#fff;font-size:15px;";
      var scoreEl = document.createElement("span");
      scoreEl.textContent = p.score + "分";
      scoreEl.style.cssText = "color:" + (p.isEliminated ? "#EF9A9A" : "#A5D6A7") + ";font-size:15px;font-weight:bold;";
      row.appendChild(nameEl);
      row.appendChild(scoreEl);
      list.appendChild(row);
    }
    ov.appendChild(list);
    var btnBox = document.createElement("div");
    btnBox.style.cssText = "display:flex;gap:12px;margin-top:20px;";
    var btnBack = document.createElement("button");
    btnBack.textContent = "返回大厅";
    btnBack.style.cssText = "padding:10px 32px;background:#FF6B6B;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;";
    btnBack.onclick = function() {
      ov.remove();
      onLeaveRoom();
    };
    btnBox.appendChild(btnBack);
    // 房主可以重新开始
    if (state.isHost) {
      document.getElementById("btn-start-game").textContent = "重新开始";
      document.getElementById("btn-start-game").style.display = "block";
    }
    ov.appendChild(btnBox);
    document.body.appendChild(ov);
  }

  return {
    init: init,
    registerWSEvents: registerWSEvents,
    getState: function () { return state; },
    showScreen: showScreen,
    handleRoomJoined: handleRoomJoined,
    handleRoomUpdate: handleRoomUpdate,
    handleGameStarted: handleGameStarted,
    handleHandDealt: handleHandDealt,
    handlePlayerTurn: handlePlayerTurn
  };
})();



