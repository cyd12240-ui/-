/**
 * sound.js - 音效管理（Web Audio API 合成）
 * 无需外部音频文件，纯代码生成音效
 */
window.PK = window.PK || {};

PK.Sound = (function () {
  var ctx = null;
  var enabled = true;

  function init() { preloadAudio();
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("[Sound] AudioContext not available");
      enabled = false;
    }
  }

  var audioBuffers={};
function preloadMP3(){
  ["egg_throw","egg_hit","flower_throw","flower_hit","speech_01_male","speech_01_female"].forEach(function(n){
    fetch("/assets/sounds/"+n+".mp3").then(function(r){return r.arrayBuffer();}).then(function(d){
      if(!ctx)return;
      ctx.decodeAudioData(d,function(b){audioBuffers[n]=b;},function(){});
    });
  });
}
function playMP3(name){
  if(!ctx||!audioBuffers[name])return false;
  try{
    var src=ctx.createBufferSource();
    src.buffer=audioBuffers[name];
    src.connect(ctx.destination);
    src.start(0);
  }catch(e){}
  return true;
}

var audioBuffers={},audioEls={},audioReady={};
function preloadAudio(){
  ["egg_throw","egg_hit","flower_throw","flower_hit","Tuoxie1","Tuoxie2","words_0_1","words_0_2","words_3_1","words_3_2","words_4_1","words_4_2","words_5_1","words_5_2","words_6_1","words_6_2","words_9_1","words_9_2","SKILL_31_1_1","SKILL_31_1_2","words_0_1","words_0_2","words_3_1","words_3_2","words_4_1","words_4_2","words_5_1","words_5_2","words_6_1","words_6_2","words_9_1","words_9_2","SKILL_31_1_1","SKILL_31_1_2","words_0_1","words_0_2","words_3_1","words_3_2","words_4_1","words_4_2","words_5_1","words_5_2","words_6_1","words_6_2","words_9_1","words_9_2","SKILL_34_3_1","SKILL_34_3_2","SKILL_33_2_1","SKILL_33_2_2","SKILL_16105_shangshi_1","SKILL_16105_shangshi_2","SKILL_16105_jueqing_1","SKILL_16105_jueqing_2"].forEach(function(n){
    // Preload HTMLAudioElement for instant playback
    var a=new Audio();a.src="/assets/sounds/"+n+".mp3";a.load();audioEls[n]=a;
    // Also decode via Web Audio API for parallel playback
    fetch("/assets/sounds/"+n+".mp3").then(function(r){return r.arrayBuffer();}).then(function(d){
      if(ctx){ctx.decodeAudioData(d,function(b){audioBuffers[n]=b;audioReady[n]=true;},function(e){console.warn("Audio decode error:",n,e);});}
    });
  });
}
function playMP3(name){
  // Try Web Audio API first (best quality, parallel)
  if(audioBuffers[name]){try{var src=ctx.createBufferSource();src.buffer=audioBuffers[name];src.connect(ctx.destination);src.start(0);}catch(e){}return true;}
  // Fallback to HTMLAudioElement (instant, good quality)
  if(audioEls[name]){try{var c=audioEls[name].cloneNode();c.volume=1;c.play();}catch(e){}return true;}
  return false;
}

function ensureResumed(){
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  }

  function play(type) {
    // Direct Audio path - no AudioContext needed
    if (type==="egg_throw"||type==="egg_hit"||type==="flower_throw"||type==="flower_hit"||type==="Tuoxie1"||type==="Tuoxie2"||type==="words_0_1"||type==="words_0_2"||type==="words_3_1"||type==="words_3_2"||type==="words_4_1"||type==="words_4_2"||type==="words_5_1"||type==="words_5_2"||type==="words_6_1"||type==="words_6_2"||type==="words_9_1"||type==="words_9_2"||type==="SKILL_31_1_1"||type==="SKILL_31_1_2") {
      var src = "/assets/sounds/" + type + ".mp3";
      try {
        var a = new Audio(src);
        a.volume = 1;
        a.play().catch(function(){});
      } catch(e) {}
      return;
    }
    if (!enabled) return;
    ensureResumed();
    if (playMP3(type)) return;
    if (!ctx) return;
    switch (type) {
      case "card_deal": playCardDeal(); break;
      case "chip": playChip(); break;
      case "win": playWin(); break;
    }
  }

  function playEggThrow() {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  function playEggHit() {
    // 噪声模拟碎裂声
    var bufferSize = ctx.sampleRate * 0.2;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;

    var bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 500;
    bandpass.Q.value = 2;

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  function playFlowerThrow() {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  function playFlowerHit() {
    // 欢快和弦
    var notes = [523, 659, 784]; // C5, E5, G5
    for (var i = 0; i < notes.length; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + 0.5);
    }
  }

  function playCardDeal() {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  function playChip() {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 400;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  function playWin() {
    var notes = [523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    }
  }

  return { init: init, play: play, ensureResumed: ensureResumed };
})();
