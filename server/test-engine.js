/**
 * test-engine.js - 牌局引擎集成测试
 *
 * 模拟完整游戏流程，验证核心逻辑正确性
 * 运行：node server/test-engine.js
 */

const HandEval = require('./game-engine/hand-eval');
const Pot = require('./game-engine/pot');
const { HandState } = require('./game-engine/game-state');
const Room = require('./game-engine/room');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

console.log('\n=== 1. 牌型判定测试 ===\n');

// 高牌
const highCard = HandEval.evaluate5([
  {suit:'h',rank:2},{suit:'d',rank:7},{suit:'c',rank:9},{suit:'s',rank:11},{suit:'h',rank:13}
]);
assert(highCard.rank === 0, '高牌 rank=0');

// 一对
const pair = HandEval.evaluate5([
  {suit:'h',rank:14},{suit:'d',rank:14},{suit:'c',rank:9},{suit:'s',rank:11},{suit:'h',rank:5}
]);
assert(pair.rank === 1, '一对 rank=1');
assert(pair.score[1] === 14, '一对 score 含对子点数');

// 两对
const twoPair = HandEval.evaluate5([
  {suit:'h',rank:14},{suit:'d',rank:14},{suit:'c',rank:11},{suit:'s',rank:11},{suit:'h',rank:5}
]);
assert(twoPair.rank === 2, '两对 rank=2');

// 三条
const trips = HandEval.evaluate5([
  {suit:'h',rank:10},{suit:'d',rank:10},{suit:'c',rank:10},{suit:'s',rank:11},{suit:'h',rank:5}
]);
assert(trips.rank === 3, '三条 rank=3');

// 顺子
const straight = HandEval.evaluate5([
  {suit:'h',rank:9},{suit:'d',rank:10},{suit:'c',rank:11},{suit:'s',rank:12},{suit:'h',rank:13}
]);
assert(straight.rank === 4, '顺子 rank=4');

// 轮盘顺 A-2-3-4-5
const wheel = HandEval.evaluate5([
  {suit:'h',rank:14},{suit:'d',rank:2},{suit:'c',rank:3},{suit:'s',rank:4},{suit:'h',rank:5}
]);
assert(wheel.rank === 4, '轮盘顺 rank=4');
assert(wheel.score[1] === 5, '轮盘顺高牌=5');

// 同花
const flush = HandEval.evaluate5([
  {suit:'h',rank:2},{suit:'h',rank:7},{suit:'h',rank:9},{suit:'h',rank:11},{suit:'h',rank:13}
]);
assert(flush.rank === 5, '同花 rank=5');

// 葫芦
const fullHouse = HandEval.evaluate5([
  {suit:'h',rank:10},{suit:'d',rank:10},{suit:'c',rank:10},{suit:'s',rank:13},{suit:'h',rank:13}
]);
assert(fullHouse.rank === 6, '葫芦 rank=6');

// 四条
const quads = HandEval.evaluate5([
  {suit:'h',rank:10},{suit:'d',rank:10},{suit:'c',rank:10},{suit:'s',rank:10},{suit:'h',rank:13}
]);
assert(quads.rank === 7, '四条 rank=7');

// 同花顺
const straightFlush = HandEval.evaluate5([
  {suit:'h',rank:9},{suit:'h',rank:10},{suit:'h',rank:11},{suit:'h',rank:12},{suit:'h',rank:13}
]);
assert(straightFlush.rank === 8, '同花顺 rank=8');

// 皇家同花顺
const royalFlush = HandEval.evaluate5([
  {suit:'h',rank:10},{suit:'h',rank:11},{suit:'h',rank:12},{suit:'h',rank:13},{suit:'h',rank:14}
]);
assert(royalFlush.rank === 9, '皇家同花顺 rank=9');

// 牌型比较
assert(HandEval.compareHands(royalFlush, highCard) > 0, '皇家同花顺 > 高牌');
assert(HandEval.compareHands(straightFlush, flush) > 0, '同花顺 > 同花');
assert(HandEval.compareHands(fullHouse, trips) > 0, '葫芦 > 三条');

// 同牌型比较踢脚
const pairA = HandEval.evaluate5([
  {suit:'h',rank:14},{suit:'d',rank:14},{suit:'c',rank:9},{suit:'s',rank:11},{suit:'h',rank:5}
]);
const pairK = HandEval.evaluate5([
  {suit:'h',rank:13},{suit:'d',rank:13},{suit:'c',rank:9},{suit:'s',rank:11},{suit:'h',rank:5}
]);
assert(HandEval.compareHands(pairA, pairK) > 0, 'AA > KK');

console.log('\n=== 2. 底池计算测试 ===\n');

// 无全下的简单底池
const simplePot = Pot.calculatePots([
  { id: 'a', totalBetThisHand: 20, folded: false, isAllIn: false },
  { id: 'b', totalBetThisHand: 20, folded: false, isAllIn: false },
  { id: 'c', totalBetThisHand: 20, folded: true, isAllIn: false }
]);
assert(simplePot.length === 1, '简单底池：1个池');
assert(simplePot[0].amount === 60, '简单底池：金额=60');
assert(simplePot[0].eligiblePlayerIds.length === 2, '简单底池：2人可赢');

// 边池场景：a全下20，b跟注50，c加注到100
const sidePot = Pot.calculatePots([
  { id: 'a', totalBetThisHand: 20, folded: false, isAllIn: true },
  { id: 'b', totalBetThisHand: 50, folded: false, isAllIn: false },
  { id: 'c', totalBetThisHand: 100, folded: false, isAllIn: false }
]);
assert(sidePot.length >= 2, '边池：至少2个池');
const totalPot = sidePot.reduce((s, p) => s + p.amount, 0);
assert(totalPot === 170, `边池：总金额=170 (实际=${totalPot})`);

console.log('\n=== 3. 牌局状态机测试 ===\n');

// 模拟一局完整游戏
const players = [
  { id: 'p1', nickname: '张三', avatarId: 0, score: 2000 },
  { id: 'p2', nickname: '李四', avatarId: 1, score: 2000 },
  { id: 'p3', nickname: '王五', avatarId: 2, score: 2000 }
];

const hand = new HandState(players, 0, { small: 10, big: 20 });
const events = [];
hand.onEvent((event, data) => events.push({ event, data }));

hand.startHand();

assert(hand.players.length === 3, '牌局：3名玩家');
assert(hand.phase === 'preflop', '牌局：preflop阶段');

// 验证盲注
const sbPlayer = hand.players.find(p => p.isSmallBlind);
const bbPlayer = hand.players.find(p => p.isBigBlind);
assert(sbPlayer !== undefined, '有庄家');
assert(sbPlayer.score < 2000, '小盲扣分了');
assert(bbPlayer.score < 2000, '大盲扣分了');

// 模拟完整下注流程
// 3人局 dealer=0：盲注顺序 p2(SB) p3(BB)，行动顺序 p1(dealer)->p2(SB)->p3(BB)
let r;
r = hand.processAction(players[0].id, 'call');
assert(r.success, 'p1(dealer) 跟注');

r = hand.processAction(players[1].id, 'call');
assert(r.success, 'p2(SB) 跟注');

r = hand.processAction(players[2].id, 'check');
assert(r.success, 'p3(BB) 过牌');

assert(hand.phase === 'flop', '翻牌阶段');
assert(hand.communityCards.length === 3, '翻牌3张公牌');

// Flop 行动顺序：p2(SB) -> p3 -> p1(dealer)
r = hand.processAction(players[1].id, 'check');
assert(r.success, 'p2 flop过牌');

r = hand.processAction(players[2].id, 'check');
assert(r.success, 'p3 flop过牌');

r = hand.processAction(players[0].id, 'check');
assert(r.success, 'p1 flop过牌');

assert(hand.phase === 'turn', '转牌阶段');
assert(hand.communityCards.length === 4, '转牌4张公牌');

// Turn 行动顺序：p2 -> p3 -> p1
r = hand.processAction(players[1].id, 'check');
r = hand.processAction(players[2].id, 'check');
r = hand.processAction(players[0].id, 'check');

assert(hand.phase === 'river', '河牌阶段');
assert(hand.communityCards.length === 5, '河牌5张公牌');

// River 行动顺序：p2 -> p3 -> p1
r = hand.processAction(players[1].id, 'check');
r = hand.processAction(players[2].id, 'check');
r = hand.processAction(players[0].id, 'check');

assert(hand.phase === 'showdown' || hand.handOver, '摊牌或结束');
assert(hand.handOver, '牌局结束');
assert(hand.result && hand.result.winnerIds.length > 0, '有赢家');

console.log('\n=== 4. 房间管理测试 ===\n');

const room = Room.createRoom('p1', '张三', 0, { minPlayers: 2 });
assert(room.code.length === 4, '4位房间码');
assert(room.players.length === 1, '1人在房间');

const joinResult = Room.joinRoom(room.code, 'p2', '李四', 1);
assert(!joinResult.error, 'p2 加入成功');
assert(joinResult.room.players.length === 2, '2人在房间');

const joinResult2 = Room.joinRoom(room.code, 'p3', '王五', 2);
assert(!joinResult2.error, 'p3 加入成功');

// 设置准备
Room.setReady(room.code, 'p1', true);
Room.setReady(room.code, 'p2', true);
Room.setReady(room.code, 'p3', true);

assert(room.players.every(p => p.isReady), '全部已准备');

// 开始游戏
const startResult = Room.startGame(room.code, 'p1');
assert(!startResult.error, '游戏开始成功');
assert(room.phase === 'playing', '进行中');
assert(room.hand !== null, '有牌局');

console.log(`\n========================`);
console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
console.log(`========================\n`);

process.exit(failed > 0 ? 1 : 0);

