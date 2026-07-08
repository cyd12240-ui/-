/**
 * pot.js - 底池和边池计算
 *
 * 德州扑克边池规则：
 * - 当有玩家全下时，超出其下注额的部分形成边池
 * - 每个边池只对下注达到该额度的玩家开放
 * - 已弃牌的玩家不能赢得任何底池
 */

/**
 * 计算所有底池
 *
 * @param {Array} players - [{ id, totalBetThisHand, folded, isAllIn }]
 * @returns {Array} - [{ id, amount, eligiblePlayerIds }]
 */
function calculatePots(players) {
  // 按总下注额升序排列
  const sorted = [...players].sort((a, b) => a.totalBetThisHand - b.totalBetThisHand);

  const pots = [];
  let prevLevel = 0;
  let potId = 0;

  for (let i = 0; i < sorted.length; i++) {
    const level = sorted[i].totalBetThisHand;
    if (level === prevLevel) continue;

    const diff = level - prevLevel;
    if (diff === 0) continue;

    // 下注达到 level 的玩家数量（含已弃牌的，因为他们的下注也在池子里）
    const contributorCount = players.filter(p => p.totalBetThisHand >= level).length;

    // 可赢取此池的玩家：未弃牌且下注 >= level
    const eligible = players
      .filter(p => !p.folded && p.totalBetThisHand >= level)
      .map(p => p.id);

    if (eligible.length > 0) {
      pots.push({
        id: potId++,
        amount: diff * contributorCount,
        eligiblePlayerIds: eligible,
        winnerId: null
      });
    }

    prevLevel = level;
  }

  return pots;
}

/**
 * 分配底池给获胜者
 *
 * @param {Array} pots - calculatePots 的结果
 * @param {Object} playerHands - { playerId: { rank, score, name, cards } }
 * @returns {Array} - [{ potId, amount, winnerIds, sharePerWinner }]
 */
function distributePots(pots, playerHands) {
  const { compareHands } = require('./hand-eval');

  return pots.map(pot => {
    if (pot.eligiblePlayerIds.length === 0) {
      return { potId: pot.id, amount: pot.amount, winnerIds: [], sharePerWinner: 0 };
    }

    // 找出此池中牌最强的玩家
    const eligible = pot.eligiblePlayerIds.filter(pid => playerHands[pid]);
    if (eligible.length === 0) {
      // 所有可赢取此池的玩家都无手牌（理论上不应发生）
      return { potId: pot.id, amount: pot.amount, winnerIds: [], sharePerWinner: 0 };
    }

    let bestPid = eligible[0];
    let bestHand = playerHands[bestPid];

    for (let i = 1; i < eligible.length; i++) {
      const pid = eligible[i];
      const hand = playerHands[pid];
      if (compareHands(hand, bestHand) > 0) {
        bestPid = pid;
        bestHand = hand;
      }
    }

    // 检查是否有平局
    const winners = eligible.filter(pid => compareHands(playerHands[pid], bestHand) === 0);

    return {
      potId: pot.id,
      amount: pot.amount,
      winnerIds: winners,
      sharePerWinner: Math.floor(pot.amount / winners.length)
    };
  });
}

module.exports = { calculatePots, distributePots };
