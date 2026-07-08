# 🃏 朋友局德州扑克 — V2

> 一款仅限熟人间内部娱乐的网页版德州扑克。支持标准德扑规则 + 搞怪社交道具系统（丢鸡蛋、送鲜花），纯 HTML5 多人在线实时对战。

---

## 功能特性

### 核心玩法
- 标准 52 张扑克牌，2~6 人同台
- 完整牌局流程：Preflop → Flop → Turn → River → Showdown
- 支持操作：弃牌 / 过牌 / 跟注 / 加注 / All-in
- 边池（Side Pot）自动计算
- 初始积分 2000，盲注 10/20
- 房主可在等待房间调整：小盲注 / 大盲注 / 初始积分 / 最大玩家数 / 自动开始延迟

### 社交道具系统
- **丢鸡蛋 🥚** — 抛物线飞出，砸中角色后蛋液糊脸，持续到本局结束。单发 -1分，十连 -10分
- **送鲜花 🌹** — 花瓣飘落，命中后角色头顶出现喝彩文字。单发 -1分，十连 -10分
- 道具飞行使用 DOM overlay + requestAnimationFrame 贝塞尔抛物线动画，支持十连发连续特效

### 快捷发言
- 游戏内左下角消息按钮，打开后显示道具 + 6 条快捷发言
- 男女角色配音自动切换（刘备 = 男声，小杀 = 女声）
- 发言内容以气泡形式出现在角色头顶，其他玩家同步可见

### 技术特色
- 纯前端 H5，适配手机竖屏（微信浏览器）
- PixiJS Canvas 渲染牌桌 + 角色形象
- WebSocket 实时通信，服务器权威状态
- 无数据库，全内存运行
- 无赌场视觉元素（积分 ≠ 筹码）

---

## 快速开始

### 环境要求
- Node.js >= 18

### 安装 & 启动

```bash
# 1. 安装依赖
cd 项目目录
npm install

# 2. 启动服务端
node server/index.js

# 3. 浏览器打开
#    http://localhost:3009
```

默认端口为 **3009**，可通过环境变量修改：
```bash
set PORT=3000 && node server/index.js
```

### 联机测试
1. 电脑上打开 http://localhost:3009
2. 输入昵称，创建房间（获得 4 位房间码）
3. 其他玩家用同一 WiFi 访问同一 IP:端口
4. 输入房间码加入

> 手机测试：手机连同一 WiFi → 浏览器打开 `http://你电脑的IP:3009`

---

## 游戏玩法

### 操作流程
1. **创建房间** — 房主设置游戏参数（可选）
2. **准备 / 开始** — 非房主点击准备，房主点击开始游戏
3. **牌局进行** — 轮到你时出现操作按钮
4. **摊牌比大小** — 最后一轮结束后自动比牌

### 牌型大小
| 牌型 | 说明 |
|------|------|
| 皇家同花顺 | A-K-Q-J-10 同花色 |
| 同花顺 | 5 张连续同花色 |
| 四条 | 4 张同点数 |
| 葫芦 | 3+2 |
| 同花 | 5 张同花色 |
| 顺子 | 5 张连续 |
| 三条 | 3 张同点数 |
| 两对 | 2+2 |
| 一对 | 2 张同点数 |
| 高牌 | 无组合 |

### 道具使用
点击左下角消息按钮 → 选择道具（🥚/🌹）→ 点击目标玩家角色 → 道具飞出

### 快捷发言
点击左下角消息按钮 → 滚动到发言列表 → 点击对应条目 → 角色头顶出现气泡

---

## 项目结构

```
├── server/                    # 服务端
│   ├── index.js               # 入口，Express + WebSocket
│   ├── ws/
│   │   ├── handler.js          # WebSocket 消息分发
│   │   └── protocol.js         # 消息类型定义
│   └── game-engine/            # 牌局逻辑
│       ├── room.js             # 房间管理
│       ├── game-state.js        # 牌局状态机
│       ├── hand-eval.js        # 牌型判定
│       ├── pot.js              # 边池计算
│       └── deck.js             # 发牌
├── public/                    # 前端（纯静态）
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── game-client.js       # 客户端游戏管理
│       ├── ws-client.js         # WebSocket 客户端
│       ├── sound.js             # 音效管理
│       ├── prop-throw.js        # 道具飞行动画
│       ├── main.js              # 入口
│       └── renderer/
│           ├── pixi-setup.js    # Canvas 2D 牌桌渲染
│           └── ui-overlay.js    # UI 覆盖层
├── package.json
└── README.md
```

---

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | 纯 HTML/CSS/JS + PixiJS (CDN) |
| 后端 | Node.js + Express + ws |
| 通信 | WebSocket（JSON 协议） |
| 数据库 | 无（全内存） |
| 构建 | 无（服务端 npm install，前端 CDN） |

---

## 部署

推荐配置：轻量云服务器（2核4G 3M 带宽）

```bash
# 安装 Node.js 后
npm install --production
PORT=3009 node server/index.js &
```

可使用 pm2 保持运行：
```bash
npm install -g pm2
pm2 start server/index.js --name poker
```

---

## 许可证

MIT License

---

*本项目为纯娱乐用途，不涉及任何真实货币交易。所有数值均为虚拟积分，不可变现。*
