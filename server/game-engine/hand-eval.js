/**
 * hand-eval.js - 牌型判定和比较
 *
 * 牌型等级：
 *   9 - 皇家同花顺
 *   8 - 同花顺
 *   7 - 四条
 *   6 - 葫芦
 *   5 - 同花
 *   4 - 顺子
 *   3 - 三条
 *   2 - 两对
 *   1 - 一对
 *   0 - 高牌
 */

const HAND_NAMES = {
  9: '皇家同花顺',
  8: '同花顺',
  7: '四条',
  6: '葫芦',
  5: '同花',
  4: '顺子',
  3: '三条',
  2: '两对',
  1: '一对',
  0: '高牌'
};

/**
 * 评估 5 张牌，返回 { rank: number, score: number[], name: string }
 * score 数组用于逐级比较：第一项为牌型等级，后续为踢脚
 * @param {Array} cards - [{ suit, rank }]
 * @returns {{ rank: number, score: number[], name: string, cards: Array }}
 */
function evaluate5(cards) {
  if (cards.length !== 5) throw new Error('evaluate5 requires exactly 5 cards');

  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  // 检查顺子
  let isStraight = false;
  let straightHigh = 0;
  // 常规顺子
  if (ranks[0] - ranks[4] === 4 &&
      new Set(ranks).size === 5) {
    isStraight = true;
    straightHigh = ranks[0];
  }
  // 特殊：A-2-3-4-5（轮盘顺）
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 &&
      ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true;
    straightHigh = 5; // 轮盘顺的高牌是 5
  }

  // 皇家同花顺
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: 9, score: [9], name: HAND_NAMES[9], cards: sorted };
  }

  // 同花顺
  if (isFlush && isStraight) {
    return { rank: 8, score: [8, straightHigh], name: HAND_NAMES[8], cards: sorted };
  }

  // 统计各点数出现次数
  const freq = {};
  for (const r of ranks) {
    freq[r] = (freq[r] || 0) + 1;
  }
  const groups = Object.entries(freq)
    .map(([r, c]) => ({ rank: parseInt(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 四条
  if (groups[0].count === 4) {
    const quadRank = groups[0].rank;
    const kicker = groups[1].rank;
    return { rank: 7, score: [7, quadRank, kicker], name: HAND_NAMES[7], cards: sorted };
  }

  // 葫芦
  if (groups[0].count === 3 && groups[1].count === 2) {
    return { rank: 6, score: [6, groups[0].rank, groups[1].rank], name: HAND_NAMES[6], cards: sorted };
  }

  // 同花
  if (isFlush) {
    return { rank: 5, score: [5, ...ranks], name: HAND_NAMES[5], cards: sorted };
  }

  // 顺子
  if (isStraight) {
    return { rank: 4, score: [4, straightHigh], name: HAND_NAMES[4], cards: sorted };
  }

  // 三条
  if (groups[0].count === 3) {
    const tripRank = groups[0].rank;
    const kickers = groups.slice(1).map(g => g.rank);
    return { rank: 3, score: [3, tripRank, ...kickers], name: HAND_NAMES[3], cards: sorted };
  }

  // 两对
  if (groups[0].count === 2 && groups[1].count === 2) {
    const highPair = Math.max(groups[0].rank, groups[1].rank);
    const lowPair = Math.min(groups[0].rank, groups[1].rank);
    const kicker = groups[2].rank;
    return { rank: 2, score: [2, highPair, lowPair, kicker], name: HAND_NAMES[2], cards: sorted };
  }

  // 一对
  if (groups[0].count === 2) {
    const pairRank = groups[0].rank;
    const kickers = groups.slice(1).map(g => g.rank);
    return { rank: 1, score: [1, pairRank, ...kickers], name: HAND_NAMES[1], cards: sorted };
  }

  // 高牌
  return { rank: 0, score: [0, ...ranks], name: HAND_NAMES[0], cards: sorted };
}

/**
 * 从 7 张牌中选出最好的 5 张牌组合
 * @param {Array} cards - 7 张牌
 * @returns {{ rank, score, name, cards }}
 */
function best5(cards) {
  if (cards.length < 5) throw new Error('best5 requires at least 5 cards');
  if (cards.length === 5) return evaluate5(cards);

  // 生成所有 C(n,5) 组合
  const n = cards.length;
  let best = null;

  // 组合生成（位运算或递归）
  function combine(start, chosen) {
    if (chosen.length === 5) {
      const result = evaluate5(chosen);
      if (!best || compareHands(result, best) > 0) {
        best = result;
      }
      return;
    }
    for (let i = start; i < n; i++) {
      chosen.push(cards[i]);
      combine(i + 1, chosen);
      chosen.pop();
    }
  }
  combine(0, []);

  return best;
}

/**
 * 比较两手牌
 * @returns {number} 正数则 a 赢，负数则 b 赢，0 平局
 */
function compareHands(a, b) {
  for (let i = 0; i < Math.min(a.score.length, b.score.length); i++) {
    if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i];
  }
  return 0;
}

module.exports = { evaluate5, best5, compareHands, HAND_NAMES };
