/*** pixi-setup.js - Canvas 2D 渲染器（稳定版）
 * 纯 Canvas API，零外部依赖
 */
window.PK = window.PK || {};

PK.TableRenderer = (function () {
  var canvas = null, ctx = null, container = null;
  var eggImg = null, eggCanvas = null;
  var flowerImg = null, flowerCanvas = null;
  var flowerFlyImg=null,flowerFlyCanvas=null;
  var charImages = {};
  var animFrame = null, animItems = [], floatTexts = [], particles = [];
  var currentData = null;
  var W = 0, H = 0, cx = 0, cy = 0;
  var seatPos = [], eggSplat = {};
  var myId = null;

  // 预加载角色图片
  function loadCharacterImages() {
    var charDefs = [
      { id: "liubei", src: "/assets/sprites/char_liubei.png" },
    { id: "xiaosha", src: "/assets/sprites/char_xiaosha.png" },
     { id: "zhangfei", src: "/assets/sprites/char_zhangfei.png" },
      { id: "guanyu", src: "/assets/sprites/char_guanyu.png" },
      { id: "zhangchunhua", src: "/assets/sprites/char_zhangchunhua.png" }
    ];
    for (var i = 0; i < charDefs.length; i++) {
      (function (def) {
        var img = new Image();
        img.onload = function () {
          var oc = document.createElement("canvas");
          oc.width = img.width; oc.height = img.height;
          var octx = oc.getContext("2d");
          octx.drawImage(img, 0, 0);
          charImages[def.id] = oc;
        };
        img.src = def.src;
      })(charDefs[i]);
    }
  }

  // 公共 API
  function start() {
    try {
      container = document.getElementById("game-canvas-container");
      if (!container) { console.warn("[Render] no container"); return; }
      if (canvas) { resize(); return; }
      myId = PK.GameClient ? PK.GameClient.getState().playerId : null;
      W = container.offsetWidth || 800; H = container.offsetHeight || 600;
      canvas = document.createElement("canvas");
      var dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.cssText = "position:absolute;top:0;left:0;width:"+W+"px;height:"+H+"px";
      ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      container.appendChild(canvas);
      loadEggImage();loadFlowerImage();loadCharacterImages();
      window.addEventListener("resize", resize);
      drawStatic();
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
    drawStatic();
  }

  function stop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null; animItems = []; floatTexts = []; particles = [];
    window.removeEventListener("resize", resize);
  }

  function reset() { stop(); start(); }
  function update(data) { currentData = data; }

  function loop() {
    try {
      if (ctx && canvas) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#FFF8E7"; ctx.fillRect(0, 0, W, H);
        if (currentData) renderScene();
        else drawStatic();
      }
    } catch(e) { console.error("[Render] loop error:", e); }
    animFrame = requestAnimationFrame(loop);
  }

  // 静态背景
  
  function loadFlowerImage(){flowerImg=new Image();flowerImg.onload=function(){var oc=document.createElement("canvas");oc.width=flowerImg.width;oc.height=flowerImg.height;var octx=oc.getContext("2d");octx.drawImage(flowerImg,0,0);var d=octx.getImageData(0,0,oc.width,oc.height);var px=d.data;for(var i=0;i<px.length;i+=4){var r=px[i],g=px[i+1],b=px[i+2];if(b>180&&g>170&&r>140&&b-r>30&&b-g<40){px[i+3]=0;}}octx.putImageData(d,0,0);flowerCanvas=oc;};flowerImg.src="/assets/sprites/flower_icon.png";loadFlowerFlyImage();}
  function loadFlowerFlyImage(){flowerFlyImg=new Image();flowerFlyImg.onload=function(){var oc=document.createElement("canvas");oc.width=flowerFlyImg.width;oc.height=flowerFlyImg.height;var octx=oc.getContext("2d");octx.drawImage(flowerFlyImg,0,0);var d=octx.getImageData(0,0,oc.width,oc.height);var px=d.data;for(var i=0;i<px.length;i+=4){var r=px[i],g=px[i+1],b=px[i+2];if(b>180&&g>170&&r>140&&b-r>30&&b-g<40){px[i+3]=0;}}octx.putImageData(d,0,0);flowerFlyCanvas=oc;};flowerFlyImg.src="/assets/sprites/flower_fly.png";}
  function loadEggImage(){
    eggImg=new Image();
    eggImg.onload=function(){
      var oc=document.createElement("canvas");
      oc.width=eggImg.width;oc.height=eggImg.height;
      var octx=oc.getContext("2d");
      octx.drawImage(eggImg,0,0);
      var d=octx.getImageData(0,0,oc.width,oc.height);
      var px=d.data;
      for(var i=0;i<px.length;i+=4){
        var r=px[i],g=px[i+1],b=px[i+2];
        // Remove light blue background (RGB ~180,210,235 tolerance 40)
        if(b>180&&g>170&&r>140&&b-r>30&&b-g<40){px[i+3]=0;}
      }
      eggCanvas=oc;
    };
    eggImg.src="/assets/sprites/egg.png";
  }
function drawStatic() {
    if (!ctx) return;
    ctx.fillStyle = "#FFF8E7"; ctx.fillRect(0, 0, W, H);
    cx = W/2; cy = H/2;
    drawTable(cx, cy, Math.min(W*0.36, 260), Math.min(H*0.28, 150));
    ctx.fillStyle = "#999"; ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("等待游戏开始...", cx, cy);
  }

  function drawTable(x, y, rx, ry) {
    ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.ellipse(x, y, rx+10, ry+10, 0, 0, Math.PI*2);
    ctx.fillStyle = "#16213e"; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, rx+5, ry+5, 0, 0, Math.PI*2);
    ctx.fillStyle = "#0f3460"; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2);
    var g = ctx.createRadialGradient(x, y-20, 10, x, y, rx);
    g.addColorStop(0, "#16213e"); g.addColorStop(0.7, "#0f3460"); g.addColorStop(1, "#0a1a3a");
    ctx.fillStyle = g; ctx.fill();
  }

  // 渲染场景
  function renderScene() {
    if (!ctx || !currentData) return;
    var data = currentData, players = (data.players || []).slice(0);
    // 添加淘汰（观战）玩家，灰显
    var elimPlayers = data.eliminatedPlayers || [];
    for (var ei = 0; ei < elimPlayers.length; ei++) {
      elimPlayers[ei].folded = true;
      elimPlayers[ei].cards = [];
      elimPlayers[ei].totalBetThisHand = 0;
      elimPlayers[ei].currentBet = 0;
      elimPlayers[ei].allIn = false;
      players.push(elimPlayers[ei]);
    }
    cx = W/2; cy = H/2;
    var rx = Math.min(W*0.36, 260), ry = Math.min(H*0.28, 150);
    drawTable(cx, cy, rx, ry);

    // 座位
    var n = players.length;
    seatPos = [];
    var outR = rMin(W*0.42, 300), outRy = rMin(H*0.34, 190);
    var cardR = rMin(W*0.30, 200), cardRy = rMin(H*0.22, 130);
    var angles = getAngles(n);
    // Rotate so current player is always at bottom
    var curMyId = myId;
    if (!curMyId && PK.GameClient) { curMyId = PK.GameClient.getState().playerId; }
    if (curMyId) {
      var myIdx = -1;
      for (var ri = 0; ri < n; ri++) { if (players[ri].id === curMyId) { myIdx = ri; break; } }
      if (myIdx > 0) {
        var rotA = [];
        for (var ri = 0; ri < n; ri++) { rotA[(ri + myIdx) % n] = angles[ri]; }
        angles = rotA;
      }
    }
    for (var i = 0; i < n; i++) {
      var a = angles[i] || (Math.PI/2 - 2*Math.PI*i/n);
      seatPos.push({
        x: cx + outR * Math.cos(a), y: cy + outRy * Math.sin(a),
        cx: cx + cardR * Math.cos(a), cy: cy + cardRy * Math.sin(a)
      });
    }

    // 公共牌
    var comm = data.communityCards || [];
    if (comm.length > 0) {
      var cs = Math.min(44, W*0.08);
      var sx = cx - (comm.length * (cs+4)) / 2;
      for (var i = 0; i < comm.length; i++)
        drawCard(ctx, sx + i*(cs+4), cy+10, comm[i].rank, comm[i].suit, cs/50);
    }

    // 奖池
    var pot = players.reduce(function(s,p){return s+(p.totalBetThisHand||0);},0);
    ctx.fillStyle = "#FFD700"; ctx.font = "bold "+rMin(20, W*0.032)+"px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("奖池: "+pot, cx, cy-10);

    // 阶段
    var pn = {preflop:"翻牌前",flop:"翻牌",turn:"转牌",river:"河牌",showdown:"摊牌"};
    var ph = pn[data.phase]||"";
    if (ph) { ctx.fillStyle="#FFE082"; ctx.font=rMin(12,W*0.021)+"px sans-serif";
      ctx.textAlign="center"; ctx.textBaseline="top"; ctx.fillText(ph,cx,cy+14); }

    // 玩家
    for (var i = 0; i < Math.min(n, seatPos.length); i++) {
      var p = players[i], sp = seatPos[i];
      var im = p.id === myId;
      // 卡牌
      if (!p.folded && p.cards && p.cards.length > 0) {
        var sc = im ? Math.min(1.3, W*0.05) : Math.min(0.55, W*0.001);
        var pw = 50*sc, ph2 = 70*sc;
        var px2 = im ? cx - pw - 4 : sp.cx - pw/2;
        var py2 = im ? H - ph2 - 140 : sp.cy - ph2/2;
        for (var c = 0; c < Math.min(p.cards.length, 2); c++) {
          if (im && p.cards[c]) drawCard(ctx, px2 + c*(pw+4), py2, p.cards[c].rank, p.cards[c].suit, sc);
          else drawCardBack(ctx, px2 + c*(pw+4), py2, sc);
        }
      }
      // 人物
      drawPerson(ctx, sp.x, sp.y, p, im);
    }

    // 动画
    drawAnims();
    drawParticles();
    drawFloats();
  }

  // 人物
  function drawPerson(ctx, x, y, p, isMe) {
    if (!p) return;
    var hr = rMin(20, W*0.035), bw = hr*1.5, bh = hr*1.6;
    var isFolded = p.folded;
    var charIds = ["liubei", "xiaosha", "zhangfei", "guanyu", "zhangchunhua"];
    var charId = charIds[p.avatarId] || charIds[0];
    var charCanvas = charImages[charId];

    if (charCanvas) {
      // 有角色贴图 -> 绘制角色图片
      ctx.save();
      ctx.translate(x, y);
      if (isFolded) ctx.globalAlpha = 0.5;
      var sc = Math.min(80 / charCanvas.width, 80 / charCanvas.height);
      ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 4;
      ctx.drawImage(charCanvas, -charCanvas.width * sc / 2, -charCanvas.height * sc / 2, charCanvas.width * sc, charCanvas.height * sc);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      // 无角色贴图 -> 绘制卡通简笔画
      ctx.save();
      ctx.translate(x, y);
      if (isFolded) ctx.globalAlpha = 0.5;
      ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 4;
      // 身体
      ctx.fillStyle = "#5DADE2";
      roundRect(ctx, -bw/2, hr+4, bw, bh, 5); ctx.fill();
      // 头
      ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI*2);
      ctx.fillStyle = "#FFE0B2"; ctx.fill(); ctx.shadowBlur = 0;
      // 头发
      ctx.fillStyle = p.avatarId === 1 ? "#4A148C" : "#3E2723";
      ctx.beginPath(); ctx.arc(0, -hr*0.25, hr*0.9, Math.PI, 0); ctx.fill();
      ctx.fillRect(-hr*0.9, -hr*0.05, hr*1.8, hr*0.18);
      // 眼
      var ey = -hr*0.1, eo = hr*0.25;
      if (isFolded) {
        ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-eo-2, ey-2); ctx.lineTo(-eo+2, ey+2);
        ctx.moveTo(-eo+2, ey-2); ctx.lineTo(-eo-2, ey+2);
        ctx.moveTo(eo-2, ey-2); ctx.lineTo(eo+2, ey+2);
        ctx.moveTo(eo+2, ey-2); ctx.lineTo(eo-2, ey+2); ctx.stroke();
      } else {
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(-eo, ey, hr*0.08, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eo, ey, hr*0.08, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(-eo+1, ey-1, hr*0.03, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eo+1, ey-1, hr*0.03, 0, Math.PI*2); ctx.fill();
      }
      // 嘴
      ctx.strokeStyle = "#C62828"; ctx.lineWidth = 1.2;
      var my2 = hr*0.2;
      ctx.beginPath(); ctx.arc(0, my2, hr*0.15, 0.1, Math.PI-0.1); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // 蛋液效果
    if (eggSplat[p.id]) {
      ctx.save();
      ctx.fillStyle = "rgba(255,235,59,0.5)";
      ctx.beginPath(); ctx.arc(x-3, y-hr*0.2, hr*1.1, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(255,193,7,0.35)";
      ctx.beginPath(); ctx.arc(x+5, y-hr*0.3, hr*0.8, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // 昵称
    ctx.fillStyle = "#fff"; ctx.font = "bold " + rMin(14, W*0.025) + "px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(p.nickname, x, y + 50);
    // 积分
    ctx.fillStyle = p.score > 0 ? "#A5D6A7" : "#EF9A9A";
    ctx.font = rMin(12, W*0.022) + "px sans-serif";
    ctx.fillText("积分 " + p.score, x, y + 68);

    if (p.currentBet > 0) {
      ctx.fillStyle = "#FFD54F"; ctx.font = "bold " + rMin(16, W*0.025) + "px sans-serif";
      ctx.textBaseline = "bottom";
      ctx.fillText("+" + p.currentBet, x, y - 30);
    }
    if (p.allIn) {
      ctx.fillStyle = "#FF5252"; ctx.font = "bold 11px sans-serif";
      ctx.fillText("ALL IN", x, y - 50);
    }
  }

  function drawHair(hr, s) {
    ctx.fillStyle = s.h;
    if (s.t==="cap") { ctx.beginPath();ctx.arc(0,-hr*0.25,hr*0.9,Math.PI,0);ctx.fill();
      ctx.fillRect(-hr*0.9,-hr*0.05,hr*1.8,hr*0.18); }
    else if (s.t==="long") { ctx.beginPath();ctx.arc(0,-hr*0.2,hr*0.95,Math.PI,0);ctx.fill();
      ctx.fillRect(-hr*0.1,0,hr*0.2,hr*0.8); }
    else if (s.t==="beard") { ctx.beginPath();ctx.arc(0,-hr*0.2,hr*0.95,Math.PI,0);ctx.fill();
      ctx.beginPath();ctx.arc(0,hr*0.3,hr*0.55,0,Math.PI);ctx.fill(); }
    else if (s.t==="curly") { for(var a=-hr*0.8;a<=hr*0.8;a+=hr*0.3){ctx.beginPath();ctx.arc(a,-hr*0.5,hr*0.22,0,Math.PI*2);ctx.fill();} }
    else if (s.t==="glasses"){ctx.beginPath();ctx.arc(0,-hr*0.2,hr*0.95,Math.PI,0);ctx.fill();
      ctx.strokeStyle="#666";ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(-hr*0.25,-hr*0.05,hr*0.22,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(hr*0.25,-hr*0.05,hr*0.22,0,Math.PI*2);ctx.stroke(); }
    else if (s.t==="bun") { ctx.beginPath();ctx.arc(0,-hr*0.2,hr*0.95,Math.PI,0);ctx.fill();
      ctx.beginPath();ctx.arc(0,-hr*0.85,hr*0.35,0,Math.PI*2);ctx.fill(); }
  }

  // 卡牌
  function drawCard(ctx, x, y, rank, suit, scale) {
    if (!scale) scale = 0.6;
    var w=50*scale,h=70*scale,r=4*scale;
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,0.2)";ctx.shadowBlur=3*scale;
    roundRect(ctx,x,y,w,h,r);ctx.fillStyle="#fff";ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle="#ddd";ctx.lineWidth=1;
    roundRect(ctx,x,y,w,h,r);ctx.stroke();
    var red=suit==="h"||suit==="d";
    var color=red?"#D32F2F":"#212121";
    var rn={2:"2",3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K",14:"A"}[rank]||"?";
    var ss={h:"♥",d:"♦",c:"♣",s:"♠"}[suit]||"?";
    ctx.fillStyle=color;ctx.font="bold "+Math.round(13*scale)+"px sans-serif";
    ctx.textAlign="left";ctx.textBaseline="top";ctx.fillText(rn,x+3*scale,y+2*scale);
    ctx.font=Math.round(10*scale)+"px sans-serif";ctx.fillText(ss,x+3*scale,y+16*scale);
    ctx.font=Math.round(20*scale)+"px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(ss,x+w/2,y+h/2);
    ctx.restore();
  }

  function drawCardBack(ctx,x,y,scale){
    scale=scale||0.6;var w=50*scale,h=70*scale,r=4*scale;
    ctx.save();ctx.shadowColor="rgba(0,0,0,0.2)";ctx.shadowBlur=3*scale;
    roundRect(ctx,x,y,w,h,r);ctx.fillStyle="#1565C0";ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle="#0D47A1";ctx.lineWidth=1;
    roundRect(ctx,x,y,w,h,r);ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=0.5;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+h);
    ctx.moveTo(x+w,y);ctx.lineTo(x,y+h);ctx.stroke();
    ctx.restore();
  }

  // 动画
  function drawAnims() {
    var now=Date.now();
    for(var i=animItems.length-1;i>=0;i--){
      var a=animItems[i],t=(now-a.start)/a.dur;
      if(t>=1){animItems.splice(i,1);continue;}
      var x=a.fx+(a.tx-a.fx)*t;
      var my2=Math.min(a.fy,a.ty)-60-a.oy;
      var y=(1-t)*(1-t)*a.fy+2*(1-t)*t*my2+t*t*a.ty;
      ctx.save();ctx.translate(x,y);ctx.rotate(t*Math.PI*6);
      ctx.font=Math.round(28*(1+Math.sin(t*Math.PI)*0.3))+"px sans-serif";
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(a.sym,0,0);ctx.restore();
    }
  }

  function drawParticles() {
    var now=Date.now();
    for(var i=particles.length-1;i>=0;i--){
      var p=particles[i],age=now-p.start;
      if(age>p.life){particles.splice(i,1);continue;}
      var pr=age/p.life;
      p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;
      ctx.globalAlpha=1-pr;
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-pr*0.5),0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function drawFloats() {
    var now=Date.now();
    for(var i=floatTexts.length-1;i>=0;i--){
      var ft=floatTexts[i],age=now-ft.start;
      if(age>ft.dur){floatTexts.splice(i,1);continue;}
      ctx.globalAlpha=1-age/ft.dur;
      ctx.fillStyle=ft.color;ctx.font=ft.font;
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.shadowColor="rgba(0,0,0,0.5)";ctx.shadowBlur=4;
      ctx.fillText(ft.text,ft.x,ft.y-age/ft.dur*40);
    }
    ctx.globalAlpha=1;ctx.shadowBlur=0;
  }

  function spawnParticles(x,y,color,cnt){
    for(var i=0;i<(cnt||15);i++)particles.push({x:x,y:y,vx:(Math.random()-0.5)*8,vy:-Math.random()*6-2,color:color||"#FFD700",size:Math.random()*4+2,start:Date.now(),life:800+Math.random()*400});
  }

  function getAngles(n){
    var m={2:[Math.PI/2,-Math.PI/2],3:[Math.PI/2,Math.PI*0.15,Math.PI*0.85],4:[Math.PI/2,Math.PI*0.12,-Math.PI/2,Math.PI*0.88],5:[Math.PI/2,Math.PI*0.08,-Math.PI/3,-2*Math.PI/3,Math.PI*0.92],6:[Math.PI/2,Math.PI*0.18,-Math.PI/4,-Math.PI/2,-3*Math.PI/4,Math.PI*0.82]};
    return m[n]||[Math.PI/2,-Math.PI/2];
  }

  function rMin(a,b){return a<b?a:b;}

  function addFloatText(x,y,text,color,font,dur){
    floatTexts.push({x:x,y:y,text:text,color:color||"#fff",font:font||"20px sans-serif",start:Date.now(),dur:dur||2000});
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  // ========== 公开 API ==========
  function playItemAnimation(data){
    if(!data||!currentData)return;
    var fi=-1,ti=-1,pls=currentData.players||[];
    for(var i=0;i<pls.length;i++){if(pls[i].id===data.fromPlayerId)fi=i;if(pls[i].id===data.toPlayerId)ti=i;}
    if(fi<0||ti<0||fi>=seatPos.length||ti>=seatPos.length)return;
    var f=seatPos[fi],t=seatPos[ti];
    var sym=data.itemType; if(data.itemType==="egg")sym="egg";else sym="flower"; //"🥚":"💐";
    var hc=data.itemType==="egg"?"#FFB300":"#FF6F00";
    var cnt=data.count||1,delay=0;
    for(var i=0;i<Math.min(cnt,10);i++)(function(idx){
      setTimeout(function(){
        animItems.push({fx:f.x,fy:f.y-20,tx:t.x,ty:t.y-20,sym:sym,oy:Math.random()*40,start:Date.now(),dur:500});
        setTimeout(function(){
          spawnParticles(t.x,t.y,hc,data.itemType==="egg"?20:25);
          addFloatText(t.x,t.y-30,data.itemType==="egg"?"💥":"✨","#FFD700","28px bold",1000);
          if(data.itemType==="egg"){eggSplat[data.toPlayerId]=true;if(window._eggTimer)clearTimeout(window._eggTimer);window._eggTimer=setTimeout(function(){eggSplat={};},8000);}
        },500);
      },delay);
      delay+=280;
    })(i);
  }

  function showShowdown(data){
    if(!data||!data.hands)return;
    for(var pid in data.hands){
      var pls=(currentData&&currentData.players)||[];
      for(var i=0;i<pls.length;i++)if(pls[i].id===pid&&seatPos[i])
        addFloatText(seatPos[i].x,seatPos[i].y-60,"🃏 "+data.hands[pid].name,"#FFE082",rMin(12,W*0.019)+"px",3500);
    }
  }

  function showHandResult(data){
    if(!data)return;
    addFloatText(W/2,H/2-30,"🏆 "+((data.winnerIds||[]).join(", ")||"?"),"#FFD700","bold "+rMin(22,W*0.04)+"px",5000);
    spawnParticles(W/2,H/2,"#FFD700",30);
    if(data.scoreChanges)for(var i=0;i<data.scoreChanges.length;i++){
      var sc=data.scoreChanges[i];
      addFloatText(W/2+(i-data.scoreChanges.length/2)*60,H/2+20,(sc.scoreChange>0?"+":"")+sc.scoreChange,sc.scoreChange>0?"#A5D6A7":"#EF9A9A",rMin(14,W*0.022)+"px",3000);
    }
  }

  function highlightPlayer(p){}
  function setPlayerStatus(p,s){
    if(s==="disconnected")addFloatText(W/2,40,"⚡ 掉线: "+p,"#FF5252","14px bold",3000);
  }


  function clearEggSplat() { eggSplat = {}; }

  function setEggSplat(playerId) { eggSplat[playerId] = true; }

  function getSeatPos(playerId) {
    if (!currentData || !currentData.players) return null;
    var allPlayers = (currentData.players || []).concat(currentData.eliminatedPlayers || []);
    for (var i = 0; i < allPlayers.length; i++) {
      if (allPlayers[i].id === playerId && seatPos[i]) {
        return { x: seatPos[i].x, y: seatPos[i].y };
      }
    }
    return null;
  }

  return {
    cx:function(){return cx;},cy:function(){return cy;},
    addFloatText:addFloatText,
    start:start,stop:stop,reset:reset,update:update,
    clearEggSplat:clearEggSplat,setEggSplat:setEggSplat,getSeatPos:getSeatPos,highlightPlayer:highlightPlayer,setPlayerStatus:setPlayerStatus,
    playItemAnimation:playItemAnimation,showShowdown:showShowdown,
    showHandResult:showHandResult
  };
})();


