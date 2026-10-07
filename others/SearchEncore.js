// ==UserScript==
// @name         SearchEncore!! 搜索增强
// @version      1.1.1
// @match        https://bgm.tv/*
// @match        https://bangumi.tv/*
// @match        https://chii.in/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const API_BASE = 'https://bgmdb.ry.mk/v1/search';
    const PAGE_SIZE = 20;
    const OVERVIEW_SIZE = 4;  // 概览模式下每类预览几条
    const MAX_OFFSET = 5000;  // 服务端 offset 上限，超过会被截断
    const DEFAULT_GROUP_ICON = '//lain.bgm.tv/pic/icon/m/000/00/00/0.jpg';
    const DEFAULT_USER_AVATAR = '//lain.bgm.tv/pic/user/m/icon.jpg';
    const LS_SORT = 'se:sort';
    const LS_EXACT = 'se:exact';
    const LS_NSFW = 'se:nsfw';
    const LS_REPLY_SOURCE = 'se:replySource';

    const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl';
    // 触屏上 input.focus() 会弹起虚拟键盘，挡掉半屏结果；键盘导航在触屏也用不上
    const IS_TOUCH = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const PANEL_MS = 340;   // 整个面板共用一条可反向播放的开合动画

    // === 工具函数 ===
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function fmtDate(ts) {
        if (!ts) return '';
        const date = new Date(ts * 1000);
        return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
            .map(n => String(n).padStart(2, '0')).join('-');
    }

    // 估算总数来自查询计划，可能偏差几个数量级，只当量级用
    function fmtCount(total, isEstimate) {
        if (!total) return '0';
        if (!isEstimate) return String(total);
        if (total < 100) return `~${total}`;   // 计划成本超阈值时也会回估算，这时总数可能很小
        const mag = Math.pow(10, Math.floor(Math.log10(total)));
        return `${Math.floor(total / mag) * mag}+`;
    }

    function avatarHtml(url, fallback) {
        // 用 CSS 字符串转义放进 url("...")，避免图片地址里的引号破坏样式
        const safe = (url || fallback).replace(/["\\\n]/g, c => '\\' + c.charCodeAt(0).toString(16) + ' ');
        return `<span class="avatarNeue avatarReSize32 se-avatar" style="background-image:url(&quot;${esc(safe)}&quot;)"></span>`;
    }

    function debounce(fn, ms) {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    // 站点在隐私模式 / 禁用三方存储时会让 localStorage 直接抛，读写都得兜住
    function lsGet(key) {
        try { return localStorage.getItem(key); } catch (_) { return null; }
    }

    function lsSet(key, val) {
        try { localStorage.setItem(key, val); } catch (_) { /* 存不下就只在这一次会话里生效 */ }
    }

    // 每条结果行 = 可选头像 + 标题 + 元信息（徽标排在最前）+ 可选摘要
    function row(title, parts, { avatar = '', badges = [], excerpt = '' } = {}) {
        return {
            html: `${avatar}<div class="se-content">
                    <span class="se-title">${esc(title)}</span>
                    <span class="se-meta">${badges.filter(Boolean).map(b => `<span class="se-badge">${esc(b)}</span>`).join('')}${parts.map(esc).filter(Boolean).join(' · ')}</span>
                    ${excerpt ? `<span class="se-excerpt">${excerpt}</span>` : ''}
                </div>`,
        };
    }

    // 服务端用 U+E000 … U+E001 包住命中词；先转义再换成高亮标签
    function highlight(text) {
        return esc(text).replace(/\uE000/g, '<b class="se-hl">').replace(/\uE001/g, '</b>');
    }

    // === 搜索类型：一个类型 = 一个 v1 端点 + 一个结果渲染函数 ===
    const TYPES = [
        {
            key: 'custom_topic', label: '话题', endpoint: 'group-topics',
            // 服务端只在这两类话题上实现了 user:，group: 更只有小组话题认
            dirs: ['user', 'group'],
            render: t => ({
                href: `/group/topic/${t.id}`,
                ...row(t.title, [t.creatorName, fmtDate(t.createdAt), `回复 ${t.replyCount}`],
                    { badges: [t.parentName || '未知小组'] }),
            }),
        },
        {
            key: 'custom_user', label: '用户', endpoint: 'users',
            render: u => ({
                href: `/user/${encodeURIComponent(u.username)}`,
                ...row(u.nickname || u.username, [`@${u.username}`, `UID ${u.id}`, u.sign],
                    { avatar: avatarHtml(u.avatar && u.avatar.small, DEFAULT_USER_AVATAR) }),
            }),
        },
        {
            key: 'custom_group', label: '小组', endpoint: 'groups',
            render: g => ({
                href: `/group/${encodeURIComponent(g.name)}`,
                ...row(g.title, [g.name, `成员 ${g.members ?? 0}`],
                    { avatar: avatarHtml(g.icon && g.icon.small, DEFAULT_GROUP_ICON) }),
            }),
        },
        {
            key: 'custom_blog', label: '日志', endpoint: 'blogs',
            render: b => ({
                href: `/blog/${b.id}`,
                ...row(b.title, [b.creatorName, fmtDate(b.createdAt), `回复 ${b.replies ?? 0}`],
                    { badges: (b.tags || []).slice(0, 3) }),
            }),
        },
        {
            key: 'custom_index', label: '目录', endpoint: 'indexes',
            render: i => ({
                href: `/index/${i.id}`,
                ...row(i.title, [i.creatorName, fmtDate(i.createdAt),
                    `${i.total ?? 0} 个条目`, `${i.collects ?? 0} 收藏`]),
            }),
        },
        {
            key: 'custom_subject_topic', label: '讨论', endpoint: 'subject-topics',
            dirs: ['user'],
            render: t => ({
                href: `/subject/topic/${t.id}`,
                ...row(t.title, [t.creatorName, fmtDate(t.createdAt), `回复 ${t.replyCount}`],
                    { badges: [t.parentName || '未知条目'] }),
            }),
        },
        {
            // 不进概览（「全部」），点进来才搜；子类型见 REPLY_SOURCES
            key: 'custom_reply', label: '回复', endpoint: 'replies', overview: false,
            dirs: ['user', 'group'],
            render: r => {
                const src = REPLY_SOURCE_BY_API[r.source] || REPLY_SOURCES[0];
                return {
                    href: `${src.path}/${r.containerID}#post_${r.id}`,
                    ...row(r.containerTitle || `#${r.containerID}`, [r.creatorName || r.creatorUsername, fmtDate(r.createdAt)],
                        { badges: [src.label, r.parentName], excerpt: highlight(r.excerpt) }),
                };
            },
        },
    ];
    const TYPE_BY_KEY = Object.fromEntries(TYPES.map(t => [t.key, t]));
    const REPLY_TYPE = 'custom_reply';

    // 回复的子类型：value 是搜索框里 in: 的写法，api 是服务端 source= 的取值
    const REPLY_SOURCES = [
        { value: 'all', label: '全部' },
        { value: 'group', api: 'group', label: '小组', path: '/group/topic' },
        { value: 'subject', api: 'subject', label: '条目', path: '/subject/topic' },
        { value: 'ep', api: 'episode', label: '章节', path: '/ep' },
        { value: 'crt', api: 'character', label: '角色', path: '/character' },
        { value: 'prsn', api: 'person', label: '人物', path: '/person' },
        { value: 'blog', api: 'blog', label: '日志', path: '/blog' },
    ];
    const REPLY_SOURCE_BY_API = Object.fromEntries(REPLY_SOURCES.filter(s => s.api).map(s => [s.api, s]));
    const REPLY_SOURCE_ALIASES = {
        all: 'all', group: 'group', subject: 'subject', ep: 'ep', episode: 'ep',
        crt: 'crt', character: 'crt', prsn: 'prsn', person: 'prsn', blog: 'blog',
    };

    // 服务端 `sort=` 参数；`exact` 走 `exact:true` directive
    const SORTS = [
        { value: 'relevance', label: '相关' },
        { value: 'newest', label: '最新' },
        { value: 'oldest', label: '最早' },
        { value: 'popular', label: '最热' },
    ];
    const SORT_ALIASES = {
        relevance: 'relevance', newest: 'newest', new: 'newest',
        oldest: 'oldest', old: 'oldest', popular: 'popular', hot: 'popular',
    };
    const SYNTAX_HELP = '高级语法（可与关键词混用，优先于「选项」里的设置）：\n'
        + 'user:用户名或 UID　group:小组英文名（只写条件、不写关键词也能搜）\n'
        + 'sort:newest / oldest / popular / relevance\n'
        + 'in:group / subject / ep / crt / prsn / blog / all（搜回复，并选回复类型）\n'
        + 'exact:true　include:nsfw / exclude:nsfw';

    // 首楼的高级搜索语法：从搜索框里摘出 user:/group:/sort:/exact:/include|exclude:nsfw，
    // 其余词（包括 include:blocked 之类）原样作为关键词交给服务端
    function parseQuery(raw) {
        const q = { text: '', sort: null, exact: null, nsfw: null, user: '', group: '', in: null };
        const rest = [];
        for (const tok of raw.split(/\s+/).filter(Boolean)) {
            const m = /^(user|group|sort|exact|include|exclude|in):(.*)$/i.exec(tok);
            if (!m) { rest.push(tok); continue; }
            const key = m[1].toLowerCase(), v = m[2], lv = v.toLowerCase();
            if (!v) continue;   // 还没打完的 `user:` 别当关键词搜
            if (key === 'user' || key === 'group') q[key] = v;
            else if (key === 'sort' && SORT_ALIASES[lv]) q.sort = SORT_ALIASES[lv];
            else if (key === 'exact') q.exact = /^(true|1|yes)$/.test(lv);
            else if ((key === 'include' || key === 'exclude') && lv === 'nsfw') q.nsfw = key === 'include';
            else if (key === 'in' && REPLY_SOURCE_ALIASES[lv]) q.in = REPLY_SOURCE_ALIASES[lv];
            else rest.push(tok);
        }
        q.text = rest.join(' ');
        return q;
    }
    const DIRECTIVE_RE = {
        sort: /^sort:/i, exact: /^exact:/i, nsfw: /^(include|exclude):nsfw$/i,
        user: /^user:/i, group: /^group:/i, in: /^in:/i,
    };

    // === 样式注入 ===
    const style = document.createElement('style');
    style.textContent = `
        html { --se-p: var(--primary-color, #f09199); --se-bg: #fefefe; --se-line: #eee; --se-div: #eee; --se-track: #ddd; --se-fg: #666; --se-link: #0084b4; --se-text: #000; }
        html[data-theme='dark'] { --se-bg: #6e6e6e; --se-line: #7c7c7c; --se-div: #444; --se-track: #6e6e6e; --se-fg: #d8d8d8; --se-link: #2ea6ff; --se-text: #fff; }
        #headerSearch .se-entry { display: flex; align-items: center; padding: 5px; margin: 5px; border-radius: 100px; background-clip: padding-box; cursor: pointer; color: #444; outline: none; transition: background-color .2s ease; }
        #suggestionBox.se-has-entry { max-height: none; }
        .se-entry-label { flex-shrink: 0; margin-right: 8px; padding: 2px 6px; border: 1px solid var(--se-line); border-radius: 100px; background-clip: padding-box; color: #999; }
        .se-entry-kw { flex: 1 1 auto; min-width: 0; font-size: 14px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .se-entry-kbd { flex-shrink: 0; margin-left: 8px; font-size: 10px; color: #999; }
        #headerSearch .se-entry:hover, #headerSearch .se-entry:focus-visible { background-color: var(--se-p); color: #fff; }
        #headerSearch .se-entry:hover .se-entry-label, #headerSearch .se-entry:focus-visible .se-entry-label { border-color: #fff; color: #fff; }
        #headerSearch .se-entry:hover .se-entry-kw, #headerSearch .se-entry:focus-visible .se-entry-kw { color: #fff; }
        #headerSearch .se-entry:hover .se-entry-kbd, #headerSearch .se-entry:focus-visible .se-entry-kbd { color: rgba(255,255,255,.75); }
        .se-panel-shell { position: fixed; z-index: 99; width: min(720px, 92vw); filter: drop-shadow(0 5px 18px rgba(80,80,80,.45)); }
        .se-panel { position: relative; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; overflow: auto; overscroll-behavior: contain; border: 1px solid rgba(255,255,255,.3); border-radius: 15px; background-clip: padding-box; background: rgba(254,254,254,.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: var(--se-text); }
        .se-nav, .se-results { overscroll-behavior: contain; }
        .se-panel[hidden] { display: none; }
        .se-panel[inert] { pointer-events: none; }
        .se-source-hidden { opacity: 0; pointer-events: none; }
        .se-source-motion { transition: none !important; }
        .se-nav::-webkit-scrollbar, .se-results::-webkit-scrollbar { background-color: transparent; width: 0; }
        .se-nav:hover::-webkit-scrollbar, .se-results:hover::-webkit-scrollbar { width: 5px; }
        .se-nav:hover::-webkit-scrollbar-thumb, .se-results:hover::-webkit-scrollbar-thumb { background: #999; border-radius: 5px; background-clip: padding-box; }
        .se-head { padding: 10px 10px 8px; display: flex; flex-direction: column; gap: 8px; }
        .se-query-row { display: grid; grid-template-columns: minmax(0, 1fr) 30px; align-items: center; gap: 8px; }
        .se-q { width: 100%; box-sizing: border-box; padding: 6px 12px; min-width: 0; font: inherit; font-size: 14px; color: var(--se-text); background: var(--se-bg); border: 1px solid var(--se-line); border-radius: 20px; outline: 0; }
        .se-q:focus { border-color: var(--se-p); }
        .se-close { width: 30px; height: 30px; margin: 0; padding: 0; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--se-fg); cursor: pointer; transition: background-color .15s ease, color .15s ease; }
        .se-close:hover { background: var(--se-p); color: #fff; }
        .se-close:focus-visible { outline: 2px solid var(--se-p); outline-offset: 1px; }
        .se-close svg { width: 14px; height: 14px; }
        .se-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .se-chip { padding: 3px 12px; background: var(--se-bg); border: 1px solid var(--se-line); border-radius: 20px; color: var(--se-text); cursor: pointer; user-select: none; transition: all .2s ease; }
        .se-chip:hover { border-color: var(--se-p); transform: translateY(-1px); }
        .se-chip.on { background: var(--se-p); border-color: var(--se-p); color: #fff; }
        .se-chip-sep { width: 1px; height: 14px; background: var(--se-div); }
        .se-opts-wrap { position: relative; display: inline-flex; }
        .se-opts-btn { display: inline-flex; align-items: center; gap: 5px; }
        .se-caret { font-size: 9px; line-height: 1; transition: transform .2s ease; }
        .se-opts-wrap.open .se-caret { transform: rotate(180deg); }
        .se-opts { position: absolute; z-index: 2; top: calc(100% + 6px); left: 0; display: flex; flex-direction: column; gap: 9px; padding: 11px 13px; border: 1px solid #eee; border-radius: 12px; background: #fefefe; background-clip: padding-box; box-shadow: 0 4px 16px rgba(80,80,80,.18); white-space: nowrap; }
        .se-opts[hidden] { display: none; }
        /* 窄屏选项占满筛选栏宽度，避免从按钮旁弹出后被面板裁掉。 */
        @media (max-width: 767px), (pointer: coarse) {
            .se-opts-wrap { display: contents; }
            .se-opts { position: static; box-sizing: border-box; flex: 1 0 100%; min-width: 0; white-space: normal; }
            .se-opts .se-opt-name { flex-basis: 36px; }
            .se-opts .se-fin { flex: 1 1 0; width: 0; min-width: 0; }
        }
        .se-opt-row { display: flex; align-items: center; gap: 8px; }
        .se-opt-name { flex: 0 0 28px; color: #999; }
        .se-switch { padding: 0; border: 0; box-sizing: content-box; position: relative; flex: 0 0 auto; width: 28px; height: 16px; border-radius: 100px; background: var(--se-track); background-clip: padding-box; cursor: pointer; transition: background-color .2s ease; }
        .se-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform .2s ease; }
        .se-switch.on { background: var(--se-p); }
        .se-switch.on::after { transform: translateX(12px); }
        .se-fin { width: 68px; font: inherit; line-height: inherit; cursor: text; outline: 0; }
        .se-fin:hover { transform: none; }
        .se-fin:focus { border-color: var(--se-p); }
        .se-fin::placeholder { color: #999; }
        .se-fin.on::placeholder { color: rgba(255,255,255,.7); }
        .se-body { display: flex; align-items: stretch; min-height: 0; border-top: 1px solid var(--se-div); }
        .se-nav { flex: 0 0 112px; padding: 5px 0; overflow-y: auto; border-right: 1px solid var(--se-div); max-height: min(62vh, 520px); }
        .se-nav-item { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin: 2px 5px; padding: 4px 10px; border-radius: 100px; background-clip: padding-box; color: var(--se-fg); cursor: pointer; transition: background-color .2s ease; }
        .se-nav-item:hover { background-color: color-mix(in srgb, var(--se-p) 14%, transparent); }
        .se-nav-item.se-off { opacity: .4; cursor: default; }
        .se-nav-item.se-off:hover { background-color: transparent; }
        .se-nav-item.on { background-color: var(--se-p); color: #fff; }
        .se-nav-count { font-size: 10px; color: #999; }
        .se-nav-item.on .se-nav-count { color: rgba(255,255,255,.8); }
        .se-results { flex: 1 1 auto; min-width: 0; overflow-y: auto; padding: 5px 0; max-height: min(62vh, 520px); }
        .se-section-head { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 15px 3px; font-size: 10px; color: #999; cursor: pointer; }
        .se-section-head:hover { color: var(--se-p); }
        a.se-row { display: flex; align-items: flex-start; margin: 1px 5px; padding: 6px 10px; border-radius: 8px; text-decoration: none; color: var(--se-fg); transition: background-color .2s ease; }
        a.se-row:hover { background-color: color-mix(in srgb, var(--se-p) 10%, transparent); }
        a.se-row.se-sel { background-color: color-mix(in srgb, var(--se-p) 10%, transparent); box-shadow: 0 0 3px color-mix(in srgb, var(--se-p) 40%, transparent); }
        .se-avatar { margin-right: 10px; flex-shrink: 0; margin-top: 1px; }
        .se-content { flex-grow: 1; min-width: 0; }
        .se-title { display: block; font-size: 14px; color: var(--se-link); overflow-wrap: anywhere; }
        a.se-row:hover .se-title { color: #02a3fb; }
        .se-meta { display: block; font-size: 11px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .se-excerpt { margin-top: 2px; font-size: 12px; color: var(--se-fg); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .se-hl { color: var(--se-p); font-weight: bold; }
        .se-sources[hidden] { display: none; }
        .se-chip.se-off { opacity: .4; cursor: default; }
        .se-chip.se-off:hover { border-color: var(--se-line); transform: none; }
        .se-badge { display: inline-block; margin-right: 6px; padding: 0 6px; border: 1px solid var(--se-line); border-radius: 100px; background-clip: padding-box; color: #999; }
        .se-status { padding: 24px 10px; text-align: center; color: #999; }
        .se-status.error, .se-more.error { color: #c00; }
        .se-more { margin: 3px 5px; padding: 6px; border-radius: 8px; text-align: center; color: #999; cursor: pointer; transition: background-color .2s ease; }
        .se-more:hover { background-color: color-mix(in srgb, var(--se-p) 10%, transparent); }
        .se-foot { display: flex; justify-content: space-between; gap: 10px; padding: 6px 15px; border-top: 1px solid var(--se-div); font-size: 10px; color: #999; }
        .se-info { flex-shrink: 0; white-space: nowrap; }
        .se-foot-keys { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media (max-width: 767px), (pointer: coarse) {
            /* 触屏没有键盘快捷键，提示只会把左侧状态挤成逐字换行。 */
            .se-foot-keys { display: none; }
            /* 两字分类名 + 「5000+」级别的计数刚好放得下 */
            .se-nav { flex-basis: 80px; }
            .se-nav-item { gap: 4px; margin: 2px 3px; padding: 4px 7px; }
        }
        html[data-theme='dark'] #headerSearch .se-entry { color: #e1e1e1; }
        html[data-theme='dark'] .se-entry-kw { color: #e0e0e1; }
        html[data-theme='dark'] .se-panel-shell { filter: drop-shadow(0 5px 18px rgba(0,0,0,.3)); }
        html[data-theme='dark'] .se-panel { background: rgba(40,40,40,.92); }
        html[data-theme='dark'] .se-fin::placeholder { color: #c0c0c0; }
        html[data-theme='dark'] .se-opts { background: rgba(58,58,58,.98); border-color: #4a4a4a; box-shadow: 0 4px 16px rgba(0,0,0,.35); }
    `;
    document.head.appendChild(style);

    // === DOM ===
    const searchInput = document.getElementById('search_text');
    const suggestionsBox = document.getElementById('searchSuggestions');
    const headerSearch = document.getElementById('headerSearch');
    if (!headerSearch?.querySelector('form') || !searchInput) return;
    // 「班固米右上角快速搜索」脚本的下拉（#suggestionBox）；装了它时官方联想被它的样式常驻隐藏
    const quickBox = () => headerSearch.querySelector('#suggestionBox');

    function hideSuggestions() {
        if (suggestionsBox) suggestionsBox.style.display = 'none';
        const box = quickBox();
        if (box) box.style.display = 'none';
    }

    // === 面板 ===
    // 每次新搜索换一个 state 对象；旧请求回来时发现 state 已不是当前的就丢弃。
    let state = null;
    let panel = null;
    let panelShell = null;
    let els = null;
    let panelOpen = false;        // 用户期望的状态；退场中的面板已不响应搜索快捷键
    let panelMotion = null;       // 快速开关时沿当前进度折返，不重置画面
    let sourceWasInert = false;
    let panelTracks = [];         // 外壳、真实输入框和内容共用时间轴
    // 「选项」和排序按钮自己的设置；搜索框里的指令只覆盖当次搜索，不改这里
    const prefs = { sort: 'relevance', exact: false, nsfw: false, user: '', group: '', replySource: 'all' };

    function buildPanel() {
        panel = document.createElement('div');
        panel.className = 'se-panel';
        panel.hidden = true;
        panel.innerHTML = `
            <div class="se-head">
                <div class="se-query-row">
                    <input class="se-q" type="text" autocomplete="off" spellcheck="false"
                           placeholder="搜索话题、用户、小组、日志、目录、讨论（支持 user: group: sort:）">
                    <button class="se-close" type="button" aria-label="关闭搜索面板" title="关闭（Esc）">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8"/></svg>
                    </button>
                </div>
                <div class="se-filters"></div>
                <div class="se-filters se-sources" hidden></div>
            </div>
            <div class="se-body">
                <div class="se-nav"></div>
                <div class="se-results"></div>
            </div>
            <div class="se-foot">
                <span class="se-info"></span>
                <span class="se-foot-keys">↑↓ 选择 · Enter 打开 · ${MOD_LABEL}Enter 新标签页 · ${MOD_LABEL}0–7 切分类 · Esc 关闭</span>
            </div>`;
        els = {
            q: panel.querySelector('.se-q'),
            close: panel.querySelector('.se-close'),
            filters: panel.querySelector('.se-filters'),
            sources: panel.querySelector('.se-sources'),
            nav: panel.querySelector('.se-nav'),
            results: panel.querySelector('.se-results'),
            info: panel.querySelector('.se-info'),
        };
        els.q.title = SYNTAX_HELP;
        panelShell = document.createElement('div');
        panelShell.className = 'se-panel-shell';
        panelShell.appendChild(panel);
        document.body.appendChild(panelShell);
        buildFilters();
        els.close.addEventListener('click', closePanel);

        // 面板自己的输入框就是唯一的搜索入口，顶栏那只只负责把词带进来
        els.q.addEventListener('input', debounce(() => {
            const kw = els.q.value.trim();
            if (state && kw !== state.raw) search(kw, state.activeType);
        }, 250));

        // 单类型模式滚到底继续翻页（概览没有分页游标，loadMore 自己会挡掉）
        els.results.addEventListener('scroll', () => {
            const r = els.results;
            if (r.scrollTop + r.clientHeight >= r.scrollHeight - 80) loadMore();
        }, { passive: true });

        // 点面板里别处就收起「选项」下拉
        panel.addEventListener('mousedown', e => {
            e.stopPropagation();
            const wrap = optsWrap();
            if (wrap && wrap.classList.contains('open') && !wrap.contains(e.target)) toggleOpts(false);
        });

        panel.addEventListener('click', e => e.stopPropagation());
        panel.addEventListener('keydown', e => {
            e.stopPropagation();
            if ((IS_MAC ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                closePanel();
            } else onKeydown(e);
        });
        // 触屏未聚焦输入框时仍支持 Esc 和结果导航。
        document.addEventListener('keydown', e => {
            if (!headerSearch.contains(e.target) && !panel.contains(e.target)) onKeydown(e);
        });
        panel.addEventListener('wheel', e => {
            e.stopPropagation();
            if (!e.ctrlKey && e.deltaY && !canScrollPanel(e.target, e.deltaY)) e.preventDefault();
        }, { passive: false });
        let touchY = null;
        panel.addEventListener('touchstart', e => {
            touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
        }, { passive: true });
        panel.addEventListener('touchmove', e => {
            e.stopPropagation();
            if (touchY === null || e.touches.length !== 1) return;
            const delta = touchY - e.touches[0].clientY;
            touchY = e.touches[0].clientY;
            if (delta && !canScrollPanel(e.target, delta)) e.preventDefault();
        }, { passive: false });
    }

    // 仅在面板内部存在可滚动空间时放行，边缘和空白区域不把滚动传给页面。
    function canScrollPanel(target, delta) {
        for (let node = target; node && panel.contains(node); node = node.parentElement) {
            if (!/auto|scroll/.test(getComputedStyle(node).overflowY)) continue;
            if (delta < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
        }
        return false;
    }

    function buildFilters() {
        const savedSort = lsGet(LS_SORT);
        prefs.sort = SORTS.some(s => s.value === savedSort) ? savedSort : 'relevance';
        prefs.exact = lsGet(LS_EXACT) === '1';
        prefs.nsfw = lsGet(LS_NSFW) === '1';
        const frag = document.createDocumentFragment();
        for (const s of SORTS) {
            const chip = element('span', 'se-chip se-sort');
            chip.dataset.sort = s.value;
            chip.textContent = s.label;
            chip.addEventListener('click', () => {
                if (chip.classList.contains('se-off')) return;
                prefs.sort = s.value;
                lsSet(LS_SORT, s.value);
                stripDirective('sort');
                applyFilters();
            });
            frag.appendChild(chip);
        }

        const sep = element('span', 'se-chip-sep');
        frag.appendChild(sep);
        frag.appendChild(buildOpts());

        els.filters.appendChild(frag);

        const savedSource = lsGet(LS_REPLY_SOURCE);
        prefs.replySource = REPLY_SOURCES.some(s => s.value === savedSource) ? savedSource : 'all';
        for (const src of REPLY_SOURCES) {
            const chip = element('span', 'se-chip se-source', src.label);
            chip.dataset.source = src.value;
            chip.addEventListener('click', () => {
                if (chip.classList.contains('se-off')) return;
                prefs.replySource = src.value;
                lsSet(LS_REPLY_SOURCE, src.value);
                stripDirective('in');
                applyFilters();
            });
            els.sources.appendChild(chip);
        }
        paintControls();
    }

    // 匹配方式、NSFW 内容、user:/group: 都收进「选项」下拉，筛选栏上只留排序
    function buildOpts() {
        const wrap = element('span', 'se-opts-wrap');

        const btn = element('span', 'se-chip se-opts-btn');
        btn.innerHTML = '<span>选项</span><span class="se-caret">▾</span>';
        btn.title = '匹配方式、NSFW 内容、按用户 / 小组筛选';
        btn.addEventListener('click', () => toggleOpts());
        wrap.appendChild(btn);

        const box = element('div', 'se-opts');
        box.hidden = true;

        box.appendChild(optRow('模糊搜索', [toggleSwitch('se-fuzzy', 'exact', LS_EXACT, {
            label: '模糊搜索',
            onTitle: '模糊：标题分词 + 话题正文全文检索，命中面更广',
            offTitle: '精确：只按字面匹配标题（用户为用户名/昵称完全相等），不做中文分词',
        }, true)]));
        box.appendChild(optRow('NSFW', [toggleSwitch('se-nsfw', 'nsfw', LS_NSFW, {
            label: '包含 NSFW',
            onTitle: '包含：同时搜索 NSFW 小组及相关话题、讨论；不包含隐藏帖子',
            offTitle: '不含：排除 NSFW 小组及相关话题、讨论',
        })]));
        box.appendChild(optRow('筛选', [
            dirInput('user', '用户', '只看这个人发的（用户名或 UID）。仅「话题」「讨论」支持，留空为不限'),
            dirInput('group', '小组', '只看这个小组里的（小组英文名，如 sf）。仅「话题」支持，留空为不限'),
        ]));

        wrap.appendChild(box);
        return wrap;
    }

    function optRow(name, controls) {
        const row = element('div', 'se-opt-row');
        const label = element('span', 'se-opt-name', name);
        row.appendChild(label);
        row.append(...controls);
        if (controls.length === 1) label.addEventListener('click', () => controls[0].click());
        return row;
    }

    function optsWrap() {
        return els && els.filters.querySelector('.se-opts-wrap');
    }

    function toggleOpts(force) {
        const wrap = optsWrap();
        if (!wrap) return;
        const open = force === undefined ? !wrap.classList.contains('open') : force;
        wrap.classList.toggle('open', open);
        wrap.querySelector('.se-opts').hidden = !open;
    }

    // 有任何一项不是默认值就把「选项」点亮，收起来了也看得出还带着条件
    function paintOptsBtn() {
        const btn = els && els.filters.querySelector('.se-opts-btn');
        if (!btn) return;
        btn.classList.toggle('on', exactOn() || nsfwOn() || activeDirs().length > 0);
    }

    // inverted 保留旧的精确匹配设置，但界面以“模糊开启”表示相反状态。
    // 开关显示的是实际生效的值（可能来自搜索框里的指令），拨动后改回由开关决定。
    function toggleSwitch(cls, pref, lsKey, text, inverted = false) {
        const sw = element('button', 'se-switch ' + cls);
        sw.type = 'button';
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-label', text.label);
        sw.paint = on => {
            sw.classList.toggle('on', on);
            sw.setAttribute('aria-checked', String(on));
            sw.title = on ? text.onTitle : text.offTitle;
        };
        sw.addEventListener('click', () => {
            prefs[pref] = !sw.classList.contains('on') !== inverted;
            lsSet(lsKey, prefs[pref] ? '1' : '0');
            stripDirective(pref);
            applyFilters();
        });
        return sw;
    }

    // 用户/小组条件仅在当前会话保留。搜索框里写了 user:/group: 时这里显示它，
    // 一旦在这里改动，就把搜索框里那条指令删掉，改由输入框决定。
    function dirInput(name, placeholder, title) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'se-chip se-fin';
        input.dataset.dir = name;
        input.placeholder = placeholder;
        input.title = title;
        input.spellcheck = false;
        const run = () => {
            const v = input.value.trim().replace(/\s+/g, '');
            const fromQuery = !!state?.q[name] && input.value !== state.q[name];
            // 失焦时的 change 别把刚搜过的再搜一遍
            if (v === prefs[name] && !fromQuery) return;
            prefs[name] = v;
            if (fromQuery) stripDirective(name);
            applyFilters();
        };
        input.addEventListener('input', debounce(run, 400));
        input.addEventListener('change', run);
        return input;
    }

    // 触屏不主动弹键盘。
    function focusQuery(select) {
        if (IS_TOUCH) return;
        els.q.focus({ preventScroll: true });
        if (select) els.q.select();
    }

    // 以下都是实际生效的值：搜索框里的指令优先，其次是按钮 / 「选项」
    function currentSort() {
        let s = state?.q.sort || prefs.sort;
        // 回复没有热度可比，服务端也按相关处理
        if (s === 'popular' && state?.activeType === REPLY_TYPE) s = 'relevance';
        // 只按条件列出时谈不上相关度，按最新列出
        return s === 'relevance' && state && !state.keyword && activeDirs().length ? 'newest' : s;
    }
    function exactOn() {
        return state?.q.exact ?? prefs.exact;
    }
    function nsfwOn() {
        return state?.q.nsfw ?? prefs.nsfw;
    }
    // 指令值里不能有空格，否则后半截会被服务端当成另一个搜索词
    function dirVal(name) {
        return state?.q[name] || prefs[name];
    }
    // group: 只对小组话题的回复有效，这时只能选「小组」
    function replySource() {
        if (dirVal('group')) return 'group';
        return state?.q.in || prefs.replySource;
    }
    function activeDirs() {
        return ['user', 'group'].filter(d => dirVal(d));
    }
    // 不搜索无法应用当前指令的分类。
    function typeAllowed(type) {
        return activeDirs().every(d => (type.dirs || []).includes(d));
    }
    // 任一筛选项变动后重跑（search 会把被新指令排除的分类退回概览）
    function applyFilters() {
        if (state) search(els.q.value.trim(), state.activeType);
        else paintControls();
    }

    // 点了按钮就以按钮为准：把搜索框里同类的指令删掉
    function stripDirective(name) {
        const toks = els.q.value.split(/\s+/).filter(Boolean);
        const kept = toks.filter(t => !DIRECTIVE_RE[name].test(t));
        if (kept.length !== toks.length) els.q.value = kept.join(' ');
    }

    function paintControls() {
        const sort = currentSort();
        const inReplies = state?.activeType === REPLY_TYPE;
        els.filters.querySelectorAll('.se-sort').forEach(c => {
            // 回复没有热度可比，服务端按相关处理
            const off = inReplies && c.dataset.sort === 'popular';
            c.classList.toggle('on', !off && c.dataset.sort === sort);
            c.classList.toggle('se-off', off);
            c.title = off ? '回复没有热度可比' : '';
        });
        els.sources.hidden = !inReplies;
        const source = replySource();
        const groupOnly = !!dirVal('group');
        els.sources.querySelectorAll('.se-source').forEach(c => {
            c.classList.toggle('on', c.dataset.source === source);
            const off = groupOnly && c.dataset.source !== 'group';
            c.classList.toggle('se-off', off);
            c.title = off ? 'group: 只能筛小组话题的回复' : '';
        });
        els.filters.querySelector('.se-fuzzy').paint(!exactOn());
        els.filters.querySelector('.se-nsfw').paint(nsfwOn());
        for (const input of els.filters.querySelectorAll('.se-fin')) {
            const v = dirVal(input.dataset.dir);
            if (input.value !== v && document.activeElement !== input) input.value = v;
            input.classList.toggle('on', !!v);
        }
        paintOptsBtn();
    }

    function positionPanel() {
        const anchor = headerSearch.getBoundingClientRect();
        const width = panelShell.getBoundingClientRect().width;
        const margin = 8;
        // 用布局坐标扣除面板边框和头部内边距；不读取动画中的 transform。
        // 展开后的真实输入框与官方框同高，空间不足时沿共同的右边缘展开。
        const inputLeft = els.q.offsetLeft + panel.clientLeft;
        const inputTop = els.q.offsetTop + panel.clientTop;
        const inputRight = width - inputLeft - els.q.offsetWidth;
        let left = anchor.left - inputLeft;
        if (left + width + margin > window.innerWidth) {
            left = anchor.right + inputRight - width;
        }
        // 触屏和窄屏优先保持左右等距，桌面仍与官方输入框对齐。
        left = IS_TOUCH || window.innerWidth <= 767
            ? (window.innerWidth - width) / 2
            : Math.max(margin, Math.min(left, window.innerWidth - width - margin));
        panelShell.style.left = `${left}px`;
        const top = Math.max(margin, anchor.top - inputTop);
        panelShell.style.top = `${top}px`;
        panel.style.maxHeight = `${Math.max(0, window.innerHeight - top - margin)}px`;
    }

    function openPanel(keyword, typeKey) {
        if (!panel) buildPanel();
        // 中途反向展开时保留本轮记录的官方框交互状态。
        if (panel.hidden) {
            sourceWasInert = headerSearch.inert;
        }
        panelOpen = true;
        panel.hidden = false;
        panel.inert = false;
        if (!panelMotion) positionPanel();
        hideSuggestions();
        els.q.value = keyword;
        search(keyword, typeKey || null);
        // 先确定焦点样式，再测量动画终态，避免完成时边框变色。
        focusQuery(true);
        headerSearch.inert = true;
        animatePanel();
    }

    function closePanel() {
        if (!panelOpen) return;
        state?.controllers.forEach(c => c.abort());
        state = null;
        panelOpen = false;
        if (panel.contains(document.activeElement)) document.activeElement.blur();
        panel.inert = true;
        // 关闭只恢复官方框，不主动 focus；官方 focus 处理器会重新展开联想下拉。
        hideSuggestions();
        animatePanel();
    }

    // 外壳从官方药丸的位置展开，真实输入框跟随同一时间轴平移和扩宽。
    // 文字不做缩放；分类/图标随原框交接，面板内容在轮廓展开后再显现。
    function settlePanel() {
        const source = headerSearch;
        if (panelMotion) panelMotion.onfinish = null;
        panel.hidden = !panelOpen;
        // 先让底层样式和动画终态一致，再撤销动画。官方的 opacity transition
        // 不会在撤销时从 0 重新淡入；回程全程使用同一个真实 DOM。
        source.classList.toggle('se-source-hidden', panelOpen);
        void getComputedStyle(source).opacity;
        panelTracks.forEach(track => track.cancel());
        source.classList.remove('se-source-motion');
        panelTracks = [];
        panelMotion = null;
        if (!panelOpen) {
            source.inert = sourceWasInert;
            hideSuggestions();
        }
    }

    function animatePanel() {
        if (!panel.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) {
            settlePanel();
            return;
        }
        if (!panelMotion) {
            const source = headerSearch;
            const from = source.getBoundingClientRect();
            const to = panel.getBoundingClientRect();
            const input = els.q.getBoundingClientRect();
            const sourceStyle = getComputedStyle(source);
            const visible = from.width > 0 && from.height > 0 && from.bottom > 0 &&
                from.top < innerHeight && from.right > 0 && from.left < innerWidth &&
                sourceStyle.visibility !== 'hidden' && from.width <= to.width;
            const add = (element, frames) => {
                const track = element.animate(frames, {
                    duration: PANEL_MS, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both',
                });
                track.pause();
                track.currentTime = panelOpen ? 0 : PANEL_MS;
                panelTracks.push(track);
                return track;
            };
            // 阴影位于裁剪层之外，随轮廓变化；完成时取消动画不会突然露出阴影。
            add(panelShell, [
                { filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' },
                { filter: getComputedStyle(panelShell).filter },
            ]);
            if (visible) {
                source.classList.add('se-source-motion');
                const x = Math.max(0, Math.min(to.width - from.width, from.left - to.left));
                const dx = from.left - to.left - x;
                const dy = from.top - to.top;
                const text = searchInput.getBoundingClientRect();
                const textStyle = getComputedStyle(searchInput);
                const radius = `${from.height / 2}px`;
                const inputStyle = getComputedStyle(els.q);
                panelMotion = add(panel, [
                    { transform: `translate(${dx}px, ${dy}px)`,
                      clipPath: `inset(0px ${to.width - x - from.width}px calc(100% - ${from.height}px) ${x}px round ${radius})`,
                      borderRadius: '0px', backgroundColor: sourceStyle.backgroundColor, opacity: 0, offset: 0 },
                    { opacity: 1, offset: 0.22 },
                    { transform: 'translate(0, 0)', clipPath: 'inset(0px 0px 0px 0px round 15px)',
                      borderRadius: '15px', backgroundColor: getComputedStyle(panel).backgroundColor, opacity: 1, offset: 1 },
                ]);
                add(els.q, [
                    { transform: `translate(${from.left - input.left - dx}px, ${from.top - input.top - dy}px)`,
                      width: `${from.width}px`, height: `${from.height}px`, borderRadius: radius,
                      paddingLeft: `${Math.max(0, text.left - from.left + parseFloat(textStyle.paddingLeft))}px`,
                      backgroundColor: sourceStyle.backgroundColor, borderColor: sourceStyle.borderColor,
                      color: textStyle.color, opacity: 0, offset: 0 },
                    { opacity: 1, offset: 0.38 },
                    { transform: 'translate(0, 0)', width: `${input.width}px`, height: `${input.height}px`,
                      borderRadius: inputStyle.borderRadius,
                      paddingLeft: inputStyle.paddingLeft,
                      backgroundColor: inputStyle.backgroundColor,
                      borderColor: inputStyle.borderColor, color: inputStyle.color, opacity: 1, offset: 1 },
                ]);
                // 直接移动真实官方框，保持分类、图标、字体及焦点样式一致。
                // 不在末帧切换克隆节点，因此不会出现替身消失后原框闪现。
                const sourceTransform = sourceStyle.transform === 'none' ? '' : sourceStyle.transform;
                add(source, [
                    { opacity: 1, transform: `translate(0, 0) ${sourceTransform}`, offset: 0 },
                    { opacity: 0, offset: 0.38 },
                    { opacity: 0, transform: `translate(${input.left - from.left}px, ${input.top - from.top}px) ${sourceTransform}`, offset: 1 },
                ]);
                source.classList.add('se-source-hidden');
                for (const content of [els.close, els.filters, panel.querySelector('.se-body'), panel.querySelector('.se-foot')]) {
                    add(content, [
                        { opacity: 0, transform: 'translateY(-6px)', offset: 0 },
                        { opacity: 0, transform: 'translateY(-6px)', offset: 0.35 },
                        { opacity: 1, transform: 'translateY(0)', offset: 1 },
                    ]);
                }
            } else {
                // 窄屏官方搜索框收起或滚出视口时，不从屏幕外飞入。
                source.classList.remove('se-source-hidden');
                panelMotion = add(panel, [
                    { opacity: 0, transform: 'translateY(-8px)' },
                    { opacity: 1, transform: 'translateY(0)' },
                ]);
            }
            panelMotion.onfinish = settlePanel;
        }
        for (const track of panelTracks) {
            track.updatePlaybackRate(panelOpen ? 1 : -1.2);
            track.play();
        }
    }

    // 后台标签页不等待动画帧，避免留下半透明面板或未恢复的官方下拉。
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && panelMotion) settlePanel();
    });

    // === 搜索 ===
    function buildUrl(type, limit, offset) {
        const parts = state.keyword ? [state.keyword] : [];
        if (exactOn()) parts.push('exact:true');
        parts.push(nsfwOn() ? 'include:nsfw' : 'exclude:nsfw');
        // 只把这个分类真认的指令发过去
        for (const d of activeDirs()) {
            if ((type.dirs || []).includes(d)) parts.push(`${d}:${dirVal(d)}`);
        }
        const params = new URLSearchParams({ q: parts.join(' '), limit, offset, sort: currentSort() });
        if (type.key === REPLY_TYPE) {
            const src = REPLY_SOURCES.find(s => s.value === replySource());
            if (src && src.api) params.set('source', src.api);
        }
        return `${API_BASE}/${type.endpoint}?${params}`;
    }

    async function fetchPage(type, limit, offset) {
        const controller = new AbortController();
        state.controllers.push(controller);
        const res = await fetch(buildUrl(type, limit, offset), { signal: controller.signal });
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try { msg = (await res.json()).error.message || msg; } catch (_) { /* 非 JSON 错误体 */ }
            throw new Error(msg);
        }
        return res.json();
    }

    function search(raw, typeKey) {
        state?.controllers.forEach(c => c.abort());
        const q = parseQuery(raw);
        state = {
            raw,                           // 搜索框原文
            q,                             // 从中摘出的指令
            keyword: q.text,               // 去掉指令后的关键词，可以为空
            activeType: null,              // null = 概览
            counts: {},                    // key -> { total, isEstimate }
            page: null,                    // 单类型模式的分页游标
            controllers: [],
            loading: false,
        };
        // 写了 in: 就是要搜回复；当前分类要是被新指令排除了，退回概览
        const t = TYPE_BY_KEY[q.in ? REPLY_TYPE : typeKey];
        if (t && typeAllowed(t)) state.activeType = t.key;
        paintControls();
        renderNav();
        // 关键词为空但有 user:/group: 时照样搜，直接按条件列出
        if (!state.keyword && !activeDirs().length) {
            els.results.innerHTML = '<div class="se-status">输入关键词开始搜索<br>'
                + '也可以只写条件，如 <code>user:sai</code>、<code>group:sf sort:newest</code></div>';
            els.info.textContent = '';
            return;
        }
        if (state.activeType) runType(); else runOverview();
    }

    function setType(typeKey) {
        if (!state) return;
        if (typeKey && !typeAllowed(TYPE_BY_KEY[typeKey])) return;
        const keep = state.counts;
        // 离开「回复」时去掉 in:，否则它又会把分类切回来
        if (typeKey !== REPLY_TYPE) stripDirective('in');
        search(els.q.value.trim(), typeKey);
        if (state) {
            state.counts = keep;   // 概览已经数过了，切类型时别把左栏清空
            renderNav();
        }
        focusQuery();
    }

    // 概览缓存按关键词和筛选条件区分。
    const OVERVIEW_CACHE_MAX = 8;
    const OVERVIEW_CACHE_TTL = 120000;
    const overviewCache = new Map();

    function overviewKey(keyword) {
        return [currentSort(), exactOn() ? 1 : 0, nsfwOn() ? 1 : 0,
            dirVal('user'), dirVal('group'), keyword].join('|');
    }

    function cacheGet(key) {
        const hit = overviewCache.get(key);
        if (!hit) return null;
        if (performance.now() - hit.at > OVERVIEW_CACHE_TTL) {
            overviewCache.delete(key);
            return null;
        }
        overviewCache.delete(key);      // 命中即置顶，Map 的插入序就是 LRU 序
        overviewCache.set(key, hit);
        return hit;
    }

    function cacheSet(key, entry) {
        overviewCache.set(key, { at: performance.now(), ...entry });
        while (overviewCache.size > OVERVIEW_CACHE_MAX) {
            overviewCache.delete(overviewCache.keys().next().value);
        }
    }

    function fillSection(slot, type, count, data) {
        slot.appendChild(sectionHead(type, count));
        for (const item of data) slot.appendChild(rowEl(type, item));
    }

    // --- 概览：6 个端点并发，各取前几条；按分类顺序依次显示 ---
    function runOverview() {
        const s = state;
        els.info.textContent = '';

        const key = overviewKey(s.keyword);
        const cached = cacheGet(key);
        if (cached) {
            const frag = document.createDocumentFragment();
            for (const sec of cached.sections) {
                const slot = element('div', 'se-sec');
                fillSection(slot, sec.type, sec.count, sec.data);
                frag.appendChild(slot);
            }
            s.counts = { ...cached.counts };
            renderNav();
            els.results.innerHTML = '';
            els.results.appendChild(frag);
            els.info.textContent = '概览 · 缓存';
            return;
        }

        // 固定分类槽位，异步结果返回时不改变顺序。
        els.results.innerHTML = '';
        const types = TYPES.filter(t => t.overview !== false && typeAllowed(t));
        const slots = types.map(() => {
            const slot = element('div', 'se-sec');
            els.results.appendChild(slot);
            return slot;
        });
        const status = element('div', 'se-status', '正在搜索…');
        els.results.appendChild(status);

        const started = performance.now();
        const sections = new Array(types.length);   // 按 types 下标存，写进缓存时顺序天然正确
        const settled = new Array(types.length).fill(false);
        let nextSection = 0;
        let pending = types.length;
        let hits = 0;
        let failed = 0;

        types.forEach((type, i) => {
            fetchPage(type, OVERVIEW_SIZE, 0).then(res => {
                if (s !== state) return;
                const data = res.data || [];
                const page = res.pagination || {};
                const count = { total: page.total ?? data.length, isEstimate: !!page.totalIsEstimate };
                s.counts[type.key] = count;
                renderNav();            // 左栏计数也一个一个填，不攒到最后
                if (!data.length) return;
                hits += data.length;
                sections[i] = { type, count, data };
            }, err => {
                if (err.name !== 'AbortError') failed++;
            }).then(() => {
                if (s !== state) return;
                settled[i] = true;
                // 后面的分类即使先返回，也等前面的分类完成后再显示。
                while (nextSection < types.length && settled[nextSection]) {
                    const sec = sections[nextSection];
                    if (sec) fillSection(slots[nextSection], sec.type, sec.count, sec.data);
                    nextSection++;
                }
                if (--pending) return;
                status.remove();
                if (!hits) {
                    els.results.innerHTML = failed
                        ? `<div class="se-status error">搜索失败（${failed} 个分类出错）</div>`
                        : '<div class="se-status">没有找到相关结果</div>';
                } else if (!failed) {
                    // 只缓存完整且无错的一轮，免得把半截结果记下来
                    cacheSet(key, { counts: { ...s.counts }, sections: sections.filter(Boolean) });
                }
                els.info.textContent = `概览 · ${Math.round(performance.now() - started)}ms`
                    + (failed ? ` · ${failed} 个分类失败` : '');
            });
        });
    }

    function sectionHead(type, count) {
        const head = element('div', 'se-section-head');
        head.innerHTML = `<b>${esc(type.label)}</b><span>${fmtCount(count.total, count.isEstimate)} 条 · 查看全部 ›</span>`;
        head.addEventListener('click', () => setType(type.key));
        return head;
    }

    // --- 单类型：分页 + 无限滚动 ---
    function runType() {
        state.page = { offset: 0, total: 0, isEstimate: false, hasMore: true };
        els.results.innerHTML = '<div class="se-status">正在搜索…</div>';
        els.info.textContent = '';
        loadMore(true);
    }

    function loadMore(first) {
        const s = state;
        const p = s && s.page;
        if (!s || !p || s.loading || !p.hasMore) return;
        s.loading = true;

        const type = TYPE_BY_KEY[s.activeType];
        if (!first) setMore('加载中…', { clickable: false });

        fetchPage(type, PAGE_SIZE, p.offset)
            .then(res => {
                if (s !== state) return;
                const data = res.data || [];
                const page = res.pagination || {};
                p.total = page.total ?? p.total;
                p.isEstimate = !!page.totalIsEstimate;
                p.offset += data.length;
                // 估算总数可能偏大，所以以“这一页是否满页”判断是否还有下一页
                p.hasMore = data.length === PAGE_SIZE
                    && p.offset + PAGE_SIZE <= MAX_OFFSET
                    && (p.isEstimate || p.offset < p.total);
                s.loading = false;
                s.counts[type.key] = { total: p.total, isEstimate: p.isEstimate };
                renderNav();

                if (first) els.results.innerHTML = '';
                clearMore();
                if (!p.offset) {
                    els.results.innerHTML = '<div class="se-status">没有找到相关结果</div>';
                    els.info.textContent = '';
                    return;
                }
                const frag = document.createDocumentFragment();
                for (const item of data) frag.appendChild(rowEl(type, item));
                els.results.appendChild(frag);

                const shown = p.isEstimate ? `已显示 ${p.offset}` : `已显示 ${p.offset} / ${p.total}`;
                if (p.hasMore) setMore(`加载更多（${shown}）`);
                els.info.textContent = p.isEstimate ? `${shown} 条（总数为估算）` : shown;
            })
            .catch(err => {
                if (s !== state || err.name === 'AbortError') return;
                s.loading = false;
                if (first) els.results.innerHTML = '';
                setMore(`搜索失败：${err.message}（点击重试）`, { error: true });
            });
    }

    function clearMore() {
        els.results.querySelector('.se-more')?.remove();
    }

    function setMore(text, { clickable = true, error = false } = {}) {
        clearMore();
        const more = element('div', 'se-more' + (error ? ' error' : ''), text);
        if (clickable) more.addEventListener('click', () => loadMore());
        els.results.appendChild(more);
    }

    // --- 行 / 左栏 ---
    function rowEl(type, item) {
        const { href, html } = type.render(item);
        const a = element('a', 'se-row');
        a.href = href;
        a.innerHTML = html;
        a.addEventListener('mouseenter', () => select(a, false));
        return a;
    }

    function renderNav() {
        const frag = document.createDocumentFragment();

        [{ key: null, label: '全部' }, ...TYPES].forEach((type, i) => {
            const count = state?.counts[type.key];
            const off = type.key !== null && !typeAllowed(type);
            const item = element('div', 'se-nav-item'
                + (state?.activeType === type.key ? ' on' : '') + (off ? ' se-off' : ''));
            const label = off ? '—' : count ? fmtCount(count.total, count.isEstimate) : IS_TOUCH ? '' : `${MOD_LABEL}${i}`;
            item.innerHTML = `<span>${esc(type.label)}</span><span class="se-nav-count">${esc(label)}</span>`;
            if (off) item.title = `「${type.label}」不支持 ${activeDirs().map(d => d + ':').join(' / ')} 筛选`;
            else item.addEventListener('click', () => setType(type.key));
            frag.appendChild(item);
        });

        els.nav.innerHTML = '';
        els.nav.appendChild(frag);
    }

    // === 键盘 ===
    function rows() {
        return Array.from(els.results.querySelectorAll('a.se-row'));
    }

    function select(el, scroll = true) {
        els.results.querySelectorAll('a.se-row.se-sel').forEach(r => r.classList.remove('se-sel'));
        if (!el) return;
        el.classList.add('se-sel');
        if (scroll) {
            const row = el.getBoundingClientRect(), box = els.results.getBoundingClientRect();
            els.results.scrollTop += row.top < box.top ? row.top - box.top : Math.max(0, row.bottom - box.bottom);
        }
    }

    function moveSel(delta) {
        const list = rows();
        if (!list.length) return;
        const cur = list.findIndex(r => r.classList.contains('se-sel'));
        const next = cur < 0
            ? (delta > 0 ? 0 : list.length - 1)
            : (cur + delta + list.length) % list.length;
        select(list[next]);
    }

    function onKeydown(e) {
        if (!panelOpen) return;
        // 关闭按钮保留原生 Enter / Space 激活，不触发搜索结果导航。
        if (e.target.closest('button') && ['Enter', ' '].includes(e.key)) return;
        const mod = IS_MAC ? e.metaKey : e.ctrlKey;
        if (!e.target.closest('input, textarea, [contenteditable]') && !mod &&
            [' ', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const r = els.results, step = r.clientHeight * 0.9;
            if (e.key === 'Home') r.scrollTop = 0;
            else if (e.key === 'End') r.scrollTop = r.scrollHeight;
            else r.scrollTop += e.key === 'PageUp' || (e.key === ' ' && e.shiftKey) ? -step : step;
            return;
        }

        // 指令输入框里除了 Esc 什么都不接管：否则回车会直接打开当前选中的那一行
        if (e.target && e.target.classList && e.target.classList.contains('se-fin')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.dispatchEvent(new Event('change'));
            }
            if (e.key !== 'Escape') return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            closePanel();
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveSel(e.key === 'ArrowDown' ? 1 : -1);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const sel = els.results.querySelector('a.se-row.se-sel');
            if (!sel) {
                // 第一次回车落到首条，第二次才打开——避免误触导航
                const first = rows()[0];
                if (first) select(first);
                return;
            }
            if (mod) window.open(sel.href, '_blank');
            else window.location.href = sel.href;
            return;
        }
        if (mod && /^[0-7]$/.test(e.key)) {
            e.preventDefault();
            const n = Number(e.key);
            setType(n === 0 ? null : (TYPES[n - 1] && TYPES[n - 1].key));
        }
    }

    // === 联想下拉里的置顶入口行 ===
    function entryRow(keyword) {
        const row = element('div', 'se-entry suggestion-item');
        // data-index=-1 排除官方联想键盘索引。
        row.dataset.index = '-1';
        row.tabIndex = 0;
        // 分类说明挪到 title 和面板左栏，入口行只留“去哪 + 搜什么 + 怎么按”
        row.title = '在 SearchEncore 中搜索话题、用户、小组、日志、目录、讨论';
        row.innerHTML = `<span class="se-entry-label">SearchEncore</span>
            <span class="se-entry-kw">${esc(keyword)}</span>
            <span class="se-entry-kbd">${MOD_LABEL}K</span>`;
        const open = e => {
            e.preventDefault();
            e.stopPropagation();
            openPanel(keyword || searchInput.value.trim(), null);
        };
        row.addEventListener('click', open);
        row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') open(e);
        });
        // ⇥ 落到入口行不会触发 mouseover，手动补一次，让官方同样把选中项清空
        row.addEventListener('focus', () => {
            row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        return row;
    }

    // 入口行只搭联想下拉的车：下拉何时出现、何时收起，全归宿主脚本管。
    // hasItems 判断宿主当前是否有联想项，mount 把入口行放到合适位置。
    function syncEntry(box, hasItems, mount) {
        if (panelOpen) return;
        const keyword = searchInput.value.trim();
        const existing = box.querySelector('.se-entry');
        if (!hasItems()) {
            if (existing) existing.remove();   // 宿主清空了联想，别留一行孤儿
            return;
        }
        if (existing && existing.dataset.kw === keyword) {
            mount(existing);   // 宿主后续又追加了联想项，把入口行重新挪回末尾
            return;
        }
        if (existing) existing.remove();
        const row = entryRow(keyword);
        row.dataset.kw = keyword;
        mount(row);
    }

    const syncOfficial = () => suggestionsBox && syncEntry(suggestionsBox,
        // 入口行排在官方联想项之后。官方的 ↑↓ 只在 0..currentSuggestions.length-1 里走，
        // 排在末尾的我们永远轮不到，两套导航不会打架（进面板走 ⇥ / 点击 / ⌘K）。
        () => suggestionsBox.querySelector('.suggestion-item:not(.se-entry)'),
        row => { if (row !== suggestionsBox.lastElementChild) suggestionsBox.appendChild(row); });

    // 快速搜索脚本每次用 innerHTML 整体重绘结果列表；入口行放在列表外、盒子底部，
    // 不进它的 li 键盘导航。它给盒子限了高度，有入口行时解除，列表自己仍然限高滚动。
    let observedQuickBox = null;
    const syncQuick = () => {
        const box = quickBox();
        if (!box) return;
        if (box !== observedQuickBox) {
            observedQuickBox = box;
            new MutationObserver(syncQuick).observe(box, { childList: true });
        }
        syncEntry(box,
            () => box.querySelector('ul.ajaxSubjectList li'),
            row => { if (row !== box.lastElementChild) box.appendChild(row); });
        box.classList.toggle('se-has-entry', !!box.querySelector('.se-entry'));
    };

    const syncEntries = () => { syncOfficial(); syncQuick(); };

    if (suggestionsBox) new MutationObserver(syncOfficial).observe(suggestionsBox, { childList: true });
    // 快速搜索脚本可能晚于本脚本运行，等它把下拉挂到 #headerSearch 上
    new MutationObserver(syncQuick).observe(headerSearch, { childList: true });
    syncQuick();
    searchInput.addEventListener('focus', syncEntries);
    searchInput.addEventListener('input', syncEntries);

    // ⇥ 从输入框落到当前可见的入口行（装了快速搜索时官方下拉被 CSS 隐藏，不能只看 style）
    searchInput.addEventListener('keydown', e => {
        if (e.key !== 'Tab' || e.shiftKey) return;
        const row = [...headerSearch.querySelectorAll('.se-entry')].find(r => r.getClientRects().length);
        if (!row) return;
        e.preventDefault();
        row.focus();
    });

    // === 用户主页的 service 行：最近活动 = 这个人最新的全部回复 ===
    // 开关放在「个性化 › 通用」里，存在组件云存储（跟着账号走）；拿不到云存储时只在当前页面生效
    const PROFILE_ENTRY_KEY = 'profileEntry';
    // chiiApp 是站点包在组件代码外层的局部 const（按组件 ID 隔离），不在 window 上；
    // 油猴里根本没有这个标识符，只能用 typeof 探测
    const cloud = typeof chiiApp !== 'undefined' ? chiiApp.cloud_settings || null : null;
    let profileEntryPage = 'on';
    function profileEntryOn() {
        let v = null;
        try { v = cloud?.get(PROFILE_ENTRY_KEY); } catch (_) { /* 云存储不可用 */ }
        return (v === 'on' || v === 'off' ? v : profileEntryPage) !== 'off';
    }
    function setProfileEntry(on) {
        profileEntryPage = on ? 'on' : 'off';
        try {
            if (cloud) { cloud.update({ [PROFILE_ENTRY_KEY]: profileEntryPage }); cloud.save(); }
        } catch (_) { /* 存不上就只在当前页面生效 */ }
        syncProfileEntry();
    }

    const profileUser = /^\/user\/([^/]+)\/?$/.exec(location.pathname);
    const services = profileUser && document.querySelector('#user_home ul.network_service');
    let profileEntry = null;
    function syncProfileEntry() {
        if (!services) return;
        if (!profileEntryOn()) {
            profileEntry?.remove();
            return;
        }
        if (!profileEntry) {
            const username = decodeURIComponent(profileUser[1]);
            profileEntry = document.createElement('li');
            profileEntry.innerHTML = `<span class="service" style="background-color:#369cf8;">SearchEncore</span> <span class="tip"><a href="#" class="l">最近活动</a></span>`;
            profileEntry.querySelector('a').addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                // 写成指令，面板里看得见也改得了；in:all 不受上次选的回复类型影响
                openPanel(`user:${username} sort:newest in:all`, REPLY_TYPE);
            });
        }
        if (!profileEntry.isConnected) services.appendChild(profileEntry);
    }
    syncProfileEntry();

    try {
        window.chiiLib?.ukagaka?.addGeneralConfig({
            title: 'SearchEncore 用户主页「最近活动」',
            name: 'searchEncoreProfileEntry',
            type: 'radio',
            defaultValue: 'on',
            getCurrentValue: () => (profileEntryOn() ? 'on' : 'off'),
            onChange: value => setProfileEntry(value !== 'off'),
            options: [
                { value: 'on', label: '显示' },
                { value: 'off', label: '隐藏' },
            ],
        });
    } catch (_) { /* 旧版站点没有个性化面板接口，入口照常显示 */ }

    // === 全局快捷键：⌘/Ctrl+K ===
    document.addEventListener('keydown', e => {
        const mod = IS_MAC ? e.metaKey : e.ctrlKey;
        if (!mod || e.key.toLowerCase() !== 'k') return;
        e.preventDefault();
        if (panelOpen) { closePanel(); return; }
        openPanel(searchInput.value.trim(), null);
    });

    // === 点击外部关闭面板（官方下拉的收起仍归官方脚本）===
    document.addEventListener('mousedown', e => {
        if (panelOpen && !panel.contains(e.target) && !headerSearch.contains(e.target)) {
            closePanel();
        }
    });

    // === 跟随顶栏位置 ===
    const repositionPanel = () => {
        if (panelMotion) settlePanel();
        if (panelOpen) positionPanel();
    };
    window.addEventListener('resize', repositionPanel, { passive: true });
    window.addEventListener('scroll', repositionPanel, { passive: true });

})();