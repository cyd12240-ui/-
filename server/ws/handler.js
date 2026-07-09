/**
 * handler.js - WebSocket 消息分发
 *
 * 连接 WebSocket 消息到房间/游戏操作。
 * 每个 WebSocket 连接对应一个玩家，绑定 playerId。
 */

const { validateMessage, errorMsg } = require('./protocol');
const Room = require('../game-engine/room');
const crypto = require('crypto');

// 生成唯一玩家 ID
function generatePlayerId() {
  return 'p_' + crypto.randomBytes(8).toString('hex');
}

/**
 * 处理新的 WebSocket 连接
 */
function handleConnection(ws) {
  const playerId = generatePlayerId();
  ws.playerId = playerId;
  ws.roomCode = null;

  console.log(`[WS] New connection: ${playerId}`);

  // 发送连接确认
  ws.send(JSON.stringify({
    type: 'connected',
    data: { playerId }
  }));

  // 绑定消息处理
  ws.on('message', (raw) => handleMessage(ws, raw));

  // 绑定断开处理
  ws.on('close', () => handleDisconnect(ws));

  // 绑定错误处理
  ws.on('error', (err) => {
    console.error(`[WS] Error ${playerId}:`, err.message);
  });
}

/**
 * 处理收到的消息
 */
function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch (e) {
    ws.send(errorMsg('parse_error', '消息格式错误'));
    return;
  }

  const validation = validateMessage(msg);
  if (!validation.valid) {
    ws.send(errorMsg('validation_error', validation.reason));
    return;
  }

  const { type, data } = msg;

  try {
    switch (type) {
      case 'create_room': return handleCreateRoom(ws, data);
      case 'join_room': return handleJoinRoom(ws, data);
      case 'leave_room': return handleLeaveRoom(ws, data);
      case 'player_action': return handlePlayerAction(ws, data);
      case 'use_item': return handleUseItem(ws, data);
      case 'start_game': return handleStartGame(ws, data);
      case 'ready': return handleReady(ws, data);
      case 'kick_player': return handleKickPlayer(ws, data);
      case 'change_character': return handleChangeChar(ws, data);
      case 'add_bot': return handleAddBot(ws, data);
      case 'remove_bot': return handleRemoveBot(ws, data);
      case 'update_settings': return handleUpdateSettings(ws, data);
      case 'send_speech': return handleSendSpeech(ws, data);
      case 'ping': return handlePing(ws);
      default:
        ws.send(errorMsg('unknown_type', `未知消息类型: ${type}`));
    }
  } catch (err) {
    console.error(`[WS] Error handling ${type}:`, err);
    ws.send(errorMsg('server_error', '服务端内部错误'));
  }
}

/**
 * 处理断开连接
 */
function handleDisconnect(ws) {
  console.log(`[WS] Disconnect: ${ws.playerId}`);

  if (ws.roomCode) {
    const room = Room.getRoom(ws.roomCode);
    if (room) {
      const player = room.players.find(p => p.id === ws.playerId);
      if (player) {
        player.isConnected = false;
        player.ws = null;
        // 通知房间其他玩家
        Room._broadcast(room, 'player_disconnected', { playerId: ws.playerId });

        // 如果玩家正在游戏中，自动弃牌
        if (room.phase === 'playing' && room.hand) {
          const result = room.hand.processAction(ws.playerId, 'fold');
          if (result && result.error === 'not_your_turn') {
            // 不是该玩家的回合，忽略
          }
        }
      }
    }
  }
}

/**
 * 创建房间
 */
function handleCreateRoom(ws, data) {
  const { nickname, avatarId, settings } = data || {};
  if (!nickname || nickname.trim().length === 0) {
    ws.send(errorMsg('invalid_input', '请输入昵称'));
    return;
  }

  // 如果已在某个房间，先离开
  if (ws.roomCode) {
    Room.leaveRoom(ws.roomCode, ws.playerId);
  }

  const room = Room.createRoom(ws.playerId, nickname.trim(), avatarId || 0, settings);
  ws.roomCode = room.code;

  // 绑定 WebSocket
  const player = room.players.find(p => p.id === ws.playerId);
  if (player) player.ws = ws;

  console.log(`[Room] ${nickname} created room ${room.code}`);

  ws.send(JSON.stringify({
    type: 'room_joined',
    data: { ...Room.getRoomPublic(room), you: ws.playerId }
  }));
}

/**
 * 加入房间
 */
function handleJoinRoom(ws, data) {
  const { roomCode, nickname, avatarId } = data || {};
  if (!roomCode) { ws.send(errorMsg('invalid_input', '请输入房间码')); return; }
  if (!nickname || nickname.trim().length === 0) { ws.send(errorMsg('invalid_input', '请输入昵称')); return; }

  const result = Room.joinRoom(roomCode, ws.playerId, nickname.trim(), avatarId || 0);
  if (result.error) {
    ws.send(errorMsg(result.error, {
      room_not_found: '房间不存在',
      game_in_progress: '游戏已经开始',
      room_full: '房间已满',
      already_in_room: '已在该房间中'
    }[result.error] || result.error));
    return;
  }

  ws.roomCode = roomCode;
  result.player.ws = ws;

  console.log(`[Room] ${nickname} joined room ${roomCode}`);

  // 通知所有玩家
  Room._broadcast(result.room, 'room_update', Room.getRoomPublic(result.room));

  // 单独发送加入确认（含玩家身份信息）
  ws.send(JSON.stringify({
    type: 'room_joined',
    data: { ...Room.getRoomPublic(result.room), you: ws.playerId }
  }));
}

/**
 * 离开房间
 */
function handleLeaveRoom(ws, data) {
  if (!ws.roomCode) return;
  const code = ws.roomCode;
  const room = Room.leaveRoom(code, ws.playerId);
  ws.roomCode = null;

  if (!room) return;
    if (room.players.length > 0) {
    Room._broadcast(room, 'player_left', { playerId: ws.playerId });
    Room._broadcast(room, 'room_update', Room.getRoomPublic(room));
  }
}

/**
 * 玩家操作
 */
function handlePlayerAction(ws, data) {
  if (!ws.roomCode) { ws.send(errorMsg('not_in_room', '不在房间中')); return; }
  const room = Room.getRoom(ws.roomCode);
  if (!room) { ws.send(errorMsg('room_not_found', '房间不存在')); return; }
  if (!room.hand) { ws.send(errorMsg('no_hand', '没有进行中的牌局')); return; }

  const { action, amount } = data || {};
  if (!action) { ws.send(errorMsg('invalid_input', '缺少操作类型')); return; }

  const result = room.hand.processAction(ws.playerId, action, amount);
  if (result.error) {
    ws.send(errorMsg('action_error', {
      not_your_turn: '还没轮到你',
      already_folded: '已弃牌',
      already_allin: '已全下',
      hand_over: '牌局已结束',
      cannot_check_with_bet: '有下注，不能过牌',
      no_bet_to_call: '没有需要跟注的注额',
      invalid_action: '无效操作',
      player_not_found: '玩家不存在'
    }[result.error] || result.error));
  }
}

/**
 * 使用道具
 */
function handleUseItem(ws, data) {
  if (!ws.roomCode) { ws.send(errorMsg('not_in_room', '不在房间中')); return; }
  const room = Room.getRoom(ws.roomCode);
  if (!room) { ws.send(errorMsg('room_not_found', '房间不存在')); return; }

  const { itemType, targetPlayerId, count } = data || {};
  if (!itemType || !targetPlayerId) {
    ws.send(errorMsg('invalid_input', '缺少道具参数'));
    return;
  }

  // 验证道具类型
  if (!['egg', 'flower'].includes(itemType)) {
    ws.send(errorMsg('invalid_input', '未知道具类型'));
    return;
  }

  // 验证目标存在
  const target = room.players.find(p => p.id === targetPlayerId);
  if (!target) {
    ws.send(errorMsg('invalid_input', '目标玩家不存在'));
    return;
  }

  // 验证积分
  const cost = (count || 1);
  const player = room.players.find(p => p.id === ws.playerId);
  if (!player || player.score < cost) {
    ws.send(errorMsg('insufficient_score', '积分不足'));
    return;
  }

  // 扣分（服务端立即执行）
  player.score -= cost;

  // 广播道具动画
  Room._broadcast(room, 'item_anim', {
    fromPlayerId: ws.playerId,
    toPlayerId: targetPlayerId,
    itemType,
    count: cost,
    fromNickname: player.nickname,
    toNickname: target.nickname
  });

}

/**
 * 开始游戏
 */
function handleStartGame(ws, data) {
  if (!ws.roomCode) { ws.send(errorMsg('not_in_room', '不在房间中')); return; }
  const result = Room.startGame(ws.roomCode, ws.playerId);
  if (result && result.error) {
    ws.send(errorMsg(result.error, {
      not_host: '你不是房主',
      not_enough_players: '玩家人数不足',
      game_in_progress: '游戏已经开始'
    }[result.error] || result.error));
  }
}

/**
 * 准备/取消准备
 */
function handleReady(ws, data) {
  if (!ws.roomCode) { ws.send(errorMsg('not_in_room', '不在房间中')); return; }
  const ready = data && data.ready !== undefined ? data.ready : true;
  const result = Room.setReady(ws.roomCode, ws.playerId, ready);
  if (result && result.room) {
    Room._broadcast(result.room, 'room_update', Room.getRoomPublic(result.room));
  }
}

/**
 * 踢人
 */
function handleKickPlayer(ws, data) {
  if (!ws.roomCode) { ws.send(errorMsg('not_in_room', '不在房间中')); return; }
  const { targetPlayerId } = data || {};
  if (!targetPlayerId) { ws.send(errorMsg('invalid_input', '缺少目标玩家')); return; }

  const result = Room.kickPlayer(ws.roomCode, ws.playerId, targetPlayerId);
  if (result && result.error) {
    ws.send(errorMsg(result.error, {
      not_host: '你不是房主',
      cannot_kick_self: '不能踢自己'
    }[result.error] || result.error));
    return;
  }

  if (result && result.room) {
    Room._broadcast(result.room, 'player_left', { playerId: targetPlayerId });
    Room._broadcast(result.room, 'room_update', Room.getRoomPublic(result.room));
  }
}

/**
 * Ping/Pong 心跳
 */
function handleChangeChar(ws, data) {
  if (!ws.roomCode) return;
  var room = Room.getRoom(ws.roomCode);
  if (!room) return;
  var avatarId = data && data.avatarId;
  if (avatarId === undefined) return;
  var player = room.players.find(p => p.id === ws.playerId);
  if (player) { player.avatarId = avatarId; }
  Room._broadcast(room, "room_update", Room.getRoomPublic(room));
}


function handleSendSpeech(ws, data) {
  if (!ws.roomCode) return;
  var room = Room.getRoom(ws.roomCode);
  if (!room) return;
  var player = room.players.find(p => p.id === ws.playerId);
  if (!player) return;
  Room._broadcast(room, 'speech_received', {
    playerId: ws.playerId,
    playerName: player.nickname,
    message: (data && data.text) || '',
    soundName: (data && data.soundName) || ''
  });
}

function handlePing(ws) {
  ws.send(JSON.stringify({ type: "pong", data: { time: Date.now() } }));
}




function handleAddBot(ws, data) {
  if (!ws.roomCode) { ws.send(errorMsg('not_in_room', '不在房间中')); return; }
  const level = (data && data.level) || 0;
  const result = Room.addBot(ws.roomCode, ws.playerId, level);
  if (result && result.error) {
    ws.send(errorMsg(result.error, {
      room_not_found: '房间不存在', not_host: '你不是房主',
      game_in_progress: '游戏已经开始', room_full: '房间已满'
    }[result.error] || result.error));
    return;
  }
  if (result && result.room) {
    Room._broadcast(result.room, 'room_update', Room.getRoomPublic(result.room));
  }
}

function handleRemoveBot(ws, data) {
  if (!ws.roomCode) { ws.send(errorMsg('not_in_room', '不在房间中')); return; }
  const botId = data && data.botId;
  if (!botId) { ws.send(errorMsg('invalid_input', '缺少机器人ID')); return; }
  const result = Room.removeBot(ws.roomCode, ws.playerId, botId);
  if (result && result.error) {
    ws.send(errorMsg(result.error, {
      room_not_found: '房间不存在', not_host: '你不是房主', bot_not_found: '机器人不存在'
    }[result.error] || result.error));
    return;
  }
  if (result && result.room) {
    Room._broadcast(result.room, 'room_update', Room.getRoomPublic(result.room));
  }
}

function handleUpdateSettings(ws, data) {
  if (!ws.roomCode) { ws.send(errorMsg('not_in_room', '不在房间中')); return; }
  const result = Room.updateSettings(ws.roomCode, ws.playerId, data);
  if (result && result.error) {
    ws.send(errorMsg(result.error, {
      room_not_found: '房间不存在',
      not_host: '你不是房主',
      game_in_progress: '游戏已经开始'
    }[result.error] || result.error));
    return;
  }
  if (result && result.room) {
    Room._broadcast(result.room, 'settings_updated', Room.getRoomPublic(result.room));
  }
}

module.exports = { handleConnection };


