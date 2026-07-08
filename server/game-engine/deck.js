/**
 * deck.js - 牌组管理
 * 标准 52 张扑克牌，无大小王
 */

const SUITS = ['h', 'd', 'c', 's'];
const SUIT_NAMES = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };
const RANK_NAMES = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

/**
 * 创建一副新牌（按顺序）
 * @returns {Array} 52 张牌
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Fisher-Yates 洗牌
 * @param {Array} deck
 * @returns {Array} 洗好的牌组
 */
function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/**
 * 发牌：从牌组顶部取出 n 张
 * @param {Array} deck
 * @param {number} n
 * @returns {{ cards: Array, remaining: Array }}
 */
function deal(deck, n) {
  const cards = deck.slice(0, n);
  const remaining = deck.slice(n);
  return { cards, remaining };
}

/**
 * 创建并洗好一副新牌
 * @returns {Array}
 */
function freshDeck() {
  return shuffle(createDeck());
}

/**
 * 格式化单张牌为字符串（用于显示/日志）
 * @param {{ suit: string, rank: number }} card
 * @returns {string}
 */
function cardStr(card) {
  if (!card) return '??';
  return RANK_NAMES[card.rank] + SUIT_NAMES[card.suit][0].toUpperCase();
}

/**
 * 格式化一手牌
 * @param {Array} cards
 * @returns {string}
 */
function handStr(cards) {
  return cards.map(cardStr).join(' ');
}

module.exports = {
  createDeck,
  shuffle,
  deal,
  freshDeck,
  cardStr,
  handStr,
  SUITS,
  SUIT_NAMES,
  RANK_NAMES
};
