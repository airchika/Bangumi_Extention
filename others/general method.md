# Bangumi 用户脚本开发技巧速查

这份文档只记录在 Bangumi 插件/用户脚本里容易现查的站点特有写法。普通 JavaScript 写法不放这里；新增条目时优先从已验证脚本中提炼。

## 设计汇总

按钮都使用打满的圆角矩形。

## 个性化设置与云设置

Bangumi 页面里可能存在 `chiiLib`、`chiiApp`，但它们不一定在用户脚本刚执行时就可用。注册设置项时要先探测，不存在就延迟重试；读取云设置失败时要有本地默认值。

### 通用选项

在“个性化 > 通用选项”中增加设置可以用 `window.chiiLib.ukagaka.addGeneralConfig(...)`：

```JavaScript
function registerBangumiSettings() {
    if (window.chiiLib && window.chiiLib.ukagaka) {
        window.chiiLib.ukagaka.addGeneralConfig({
            title: '视频播放器嵌入',
            name: 'bve_config',
            type: 'radio',
            defaultValue: 'false',
            getCurrentValue: function () {
                return isDefaultCollapse ? 'true' : 'false'
            },
            onChange: function (value) {
                isDefaultCollapse = value === 'true'
                if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
                    chiiApp.cloud_settings.update({ [CONFIG_KEY_DEFAULT_COLLAPSE]: value })
                    chiiApp.cloud_settings.save()
                }
            },
            options: [
                { value: 'false', label: '默认展开' },
                { value: 'true', label: '默认折叠' },
            ],
        })
    }
}
```

### 独立面板选项

如果要在个性化面板里开一个插件自己的页签，可以用 `chiiLib.ukagaka.addPanelTab({ tab, label, type: 'options', config })`。`config` 数组里的单个选项结构和 `addGeneralConfig` 类似。

```JavaScript
function has_bangumi_cloud_settings() {
    try {
        return typeof chiiApp !== 'undefined' && !!chiiApp?.cloud_settings
    } catch (error) {
        return false
    }
}

function register_plugin_settings() {
    let attempts = 0
    const try_register = () => {
        if (typeof chiiLib !== 'undefined' && chiiLib?.ukagaka?.addPanelTab) {
            chiiLib.ukagaka.addPanelTab({
                tab: 'shadow',
                label: 'Shadow',
                type: 'options',
                config: [{
                    title: '显示快捷入口',
                    name: 'shadow_show_post_shortcut',
                    type: 'radio',
                    defaultValue: 'on',
                    getCurrentValue: () => {
                        if (!has_bangumi_cloud_settings()) return 'on'
                        return chiiApp.cloud_settings.get('shadow_show_post_shortcut') !== 'off' ? 'on' : 'off'
                    },
                    onChange: value => {
                        if (has_bangumi_cloud_settings()) {
                            chiiApp.cloud_settings.update({ shadow_show_post_shortcut: value })
                            chiiApp.cloud_settings.save()
                        }
                        window.dispatchEvent(new CustomEvent('shadow-post-shortcut-setting-change', { detail: value }))
                    },
                    options: [{ value: 'on', label: '开启' }, { value: 'off', label: '关闭' }],
                }],
            })
        } else if (attempts < 10) {
            attempts++
            setTimeout(try_register, 500)
        }
    }
    try_register()
}
```

云设置只适合保存配置。油猴本地脚本或旧页面拿不到 `chiiApp.cloud_settings` 时，应回退到默认值或 `localStorage`，并把 UI 状态标成“本地”。

## 页面注入点与标签页

用户页/条目页等主内容导航通常用 `.navTabs`。新增插件页签时插入 `<li><a href="javascript:">标题</a></li>`，点击后移除已有 `.focus`，再给自己的 `<a>` 加 `.focus`。

```JavaScript
const navTabs = document.querySelector('.navTabs')
const btn = create_element('<li><a href="javascript:">Shadow</a></li>')

btn.addEventListener('click', () => {
    for (const focus of navTabs.querySelectorAll('.focus')) {
        focus.classList.remove('focus')
    }
    btn.querySelector('a').classList.add('focus')
    inject_analyze_page()
})

navTabs.append(btn)
```

首页动态页的标签栏是 `#timelineTabs`。可以优先插到可见“动态”右侧，找不到时插到第一个可见“更多”前面，再找不到就 append。

```JavaScript
const timelineLi = Array.from(tabs.children).find(child => {
    const anchor = child.querySelector(':scope > a')
    return anchor && anchor.textContent.trim() === '动态' && child.style.display !== 'none'
})

const moreLi = Array.from(tabs.children).find(child => {
    const top = child.querySelector(':scope > a.top')
    return top && child.style.display !== 'none'
})
```

讨论楼层可用下面的选择器兼容小组话题、条目讨论、章节/人物/角色/日志回复：

```JavaScript
const FLOOR_SELECTOR = 'div[id^="post_"], .postTopic, .sub_reply_bg'
const actions = floor.querySelector('.post_actions.re_info, .post_actions, .re_info')
```

从楼层取用户名时，优先读 `data-item-user`，再从头像或作者链接解析 `/user/{username}`。合法用户名可以按 `/^[A-Za-z0-9_]{1,32}$/` 验证。

条目页等普通页面不一定能直接读到 `CHOBITS_USERNAME`。需要当前登录用户时，优先读全局变量；失败后从顶部登录栏的 `/user/{username}` 链接解析，常见入口是 `#dock` 和 `#badgeUserPanel`。

```JavaScript
function get_current_username() {
    const is_valid_username = username => /^[A-Za-z0-9_]{1,32}$/.test(username)
    const from_href = href => {
        if (!href) return ''
        try {
            const match = new URL(href, location.origin).pathname.match(/^\/user\/([^/]+)\/?$/)
            const username = match ? decodeURIComponent(match[1]) : ''
            return is_valid_username(username) ? username : ''
        } catch (error) {
            return ''
        }
    }

    try {
        if (typeof window.CHOBITS_USERNAME === 'string' && is_valid_username(window.CHOBITS_USERNAME)) {
            return window.CHOBITS_USERNAME
        }
        if (typeof CHOBITS_USERNAME === 'string' && is_valid_username(CHOBITS_USERNAME)) {
            return CHOBITS_USERNAME
        }
    } catch (error) {
        // 旧页面或部分条目页可能没有注入 CHOBITS_USERNAME
    }

    for (const link of document.querySelectorAll('#dock a[href*="/user/"], #badgeUserPanel a[href*="/user/"]')) {
        const username = from_href(link.getAttribute('href'))
        if (username) return username
    }

    return ''
}
```

条目页兴趣面板标题可从 `#panelInterestWrapper h2` 注入小按钮，例如“标为重要”。按钮状态建议同步 `aria-pressed`，并在页面重绘后重新确认是否还存在。

## Bangumi 动态和页面片段抓取

首页动态支持带 `ajax=1` 的 HTML 片段请求：

```JavaScript
function buildTimelineUrl(type, page) {
    const url = new URL('/timeline', location.origin)
    url.searchParams.set('type', type) // say / blog / subject
    url.searchParams.set('page', String(page))
    url.searchParams.set('ajax', '1')
    return url.toString()
}

const response = await fetch(buildTimelineUrl('subject', 1), {
    credentials: 'same-origin',
})
```

解析片段时，用临时容器承载 HTML，优先取 `#timeline`，跳过 `#tmlPager`，再按 `H4 + UL > LI` 结构恢复日期分组。

```JavaScript
const temp = document.createElement('div')
temp.innerHTML = html

const timeline = temp.querySelector('#timeline') || temp
let currentHeader = ''

for (const child of Array.from(timeline.children)) {
    if (child.id === 'tmlPager') continue
    if (child.tagName === 'H4') {
        currentHeader = child.textContent.trim()
        continue
    }
    if (child.tagName !== 'UL') continue
    for (const li of Array.from(child.children)) {
        if (li.tagName !== 'LI') continue
        // 保存 li、currentHeader、type、page 等信息
    }
}
```

动态精确时间经常藏在 `.date` 内部的 `.titleTip[title]`、`[datetime]` 或 `[data-time]` 上，不能只读 `.date.textContent`，否则同一批动态可能只能按抓取顺序排序。

把抓来的动态节点插回 `#timeline` 后，调用一次 Bangumi 自带初始化，恢复站内动态相关行为：

```JavaScript
try {
    window.chiiLib?.tml?.prepareAjax?.()
} catch (error) {
    console.warn('[Plugin] prepareAjax failed:', error)
}
```

## 图片质量与抗锯齿排查

Bangumi 页面里的头像/角色图经常是 `background-image`，并且站内页面和公开 API 返回的图片 URL 可能不是同一档位。遇到插件里的图片比原页面模糊、锯齿或抗锯齿不一致时，先对比原页面元素和插件元素的 outerHTML，不要只看 CSS。

角色介绍栏常见角色图形如：

```html
<span class="avatarNeue avatarCoverPortrait avatarTop" style="background-image:url('https://lain.bgm.tv/pic/crt/m/bc/f5/184195_crt_w5sCv.jpg')"></span>
```

而 API 可能返回 resize 路径或大图路径，例如：

```text
https://lain.bgm.tv/r/400/pic/crt/l/bc/f5/184195_crt_w5sCv.jpg
```

如果想让自定义卡片尽量贴近原角色介绍栏，可以把角色图 URL 规范到页面原生的 medium 路径：

```JavaScript
function normalize_character_image_url(url) {
    return String(url || '')
        .replace(/\/r\/\d+\/pic\/crt\/[a-z]\//, '/pic/crt/m/')
        .replace(/\/pic\/crt\/[a-z]\//, '/pic/crt/m/')
}
```

同时检查插件样式里是否被站点或类名继承了 `image-rendering: pixelated`。如果需要恢复浏览器默认抗锯齿，可以在插件自己的头像选择器上显式覆盖：

```CSS
.plugin-avatar {
    image-rendering: auto !important;
}
```

## 公开 API 与缓存

常用公开 API：

```text
https://api.bgm.tv/v0/users/{username}
https://api.bgm.tv/v0/users/{username}/collections?subject_type={id}&limit=100&offset={offset}
```

收藏分页可以先请求 `offset=0`，读取返回里的 `total`，再按 `limit=100` 并发请求后续页。

```JavaScript
async function fetch_all_collections(username, subject_type) {
    const limit = 100
    const api = `https://api.bgm.tv/v0/users/${username}/collections?subject_type=${subject_type}&limit=${limit}&offset=`

    const first_response = await fetch(api + 0)
    if (!first_response.ok) throw new Error(`HTTP ${first_response.status}`)
    const first_page = await first_response.json()
    if (!Array.isArray(first_page.data)) throw new Error(first_page.description || first_page.message || '收藏数据格式无效')

    const tasks = []
    for (let offset = limit; offset < first_page.total; offset += limit) {
        tasks.push(fetch(api + offset).then(async response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const page = await response.json()
            if (!Array.isArray(page.data)) throw new Error(page.description || page.message || '收藏数据格式无效')
            return page.data
        }))
    }

    return first_page.data.concat(...await Promise.all(tasks))
}
```

大量 API 结果应放 IndexedDB，不要塞进 `localStorage`。缓存 key 可以直接使用 API URL，之后按用户或接口前缀清理会比较方便。

```JavaScript
const DB = 'bangumi_api_cache_plugin_v1'
const STORE = 'store'

function pr(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

async function open_db() {
    const req = indexedDB.open(DB)
    req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    return pr(req)
}
```

网络请求建议包一层超时，并验证 `response.ok` 和返回结构：

```JavaScript
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timer)
    }
}
```

## DOM 更新与重复初始化防护

Bangumi 页面和其它用户脚本都可能异步改写 DOM。注入后用 `MutationObserver` 监听，并用 `requestAnimationFrame` 合并重复触发。

```JavaScript
let scheduled = false
const observer = new MutationObserver(mutations => {
    if (!mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) return
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
        scheduled = false
        ensure_button()
    })
})
observer.observe(document.body, { childList: true, subtree: true })
```

脚本初始化要防重复。简单脚本可以用全局标记：

```JavaScript
if (window.__airTimelineSimpleComboInstalled) return
window.__airTimelineSimpleComboInstalled = true
```

如果同一个功能可能同时存在官方组件版和本地油猴版，用实例 ID 和 `data-*` 标注来源，避免互相覆盖。

```JavaScript
const INSTANCE_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
action.dataset.pluginOwner = INSTANCE_ID
action.dataset.pluginSource = is_component ? 'component' : 'local'
```

跨页面打开并自动进入插件页时，可以给目标 URL 加查询参数，目标页初始化后读取并点击自己的标签：

```JavaScript
const params = new URLSearchParams(window.location.search)
if (params.get('shadow') === '1') {
    button.click()
}
```

如果是从点击事件打开新标签，先 `window.open('about:blank', '_blank')` 再 `location.replace(target_href)`，可以减少弹窗拦截并给用户一个加载页；失败时要提示浏览器阻止了弹窗。

## 安全渲染与配置导入导出

任何来自页面、API、用户输入或配置文件的文本进入 `innerHTML` 前都要转义。

```JavaScript
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": ''',
    }[char]))
}
```

复杂 HTML 可以用 `create_element(html)` 创建，但模板里的变量仍然必须先 `escapeHtml`。

```JavaScript
function create_element(html) {
    const temp = document.createElement('temp')
    temp.innerHTML = html
    return temp.firstElementChild
}
```

JSON 配置导出可以用 `Blob`、`URL.createObjectURL` 和临时 `<a download>`：

```JavaScript
function download_config(document_value, filename) {
    const blob = new Blob([JSON.stringify(document_value, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}
```

JSON 导入用隐藏文件输入。读取后先 parse，再走严格校验函数，最后合并到当前配置；不要直接信任文件内容。

```JavaScript
function choose_config_file() {
    return new Promise(resolve => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json'
        input.addEventListener('change', async () => {
            const file = input.files?.[0]
            if (!file) return resolve(null)
            try {
                resolve(JSON.parse(await file.text()))
            } catch (error) {
                alert(`文件不是有效 JSON：${error.message || error}`)
                resolve(null)
            }
        })
        input.click()
    })
}
```
