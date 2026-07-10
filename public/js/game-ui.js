/**
 * game-ui.js - 游戏界面 UI 渲染模块
 * 奖池显示、阶段显示、行动日志、操作按钮、道具栏、结算画面
 * 挂载在 PK.GameUI 下
 */
window.PK = window.PK || {};

PK.GameUI = (function () {
  function getState() { return PK.GameClient ? PK.GameClient.state : null; }
  function getDom() { return PK.GameClient ? PK.GameClient.dom : null; }

  function renderGameOverlay(data) {
    var state = getState();
    var dom = getDom();
    if (!dom) return;
    var totalPot = 0;
    if (data.players) {
      for (var i = 0; i < data.players.length; i++) {
        totalPot += data.players[i].totalBetThisHand || 0;
      }
    }
    dom.gamePotDisplay.textContent = "奖池: " + totalPot;
    var phaseNames = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "摊牌" };
    dom.gamePhaseDisplay.textContent = phaseNames[data.phase] || data.phase || "";

    var hc = data.handCount || 0;
    var mh = data.maxHands || 0;
    if (mh > 0) { dom.gamePhaseDisplay.textContent += " 第" + hc + "/" + mh + "局"; }
    else if (hc > 0) { dom.gamePhaseDisplay.textContent += " 第" + hc + "局"; }

    updateItemButtons();
  }

  function updateItemButtons() {
    var state = getState();
    var dom = getDom();
    if (!state || !dom) return;
    var myScore = 0;
    if (state.room && state.room.players) {
      for (var i = 0; i < state.room.players.length; i++) {
        if (state.room.players[i].id === state.playerId) { myScore = state.room.players[i].score; break; }
      }
    }
    var showItems = state.screen === "game" && !state.hideButtons;
    dom.btnSpeech.style.display = showItems ? "" : "none";
    dom.btnSpeech.disabled = !showItems || state.selectingTarget;
  }

  function addActionLog(action) {
    var state = getState();
    var dom = getDom();
    if (!action || !state || !dom) return;
    var entry = document.createElement("div");
    var playerName = "";
    if (state.room && state.room.players) {
      for (var i = 0; i < state.room.players.length; i++) {
        if (state.room.players[i].id === action.playerId) { playerName = state.room.players[i].nickname; break; }
      }
    }
    var actionNames = { fold: "弃牌", check: "过牌", call: "跟注", raise: "加注", allin: "全下", blind: "盲注" };
    var text = playerName + " " + (actionNames[action.type] || action.type);
    if (action.amount > 0) text += " " + action.amount + "分";
    entry.textContent = text;
    dom.actionLog.appendChild(entry);
    // 浮动操作文字
    if (PK.TableRenderer && PK.TableRenderer.addFloatText && PK.TableRenderer.getSeatPos) {
      var sp = PK.TableRenderer.getSeatPos(action.playerId);
      if (sp) PK.TableRenderer.addFloatText(sp.x, sp.y - 80, text, "#FFF176", "bold 14px sans-serif", 3000);
    }
    dom.actionHistory.scrollTop = dom.actionHistory.scrollHeight;
    dom.actionHistory.style.display = "block";
  }

  function updateActionButtons() {
    var state = getState();
    var dom = getDom();
    if (!state || !dom) return;
    var scoreData = state.game && state.game.players ? state.game.players : (state.room ? state.room.players : null);
    if (scoreData) {
      for (var si = 0; si < scoreData.length; si++) {
        if (scoreData[si].id === state.playerId) {
          dom.raiseSlider.setAttribute("max", scoreData[si].score || 2000);
          if (parseInt(dom.raiseAmount.textContent) > (scoreData[si].score || 2000)) dom.raiseAmount.textContent = scoreData[si].score || 2000;
          break;
        }
      }
    }
    var btns = dom.actionBar.querySelectorAll(".btn-action");
    for (var i = 0; i < btns.length; i++) {
      var action = btns[i].getAttribute("data-action");
      var visible = state.myTurn && (!state.availableActions.length || state.availableActions.indexOf(action) >= 0);
      btns[i].style.display = visible ? "" : "none";
    }
    var raiseGroup = dom.actionBar.querySelector(".raise-group");
    if (raiseGroup) raiseGroup.style.display = (state.myTurn && state.availableActions.indexOf("raise") >= 0) ? "" : "none";
    dom.actionBar.style.display = state.myTurn ? "" : "none";

    // 等待提示
    var waitEl = document.getElementById("waiting-prompt");
    if (!waitEl) {
      waitEl = document.createElement("div");
      waitEl.id = "waiting-prompt";
      waitEl.style.cssText = "position:absolute;bottom:70px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px;background:rgba(0,0,0,0.4);padding:6px 16px;border-radius:8px;z-index:5;";
      document.getElementById("action-bar").parentNode.appendChild(waitEl);
    }
    waitEl.textContent = state.myTurn ? "" : "⏳ 等待其他玩家操作...";
    waitEl.style.display = state.screen === "game" && !state.myTurn ? "" : "none";
  }

  function showGameOver(data) {
    var state = getState();
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
    var pdata = (data.players || []).slice();
    pdata.sort(function(a,b){return b.score - a.score;});
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
      row.appendChild(nameEl); row.appendChild(scoreEl);
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
      if (PK.WSClient) PK.WSClient.send("leave_room", {});
      PK.ScreenManager.showScreen("lobby");
    };
    btnBox.appendChild(btnBack);
    if (state && state.isHost) {
      document.getElementById("btn-start-game").textContent = "重新开始";
      document.getElementById("btn-start-game").style.display = "block";
    }
    ov.appendChild(btnBox);
    document.body.appendChild(ov);
  }

  return {
    renderGameOverlay: renderGameOverlay,
    addActionLog: addActionLog,
    updateActionButtons: updateActionButtons,
    updateItemButtons: updateItemButtons,
    showGameOver: showGameOver
  };
})();
