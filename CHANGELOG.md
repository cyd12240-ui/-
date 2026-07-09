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
