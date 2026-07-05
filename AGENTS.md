# Repository Guidelines

## 项目结构与模块组织

本仓库收录面向 Bangumi 的 Tampermonkey/Greasemonkey 用户脚本。根目录的 `Shadow.js` 是当前主要脚本；`others/` 保存相似度分析、历史头像、曾用名和 BMO 面板等独立脚本。`idea.md` 与 `idea angle.md` 用于记录构想。每个 `.js` 文件应保持独立，包含完整的 `// ==UserScript==` 元数据头，并使用 IIFE 隔离作用域。不要提交生成产物或第三方依赖。

## 开发、检查与本地运行

项目没有构建步骤或包管理器。常用检查命令如下：

```powershell
node --check "鉴定.js"          # 检查 JavaScript 语法
node --check "others/emo.js"   # 检查指定脚本
git diff --check               # 查找空白字符错误
rg "@match|@include" -g "*.js" # 核对脚本生效域名
```

本地验证时，将目标脚本导入 Tampermonkey，访问 `bgm.tv`、`bangumi.tv` 或 `chii.in` 的匹配页面。修改后刷新页面，并查看浏览器控制台、网络请求和 IndexedDB/localStorage 状态。

## 编码风格与命名

沿用现有文件的风格：4 空格缩进、原生 JavaScript、`const`/`let`、无分号风格优先。函数和变量通常使用 `snake_case`，常量使用 `UPPER_SNAKE_CASE`；允许保留已有中文标识符。复杂数据结构使用 JSDoc 注释。CSS 可内嵌为模板字符串，但选择器应带脚本专属前缀，避免污染 Bangumi 页面。新增网络请求时应处理超时、非成功响应和异常；渲染外部文本前必须转义。

## 测试要求

仓库暂无自动化测试或覆盖率门槛。每次修改至少执行语法检查，并在脚本声明支持的三个域名之一进行手动验证。涉及 UI 时检查亮色/暗色主题、窄屏布局和重复初始化；涉及 API 或缓存时检查失败路径、空数据、分页及缓存失效。修复缺陷时，在 PR 中写明复现步骤和验证结果。

## 提交与 Pull Request

近期提交使用简短中文主题，例如“好友评级”“优化评分阈值过滤逻辑”。提交信息应使用祈使式、聚焦单一改动，避免将无关脚本混入同一提交。PR 需说明变更目的、影响的脚本与页面、手动测试步骤；关联相关 issue 或 Bangumi 讨论帖。可见 UI 改动应附亮色和暗色截图，元数据权限或匹配域名变化需单独标注。

## 安全与配置

不要提交访问令牌、Cookie、个人缓存或真实用户数据。尽量使用最小化的 `@match`、`@include` 和 `@grant` 权限；新增外部 API 时记录用途，并避免把敏感响应写入日志。
