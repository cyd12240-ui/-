/**
 * game-state.js - 牌局状态机
 *
 * 管理单局德州扑克的完整生命周期：
 *   Preflop -> Flop -> Turn -> River -> Showdown
 *
 * 核心设计：
 * - 服务器权威：所有状态变更由此模块产生，通过事件向外通知
 * - 每局手牌创建一个 HandState 实例
 * - 外部通过 processAction() 传入玩家操作
 * - 外部通过 getState() 获取可广播的当前状态
 */

const { freshDeck, deal } = require('./deck');
const { best5, compareHands, HandEvaluator } = require('./hand-eval');
const { calculatePots, distributePots } = require('./pot');
const BotAI = require('./bot-ai');

class HandState {
  /**
   * @param {Array} playerStates - [{ id, nickname, avatarId, score }]
   * @param {number} dealerIndex - 庄家索引（在 playerStates 中）
   * @param {Object} blinds - { small: number, big: number }
   */
  constructor(playerStates, dealerIndex, blinds) {
    this.handId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.phase = 'preflop';

    // 深拷贝玩家状态，避免外部修改
    this.players = playerStates.map((p, i) => ({
      id: p.id,
      nickname: p.nickname,
      avatarId: p.avatarId,
      score: p.score,
      seatIndex: i,
      cards: [],
      currentBet: 0,
      totalBetThisHand: 0,
      folded: false,
      allIn: false,
     isDealer: i === dealerIndex,
     isSmallBlind: false,
      isBigBlind: false,
      isBot: !!p.isBot,
      botLevel: p.botLevel || 0
    }));

    this.dealerIndex = dealerIndex;
    this.blinds = blinds;
    this.communityCards = [];
    this.deck = null;
    this.pots = [];
    this.currentBet = 0;
    this.lastRaise = 0;
    this.minRaise = blinds.big;
    this.actions = [];
    this.handOver = false;
    this.result = null;
    this.timeoutId = null;

    // 下注轮次追踪
    this.playersToAct = [];
    this.lastAggressorIdx = -1;

    // 事件回调
    this._onEvent = null;
  }

  /**
   * 设置事件回调
   */
  onEvent(cb) {
    this._onEvent = cb;
  }

  /**
   * 触发事件
   */
  _emit(event, data) {
    if (this._onEvent) this._onEvent(event, data);
  }

  /**
   * 开始发牌
   */
  startHand() {
    this.deck = freshDeck();

    // 每人两张底牌
    for (const p of this.players) {
      const result = deal(this.deck, 2);
      p.cards = result.cards;
      this.deck = result.remaining;
    }

    this._postBlinds();
    this._emit('handDealt', this._getPublicState());
    this._startBettingRound();
  }

  /**
   * 发布盲注
   */
  _postBlinds() {
    const sbIdx = this._nextActivePlayer(this.dealerIndex);
    const bbIdx = this._nextActivePlayer(sbIdx);

    const sb = this.players[sbIdx];
    const bb = this.players[bbIdx];

    // 小盲
    const sbAmount = Math.min(this.blinds.small, sb.score);
    sb.score -= sbAmount;
    sb.currentBet = sbAmount;
    sb.totalBetThisHand = sbAmount;
    sb.isSmallBlind = true;

    // 大盲
    const bbAmount = Math.min(this.blinds.big, bb.score);
    bb.score -= bbAmount;
    bb.currentBet = bbAmount;
    bb.totalBetThisHand = bbAmount;
    bb.isBigBlind = true;

    this.currentBet = bb.currentBet;
    this.lastRaise = this.blinds.big;

    // 如果某个盲注玩家全下，记录
    if (sb.score === 0) sb.allIn = true;
    if (bb.score === 0) bb.allIn = true;

    this.actions.push(
      { playerId: sb.id, type: 'blind', amount: sbAmount, timestamp: Date.now() },
      { playerId: bb.id, type: 'blind', amount: bbAmount, timestamp: Date.now() }
    );
  }

  /**
   * 获取下一个未弃牌/未全下的玩家索引
   */
  _nextActivePlayer(fromIdx) {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (fromIdx + i) % n;
      const p = this.players[idx];
      if (!p.folded && !p.allIn) return idx;
    }
    return -1;
  }

  /**
   * 开始新的下注轮次
   */
  _startBettingRound() {
    this._botIterCount = 0;
    // 检查是否所有人都已全下或弃牌
    const active = this.players.filter(p => !p.folded && !p.allIn);
    // 所有人全下 → 直接发完所有公共牌
    if (active.length === 0) {
      this._dealRemainingCommunityCards();
      this._goToShowdown();
      return;
    }
    if (active.length <= 1) {
      const nonFolded = this.players.filter(function(p) { return !p.folded; });
      if (nonFolded.length <= 1) {
        this._handleLastManStanding();
      } else {
        this._dealRemainingCommunityCards();
        this._goToShowdown();
      }
      return;
    }

    // 确定从谁开始下注
    let startIdx;
    if (this.phase === 'preflop') {
      // Preflop: 大盲注的下家开始
      const bbIdx = this.players.findIndex(p => p.isBigBlind);
      startIdx = this._nextActivePlayer(bbIdx);
    } else {
      // Flop/Turn/River: 庄家左侧第一个活跃玩家
      startIdx = this._nextActivePlayer(this.dealerIndex);
    }

    // 构建行动顺序
    this.playersToAct = [];
    let idx = startIdx;
    while (this.playersToAct.length < active.length) {
      if (!this.players[idx].folded && !this.players[idx].allIn) {
        this.playersToAct.push(idx);
      }
      idx = (idx + 1) % this.players.length;
      if (idx === startIdx) break; // 安全退出
    }

   this.lastAggressorIdx = -1;
    var firstIdx = this.playersToAct.length > 0 ? this.playersToAct[0] : -1;
    if (firstIdx >= 0 && this.players[firstIdx].isBot && !this.handOver) {
      this._processBotAction(firstIdx);
      return;
    }
    this._emit('playerTurn', this._getTurnState());
  }

  /**
   * 处理玩家操作
   */
  processAction(playerId, action, amount) {
    if (this.handOver) return { error: 'hand_over' };

    const pIdx = this.players.findIndex(p => p.id === playerId);
    if (pIdx === -1) return { error: 'player_not_found' };

    const player = this.players[pIdx];
    if (player.folded) return { error: 'already_folded' };
    if (player.allIn) return { error: 'already_allin' };

    // 检查是否该玩家行动
    if (this.playersToAct.length === 0 || this.playersToAct[0] !== pIdx) {
      return { error: 'not_your_turn' };
    }

    // 检查操作合法性
    const validation = this._validateAction(pIdx, action, amount);
    if (!validation.valid) {
      return { error: validation.reason };
    }

    // 执行操作
    this._executeAction(pIdx, action, amount, validation);

    // 移除当前玩家
    this.playersToAct.shift();

    // 检查是否有人全下 → 即便还有人有行动需求，也要检查是否回合结束
    if (action === 'raise' || action === 'allin') {
      // 加注/全下后，所有未弃牌、未全下的玩家需重新行动
      this.lastAggressorIdx = pIdx;
      const remainingActive = this.players
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => !p.folded && !p.allIn && i !== pIdx)
        .map(({ i }) => i);
      this.playersToAct = remainingActive;
    }

    // 广播操作结果
    this._emit('actionResult', this._getPublicState());

    // 检查下注轮次是否结束
    if (this._isBettingRoundOver()) {
      this._advancePhase();
   } else {
      this._emit('playerTurn', this._getTurnState());
      // 如果下一个是机器人，自动触发（同步链式调用确保永不断）
      var nextIdx2 = this.playersToAct.length > 0 ? this.playersToAct[0] : -1;
      if (nextIdx2 >= 0 && this.players[nextIdx2].isBot && !this.handOver) {
        this._processBotAction(nextIdx2);
      }
      // 防卡死：如果 playersToAct 非空但没人触发（例如不是机器人），交给心跳
      if (!this.handOver && this.playersToAct.length > 0) {
        var checkIdx = this.playersToAct[0];
        if (checkIdx >= 0 && !this.players[checkIdx].isBot) {
          // 人类玩家 — 正常，等 WS 消息
        } else if (checkIdx >= 0 && this.players[checkIdx].isBot && this.players[checkIdx].folded) {
          // 机器人在队列里但已弃牌 → 清理并继续
          this.playersToAct.shift();
          this._emit('actionResult', this._getPublicState());
          if (!this._isBettingRoundOver()) this._advancePhase();
        }
      }
    }

    return { success: true };
  }

  /**
   * 验证操作
   */
  _validateAction(pIdx, action, amount) {
    const player = this.players[pIdx];
    const betDiff = this.currentBet - player.currentBet;

    switch (action) {
      case 'fold':
        return { valid: true };

      case 'check':
        if (betDiff > 0) {
          return { valid: false, reason: 'cannot_check_with_bet' };
        }
        return { valid: true };

      case 'call':
        if (betDiff === 0) {
          return { valid: false, reason: 'no_bet_to_call' };
        }
        if (betDiff >= player.score + player.currentBet) {
          // 不够跟注则自动全下
          return { valid: true, autoAllIn: true, callAmount: player.score };
        }
        return { valid: true, callAmount: betDiff };

      case 'raise':
        if (amount === undefined || amount < this.minRaise) {
          // 如果不够最小加注但可全下
          const totalBet = player.currentBet + amount;
          if (player.score + player.currentBet < this.currentBet) {
            // 算作 all-in 跟注
            return { valid: true, autoAllIn: true, callAmount: player.score };
          }
        }
        // 标准加注
        return { valid: true };

      case 'allin':
        return { valid: true };

      default:
        return { valid: false, reason: 'invalid_action' };
    }
  }

  /**
   * 执行操作（更新状态）
   */
  _executeAction(pIdx, action, amount, validation) {
    const player = this.players[pIdx];
    let paid = 0;

    switch (action) {
      case 'fold':
        player.folded = true;
        this.actions.push({ playerId: player.id, type: 'fold', amount: 0, timestamp: Date.now() });
        break;

      case 'check':
        this.actions.push({ playerId: player.id, type: 'check', amount: 0, timestamp: Date.now() });
        break;

      case 'call': {
        const callAmt = Math.min(validation.callAmount, player.score);
        player.score -= callAmt;
        player.currentBet += callAmt;
        player.totalBetThisHand += callAmt;
        if (player.score === 0) player.allIn = true;
        paid = callAmt;
        this.actions.push({ playerId: player.id, type: 'call', amount: callAmt, timestamp: Date.now() });
        break;
      }

      case 'raise': {
        // 使用客户端传入的 amount，否则使用默认最小加注
        const totalBet = amount ? player.currentBet + amount : this.currentBet + this.minRaise;
        const raiseAmt = Math.min(totalBet - player.currentBet, player.score);
        player.score -= raiseAmt;
        player.currentBet += raiseAmt;
        player.totalBetThisHand += raiseAmt;
        if (player.score === 0) player.allIn = true;
        if (!player.allIn) {
          this.currentBet = player.currentBet;
          this.minRaise = Math.max(this.minRaise, raiseAmt);
        }
        paid = raiseAmt;
        this.actions.push({ playerId: player.id, type: 'raise', amount: raiseAmt, timestamp: Date.now() });
        break;
      }

      case 'allin': {
        const allAmt = player.score;
        player.score = 0;
        player.currentBet += allAmt;
        player.totalBetThisHand += allAmt;
        player.allIn = true;
        if (player.currentBet > this.currentBet) {
          this.currentBet = player.currentBet;
        }
        paid = allAmt;
        this.actions.push({ playerId: player.id, type: 'allin', amount: allAmt, timestamp: Date.now() });
        break;
      }
    }

    // 如果玩家全下是因为无法全额跟注，他的下注额可能比 currentBet 少
    // 这会在 showdow 时触发边池计算
  }

  /**
   * 判断下注轮次是否结束
   */
 _isBettingRoundOver() {
    const active = this.players.filter(p => !p.folded && !p.allIn);

    if (active.length <= 1) return true;
    if (active.length === 0) return true;
    if (this.playersToAct.length > 0) return false;

    const allMatched = active.every(p => p.currentBet === this.currentBet);
    if (!allMatched) {
      // 防卡死：playersToAct 已空但下注不匹配 → 日志警告后强行结束
      console.warn('[Game] Round stuck: playersToAct empty but bets not matched. Forcing advance.');
      return true;
    }
    return allMatched;
  }

  /**
   * 只有一人存活时处理
   */
  _handleLastManStanding() {
    const remaining = this.players.filter(p => !p.folded);
    if (remaining.length === 1) {
      const winner = remaining[0];
      const totalPot = this.players.reduce((sum, p) => sum + p.totalBetThisHand, 0);
      winner.score += totalPot;
      this.handOver = true;
      this.result = {
        type: 'last_standing',
        winnerIds: [winner.id],
        potDistributions: [{ potId: 0, amount: totalPot, winnerIds: [winner.id], sharePerWinner: totalPot }],
        scoreChanges: this.players.map(p => ({
          playerId: p.id,
          scoreChange: p.id === winner.id ? totalPot : -p.totalBetThisHand,
          newScore: p.score
        }))
      };
      this._emit('handEnd', this.result);
    }
  }

  /**
   * 还未发出的公共牌全部发出
   */
  _dealRemainingCommunityCards() {
    const needed = 5 - this.communityCards.length;
    if (needed > 0) {
      // 弃一张
      this.deck = deal(this.deck, 1).remaining;
      const result = deal(this.deck, needed);
      this.communityCards.push(...result.cards);
      this.deck = result.remaining;
    }
  }

  /**
   * 推进到下一阶段
   */
  _advancePhase() {
    const active = this.players.filter(p => !p.folded);

    // 只剩一人
    if (active.length <= 1) {
      this._handleLastManStanding();
      return;
    }

    switch (this.phase) {
      case 'preflop': {
        // 发翻牌（3 张）
        this.deck = deal(this.deck, 1).remaining; // 弃一张
        const result = deal(this.deck, 3);
        this.communityCards.push(...result.cards);
        this.deck = result.remaining;
        this.phase = 'flop';
        this._resetBets();
        this._emit('roundAdvanced', this._getPublicState());
        this._startBettingRound();
        break;
      }
      case 'flop': {
        this.deck = deal(this.deck, 1).remaining;
        const result = deal(this.deck, 1);
        this.communityCards.push(...result.cards);
        this.deck = result.remaining;
        this.phase = 'turn';
        this._resetBets();
        this._emit('roundAdvanced', this._getPublicState());
        this._startBettingRound();
        break;
      }
      case 'turn': {
        this.deck = deal(this.deck, 1).remaining;
        const result = deal(this.deck, 1);
        this.communityCards.push(...result.cards);
        this.deck = result.remaining;
        this.phase = 'river';
        this._resetBets();
        this._emit('roundAdvanced', this._getPublicState());
        this._startBettingRound();
        break;
      }
      case 'river': {
        this._goToShowdown();
        break;
      }
    }
  }

  /**
   * 重置下注额（进入新的下注轮次）
   */
  _resetBets() {
    for (const p of this.players) {
      p.currentBet = 0;
    }
    this.currentBet = 0;
    this.lastRaise = 0;
    this.minRaise = this.blinds.big;
  }

  /**
   * 摊牌
   */
  _goToShowdown() {
    this.phase = 'showdown';

    // 计算所有玩家的牌力
    const playerHands = {};
    for (const p of this.players) {
      if (!p.folded && p.cards.length > 0) {
        const allCards = [...p.cards, ...this.communityCards];
        if (allCards.length >= 5) {
          playerHands[p.id] = best5(allCards);
        }
      }
    }

    // 计算底池
    this.pots = calculatePots(this.players.map(p => ({
      id: p.id,
      totalBetThisHand: p.totalBetThisHand,
      folded: p.folded,
      isAllIn: p.allIn
    })));

    // 分配底池
    const distributions = distributePots(this.pots, playerHands);

    // 更新积分
    const scoreChanges = this.players.map(p => ({
      playerId: p.id,
      scoreChange: -p.totalBetThisHand,
      newScore: p.score
    }));

    for (const dist of distributions) {
      const share = dist.sharePerWinner;
      for (const wid of dist.winnerIds) {
        const winner = this.players.find(p => p.id === wid);
        if (winner) {
          winner.score += share;
          const change = scoreChanges.find(sc => sc.playerId === wid);
          if (change) {
            change.scoreChange += share;
            change.newScore = winner.score;
          }
        }
      }
    }

    this.handOver = true;
    this.result = {
      type: 'showdown',
      hands: playerHands,
      potDistributions: distributions,
      scoreChanges,
      winnerIds: [...new Set(distributions.flatMap(d => d.winnerIds))]
    };

    this._emit('showdown', this._getPublicState());
    this._emit('handEnd', this.result);
  }

  /**
   * 获取公开状态（不含其他玩家手牌）
   */
  _getPublicState(forPlayerId) {
    return {
      handId: this.handId,
      phase: this.phase,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      pot: this.players.reduce((s, p) => s + p.totalBetThisHand, 0),
      players: this.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        avatarId: p.avatarId,
        score: p.score,
        currentBet: p.currentBet,
        totalBetThisHand: p.totalBetThisHand,
        folded: p.folded,
        allIn: p.allIn,
        isDealer: p.isDealer,
        isSmallBlind: p.isSmallBlind,
        isBigBlind: p.isBigBlind,
        cardCount: !forPlayerId || p.id === forPlayerId ? p.cards.length : p.cards.length,
        cards: !forPlayerId || p.id === forPlayerId ? p.cards : []
      })),
      actions: this.actions.slice(-20), // 最近 20 条
      handOver: this.handOver,
      result: this.result
    };
  }

  /**
   * 获取轮到谁的指示
   */
  _getTurnState() {
    const current = this.playersToAct.length > 0 ? this.playersToAct[0] : -1;
    const player = current >= 0 ? this.players[current] : null;
    return {
      currentPlayerId: player ? player.id : null,
      availableActions: player ? this._getAvailableActions(current) : [],
      playersToAct: this.playersToAct.map(i => this.players[i].id)
    };
  }

  /**
   * 获取玩家的可用操作
   */
  _getAvailableActions(pIdx) {
    const player = this.players[pIdx];
    const betDiff = this.currentBet - player.currentBet;
    const actions = [];

    if (betDiff === 0) {
      actions.push('check');
    }
    if (betDiff > 0) {
      actions.push('call');
    }
    actions.push('fold');
    if (player.score > 0) {
      actions.push('raise');
   actions.push('allin');
   }
   return actions;
 }

  /**
   * 自动处理机器人行动（AI 决策 + 执行）
   */
  _processBotAction(playerIdx) {
      if (this.handOver) return;
      if (this.playersToAct.length === 0 || this.playersToAct[0] !== playerIdx) return;
      const player = this.players[playerIdx];
      if (!player || !player.isBot) return;
      try {
        const callAmount = this.currentBet - player.currentBet;
        const gs = {
          callAmount: Math.max(0, callAmount),
          pot: this.players.reduce(function(s, p) { return s + p.totalBetThisHand; }, 0),
          communityCards: this.communityCards,
          minRaise: this.minRaise,
          canCheck: callAmount <= 0,
          canRaise: player.score > callAmount * 2 || player.score > this.minRaise
        };
        var d = BotAI.decide(player, gs, player.botLevel || 0, HandEvaluator);
        if (!d || !d.action) return;
        var r = this.processAction(player.id, d.action, d.amount || 0);
        if (r && r.error) {
          console.warn('[Bot] fallback fold for', player.id, ':', r.error);
          try { this.processAction(player.id, 'fold', 0); } catch(ef) {
            console.error('[Bot] fold fallback also failed:', ef);
            // 兜底：强行结束这一轮
            if (!this.handOver) {
              this._autoAdvanceStuckRound();
            }
          }
        }
      } catch(e) {
        console.error('[Bot] AI error:', e);
        try { this.processAction(player.id, 'fold', 0); } catch(ef) {
          if (!this.handOver) this._autoAdvanceStuckRound();
        }
      }
  }
  
  /** 防卡死：强行结束当前下注轮 */
  _autoAdvanceStuckRound() {
    console.warn('[Game] Auto-advancing stuck round');
    if (this.handOver) return;
    const active = this.players.filter(p => !p.folded && !p.allIn);
    if (active.length <= 1) {
      this._handleLastManStanding();
    } else {
      this._advancePhase();
    }
  }
}

module.exports = { HandState };
