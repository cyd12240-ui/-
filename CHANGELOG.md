---

## V2.3 -> V2.4 - Bot stuck fix + Liquid Glass lobby + table bg image

### Bot system refactoring
- **Synchronous _processBotAction** - Removed setTimeout/setImmediate, eliminated 300ms race condition
- **Real-time game state** - callAmount/pot/minRaise/currentBet computed at decision time, no stale snapshots
- **Deadlock prevention** - Auto-advance when playersToAct is empty but bets unmatched
- **Skip folded/allIn bots** - Already-out players removed from queue and chain continues
- **Uncaught exception handler** - crash_logger.js prevents server crash on unhandled errors

### Homepage redesign (Liquid Glass)
- Glassmorphism card with backdrop-filter blur and ambient sweep animation
- Pointer-following specular highlight + ambient drift (touch compatible)
- Dark gradient overlay + optional background video (sgs.mp4)
- Entrance animations (card scale-in / element slide-in / divider fade-in)

### Table background
- Full-screen background image support (replace public/assets/sprites/table_bg.png)
- Canvas gradient fallback while image loads
- Kept border ink lines and corner decorations

### Card position adjustment
- Player hand vertical offset: 140px -> 100px from bottom (moved down 40px)

### Documentation
- Updated CHANGELOG.md
- Updated current-progress.md

### File changes
- **Modified**: server/game-engine/game-state.js / public/js/renderer/pixi-setup.js / public/js/renderer/table.js / public/js/game-client.js
- **Added**: server/crash_logger.js / public/assets/sprites/sgs.mp4
- **Rewritten**: public/index.html / public/css/style.css / public/js/main.js

Current version: V2.4  |  Server port: 3009 (default) / 3012 (alternate)
---
---

## V2.3 → V2.4 — 机器人卡死修复 + Liquid Glass 首页 + 牌局背景图

### 机器人系统重构
- **_processBotAction 完全同步化** — 移除 setTimeout/setImmediate，消除 300ms 窗??竞争条件
- **游戏状态实时计算** — callAmount/pot/minRaise/currentBet 在决策?实时计算，??再使用过期快照
- **防卡死兜底机制** — playersToAct 空队列下注不匹配?自?推进轮次(_autoAdvanceStuckRound)
- **折叠/全下跳过检查** — 已出局机器人自删除并触发下一个
- **链式调用永不断** — 机制人过牌/弃牌?同步触发下一个，保证?会跳过轮次
- **全局异常捕获** — process.on('uncaughtException') + crash_logger.js，异常不崩服

### 首页重设计 (Liquid Glass)
- 毛玻璃卡片效果 (backdrop-filter blur + ambient sweep animation)
- 指针跟随镜面高光 + ??环境光漂移（touch 兼容）
- 深色渐变背景 + ??背景视频（sgs.mp4）
- 交互动画（卡片入场缩放 / 元素滑入 / 分隔线淡入）

### 牌局背景图
- 支持全屏背景图替换（覆盖 public/assets/sprites/table_bg.png）
- 桌面从 Canvas 渐变绘制改为图片绘制，保留边框装饰
- 图片???完前回退到暖色渐变

### 卡片位置调整
- 玩家手牌垂直位置从底部偏移 140px → 100px，整?往下移

### 文档维护
- 更新 CHANGELOG.md
- 更新 current-progress.md（?加 V2.4 完成列?）

### 文件变化
- **修改**: server/game-engine/game-state.js / public/js/renderer/pixi-setup.js / public/js/renderer/table.js / public/js/game-client.js
- **新增**: server/crash_logger.js / public/assets/sprites/sgs.mp4
- **重写**: public/index.html / public/css/style.css / public/js/main.js

当前版本：V2.4  |  服务端端口：3009（默认） / 3012（??）
# 朋友局德州扑克 — 版本更新报告（V1 → V2.2）

---

## V2（初始版本）

### 核心功能
- **德州扑克规则引擎**：完整实现 Preflop → Flop → Turn → River → Showdown 流程
- **WebSocket 实时联机**：服务端权威状态管理，房间码 4 位数字
- **房间系统**：创建/加入/离开房间，房主转移，准备/开始
- **牌型判定**：10 级牌型完整比较（皇家同花顺 → 高牌）
- **边池计算**：pot.js 实现多玩家全下时的边池分配

### 技术基础
- Node.js + Express 静态服务 + ws WebSocket
- 客户端纯 Canvas 2D 渲染
- 纯内存无数据库

---

## V2 → V2.1 — 机器人系统 + 核心Bug修复

### Bug 修复
| Bug | 根因 | 修复 |
|-----|------|------|
| 全下后游戏卡死 | HandLastManStanding 只检查 !p.folded，allin≠弃牌 | 改为判断多人时走摊牌 |
| 机器人只会弃牌 | preFlopStrength 高牌权重*0.5 太保守 | 改为*0.85 |
| 机器人决策无效→卡死 | canCheck=false时返回check被拒绝 | 改为返回fold |
| 机器人从未行动 | HandState 漏拷 isBot/botLevel | 补上两个字段 |
| 蛋液黄圈不消失 | 自动清除定时器在旧playItemAnimation | handleItemAnim加4秒定时器 |
| 移除机器人不可见 | getRoomPublic 没传 isBot | 补上isBot |

### 新增功能
- **机器人 AI 系统**（bot-ai.js）：三档难度，pre-flop/post-flop 评估，底池赔率决策
- **房主管理机器人**：添加/移除机器人按钮

---

## V2.1 → V2.2 — 观战系统 + 结算画面 + UI 打磨

### Bug 修复
| Bug | 根因 | 修复 |
|-----|------|------|
| 淘汰玩家无限环绕牌桌 | players = data.players 引用数组，push 改原始数据 | 改为 .slice(0) 浅拷贝 |
| 对局数不显示 | else分支发送新对象，手数未传递 | else分支也写入 handCount |
| 加注上限仍是2000 | 用了 state.room 而非 state.game | 改为 state.game 实时积分 |
| RangeError evaluateHand | hand-eval.js 缺少 HandEvaluator 导出 | 添加 evaluateHand 方法 |

### 新增功能
1. **淘汰/观战系统** — 积分清零玩家保留在原座位灰色显示，可快捷发言，不可操作/道具
2. **结算画面** — 到达最大局数或只剩一人时弹出，排序显示，房主可重新开始
3. **最大对局数设置** — 房间设置新增，0=不限制
4. **对局数 UI 显示**
5. **操作文本浮动** — 每次操作在人物上方显示3秒
6. **加注上限动态绑定** — 滑块上限=玩家当前积分
7. **道具过滤** — 客户端+服务端双端检查淘汰目标

---
当前版本：V2.2  |  服务器端口：3009

---

## V2.2 → V2.3 — 前端模块化重构 + WS 消息队列

### 模块拆分
- game-client.js (38KB) → 5 个模块：screen.js / room-ui.js / game-ui.js / item-system.js + game-client.js (14KB 协调器)
- pixi-setup.js (22KB) → 6 个模块：table.js / cards.js / avatars.js / items.js / ui-overlay.js + pixi-setup.js (12KB 编排器)
- prop-throw.js → 合并到 renderer/items.js

### WS 修复
- 新增 sendQueue 排队机制：WS 未连接时消息自动排队，连接后自动发送
- 覆盖 CONNECTING / CLOSED / CLOSING 三种状态

### 文件变化
- 2 个文件 → 14 个文件（均遵循 DESIGN.md 规范结构）
- 所有模块通过 PK.* 命名空间挂载，共享状态通过 PK.GameClient.state/dom + PK.TableRenderer.__ 暴露

当前版本：V2.3  |  服务端端口：3009
