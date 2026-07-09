/**
 * index.js - 服务端入口
 *
 * Express 静态文件服务器 + WebSocket 实时通信
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { handleConnection } = require('./ws/handler');

const PORT = process.env.PORT || 3009;
const app = express();

// 访问密码保护（环境变量 ACCESS_PASSWORD 设置密码，不设置则不开启）
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "";

app.use((req, res, next) => {
  if (req.path === "/api/health" || req.path.startsWith("/assets/")) return next();
  if (!ACCESS_PASSWORD) return next();

  var pwd = req.query.pwd || "";
  // 也从 cookie 读
  if (!pwd && req.headers.cookie) {
    var cs = req.headers.cookie.split(";");
    for (var ci = 0; ci < cs.length; ci++) {
      var c = cs[ci].trim();
      if (c.indexOf("pwd=") === 0) { pwd = c.substring(4); break; }
    }
  }

  if (pwd === ACCESS_PASSWORD) {
    res.setHeader("Set-Cookie", "pwd=" + ACCESS_PASSWORD + "; Path=/; Max-Age=604800");
    return next();
  }

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>朋友局</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#FFF8E7}.box{background:white;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.1);text-align:center;width:300px}h1{font-size:24px;margin-bottom:4px;color:#333}p{color:#999;margin-bottom:20px}input{width:100%;padding:10px;border:2px solid #eee;border-radius:8px;font-size:16px;outline:none;box-sizing:border-box;margin-bottom:12px}input:focus{border-color:#FF6B6B}button{width:100%;padding:12px;background:#FF6B6B;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer}button:active{transform:scale(0.97)}.error{color:#E74C3C;font-size:13px;margin-bottom:8px}</style></head><body><div class="box"><h1>🃏 朋友局</h1><p>请输入访问密码</p><div id="e" class="error"></div><input type="password" id="p" placeholder="密码" onkeydown="if(event.key=='Enter')check()"><button onclick="check()">进入</button></div><script>function check(){var v=document.getElementById("p").value;if(!v){document.getElementById("e").textContent="请输入密码";return}window.location.href="/?pwd="+encodeURIComponent(v)}<\/script></body></html`);;
});

// 静态文件（前端页面）
app.use(express.static(path.join(__dirname, '..', 'public')));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), time: Date.now() });
});

// 创建 HTTP 服务器
const server = http.createServer(app);

// WebSocket 服务器（挂载在 HTTP 服务器上）
const wss = new WebSocketServer({ server });

wss.on('connection', handleConnection);

wss.on('error', (err) => {
  console.error('[WSS] Error:', err.message);
});

// 启动
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Texas Poker Friends running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] WebSocket ready on ws://0.0.0.0:${PORT}`);
});

// 优雅关闭




