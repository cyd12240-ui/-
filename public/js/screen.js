/**
 * screen.js - 屏幕管理模块
 * 在大厅 / 房间 / 游戏三屏间切换
 * 挂载在 PK.ScreenManager 下
 */
window.PK = window.PK || {};

PK.ScreenManager = (function () {
  function showScreen(name) {
    var screens = ["screen-lobby", "screen-room", "screen-game"];
    for (var i = 0; i < screens.length; i++) {
      var el = document.getElementById(screens[i]);
      if (el) el.classList.toggle("active", screens[i] === "screen-" + name);
    }
    if (PK.GameClient && PK.GameClient.state) PK.GameClient.state.screen = name;
    if (name === "game" && PK.TableRenderer) PK.TableRenderer.start();
    if (name !== "game" && PK.TableRenderer) PK.TableRenderer.stop();
    // Play/pause game video on screen switch
    var gv = document.querySelector(".game-video");
    if (gv) {
      if (name === "game") { try { gv.play(); } catch(e) {} }
      else { gv.pause(); }
    }
  }

  return { showScreen: showScreen };
})();
