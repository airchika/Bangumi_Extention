---
name: jianding-project
description: 鉴定.js 项目开发记录 — Bangumi 用户收藏对比分析脚本
metadata: 
  node_type: memory
  type: project
  originSessionId: 89768cc8-ac65-4d5f-bee1-19cd90b86af4
---
## 鉴定.js 项目概况

仿照 `Your Angle.js` 创建的精简版 Bangumi 用户收藏对比分析脚本。文件：`e:\Repoing\Bangumi_Extention\鉴定.js`

## 已实现功能

### 核心架构

- IIFE 格式，注入到 `/user/*` 页面的 `.navTabs` 标签页
- IndexedDB 缓存层（`bangumi_api_cache_5445_v1`），缓存用户信息和收藏数据
- 缓存过期机制：1 周 TTL，`set` 自动加 timestamp，`get` 检查过期
- 手动更新按钮：强制刷新两人数据，不论过期
- `localStorage` 存储 UI 设置（显示数量、吐槽开关）

### 排序算法（第一排 tab，粉色主题 #FE8A95）

1. **共同喜爱** — `max(我,对方)` 高优先 → `sum` 高 → `public_diff` 大
2. **共同厌恶** — `max(我,对方)` 低优先 → `sum` 低 → `public_diff` 大
3. **一致对外** — `public_diff / (user_diff + 0.01)` 大优先
4. **冷门共鸣** — `(我+对方) / log₂(收藏数+1)` 大优先
5. **争议最大** — `|我-对方|` 大优先
6. **共同在看** — 双方 type=3，含未评分，优先按更新时间

### 排序算法（第二排 tab，蓝色主题 #7EB8DA）

- 使用对方**全部收藏**（不限共同交集），`my_review: null`

1. **对方最爱** — 对方评分降序
2. **对方最厌恶** — 对方评分升序
3. **对方与大众差距** — `|对方-大众均分|` 降序
4. **对方冷门高分** — `对方评分 / log₂(收藏数+1)` 降序

### UI 特性

- 条目卡片复用 Your Angle 的 `_review` 格式（封面 + 分布图 + 排名条 + 评论）
- 分布图：10 条等宽 bar，`__v${rate}` CSS 类 + nth-last-child 高亮当前评分
- 分数条：三段式 flex 布局（左空白 + 标记点 + 右空白），颜色按 8-10 红/5-7 黄/1-4 蓝
- 排序 tab 互斥切换，选中 tab 时显示选项含义和计算公式
- 「吐槽」复选框：关闭时隐藏评论文本，保留头像和日期
- 两排 tab 一排两个 review 卡片（grid minmax(450px, 1fr)）
- 图表固定宽度 300px

### 不使用重映射分数

- 全部使用原始 1-10 分
- 大众评分直接用 `subject.score`

## 待做

- idea.md 中有 40+ 排序算法候选待选（共同满分、分歧反转、神作共鸣、对方独爱、我高他低 等）
- 用户从中选择后实现

## 关键设计决策

- 不使用 `subject.score` 做重映射，直接用原分
- 分布图不按统计次数分长度，全部均匀
- "看过"状态不显示标签，其他状态保留
- 对方维度使用全部收藏，不与自己取交集
