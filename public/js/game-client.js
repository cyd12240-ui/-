/**
 * game-client.js - 客户端游戏管理（核心协调器）
 * 维护共享状态（state / dom），注册 WS 事件，处理房间与游戏操作
 * 子模块：screen.js / room-ui.js / game-ui.js / item-system.js
 */
window.PK = window.PK || {};

PK.GameClient = (function () {
  // 共享状态 — 子模块通过 PK.GameClient.state / PK.GameClient.dom 访问
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
     gamePotDisplay: document.getElementById("game-pot-display"),
     gamePhaseDisplay: document.getElementById("game-phase-display"),
     actionLog: document.getElementById("action-log"),
     actionHistory: document.getElementById("action-history"),
     actionBar: document.getElementById("action-bar"),
     raiseSlider: document.getElementById("raise-slider"),
     raiseAmount: document.getElementById("raise-amount"),
     itemBar: document.getElementById("item-bar"),
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
   PK.GameClient.dom = dom;
 }

  // ===== UI 绑定 =====
  function bindUI() {
    dom.btnCreateRoom.addEventListener("click", onCreateRoom);
    dom.btnJoinRoom.addEventListener("click", onJoinRoom);
    dom.btnReady.addEventListener("click", onToggleReady);
    dom.btnStartGame.addEventListener("click", onStartGame);
    dom.btnLeaveRoom.addEventListener("click", onLeaveRoom);
    dom.btnLeaveGame.addEventListener("click", onLeaveRoom);
    dom.btnCancelTarget.addEventListener("click", function() {
      if (PK.ItemSystem) PK.ItemSystem.cancelItemTarget();
    });

    // 换角色（委托到 room-ui 的 char select）
    dom.btnChangeChar.addEventListener("click", function() {
      var ov = dom.charSelectOverlay;
      ov.style.display = ov.style.display === "flex" ? "none" : "flex";
    });
    dom.btnCloseCharSelect.addEventListener("click", function() {
      dom.charSelectOverlay.style.display = "none";
    });
    dom.charSelectOverlay.addEventListener("click", function(e) {
      var cot = e.target.closest(".cot");
      if (!cot) return;
      var avatarId = parseInt(cot.getAttribute("data-avatar"));
      if (!isNaN(avatarId)) {
        PK.WSClient.send("change_character", { avatarId: avatarId });
        dom.charSelectOverlay.style.display = "none";
      }
    });

    dom.raiseSlider.addEventListener("input", function() {
      dom.raiseAmount.textContent = this.value;
    });

    dom.inputNickname.addEventListener("keydown", function(e) {
      if (e.key === "Enter") onCreateRoom();
    });
    dom.inputRoomCode.addEventListener("keydown", function(e) {
      if (e.key === "Enter") onJoinRoom();
    });

    // 快捷发言
    dom.btnSpeech.addEventListener("click", function() {
      if (PK.ItemSystem) PK.ItemSystem.onQuickSpeech();
    });

    // 房间设置
    dom.btnRoomSettings.addEventListener("click", function() {
      if (PK.RoomUI) PK.RoomUI.onRoomSettings();
    });
    dom.btnSaveSettings.addEventListener("click", function() {
      if (PK.RoomUI) PK.RoomUI.onSaveSettings();
    });
    dom.btnCloseSettings.addEventListener("click", function() {
      dom.settingsOverlay.style.display = "none";
    });

    // 操作按钮委托
    dom.actionBar.addEventListener("click", function(e) {
      var btn = e.target.closest(".btn-action");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      if (action) sendAction(action);
    });

    // 复制房间码
    document.getElementById("room-code-tap").addEventListener("click", function() {
      if (cachedRoomCode) {
        if (navigator.clipboard) navigator.clipboard.writeText(cachedRoomCode);
        this.textContent = "已复制!";
        var self = this;
        setTimeout(function() { self.textContent = "点此复制"; }, 2000);
      }
    });
  }

  // ===== 输入验证 =====
  function getNickname() {
    var nick = (dom.inputNickname.value || "").trim();
    if (!nick) { showError("请输入昵称"); return null; }
    if (nick.length > 8) { showError("昵称最多8个字符"); return null; }
    return nick;
  }

  function showError(msg) { dom.lobbyError.textContent = msg || ""; }

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
    var isReady = state.room && state.room.players &&
      state.room.players.some(function(p) { return p.id === state.playerId && p.isReady; });
    PK.WSClient.send("ready", { ready: !isReady });
  }

  function onStartGame() { PK.WSClient.send("start_game", {}); }

  function onLeaveRoom() {
    PK.WSClient.send("leave_room", {});
    cachedRoomCode = "";
    PK.ScreenManager.showScreen("lobby");
  }

  // ===== 游戏操作 =====
  function sendAction(action) {
    if (!state.myTurn) return;
    state.myTurn = false;
    PK.GameUI.updateActionButtons();
    var payload = { action: action };
    if (action === "raise") payload.amount = parseInt(dom.raiseAmount.textContent) || 40;
    PK.WSClient.send("player_action", payload);
  }

  // ===== WS 事件处理 =====
  function handleRoomJoined(data) {
    state.playerId = data.you;
    state.isHost = data.players && data.players.some(function(p) { return p.id === data.you && p.isHost; });
    state.room = { code: data.code, players: data.players, settings: data.settings, phase: data.phase };
    cachedRoomCode = data.code;
    dom.roomCodeDisplay.textContent = data.code;
    dom.btnRoomSettings.style.display = state.isHost ? "" : "none";
    if (PK.RoomUI) PK.RoomUI.renderRoom();
    PK.ScreenManager.showScreen("room");
  }

  function handleRoomUpdate(data) {
    if (state.room) {
      state.room.players = data.players;
      state.room.phase = data.phase;
      state.isHost = data.players.some(function(p) { return p.id === state.playerId && p.isHost; });
    }
    if (PK.RoomUI) PK.RoomUI.renderRoom();
  }

  function handleHandDealt(data) {
    if (state.screen !== "game") PK.ScreenManager.showScreen("game");
    state.game = data;
    PK.GameUI.renderGameOverlay(data);
    if (PK.TableRenderer) { PK.TableRenderer.clearEggSplat(); PK.TableRenderer.update(data); }
  }

  function handlePlayerTurn(data) {
    state.myTurn = (data.currentPlayerId === state.playerId);
    state.availableActions = data.availableActions || [];
    PK.GameUI.updateActionButtons();
    if (PK.TableRenderer) PK.TableRenderer.highlightPlayer(data.currentPlayerId);
  }

  function handleActionResult(data) {
    state.game = data;
    PK.GameUI.renderGameOverlay(data);
    if (PK.TableRenderer) PK.TableRenderer.update(data);
    var lastAction = data.actions ? data.actions[data.actions.length - 1] : null;
    PK.GameUI.addActionLog(lastAction);
  }

  function handleRoundAdvanced(data) {
    state.game = data;
    PK.GameUI.renderGameOverlay(data);
    if (PK.TableRenderer) PK.TableRenderer.update(data);
  }

  function handleShowdown(data) {
    if (PK.TableRenderer) PK.TableRenderer.showShowdown(data);
  }

  function handleHandEnd(data) {
    state.game = data;
    if (PK.TableRenderer) PK.TableRenderer.clearEggSplat();
    if (PK.TableRenderer) PK.TableRenderer.showHandResult(data);
  }

  function handleItemAnim(data) {
    if (PK.PropAnim) {
      PK.PropAnim.init();
      PK.PropAnim.playItemAnimation(data);
    }
    if (data.itemType === "egg" && PK.TableRenderer && PK.TableRenderer.setEggSplat) {
      PK.TableRenderer.setEggSplat(data.toPlayerId);
      if (window._eggSplatTimer) clearTimeout(window._eggSplatTimer);
      window._eggSplatTimer = setTimeout(function() {
        if (PK.TableRenderer && PK.TableRenderer.clearEggSplat) PK.TableRenderer.clearEggSplat();
      }, 4000);
    }
  }

  function handleGameStarted(data) {
    PK.ScreenManager.showScreen("game");
    if (PK.TableRenderer) { PK.TableRenderer.clearEggSplat(); PK.TableRenderer.reset(); }
    var go = document.getElementById("gameover-overlay");
    if (go) go.remove();
  }

  function handlePlayerDisconnected(data) {
    if (PK.TableRenderer) PK.TableRenderer.setPlayerStatus(data.playerId, "disconnected");
  }

  function handleError(data) {
    var msg = data.message || "操作失败";
    if (state.screen === "lobby") { dom.lobbyError.textContent = msg; }
    else {
      var el = document.createElement("div");
      el.className = "error-toast";
      el.textContent = msg;
      el.style.cssText = "position:fixed;top:20%;left:50%;transform:translateX(-50%);background:#E74C3C;color:white;padding:10px 24px;border-radius:8px;z-index:100;font-size:14px;";
      document.body.appendChild(el);
      setTimeout(function() { el.remove(); }, 2000);
    }
  }

  // ===== WS 注册 =====
  function registerWSEvents() {
    PK.WSClient.on("room_joined", handleRoomJoined);
    PK.WSClient.on("room_update", handleRoomUpdate);
    PK.WSClient.on("room_disbanded", function() { PK.ScreenManager.showScreen("lobby"); });
    PK.WSClient.on("player_left", function(data) {
      if (state.screen === "room" && state.room && state.room.players) {
        state.room.players = state.room.players.filter(function(p) { return p.id !== data.playerId; });
        if (PK.RoomUI) PK.RoomUI.renderRoom();
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
      PK.GameUI.showGameOver(data);
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
          el.style.cssText = "position:fixed;left:"+bp.x+"px;top:"+(bp.y-80)+"px;transform:translate(-50%,-100%);background:rgba(0,0,0,0.85);color:#FFE082;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:bold;z-index:10002;max-width:70vw;text-align:center;pointer-events:none;";
          document.body.appendChild(el);
          setTimeout(function(){if(el.parentNode)el.remove();},3000);
        }
      }
    });
    PK.WSClient.on("pong", function(){});
  }

  return {
    state: state,
    dom: dom,
    init: init,
    registerWSEvents: registerWSEvents,
    getState: function() { return state; },
    showScreen: function(n) { PK.ScreenManager.showScreen(n); },
    handleRoomJoined: handleRoomJoined,
    handleRoomUpdate: handleRoomUpdate,
    handleGameStarted: handleGameStarted,
    handleHandDealt: handleHandDealt,
    handlePlayerTurn: handlePlayerTurn
  };
})();
