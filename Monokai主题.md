# Bangumi Monokai 主题笔记

## 已确认的页面结构

2026-07-28 使用已登录的 `https://bgm.tv/settings` 页面检查：

- 底部“个性化”入口为 `.toggle-customize`，图标节点为 `span.ico.ico-sq.ico_customize`。
- 通用设置面板为 `#general-tab`。
- “主题色”区域为 `#section-themeColor > .color-options`。
- 原生主题色使用 `.color-option-item`，内部结构为 `input[type="radio"] + label > .color-preview + .color-label`。
- 页面以 `html[data-theme]` 和 `html[data-theme-color]` 标记原生主题，并暴露 `--primary-color`、`--bgm-bg-content`、`--bgm-card-bg`、`--bgm-text-main`、`--bgm-text-sub`、`--bgm-border` 等颜色变量。

## 实现约定

- 脚本文件：`others/Monokai主题.js`。
- 设置仅保存在当前域名的 `localStorage`，键为 `bgm_monokai_theme_enabled`，默认关闭。
- Monokai 作为第七个同形选项插入主题色区域；选中任一 Bangumi 原生主题色会停用 Monokai。
- 不写入 Bangumi 的云设置，也不把未知值写进原生 `themeColor`，避免破坏站点主题配置。
- 主题使用经典 Monokai 色板：背景 `#272822`、前景 `#f8f8f2`、粉 `#f92672`、橙 `#fd971f`、黄 `#e6db74`、绿 `#a6e22e`、青 `#66d9ef`。

## 手动验证清单

- 在 `bgm.tv`、`bangumi.tv`、`chii.in` 分别确认设置独立保存。
- 在亮色和暗色原生主题下启用、停用 Monokai。
- 检查首页、条目页、讨论页、设置页的正文、卡片、链接、表单和弹层。
- 重复打开“个性化”面板，确认只出现一个 Monokai 选项。
- 窄屏下确认第七个颜色选项正常换行。
