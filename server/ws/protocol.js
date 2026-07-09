/**
 * protocol.js - WebSocket 消息协议定义
 *
 * 所有消息为 JSON 格式：
 *   客户端 -> 服务端: { type, data }
 *   服务端 -> 客户端: { type, data }
 */

// 客户端可发送的消息类型
const CLIENT_MESSAGES = [
  'create_room',
  'join_room',
  'leave_room',
  'player_action',
  'use_item',
  'start_game',
  'ready',
  'send_speech',
  'kick_player',
 'change_character',
  'add_bot',
  'remove_bot',
  'update_settings',
 'ping'
];

// 服务端可发送的消息类型
const SERVER_MESSAGES = [
  'room_joined',
  'player_joined',
  'player_left',
  'game_started',
  'handDealt',
  'playerTurn',
  'actionResult',
  'roundAdvanced',
  'showdown',
  'handEnd',
  'item_anim',
  'player_disconnected',
  'player_reconnect',
  'room_update',
  'speech_received',
  'error',
  'settings_updated',
 'pong'
];

/**
 * 验证客户端消息
 */
function validateMessage(msg) {
  if (!msg || typeof msg !== 'object') return { valid: false, reason: 'invalid_json' };
  if (!msg.type || typeof msg.type !== 'string') return { valid: false, reason: 'missing_type' };
  if (!CLIENT_MESSAGES.includes(msg.type)) return { valid: false, reason: `unknown_type: ${msg.type}` };
  return { valid: true };
}

/**
 * 生成错误消息
 */
function errorMsg(code, message) {
  return JSON.stringify({ type: 'error', data: { code, message } });
}

module.exports = {
  CLIENT_MESSAGES,
  SERVER_MESSAGES,
  validateMessage,
  errorMsg
};
