# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

本仓库包含面向 [Bangumi (bgm.tv)](https://bgm.tv) 的 **Tampermonkey/Greasemonkey 用户脚本集合**。所有脚本均为纯 vanilla JavaScript（无构建工具、无依赖），以 IIFE 格式编写，通过 `// ==UserScript==` 头部注入到 Bangumi 站点页面中。

**运行方式**：将 `.js` 文件安装到 Tampermonkey 扩展后，在 `bgm.tv` / `bangumi.tv` / `chii.in` 域名下自动执行。无构建、测试或 lint 流程。

## 脚本架构

### emo.js — BMO 快速拼装面板

一个 Bmoji（Bangumi 自定义表情）合成器 UI 面板。核心结构：

- **状态管理**：`selectedItems`（已选部件对象）、`selectedElements`（DOM 引用缓存）、`lastSelectedItemKey`（当前调整目标）
- **资源加载**：通过 `loadAssets()` 从 `manifest.local.json` 加载部件清单，通过 `injectScript()` 动态加载 `/js/lib/bmo/bmo.js`
- **数据持久化**：收藏使用 `localStorage` + Bangumi 云同步（`chiiApp.cloud_settings`），历史使用云存储
- **DOM 缓存**：`dom` 对象在 `createAndCacheDom()` 中一次性缓存所有面板节点，避免重复查询
- **性能优化标记**：代码中 `[优化]` 注释标记了关键优化点（事件委托、DOM 缓存、内存缓存等）

### Your Angle.js — 用户相似度分析工具

在用户主页注入"Your Angle"标签页，比较两位用户的收藏/评分数据。核心模块：

- **`api_cache`**：IndexedDB 缓存层（数据库名 `bangumi_api_cache_5445_v1`），缓存用户信息和收藏列表
- **`load_manager_async`**：API 数据加载器，通过 `api.bgm.tv/v0/` REST API 分页获取收藏数据
- **`analyze`**：分析引擎，计算余弦相似度、欧几里得距离、标准化分数映射，输出 5×5 评分矩阵（好/中/差/空/无）
- **`emoManager`**：将数值指标映射为 17 级情感等级（freeze → gquuuuuux），通过加权求和得出综合等级
- **UI 组件**：`nav`（5×5 导航矩阵）、`article`（条目卡片+分布图）、双滑块阈值控制器

关键数据流：用户收藏 → 标准化分数（std_frac_map）→ 分类矩阵 → 排序渲染

### Your Angle Old.js

`Your Angle.js` 的旧版本，仅保留作参考。

## Bangumi 站点依赖

脚本依赖以下 Bangumi 站点内置 API/全局变量：

- `CHOBITS_USERNAME`：当前登录用户名
- `CHOBITS_VER`：站点版本号（用于缓存 bust）
- `chiiApp.cloud_settings`：云存储 API（`.get()` / `.update()` / `.save()`）
- `window.Bmoji` / `window.bmoji`：Bmoji 渲染引擎
- `/js/lib/bmo/bmo.js`：Bmoji 核心 JS
- `/js/lib/bmo/assets/manifest.local.json`：Bmoji 部件资源清单

## 代码风格

- 中文变量名和注释（如 `开发中`、`好友可选`、`同步率`）
- 模块模式：IIFE 内使用闭包模拟模块（`const module = (() => { ... return { ... } })()`）
- JSDoc 类型注解用于关键数据结构（`@typedef`、`@param`、`@returns`）
- CSS 直接内嵌为模板字符串，支持暗色主题（`html[data-theme=dark]`）
- 无打包/编译，直接编辑即部署
