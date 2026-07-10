/**
 * pixi-setup.js - Canvas 2D 渲染器核心协调器
 * 管理画布生命周期，委托绘制到子模块（Table / Cards / Avatars / Items）
 */
window.PK = window.PK || {};

PK.TableRenderer = (function () {
  var canvas = null, ctx = null, container = null;
  var eggSplat = {};
  var charImages = {};
  var eggCanvas = null, flowerCanvas = null, flowerFlyCanvas = null;
  var animFrame = null;
  var currentData = null;
  var W = 0, H = 0, cx = 0, cy = 0;
  var seatPos = [];
  var myId = null;

  // 动画累加器 — 被子模块操作
  var animItems = [];
  var floatTexts = [];
  var particles = [];

  // 暴露内部状态给子模块
  var rendererState = {
    get canvas() { return canvas; },
    get ctx() { return ctx; },
    get container() { return container; },
    get W() { return W; },
    get H() { return H; },
    get cx() { return cx; },
    get cy() { return cy; },
    get seatPos() { return seatPos; },
    get currentData() { return currentData; },
    set currentData(v) { currentData = v; },
    get myId() { return myId; },
    set myId(v) { myId = v; },
    get charImages() { return charImages; },
    get eggCanvas() { return eggCanvas; },
    set eggCanvas(v) { eggCanvas = v; },
    get flowerCanvas() { return flowerCanvas; },
    set flowerCanvas(v) { flowerCanvas = v; },
    get flowerFlyCanvas() { return flowerFlyCanvas; },
    set flowerFlyCanvas(v) { flowerFlyCanvas = v; },
    get eggSplat() { return eggSplat; },
    get animItems() { return animItems; },
    get floatTexts() { return floatTexts; },
    get particles() { return particles; }
  };

  function rMin(a, b) { return a < b ? a : b; }

  // ===== Canvas 生命周期 =====
  function start() {
    try {
      container = document.getElementById("game-canvas-container");
      if (!container) { console.warn("[Render] no container"); return; }
      if (canvas) { resize(); return; }
      myId = PK.GameClient ? PK.GameClient.getState().playerId : null;
      W = container.offsetWidth || 800;
      H = container.offsetHeight || 600;
      canvas = document.createElement("canvas");
      var dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.cssText = "position:absolute;top:0;left:0;width:"+W+"px;height:"+H+"px";
      ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      container.appendChild(canvas);
      loadEggImage(); loadFlowerImage(); loadCharacterImages();
      window.addEventListener("resize", resize);
      if (PK.TableRenderer.Table) PK.TableRenderer.Table.drawStatic();
      requestAnimationFrame(loop);
    } catch(e) { console.error("[Render] start error:", e); }
  }

  function resize() {
    if (!canvas || !container) return;
    W = container.offsetWidth || 800; H = container.offsetHeight || 600;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.cssText = "position:absolute;top:0;left:0;width:"+W+"px;height:"+H+"px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (PK.TableRenderer.Table) PK.TableRenderer.Table.drawStatic();
  }

  function stop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null;
    animItems = []; floatTexts = []; particles = [];
    currentData = null; seatPos = []; eggSplat = {};
    window.removeEventListener("resize", resize);
  }

  function reset() { stop(); start(); }
  function update(data) { currentData = data; }

  // 主循环
  function loop() {
    try {
      if (ctx && canvas) {
        ctx.clearRect(0, 0, W, H);
        if (currentData) renderScene();
        else if (PK.TableRenderer.Table) PK.TableRenderer.Table.drawStatic();
      }
    } catch(e) { console.error("[Render] loop error:", e); }
    animFrame = requestAnimationFrame(loop);
  }

  // 场景渲染（委托给子模块）
  function renderScene() {
    if (!ctx || !currentData) return;
    var data = currentData;
    var players = (data.players || []).slice(0);
    var elimPlayers = data.eliminatedPlayers || [];
    for (var ei = 0; ei < elimPlayers.length; ei++) {
      elimPlayers[ei].folded = true; elimPlayers[ei].cards = [];
      elimPlayers[ei].totalBetThisHand = 0; elimPlayers[ei].currentBet = 0;
      elimPlayers[ei].allIn = false; players.push(elimPlayers[ei]);
    }

    cx = W/2; cy = H/2;
    var rx = rMin(W*0.36, 260), ry = rMin(H*0.28, 150);

    // 桌子
    if (PK.TableRenderer.Table) PK.TableRenderer.Table.drawTable(ctx, cx, cy, rx, ry);
    else { ctx.fillStyle = "#C89B5E"; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill(); }

    // 座位
    var n = players.length; seatPos = [];
    var outR = rMin(W*0.42,300), outRy = rMin(H*0.34,190);
    var cardR = rMin(W*0.30,200), cardRy = rMin(H*0.22,130);
    var angles = getAngles(n);
    var curMyId = myId;
    if (!curMyId && PK.GameClient) curMyId = PK.GameClient.getState().playerId;
    if (curMyId) {
      var myIdx = -1;
      for (var ri = 0; ri < n; ri++) { if (players[ri].id === curMyId) { myIdx = ri; break; } }
      if (myIdx > 0) { var rotA = []; for (var ri = 0; ri < n; ri++) rotA[(ri+myIdx)%n] = angles[ri]; angles = rotA; }
    }
    for (var i = 0; i < n; i++) {
      var a = angles[i] || (Math.PI/2 - 2*Math.PI*i/n);
      seatPos.push({ x: cx+outR*Math.cos(a), y: cy+outRy*Math.sin(a), cx: cx+cardR*Math.cos(a), cy: cy+cardRy*Math.sin(a) });
    }

    // 公共牌
    var comm = data.communityCards || [];
    if (comm.length > 0 && PK.TableRenderer.Cards) PK.TableRenderer.Cards.drawCommunity(ctx, comm, cx, cy, rMin(44,W*0.08));

    // 奖池
    var pot = players.reduce(function(s,p){return s+(p.totalBetThisHand||0);},0);
    ctx.fillStyle = "#FFD700"; ctx.font = "bold "+rMin(20,W*0.032)+"px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("奖池: "+pot, cx, cy-10);

    // 阶段
    var pn = {preflop:"翻牌前",flop:"翻牌",turn:"转牌",river:"河牌",showdown:"摊牌"};
    var ph = pn[data.phase]||"";
    if (ph) { ctx.fillStyle="#FFE082"; ctx.font=rMin(12,W*0.021)+"px sans-serif";
      ctx.textAlign="center"; ctx.textBaseline="top"; ctx.fillText(ph,cx,cy+14); }

    // 各玩家
    for (var i = 0; i < Math.min(n, seatPos.length); i++) {
      var p = players[i], sp = seatPos[i], im = p.id === myId;
      if (!p.folded && p.cards && p.cards.length > 0 && PK.TableRenderer.Cards) {
        var sc = im ? rMin(1.3,W*0.05) : rMin(0.55,W*0.001);
        var pw = 50*sc, ph2 = 70*sc;
        var px2 = im ? cx-pw-4 : sp.cx-pw/2;
        var py2 = im ? H-ph2-140 : sp.cy-ph2/2;
        for (var c = 0; c < Math.min(p.cards.length, 2); c++) {
          if (im && p.cards[c]) PK.TableRenderer.Cards.drawCard(ctx, px2+c*(pw+4), py2, p.cards[c].rank, p.cards[c].suit, sc);
          else PK.TableRenderer.Cards.drawCardBack(ctx, px2+c*(pw+4), py2, sc);
        }
      }
      if (PK.TableRenderer.Avatars) PK.TableRenderer.Avatars.drawPerson(ctx, sp.x, sp.y, p, im);
    }

    // Canvas 动画
    if (PK.TableRenderer.Items) {
      PK.TableRenderer.Items.drawAnims(ctx);
      PK.TableRenderer.Items.drawParticles(ctx);
      PK.TableRenderer.Items.drawFloats(ctx);
    }
  }

  function getAngles(n) {
    var m = {2:[Math.PI/2,-Math.PI/2],3:[Math.PI/2,Math.PI*0.15,Math.PI*0.85],4:[Math.PI/2,Math.PI*0.12,-Math.PI/2,Math.PI*0.88],5:[Math.PI/2,Math.PI*0.08,-Math.PI/3,-2*Math.PI/3,Math.PI*0.92],6:[Math.PI/2,Math.PI*0.18,-Math.PI/4,-Math.PI/2,-3*Math.PI/4,Math.PI*0.82]};
    return m[n]||[Math.PI/2,-Math.PI/2];
  }

  // 图片加载
  function loadEggImage(){
    var img=new Image();
    img.onload=function(){
      var oc=document.createElement("canvas");oc.width=img.width;oc.height=img.height;
      var octx=oc.getContext("2d");octx.drawImage(img,0,0);
      var px=octx.getImageData(0,0,oc.width,oc.height).data;
      for(var i=0;i<px.length;i+=4){if(px[i+2]>180&&px[i+1]>170&&px[i]>140&&px[i+2]-px[i]>30&&px[i+2]-px[i+1]<40)px[i+3]=0;}
      octx.putImageData(new ImageData(new Uint8ClampedArray(px),oc.width,oc.height),0,0);
      eggCanvas=oc;
    };img.src="/assets/sprites/egg.png";
  }
  function loadFlowerImage(){
    var img=new Image();
    img.onload=function(){
      var oc=document.createElement("canvas");oc.width=img.width;oc.height=img.height;
      var octx=oc.getContext("2d");octx.drawImage(img,0,0);
      var px=octx.getImageData(0,0,oc.width,oc.height).data;
      for(var i=0;i<px.length;i+=4){if(px[i+2]>180&&px[i+1]>170&&px[i]>140&&px[i+2]-px[i]>30&&px[i+2]-px[i+1]<40)px[i+3]=0;}
      octx.putImageData(new ImageData(new Uint8ClampedArray(px),oc.width,oc.height),0,0);
      flowerCanvas=oc;loadFlowerFlyImage();
    };img.src="/assets/sprites/flower_icon.png";
  }
  function loadFlowerFlyImage(){
    var img=new Image();
    img.onload=function(){
      var oc=document.createElement("canvas");oc.width=img.width;oc.height=img.height;
      var octx=oc.getContext("2d");octx.drawImage(img,0,0);
      var px=octx.getImageData(0,0,oc.width,oc.height).data;
      for(var i=0;i<px.length;i+=4){if(px[i+2]>180&&px[i+1]>170&&px[i]>140&&px[i+2]-px[i]>30&&px[i+2]-px[i+1]<40)px[i+3]=0;}
      octx.putImageData(new ImageData(new Uint8ClampedArray(px),oc.width,oc.height),0,0);
      flowerFlyCanvas=oc;
    };img.src="/assets/sprites/flower_fly.png";
  }
  function loadCharacterImages(){
    var defs=[["liubei","/assets/sprites/char_liubei.png"],["xiaosha","/assets/sprites/char_xiaosha.png"],["zhangfei","/assets/sprites/char_zhangfei.png"],["guanyu","/assets/sprites/char_guanyu.png"],["zhangchunhua","/assets/sprites/char_zhangchunhua.png"]];
    for(var i=0;i<defs.length;i++)(function(id,src){
      var img=new Image();
      img.onload=function(){
        var oc=document.createElement("canvas");oc.width=img.width;oc.height=img.height;
        var octx=oc.getContext("2d");octx.drawImage(img,0,0);
        charImages[id]=oc;
      };img.src=src;
    })(defs[i][0],defs[i][1]);
  }

  return {
    __: rendererState,
    cx:function(){return cx;},cy:function(){return cy;},
    addFloatText:function(x,y,t,c,f,d){if(PK.TableRenderer.Items)PK.TableRenderer.Items.addFloatText(x,y,t,c,f,d);},
    start:start,stop:stop,reset:reset,update:update,
    clearEggSplat:function(){eggSplat={};},
    setEggSplat:function(pid){eggSplat[pid]=true;},
    getSeatPos:function(pid){
      if(!currentData||!currentData.players)return null;
      var allP=(currentData.players||[]).concat(currentData.eliminatedPlayers||[]);
      for(var i=0;i<allP.length;i++){if(allP[i].id===pid&&seatPos[i])return{x:seatPos[i].x,y:seatPos[i].y};}
      return null;
    },
    highlightPlayer:function(){},
    setPlayerStatus:function(p,s){if(s==="disconnected"&&PK.TableRenderer.Items)PK.TableRenderer.Items.addFloatText(W/2,40,"? 掉线: "+p,"#FF5252","14px bold",3000);},
    showShowdown:function(data){
      if(!data||!data.hands)return;
      for(var pid in data.hands){var pls=(currentData&&currentData.players)||[];for(var i=0;i<pls.length;i++){if(pls[i].id===pid&&seatPos[i]&&PK.TableRenderer.Items)PK.TableRenderer.Items.addFloatText(seatPos[i].x,seatPos[i].y-60,"?? "+data.hands[pid].name,"#FFE082",rMin(12,W*0.019)+"px",3500);}}
    },
    showHandResult:function(data){
      if(!data||!PK.TableRenderer.Items)return;
      PK.TableRenderer.Items.addFloatText(W/2,H/2-30,"?? "+((data.winnerIds||[]).join(", ")||"?"),"#FFD700","bold "+rMin(22,W*0.04)+"px",5000);
      PK.TableRenderer.Items.spawnParticles(W/2,H/2,"#FFD700",30);
      if(data.scoreChanges)for(var i=0;i<data.scoreChanges.length;i++){var sc=data.scoreChanges[i];PK.TableRenderer.Items.addFloatText(W/2+(i-data.scoreChanges.length/2)*60,H/2+20,(sc.scoreChange>0?"+":"")+sc.scoreChange,sc.scoreChange>0?"#A5D6A7":"#EF9A9A",rMin(14,W*0.022)+"px",3000);}
    }
  };
})();

