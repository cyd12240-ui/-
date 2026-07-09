/**
 * room.js - 房间管理
 *
 * 管理房间生命周期：
 * - 创建房间（4 位数字码）
 * - 玩家加入 / 离开
 * - 房主转移
 * - 准备状态
 * - 房间清理（无人时自动销毁）
 */

const crypto = require('crypto');
const { HandState } = require('./game-state');

// 全局房间表
const rooms = new Map();

// 默认房间设置
const DEFAULT_SETTINGS = {
  initialScore: 2000,
  smallBlind: 10,
 bigBlind: 20,
 autoUpgradeBlinds: false,
 autoStartDelay: 3,
  maxPlayers: 6,
  minPlayers: 2
};

/**
 * 生成 4 位数字房间码（排除易混淆数字 0/O）
 */
function generateRoomCode() {
  const chars = '123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

/**
 * 创建房间
 */
function createRoom(hostId, nickname, avatarId, settings) {
  const code = generateRoomCode();
  const player = {
    id: hostId,
    nickname,
    avatarId: avatarId || 0,
    score: (settings && settings.initialScore) || DEFAULT_SETTINGS.initialScore,
    isHost: true,
    isReady: false,
    isConnected: true,
    ws: null
  };

  const room = {
    code,
    hostId,
    players: [player],
    settings: { ...DEFAULT_SETTINGS, ...settings },
    phase: 'waiting',  // waiting | playing | gameover
    hand: null,
    handCount: 0,
    createdAt: Date.now(),
    currentDealer: -1,
    _eventSubs: new Map()  // playerId -> callback
  };

  rooms.set(code, room);

  // 房间自动清理（30 分钟无活动）
  setTimeout(() => {
    const r = rooms.get(code);
    if (r && r.players.length === 0) {
      rooms.delete(code);
    }
  }, 30 * 60 * 1000);

  return room;
}

/**
 * 加入房间
 */
function joinRoom(code, playerId, nickname, avatarId) {
  const room = rooms.get(code);
  if (!room) return { error: 'room_not_found' };
  if (room.phase !== 'waiting') return { error: 'game_in_progress' };
  if (room.players.length >= room.settings.maxPlayers) return { error: 'room_full' };
  if (room.players.find(p => p.id === playerId)) return { error: 'already_in_room' };

  const player = {
    id: playerId,
    nickname,
    avatarId: avatarId || 0,
    score: room.settings.initialScore,
    isHost: false,
    isReady: false,
    isConnected: true,
    ws: null
  };

  room.players.push(player);
  return { room, player };
}

/**
 * 玩家离开房间
 */
function leaveRoom(code, playerId) {
  const room = rooms.get(code);
  if (!room) return;

  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx === -1) return;

  room.players.splice(idx, 1);

  // 转移房主
  if (playerId === room.hostId) { rooms.delete(code); return null; }

  // 房间无人则标记清理
  if (room.players.length === 0) {
    rooms.delete(code);
  }

  return room;
}

/**
 * 玩家准备/取消准备
 */
function setReady(code, playerId, ready) {
  const room = rooms.get(code);
  if (!room) return { error: 'room_not_found' };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'player_not_found' };

  player.isReady = ready;
  return { room };
}

/**
 * 踢出玩家（仅房主）
 */
function kickPlayer(code, hostId, targetId) {
  const room = rooms.get(code);
  if (!room) return { error: 'room_not_found' };
  if (room.hostId !== hostId) return { error: 'not_host' };
  if (targetId === hostId) return { error: 'cannot_kick_self' };

  const idx = room.players.findIndex(p => p.id === targetId);
  if (idx === -1) return { error: 'player_not_found' };

  room.players.splice(idx, 1);
  return { room };
}

/**
 * 开始游戏
 */
function startGame(code, hostId) {
  const room = rooms.get(code);
  if (!room) return { error: 'room_not_found' };
  if (room.hostId !== hostId) return { error: 'not_host' };
  if (room.phase !== 'waiting') return { error: 'game_in_progress' };
  if (room.players.length < room.settings.minPlayers) {
    return { error: 'not_enough_players' };
  }

  room.phase = 'playing';
  room.handCount = 0;
  room.currentDealer = -1;

  // 重置积分
  for (const p of room.players) {
    p.score = room.settings.initialScore;
  }

  startNextHand(room);
  // 通知所有玩家游戏已开始
  _broadcast(room, 'game_started', { players: room.players.map(p => ({ id: p.id, nickname: p.nickname, avatarId: p.avatarId, score: p.score })) });
  return { room };
}

/**
 * 开始下一局
 */
function startNextHand(room) {
  // 移除已淘汰玩家
  room.players = room.players.filter(p => p.score > 0);

  if (room.players.length <= 1) {
    room.phase = 'gameover';
    const winner = room.players[0];
    return;
  }

  room.handCount++;
  room.currentDealer = (room.currentDealer + 1) % room.players.length;

  // 创建牌局
  const hand = new HandState(room.players, room.currentDealer, {
    small: room.settings.smallBlind,
    big: room.settings.bigBlind
  });

  // 盲注升级
  if (room.settings.autoUpgradeBlinds) {
    const level = Math.floor(room.handCount / 10);
    if (level > 0) {
      hand.blinds.small = room.settings.smallBlind * (level + 1);
      hand.blinds.big = room.settings.bigBlind * (level + 1);
    }
  }

  hand.onEvent((event, data) => {
    if (event === 'handEnd' || event === 'playerTurn' || event === 'item_anim' || event === 'error') {
      // 这些事件不包含手牌信息，可直接广播
      _broadcast(room, event, data);

      if (event === 'handEnd') {
        // 同步积分到房间玩家
        if (data && data.scoreChanges) {
          for (const sc of data.scoreChanges) {
            const p = room.players.find(p => p.id === sc.playerId);
            if (p) {
              p.score = sc.newScore;
            }
          }
        }
        // 自动开始下一局
        room.hand = null;
        setTimeout(() => {
          if (room.phase === 'playing') {
            startNextHand(room);
          }
        }, 3000);
      }
    } else {
      // 包含手牌信息的事件 -> 逐个玩家发送（每人只看自己手牌）
      for (const p of room.players) {
        if (p.ws && p.ws.readyState === 1) {
          const playerState = hand._getPublicState(p.id);
          try { p.ws.send(JSON.stringify({ type: event, data: playerState })); } catch (e) {}
        }
      }
    }
  });

  room.hand = hand;
  hand.startHand();
}

/**
 * 广播消息给房间内所有玩家
 */
function _broadcast(room, type, data) {
  for (const player of room.players) {
    if (player.ws && player.ws.readyState === 1) { // WebSocket.OPEN
      try {
        player.ws.send(JSON.stringify({ type, data }));
      } catch (e) {
        // 忽略发送失败
      }
    }
    // 也通过事件订阅通知（用于服务端内部）
    const cb = room._eventSubs.get(player.id);
    if (cb) cb(type, data);
  }
}

/**
 * 发送消息给特定玩家
 */
function _sendTo(player, type, data) {
  if (player.ws && player.ws.readyState === 1) {
    try {
      player.ws.send(JSON.stringify({ type, data }));
    } catch (e) {
      // 忽略
    }
  }
  const cb = room._eventSubs.get(player.id);
  if (cb) cb(type, data);
}

/**
 * 获取房间
 */


/**
 * 添加机器人
 */
function addBot(code, hostId, botLevel) {
  const room = rooms.get(code);
  if (!room) return { error: 'room_not_found' };
  if (room.hostId !== hostId) return { error: 'not_host' };
  if (room.phase !== 'waiting') return { error: 'game_in_progress' };
  if (room.players.length >= room.settings.maxPlayers) return { error: 'room_full' };

  const botId = 'bot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const botNames = { 0: "Bot-简单", 1: "Bot-普通", 2: "Bot-困难" };
  const botName = botNames[botLevel] || "Bot";

  const bot = {
    id: botId,
    nickname: botName,
    avatarId: 0,
    score: room.settings.initialScore,
    isHost: false,
    isReady: true,
    isConnected: true,
    isBot: true,
    botLevel: botLevel || 0,
    ws: null
  };

  room.players.push(bot);
  return { room, botId };
}

/**
 * 移除机器人（仅房主）
 */
function removeBot(code, hostId, botId) {
  const room = rooms.get(code);
  if (!room) return { error: 'room_not_found' };
  if (room.hostId !== hostId) return { error: 'not_host' };

  const idx = room.players.findIndex(p => p.id === botId && p.isBot);
  if (idx === -1) return { error: 'bot_not_found' };
  room.players.splice(idx, 1);
  return { room };
}


function getRoom(code) {
  return rooms.get(code);
}

/**
 * 获取所有房间（调试用）
 */
function getAllRooms() {
  return Array.from(rooms.values());
}

/**
 * 获取可公开的房间信息
 */
function getRoomPublic(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      avatarId: p.avatarId,
      score: p.score,
      isHost: p.isHost,
      isReady: p.isReady,
      isConnected: p.isConnected
    })),
    settings: room.settings,
    handCount: room.handCount
  };
}


/**
 * 更新房间设置（仅房主）
 */
function updateSettings(code, hostId, newSettings) {
  const room = rooms.get(code);
  if (!room) return { error: 'room_not_found' };
  if (room.hostId !== hostId) return { error: 'not_host' };
  if (room.phase !== 'waiting') return { error: 'game_in_progress' };

  const allowed = ['smallBlind', 'bigBlind', 'initialScore', 'maxPlayers', 'minPlayers', 'autoStartDelay'];
  for (const key of allowed) {
    if (newSettings[key] !== undefined) {
      room.settings[key] = newSettings[key];
    }
  }

  return { room };
}

module.exports = {
  addBot,
  removeBot,
  createRoom,
  joinRoom,
  leaveRoom,
  setReady,
  kickPlayer,
  startGame,
    updateSettings,
  getRoom,
  getAllRooms,
  getRoomPublic,
  _broadcast,
  _sendTo
};






