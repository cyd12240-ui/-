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




