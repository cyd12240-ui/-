/**
 * bot-ai.js - AI decision engine
 * Based on poker_engine/bot.py reference implementation
 */
const HandEvaluator = require("./hand-eval");

const BOT_LEVEL = { CHICKEN: 0, NORMAL: 1, MANIAC: 2 };
const BOT_NAMES = { 0: "Bot-简单", 1: "Bot-普通", 2: "Bot-困难" };

const RANK_STRENGTH = { 2:0.1,3:0.12,4:0.14,5:0.16,6:0.18,7:0.2,8:0.25,9:0.3,10:0.35,11:0.4,12:0.45,13:0.5,14:0.6 };

/**
 * Evaluate pre-flop hand strength (2 cards only)
 */
function preFlopStrength(holeCards) {
    if (!holeCards || holeCards.length < 2) return 0.1;
    const r1 = holeCards[0].rank, r2 = holeCards[1].rank;
    const s1 = holeCards[0].suit, s2 = holeCards[1].suit;
    const suited = s1 === s2 ? 0.08 : 0;
    const high = Math.max(RANK_STRENGTH[r1]||0.1, RANK_STRENGTH[r2]||0.1);
    const low = Math.min(RANK_STRENGTH[r1]||0.1, RANK_STRENGTH[r2]||0.1);
    const gap = Math.abs(r1 - r2);
    const pair = r1 === r2 ? high + 0.3 : 0;
    const connected = gap === 1 ? 0.05 : gap === 2 ? 0.02 : 0;
    return Math.min(1, Math.max(0.05, pair + high * 0.85 + suited + connected));
}

/**
 * Evaluate post-flop hand strength
 */
function postFlopStrength(holeCards, communityCards, evaluator) {
    const allCards = (holeCards || []).concat(communityCards || []);
    if (!allCards || allCards.length < 5) return preFlopStrength(holeCards);
    const result = evaluator.evaluateHand(allCards);
    if (!result) return 0.1;
    const rank = result.rank || 0;
    const mapping = { 0:0.1, 1:0.3, 2:0.45, 3:0.55, 4:0.65, 5:0.7, 6:0.75, 7:0.8, 8:0.9, 9:0.95, 10:1.0 };
    return Math.min(1, (mapping[rank] || 0.1) + (result.score % 100000) / 1000000 * 0.05);
}

/**
 * Decide bot action
 */
function decide(player, gameState, botLevel, handEvaluator) {
    const hasCommunity = gameState.communityCards && gameState.communityCards.length > 0;
    const handStrength = hasCommunity
        ? postFlopStrength(player.cards, gameState.communityCards, handEvaluator)
        : preFlopStrength(player.cards);

    const callAmount = gameState.callAmount || 0;
    const pot = gameState.pot || 0;
    const potOdds = callAmount > 0 && pot + callAmount > 0 
        ? callAmount / (pot + callAmount) : 0;
    const canCheck = gameState.canCheck || (!callAmount || callAmount === 0);
    const canRaise = gameState.canRaise !== undefined ? gameState.canRaise : (player.score > callAmount * 2);
    const minRaise = gameState.minRaise || callAmount * 2 || 20;

    var foldThresh, raiseThresh, raiseMult, randomFactor;
    switch (botLevel) {
        case BOT_LEVEL.CHICKEN:
            foldThresh = 0.4; raiseThresh = 0.7; raiseMult = 0.5; randomFactor = 0.05;
            break;
        case BOT_LEVEL.NORMAL:
            foldThresh = 0.28; raiseThresh = 0.55; raiseMult = 0.7; randomFactor = 0.1;
            break;
        case BOT_LEVEL.MANIAC:
            foldThresh = 0.15; raiseThresh = 0.35; raiseMult = 1.0; randomFactor = 0.15;
            break;
    }

    // Add randomness
    var strength = handStrength + (Math.random() - 0.5) * randomFactor;
    strength = Math.max(0, Math.min(1, strength));

    // Decision
    if (strength < foldThresh) {
        if (canCheck) return { action: "check" };
        return { action: "fold" };
    }

   if (strength < raiseThresh) {
       if (canCheck) return { action: "check" };
       if (callAmount > 0 && callAmount <= player.score) {
           if (strength > potOdds * 1.5 || potOdds < 0.2) {
               return { action: "call", amount: callAmount };
           }
           return { action: "fold" };
       }
        // 不能过牌又跟不起 → 弃牌
        return { action: "fold" };
   }

    // Strong hand
    if (canRaise && canCheck === false) {
        var raiseAmt = Math.floor(Math.max(minRaise, pot * raiseMult));
        raiseAmt = Math.min(raiseAmt, player.score);
        if (raiseAmt >= player.score) return { action: "allin" };
        return { action: "raise", amount: raiseAmt };
    }
    if (callAmount > 0) return { action: "call", amount: callAmount };
    return { action: "check" };
}

module.exports = { BOT_LEVEL, BOT_NAMES, decide };
