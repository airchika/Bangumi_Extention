// ==UserScript==
// @name         Shadow
// @homepage     https://bangumi.tv/dev/app/5445
// @author       https://bangumi.tv/user/air_chika
// @include      /^https?:\/\/(?:bgm\.tv|bangumi\.tv|chii\.in)\/(?:(?:group|subject)\/topic\/[^\/?#]+|(?:user|ep|person|character|blog)\/[^\/?#]+)(?:[\/?#].*)?$/
// @include      https://bgm.tv/subject/*
// @include      https://bangumi.tv/subject/*
// @include      https://chii.in/subject/*
// ==/UserScript==
(function () {

    const is_user_profile_page = /^\/user\/[^/]+\/?$/.test(location.pathname)
    const is_subject_page = /^\/subject\/\d+\/?$/.test(location.pathname)
    const is_discussion_page = /^\/(?:group\/topic|subject\/topic|ep|person|character|blog)\/[^/]+/.test(location.pathname)
    const SHADOW_POST_SHORTCUT_SETTING = 'shadow_show_post_shortcut'
    const SHADOW_SUBJECT_IMPORTANT_SETTING = 'shadow_show_subject_important_button'
    const SHADOW_INSTANCE_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    let shadow_post_shortcut_session_value = null
    let shadow_subject_important_session_value = null

    function has_bangumi_cloud_settings() {
        try {
            return typeof chiiApp !== 'undefined' && !!chiiApp?.cloud_settings
        } catch (error) {
            return false
        }
    }

    function should_show_shadow_post_shortcut() {
        if (shadow_post_shortcut_session_value != null) return shadow_post_shortcut_session_value === 'on'
        try {
            if (typeof chiiApp !== 'undefined' && chiiApp?.cloud_settings) {
                return chiiApp.cloud_settings.get(SHADOW_POST_SHORTCUT_SETTING) !== 'off'
            }
        } catch (error) { /* 个性化设置不可用时默认显示 */ }
        return true
    }

    function should_show_subject_important_button() {
        if (shadow_subject_important_session_value != null) return shadow_subject_important_session_value === 'on'
        try {
            if (typeof chiiApp !== 'undefined' && chiiApp?.cloud_settings) {
                return chiiApp.cloud_settings.get(SHADOW_SUBJECT_IMPORTANT_SETTING) !== 'off'
            }
        } catch (error) { /* 个性化设置不可用时默认显示 */ }
        return true
    }

    function register_shadow_settings() {
        let attempts = 0
        const try_register = () => {
            if (typeof chiiLib !== 'undefined' && chiiLib?.ukagaka?.addPanelTab) {
                chiiLib.ukagaka.addPanelTab({
                    tab: 'shadow',
                    label: 'Shadow',
                    type: 'options',
                    config: [{
                        title: '显示帖子楼层 Shadow 快捷入口',
                        name: SHADOW_POST_SHORTCUT_SETTING,
                        type: 'radio',
                        defaultValue: 'on',
                        getCurrentValue: () => should_show_shadow_post_shortcut() ? 'on' : 'off',
                        onChange: value => {
                            shadow_post_shortcut_session_value = value
                            if (typeof chiiApp !== 'undefined' && chiiApp?.cloud_settings) {
                                chiiApp.cloud_settings.update({ [SHADOW_POST_SHORTCUT_SETTING]: value })
                                chiiApp.cloud_settings.save()
                            }
                            window.dispatchEvent(new CustomEvent('shadow-post-shortcut-setting-change', { detail: value }))
                        },
                        options: [{ value: 'on', label: '开启' }, { value: 'off', label: '关闭' }],
                    }, {
                        title: '显示条目页“标为重要”按钮',
                        name: SHADOW_SUBJECT_IMPORTANT_SETTING,
                        type: 'radio',
                        defaultValue: 'on',
                        getCurrentValue: () => should_show_subject_important_button() ? 'on' : 'off',
                        onChange: value => {
                            shadow_subject_important_session_value = value
                            if (typeof chiiApp !== 'undefined' && chiiApp?.cloud_settings) {
                                chiiApp.cloud_settings.update({ [SHADOW_SUBJECT_IMPORTANT_SETTING]: value })
                                chiiApp.cloud_settings.save()
                            }
                            window.dispatchEvent(new CustomEvent('shadow-subject-important-setting-change', { detail: value }))
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

    register_shadow_settings()

    function init_shadow_post_shortcuts() {
        const FLOOR_SELECTOR = 'div[id^="post_"], .postTopic, .sub_reply_bg'

        function username_from_link(anchor) {
            if (!anchor) return ''
            try {
                const match = new URL(anchor.getAttribute('href'), location.origin).pathname.match(/^\/user\/([^/]+)\/?$/)
                return match ? decodeURIComponent(match[1]) : ''
            } catch (error) {
                return ''
            }
        }

        function get_floor_identity(floor) {
            const from_data = floor.dataset.itemUser || floor.getAttribute('data-item-user') || ''
            const author_link = floor.querySelector('a.avatar[href*="/user/"], strong a.l[href*="/user/"], .post_author a[href*="/user/"]')
            const from_link = username_from_link(author_link)
            const username = /^[A-Za-z0-9_]{1,32}$/.test(from_data)
                ? from_data
                : /^[A-Za-z0-9_]{1,32}$/.test(from_link) ? from_link : ''
            const nickname_link = floor.querySelector('strong a.l[href*="/user/"], .post_author a[href*="/user/"]')
            const nickname = nickname_link?.textContent?.trim() || username
            return { username, nickname }
        }

        function update_shortcut_tooltips() {
            document.querySelectorAll('.shadow-post-shortcut-link').forEach(link => {
                const opponent_nickname = link.dataset.opponentNickname || link.dataset.opponentUsername || '对方'
                const tooltip = `用 Shadow 对比我和${opponent_nickname}`
                link.dataset.shadowTooltip = tooltip
                link.setAttribute('aria-label', tooltip)
            })
        }

        function open_shadow_tab(target_href, link) {
            const opened = window.open('about:blank', '_blank')
            if (!opened) {
                link.dataset.shadowTooltip = '浏览器阻止了新标签页，请允许此站点弹出窗口'
                return
            }
            const dark = document.documentElement.dataset.theme === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches
            const background = dark ? '#1f1f1f' : '#f5f5f5'
            const color = dark ? '#aaa' : '#666'
            opened.document.open()
            opened.document.write(`<!doctype html><meta charset="utf-8"><title>Shadow 加载中</title><style>html,body{margin:0;width:100%;height:100%;background:${background};color:${color};font:20px/1.5 sans-serif}body{display:flex;align-items:center;justify-content:center}</style><body>Shadow 加载中…</body>`)
            opened.document.close()
            opened.opener = null
            opened.blur()
            window.focus()

            let finished = false
            let poll = null
            let fallback = null
            const focus_opened = () => {
                if (finished) return
                finished = true
                if (poll) clearInterval(poll)
                if (fallback) clearTimeout(fallback)
                if (!opened.closed) {
                    try { opened.focus() } catch (error) { /* 浏览器可能禁止主动切换标签 */ }
                }
            }
            setTimeout(() => {
                if (opened.closed) return focus_opened()
                opened.location.replace(target_href)
                poll = setInterval(() => {
                    if (opened.closed) return focus_opened()
                    try {
                        if (opened.location.href !== 'about:blank' && opened.document.readyState === 'complete') {
                            setTimeout(focus_opened, 150)
                        }
                    } catch (error) { /* 若浏览器隔离窗口，交给超时兜底 */ }
                }, 100)
                fallback = setTimeout(focus_opened, 5000)
            }, 50)
        }

        function inject_floor_shortcut(floor) {
            if (!should_show_shadow_post_shortcut()) return
            const is_component = has_bangumi_cloud_settings()
            const { username, nickname } = get_floor_identity(floor)
            if (!username) return
            const actions = floor.querySelector('.post_actions.re_info, .post_actions, .re_info')
            if (!actions) return
            const existing_action = actions.querySelector(':scope > .shadow-post-action')
            if (existing_action) {
                // 本地版优先接管快捷入口；官方版不得覆盖已经存在的本地入口。
                const source = is_component ? 'component' : 'local'
                if (existing_action.dataset.shadowOwner === SHADOW_INSTANCE_ID && existing_action.dataset.shadowSource === source) return
                if (existing_action.dataset.shadowOwner !== SHADOW_INSTANCE_ID && (is_component || existing_action.dataset.shadowSource === 'local')) return
                existing_action.remove()
            }

            const target = new URL(`/user/${encodeURIComponent(username)}`, location.origin)
            const action = document.createElement('div')
            action.className = 'action shadow-post-action'
            action.dataset.shadowSource = is_component ? 'component' : 'local'
            action.dataset.shadowOwner = SHADOW_INSTANCE_ID
            const link = document.createElement('button')
            link.type = 'button'
            link.className = 'shadow-post-shortcut-link'
            link.dataset.opponentUsername = username
            link.dataset.opponentNickname = nickname
            link.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor"/><path d="M8 1.5a6.5 6.5 0 0 0 0 13z" fill="currentColor"/></svg>'
            link.addEventListener('click', event => {
                event.preventDefault()
                event.stopPropagation()
                event.stopImmediatePropagation()
                target.search = ''
                target.searchParams.set(has_bangumi_cloud_settings() ? 'shadow' : 'shadow_test', '1')
                open_shadow_tab(target.href, link)
            })
            action.append(link)
            const floor_info = actions.querySelector(':scope > .action')
            if (floor_info) floor_info.after(action)
            else actions.prepend(action)
            update_shortcut_tooltips()
        }

        function inject_all_shortcuts(root = document) {
            if (root instanceof Element && root.matches(FLOOR_SELECTOR)) inject_floor_shortcut(root)
            root.querySelectorAll?.(FLOOR_SELECTOR).forEach(inject_floor_shortcut)
        }

        function start() {
            const style = document.createElement('style')
            style.textContent = `.shadow-post-action .shadow-post-shortcut-link {
                position:relative;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
                padding:0;border:0;color:#888!important;background:transparent;cursor:pointer;font:inherit;text-decoration:none!important;
            }.shadow-post-action .shadow-post-shortcut-link svg { display:block;width:14px;height:14px; }
            .shadow-post-action .shadow-post-shortcut-link:hover { color:var(--primary-color,#F09199)!important; }
            .shadow-post-action .shadow-post-shortcut-link::after {
                content:attr(data-shadow-tooltip);display:none;position:absolute;top:calc(100% + 5px);right:0;z-index:1000;
                width:max-content;max-width:320px;padding:4px 7px;color:#fff;background:rgba(0,0,0,.86);
                border-radius:4px;font-size:12px;font-weight:400;line-height:1.4;white-space:nowrap;pointer-events:none;
            }.shadow-post-action .shadow-post-shortcut-link:hover::after { display:block; }`
            document.head.append(style)
            inject_all_shortcuts()
            ;[250, 1000, 3000].forEach(delay => setTimeout(() => inject_all_shortcuts(), delay))
            window.addEventListener('shadow-post-shortcut-setting-change', event => {
                if (event.detail === 'off') document.querySelectorAll('.shadow-post-action').forEach(action => action.remove())
                else inject_all_shortcuts()
            })
            let scheduled = false
            const observer = new MutationObserver(mutations => {
                if (!mutations.some(mutation => mutation.addedNodes.length)) return
                if (scheduled) return
                scheduled = true
                requestAnimationFrame(() => {
                    scheduled = false
                    inject_all_shortcuts()
                })
            })
            observer.observe(document.body, { childList: true, subtree: true })
        }

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
        else start()
    }

    if (is_discussion_page) {
        init_shadow_post_shortcuts()
        return
    }
    if (!is_user_profile_page && !is_subject_page) return

    const IS_BANGUMI_COMPONENT = has_bangumi_cloud_settings()
    const TITLE = IS_BANGUMI_COMPONENT ? 'Shadow' : 'Shadow(L)'
    const FEEDBACK_URL = 'https://bgm.tv/group/topic/462826'
    const subject_config = {
        0: { name: "全部", id: 0 },
        2: { name: "动画", id: 2 },
        1: { name: "书籍", id: 1 },
        3: { name: "音乐", id: 3 },
        4: { name: "游戏", id: 4 },
        6: { name: "三次元", id: 6 },
    }
    const SUBJECT_TYPE_IDS = [2, 1, 3, 4, 6]

    function normalize_subject_ids(value) {
        const ids = Array.isArray(value) ? value : value === 0 ? SUBJECT_TYPE_IDS : [value]
        const valid = SUBJECT_TYPE_IDS.filter(id => ids.includes(id))
        return valid.length ? valid : [2]
    }

    function get_subject_selection_label(short = false) {
        const ids = analyze_config.subject_ids
        if (ids.length === SUBJECT_TYPE_IDS.length) return '全部类型'
        if (short && ids.length > 2) return `${ids.length}种类型`
        return ids.map(id => subject_config[id].name).join('、')
    }

    const analyze_config = {
        subject_ids: [2],
        score_display: 'raw',
        my_comment_collapsed: true,
        current_sort: 'important',
        my_threshold_low: 4,
        my_threshold_high: 7,
        his_threshold_low: 4,
        his_threshold_high: 7,
    }

    // ─── 本地设置缓存 ───

    const SETTINGS_KEY = '鉴定_settings'
    const CUSTOM_SORTS_LOCAL_KEY = '鉴定_custom_sorts_v2'
    const CUSTOM_SORTS_PENDING_KEY = '鉴定_custom_sorts_pending_v2'
    const CUSTOM_SORTS_CLOUD_KEY = 'bangumi_extension_custom_sorts_v2'
    const DEVICE_ID_KEY = '鉴定_device_id'
    const IMPORTANT_SUBJECTS_KEY = '鉴定_important_subjects_v1'
    const IMPORTANT_SUBJECTS_PENDING_KEY = '鉴定_important_subjects_pending_v1'
    const IMPORTANT_SUBJECTS_CLOUD_KEY = 'bangumi_extension_important_subjects_v1'
    const PRESET_OVERRIDES_KEY = '鉴定_preset_overrides_v1'
    const RECENT_OPPONENTS_KEY = '鉴定_recent_opponents_v1'
    const USER_CACHE_TIMES_KEY = '鉴定_user_cache_times_v1'
    const THRESHOLD_PROFILE_LOCAL_KEY = '鉴定_threshold_profile_v1'
    const THRESHOLD_PROFILE_CLOUD_KEY = 'bangumi_extension_threshold_profile_v1'
    const FRIEND_RATING_LOCAL_KEY = '鉴定_friend_rating_rules_v1'
    const FRIEND_RATING_PENDING_KEY = '鉴定_friend_rating_rules_pending_v1'
    const FRIEND_RATING_CLOUD_KEY = 'bangumi_extension_friend_rating_rules_v1'
    const FRIEND_MATRIX_SORT_MODE_KEY = '鉴定_friend_matrix_sort_mode_v1'
    const FRIEND_MATRIX_SORT_MODES = new Set(['score', 'sample-penalty', 'shrinkage'])
    const DEFAULT_FRIEND_MATRIX_SAMPLE_PENALTY = 30
    const MAX_FRIEND_MATRIX_SAMPLE_PENALTY = 100000
    const DEFAULT_FRIEND_MATRIX_SHRINKAGE_K = 10
    const MAX_FRIEND_MATRIX_SHRINKAGE_K = 100000
    const DEFAULT_FRIEND_MATRIX_SHRINKAGE_MU = 50
    const FIXED_SORT_KEYS = new Set(['important', 'discover_important', 'high_sync', 'low_sync', 'common_new', 'wanted_recommendation'])
    const CUSTOM_FACTOR_IDS = new Set([
        'my_rating', 'his_rating', 'agreement', 'my_conformity', 'his_conformity',
        'public_reputation', 'popularity', 'freshness', 'my_recency', 'his_recency',
        'my_comment', 'his_comment',
    ])
    const CUSTOM_SCOPE_IDS = new Set(['all', 'common_collection', 'common_rated', 'his_collection', 'his_rated'])
    const CUSTOM_SET_MODE_IDS = new Set(['any', 'collected', 'uncollected', 'rated'])
    const CUSTOM_RANGE_IDS = new Set(['public_score', 'collection_total', 'rank', 'subject_date_ts', 'my_comment_chars', 'his_comment_chars'])

    function load_recent_opponents() {
        try {
            const value = JSON.parse(localStorage.getItem(RECENT_OPPONENTS_KEY))
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
        } catch (error) {
            return {}
        }
    }

    const recent_opponents = load_recent_opponents()
    const user_cache_times = (() => {
        try {
            const value = JSON.parse(localStorage.getItem(USER_CACHE_TIMES_KEY))
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
        } catch (error) {
            return {}
        }
    })()

    function mark_opponent_viewed(username) {
        if (!username) return
        recent_opponents[username] = Date.now()
        localStorage.setItem(RECENT_OPPONENTS_KEY, JSON.stringify(recent_opponents))
    }

    function set_user_cache_time(username, time = Date.now()) {
        if (!username) return
        user_cache_times[username] = time
        localStorage.setItem(USER_CACHE_TIMES_KEY, JSON.stringify(user_cache_times))
    }

    function delete_user_cache_time(username) {
        delete user_cache_times[username]
        localStorage.setItem(USER_CACHE_TIMES_KEY, JSON.stringify(user_cache_times))
    }

    function format_cache_time(username) {
        const time = Number(user_cache_times[username])
        if (!time) return '未知'
        const days = Math.max(0, Math.floor((Date.now() - time) / 86400000))
        return days === 0 ? '今天' : `${days}天前`
    }

    function is_valid_set_mode(user, mode) {
        return CUSTOM_SET_MODE_IDS.has(mode) || (user === 'my' && ['important', 'not_important'].includes(mode))
    }

    function parse_important_subject_document(raw, strict = false) {
        try {
            if (raw == null || raw === '') return { schemaVersion: 3, subjects: {} }
            const value = typeof raw === 'string' ? JSON.parse(raw) : raw
            if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
                return { schemaVersion: 3, subjects: {} }
            }
            // 兼容早期仅保存 ID 数组的本地格式
            if (Array.isArray(value)) {
                const subjects = {}
                for (const raw_id of value) {
                    const id = Number(raw_id)
                    if (Number.isInteger(id) && id > 0) subjects[id] = { id, marked: true, updatedAt: 0, deviceId: 'legacy' }
                }
                return { schemaVersion: 3, subjects }
            }
            if (!value || ![1, 2, 3].includes(value.schemaVersion) || !value.subjects || typeof value.subjects !== 'object' || Array.isArray(value.subjects)) {
                if (strict) throw new Error('重要番剧云索引版本不兼容')
                return { schemaVersion: 3, subjects: {} }
            }
            const subjects = {}
            for (const [raw_id, entry] of Object.entries(value.subjects)) {
                const id = Number(raw_id)
                const valid = Number.isInteger(id) && id > 0 && entry && Number(entry.id) === id &&
                    typeof entry.marked === 'boolean' && Number.isFinite(Number(entry.updatedAt)) && typeof entry.deviceId === 'string'
                if (!valid) {
                    if (strict) throw new Error(`重要番剧云索引包含无效条目：${raw_id}`)
                    continue
                }
                subjects[id] = {
                    id,
                    marked: entry.marked,
                    updatedAt: Number(entry.updatedAt),
                    deviceId: entry.deviceId,
                }
            }
            return { schemaVersion: 3, subjects }
        } catch (error) {
            if (strict) throw error
            return { schemaVersion: 3, subjects: {} }
        }
    }

    let important_subject_document = parse_important_subject_document(localStorage.getItem(IMPORTANT_SUBJECTS_KEY))
    const important_subject_ids = new Set()

    function rebuild_important_subject_ids() {
        important_subject_ids.clear()
        for (const entry of Object.values(important_subject_document.subjects)) {
            if (entry.marked) important_subject_ids.add(entry.id)
        }
    }

    rebuild_important_subject_ids()

    function persist_important_subjects() {
        localStorage.setItem(IMPORTANT_SUBJECTS_KEY, JSON.stringify(important_subject_document))
    }

    persist_important_subjects()

    function load_preset_overrides() {
        try {
            const value = JSON.parse(localStorage.getItem(PRESET_OVERRIDES_KEY))
            if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
            return Object.fromEntries(Object.entries(value).filter(([key, rule]) => FIXED_SORT_KEYS.has(key) && rule && typeof rule === 'object'))
        } catch (error) {
            return {}
        }
    }

    const preset_rule_overrides = load_preset_overrides()

    function persist_preset_overrides() {
        const now = Date.now()
        const stored = custom_sort_document.presetOverrides || {}
        for (const key of FIXED_SORT_KEYS) {
            const active = preset_rule_overrides[key]
            const existing = stored[key]
            if (active) {
                stored[key] = { ...active, updatedAt: now, deletedAt: null, deviceId: device_id }
                preset_rule_overrides[key] = stored[key]
            } else if (existing && !existing.deletedAt) {
                stored[key] = { ...existing, updatedAt: now, deletedAt: now, deviceId: device_id }
            }
        }
        custom_sort_document.presetOverrides = stored
        localStorage.setItem(PRESET_OVERRIDES_KEY, JSON.stringify(preset_rule_overrides))
        persist_custom_sort_document()
        schedule_custom_sort_sync()
    }

    function load_settings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
            if (saved) {
                if (saved.score_display === 'raw' || saved.score_display === 'hidden') analyze_config.score_display = saved.score_display
                if (typeof saved.my_comment_collapsed === 'boolean') analyze_config.my_comment_collapsed = saved.my_comment_collapsed
                if (Array.isArray(saved.subject_ids)) analyze_config.subject_ids = normalize_subject_ids(saved.subject_ids)
                else if (typeof saved.cur_subject_id === 'number') analyze_config.subject_ids = normalize_subject_ids(saved.cur_subject_id)
            }
        } catch (e) { /* ignore */ }
    }

    function save_settings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            score_display: analyze_config.score_display,
            my_comment_collapsed: analyze_config.my_comment_collapsed,
            subject_ids: analyze_config.subject_ids,
        }))
    }

    load_settings()

    function get_device_id() {
        let id = localStorage.getItem(DEVICE_ID_KEY)
        if (!id) {
            id = typeof crypto?.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
            localStorage.setItem(DEVICE_ID_KEY, id)
        }
        return id
    }

    const device_id = get_device_id()

    const FRIEND_RULE_IDS = ['important-all', 'important-high', 'important-low', 'rated-all']
    const FRIEND_TIERS = ['low', 'medium', 'high']
    const FRIEND_STATUSES = [2, 3, 4, 5]
    const FRIEND_LEGACY_STATUSES = [1, 2, 3, 4, 5]
    const FRIEND_CONFIDENCE_BACKGROUND_RGB = '0,68,255'
    const FRIEND_CONFIDENCE_ALPHA_AT_50 = 0.4
    const FRIEND_CONFIDENCE_ALPHA_AT_99 = 0.1

    function default_friend_filters(tiers = FRIEND_TIERS) {
        return {
            my_tiers: [...tiers], his_tiers: [...tiers],
            my_statuses: [...FRIEND_STATUSES], his_statuses: [...FRIEND_STATUSES],
        }
    }

    function default_friend_confidence_target(scope) {
        return scope === 'important_rated' ? 20 : 50
    }

    function normalize_friend_confidence_target(value, scope) {
        const target = Number(value)
        return Number.isInteger(target) && target >= 1 && target <= 10000
            ? target
            : default_friend_confidence_target(scope)
    }

    function make_builtin_friend_rule(id, name, overrides = {}) {
        const rule = {
            id, name, subject_ids: [2], scope: 'important_rated', standardScope: 'all_rated',
            cutoffDate: '2000-01-01', filters: default_friend_filters(),
            display: { cosine: true, variance: false, confidence: true },
            updatedAt: 0, deviceId: 'builtin',
            ...overrides,
        }
        rule.confidenceTarget = normalize_friend_confidence_target(overrides.confidenceTarget, rule.scope)
        return rule
    }

    function create_builtin_friend_rules() {
        return {
            'important-all': make_builtin_friend_rule('important-all', '重要番剧评级'),
            'important-high': make_builtin_friend_rule('important-high', '重要番剧好评评级', {
                filters: { ...default_friend_filters(), my_tiers: ['high'] },
            }),
            'important-low': make_builtin_friend_rule('important-low', '重要番剧差评评级', {
                filters: { ...default_friend_filters(), my_tiers: ['low'] },
            }),
            'rated-all': make_builtin_friend_rule('rated-all', '全部评分评级', { scope: 'rated_intersection' }),
        }
    }

    const BUILTIN_FRIEND_RULES = create_builtin_friend_rules()

    function normalize_friend_matrix_sample_penalty(value) {
        const penalty = Number(value)
        return Number.isFinite(penalty) && penalty >= 0 && penalty <= MAX_FRIEND_MATRIX_SAMPLE_PENALTY
            ? penalty
            : DEFAULT_FRIEND_MATRIX_SAMPLE_PENALTY
    }

    function normalize_friend_matrix_shrinkage_k(value) {
        const k = Number(value)
        return Number.isInteger(k) && k >= 1 && k <= MAX_FRIEND_MATRIX_SHRINKAGE_K
            ? k
            : DEFAULT_FRIEND_MATRIX_SHRINKAGE_K
    }

    function normalize_friend_matrix_shrinkage_mu(value) {
        const mu = Number(value)
        return Number.isFinite(mu) && mu >= 0 && mu <= 100
            ? mu
            : DEFAULT_FRIEND_MATRIX_SHRINKAGE_MU
    }

    function new_friend_matrix_settings() {
        return {
            samplePenalty: DEFAULT_FRIEND_MATRIX_SAMPLE_PENALTY,
            shrinkageK: DEFAULT_FRIEND_MATRIX_SHRINKAGE_K,
            shrinkageMu: DEFAULT_FRIEND_MATRIX_SHRINKAGE_MU,
            updatedAt: 0,
            deviceId: 'builtin',
        }
    }

    function new_friend_rating_document() {
        return {
            schemaVersion: 2,
            defaultRule: { id: 'important-all', updatedAt: 0, deviceId: 'builtin' },
            matrixSettings: new_friend_matrix_settings(),
            rules: JSON.parse(JSON.stringify(BUILTIN_FRIEND_RULES)),
        }
    }

    function parse_friend_rating_document(raw, strict = false) {
        if (raw == null || raw === '') return new_friend_rating_document()
        let value = raw
        try {
            if (typeof value === 'string') value = JSON.parse(value)
        } catch (error) {
            if (strict) throw new Error('好友评级规则不是有效 JSON')
            return new_friend_rating_document()
        }
        if (!value || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) || value.schemaVersion === 1) {
            return new_friend_rating_document()
        }
        const valid_list = (list, allowed) => Array.isArray(list) && list.length > 0 &&
            list.every(item => allowed.includes(typeof allowed[0] === 'number' ? Number(item) : item)) && new Set(list.map(String)).size === list.length
        const valid_rule = (id, rule) => rule && rule.id === id && FRIEND_RULE_IDS.includes(id) &&
            typeof rule.name === 'string' && rule.name.trim() && rule.name.length <= 30 &&
            valid_list(rule.subject_ids, SUBJECT_TYPE_IDS) && ['important_rated', 'rated_intersection'].includes(rule.scope) &&
            ['all_rated', 'filtered'].includes(rule.standardScope) && /^\d{4}-\d{2}-\d{2}$/.test(rule.cutoffDate) && !Number.isNaN(Date.parse(rule.cutoffDate)) &&
            rule.filters && ['my', 'his'].every(user => valid_list(rule.filters[`${user}_tiers`], FRIEND_TIERS) &&
                valid_list(rule.filters[`${user}_statuses`], FRIEND_LEGACY_STATUSES)) &&
            rule.display && ['cosine', 'variance', 'confidence'].every(key => typeof rule.display[key] === 'boolean') &&
            (rule.confidenceTarget == null || (Number.isInteger(Number(rule.confidenceTarget)) && Number(rule.confidenceTarget) >= 1 && Number(rule.confidenceTarget) <= 10000)) &&
            Number.isFinite(Number(rule.updatedAt || 0)) && typeof rule.deviceId === 'string'
        if (value.schemaVersion !== 2 || !value.rules || typeof value.rules !== 'object' || Array.isArray(value.rules) ||
            !value.defaultRule || !FRIEND_RULE_IDS.includes(value.defaultRule.id) ||
            !Number.isFinite(Number(value.defaultRule.updatedAt || 0)) || typeof value.defaultRule.deviceId !== 'string') {
            if (strict) throw new Error('好友评级规则版本不兼容')
            return new_friend_rating_document()
        }
        const rules = {}
        for (const id of FRIEND_RULE_IDS) {
            const rule = value.rules[id]
            if (!valid_rule(id, rule)) {
                if (strict) throw new Error(`好友评级包含无效栏位：${id}`)
                return new_friend_rating_document()
            }
            rules[id] = {
                ...rule,
                subject_ids: rule.subject_ids.map(Number),
                confidenceTarget: normalize_friend_confidence_target(rule.confidenceTarget, rule.scope),
                filters: {
                    my_tiers: [...rule.filters.my_tiers], his_tiers: [...rule.filters.his_tiers],
                    my_statuses: rule.filters.my_statuses.map(Number).filter(status => FRIEND_STATUSES.includes(status)),
                    his_statuses: rule.filters.his_statuses.map(Number).filter(status => FRIEND_STATUSES.includes(status)),
                },
            }
            for (const user of ['my', 'his']) {
                if (!rules[id].filters[`${user}_statuses`].length) rules[id].filters[`${user}_statuses`] = [...FRIEND_STATUSES]
            }
            // 修正早期默认：好评/差评栏只限制我的档位，对方保持好中差全选。
            const old_default_tier = id === 'important-high' ? 'high' : id === 'important-low' ? 'low' : null
            if (old_default_tier && rules[id].filters.my_tiers.length === 1 && rules[id].filters.my_tiers[0] === old_default_tier &&
                rules[id].filters.his_tiers.length === 1 && rules[id].filters.his_tiers[0] === old_default_tier) {
                rules[id].filters.his_tiers = [...FRIEND_TIERS]
            }
        }
        let matrixSettings = new_friend_matrix_settings()
        if (value.matrixSettings != null) {
            const valid_matrix_settings = typeof value.matrixSettings === 'object' && !Array.isArray(value.matrixSettings) &&
                typeof value.matrixSettings.samplePenalty === 'number' && Number.isFinite(value.matrixSettings.samplePenalty) &&
                value.matrixSettings.samplePenalty >= 0 && value.matrixSettings.samplePenalty <= MAX_FRIEND_MATRIX_SAMPLE_PENALTY &&
                (value.matrixSettings.shrinkageK == null || (Number.isInteger(value.matrixSettings.shrinkageK) &&
                    value.matrixSettings.shrinkageK >= 1 && value.matrixSettings.shrinkageK <= MAX_FRIEND_MATRIX_SHRINKAGE_K)) &&
                (value.matrixSettings.shrinkageMu == null || (typeof value.matrixSettings.shrinkageMu === 'number' &&
                    Number.isFinite(value.matrixSettings.shrinkageMu) && value.matrixSettings.shrinkageMu >= 0 && value.matrixSettings.shrinkageMu <= 100)) &&
                Number.isFinite(Number(value.matrixSettings.updatedAt || 0)) && typeof value.matrixSettings.deviceId === 'string'
            if (!valid_matrix_settings) {
                if (strict) throw new Error('好友评级矩阵设置无效')
            } else {
                matrixSettings = {
                    samplePenalty: normalize_friend_matrix_sample_penalty(value.matrixSettings.samplePenalty),
                    shrinkageK: normalize_friend_matrix_shrinkage_k(value.matrixSettings.shrinkageK),
                    shrinkageMu: normalize_friend_matrix_shrinkage_mu(value.matrixSettings.shrinkageMu),
                    updatedAt: Number(value.matrixSettings.updatedAt || 0),
                    deviceId: value.matrixSettings.deviceId,
                }
            }
        }
        return { schemaVersion: 2, defaultRule: value.defaultRule, matrixSettings, rules }
    }

    let friend_rating_document = parse_friend_rating_document(localStorage.getItem(FRIEND_RATING_LOCAL_KEY))
    let friend_rating_sync_timer = null

    function persist_friend_rating_document() {
        localStorage.setItem(FRIEND_RATING_LOCAL_KEY, JSON.stringify(friend_rating_document))
    }

    persist_friend_rating_document()

    function get_active_friend_rules() {
        return FRIEND_RULE_IDS.map(id => friend_rating_document.rules[id])
    }

    function get_default_friend_rule() {
        const selected = friend_rating_document.rules[friend_rating_document.defaultRule.id]
        return selected || friend_rating_document.rules[FRIEND_RULE_IDS[0]]
    }

    function get_friend_matrix_sample_penalty() {
        return normalize_friend_matrix_sample_penalty(friend_rating_document.matrixSettings?.samplePenalty)
    }

    function get_friend_matrix_shrinkage_k() {
        return normalize_friend_matrix_shrinkage_k(friend_rating_document.matrixSettings?.shrinkageK)
    }

    function get_friend_matrix_shrinkage_mu() {
        return normalize_friend_matrix_shrinkage_mu(friend_rating_document.matrixSettings?.shrinkageMu)
    }

    function set_friend_matrix_sample_penalty(value) {
        friend_rating_document.matrixSettings = {
            ...friend_rating_document.matrixSettings,
            samplePenalty: normalize_friend_matrix_sample_penalty(value),
            updatedAt: Date.now(),
            deviceId: device_id,
        }
        persist_friend_rating_document()
        schedule_friend_rating_sync()
    }

    function set_friend_matrix_shrinkage_k(value) {
        friend_rating_document.matrixSettings = {
            ...friend_rating_document.matrixSettings,
            shrinkageK: normalize_friend_matrix_shrinkage_k(value),
            updatedAt: Date.now(),
            deviceId: device_id,
        }
        persist_friend_rating_document()
        schedule_friend_rating_sync()
    }

    function set_friend_matrix_shrinkage_mu(value) {
        friend_rating_document.matrixSettings = {
            ...friend_rating_document.matrixSettings,
            shrinkageMu: normalize_friend_matrix_shrinkage_mu(value),
            updatedAt: Date.now(),
            deviceId: device_id,
        }
        persist_friend_rating_document()
        schedule_friend_rating_sync()
    }

    function refresh_friend_rating_ui() {
        if (typeof window.__鉴定_refresh_friend_rating === 'function') window.__鉴定_refresh_friend_rating()
    }

    function schedule_friend_rating_sync() {
        localStorage.setItem(FRIEND_RATING_PENDING_KEY, '1')
        set_cloud_sync_status('pending')
        clearTimeout(friend_rating_sync_timer)
        friend_rating_sync_timer = setTimeout(sync_friend_rating_rules, 800)
    }

    function put_friend_rule(rule) {
        if (!FRIEND_RULE_IDS.includes(rule.id)) return null
        const now = Date.now()
        const id = rule.id
        friend_rating_document.rules[id] = { ...rule, id, updatedAt: now, deviceId: device_id }
        persist_friend_rating_document()
        schedule_friend_rating_sync()
        refresh_friend_rating_ui()
        return friend_rating_document.rules[id]
    }

    function set_default_friend_rule(id) {
        if (!friend_rating_document.rules[id]) return
        friend_rating_document.defaultRule = { id, updatedAt: Date.now(), deviceId: device_id }
        persist_friend_rating_document()
        schedule_friend_rating_sync()
        refresh_friend_rating_ui()
    }

    function restore_builtin_friend_rule(id) {
        const builtin = BUILTIN_FRIEND_RULES[id]
        if (!builtin) return null
        return put_friend_rule({ ...JSON.parse(JSON.stringify(builtin)), id })
    }

    function parse_threshold_profile(raw) {
        try {
            const value = typeof raw === 'string' ? JSON.parse(raw) : raw
            const ratios = value?.ratios
            if (!ratios || !['low', 'medium', 'high'].every(key => Number.isFinite(Number(ratios[key])) && Number(ratios[key]) >= 0)) return null
            const total = Number(ratios.low) + Number(ratios.medium) + Number(ratios.high)
            if (total <= 0) return null
            return {
                ratios: { low: Number(ratios.low) / total, medium: Number(ratios.medium) / total, high: Number(ratios.high) / total },
                updatedAt: Number(value.updatedAt || 0),
                deviceId: String(value.deviceId || ''),
            }
        } catch (error) {
            return null
        }
    }

    let threshold_profile = parse_threshold_profile(localStorage.getItem(THRESHOLD_PROFILE_LOCAL_KEY))
    let threshold_profile_timer = null

    async function sync_threshold_profile() {
        if (!IS_BANGUMI_COMPONENT) return false
        try {
            const cloud_profile = parse_threshold_profile(chiiApp.cloud_settings.get(THRESHOLD_PROFILE_CLOUD_KEY))
            if (cloud_profile && (!threshold_profile || compare_rule_version(cloud_profile, threshold_profile) > 0)) {
                threshold_profile = cloud_profile
                localStorage.setItem(THRESHOLD_PROFILE_LOCAL_KEY, JSON.stringify(threshold_profile))
            }
            if (threshold_profile && (!cloud_profile || compare_rule_version(threshold_profile, cloud_profile) > 0)) {
                chiiApp.cloud_settings.update({ [THRESHOLD_PROFILE_CLOUD_KEY]: JSON.stringify(threshold_profile) })
                await Promise.resolve(chiiApp.cloud_settings.save())
            }
            refresh_friend_rating_ui()
            return true
        } catch (error) {
            return false
        }
    }

    function save_threshold_profile(ratios) {
        threshold_profile = { ratios, updatedAt: Date.now(), deviceId: device_id }
        localStorage.setItem(THRESHOLD_PROFILE_LOCAL_KEY, JSON.stringify(threshold_profile))
        refresh_friend_rating_ui()
        clearTimeout(threshold_profile_timer)
        threshold_profile_timer = setTimeout(sync_threshold_profile, 800)
    }
    let custom_sort_document = { schemaVersion: 5, rules: {}, presetOverrides: {} }
    let custom_sort_data_error = ''
    let cloud_sync_status = 'local'
    let cloud_sync_error = ''
    let cloud_sync_timer = null
    let important_sync_timer = null

    function parse_custom_sort_document(raw, strict = false) {
        if (raw == null || raw === '') return { schemaVersion: 5, rules: {}, presetOverrides: {} }
        let value = raw
        try {
            if (typeof value === 'string') value = JSON.parse(value)
        } catch (error) {
            if (strict) throw new Error('云端自定义规则不是有效 JSON')
            custom_sort_data_error = '本地规则不是有效 JSON，请使用“重置云端数据”'
            return { schemaVersion: 5, rules: {}, presetOverrides: {} }
        }
        if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
            return { schemaVersion: 5, rules: {}, presetOverrides: {} }
        }
        if (!value || ![4, 5].includes(value.schemaVersion) || !value.rules || typeof value.rules !== 'object' || Array.isArray(value.rules)) {
            if (strict) throw new Error('规则版本不兼容，请重置规则数据')
            custom_sort_data_error = '检测到不兼容规则数据，请使用“重置云端数据”'
            return { schemaVersion: 5, rules: {}, presetOverrides: {} }
        }
        const valid_filters = filters => {
            filters = filters || {}
            const valid_tiers = user => Array.isArray(filters[`${user}_tiers`]) && filters[`${user}_tiers`].every(tier => ['unrated', 'low', 'medium', 'high'].includes(tier))
            const valid_types = user => Array.isArray(filters[`${user}_types`]) && filters[`${user}_types`].every(type => [1, 2, 3, 4, 5].includes(Number(type)))
            const valid_comments = ['my', 'his'].every(user => ['any', 'has', 'empty'].includes(filters[`${user}_comment`]))
            const valid_ranges = !filters.ranges || (typeof filters.ranges === 'object' && !Array.isArray(filters.ranges) &&
                Object.entries(filters.ranges).every(([field, bounds]) => CUSTOM_RANGE_IDS.has(field) && bounds && typeof bounds === 'object'))
            return valid_tiers('my') && valid_tiers('his') && valid_types('my') && valid_types('his') && valid_comments && valid_ranges
        }
        const valid_section = section => {
            const valid_factors = Array.isArray(section?.factors) && section.factors.every(factor =>
                factor && CUSTOM_FACTOR_IDS.has(factor.id) && ['positive', 'negative'].includes(factor.direction) && [1, 2, 3].includes(Number(factor.weight))
            ) && new Set(section.factors.map(factor => factor.id)).size === section.factors.length
            return section && /^[A-Za-z0-9_-]{1,80}$/.test(section.id) &&
                typeof section.name === 'string' && section.name.trim() && section.name.length <= 30 &&
                (section.description == null || (typeof section.description === 'string' && section.description.length <= 300)) &&
                (section.limit == null || (Number.isInteger(section.limit) && section.limit > 0 && section.limit <= 9999)) &&
                (section.claimMatches == null || typeof section.claimMatches === 'boolean') &&
                ['normal', 'muted'].includes(section.appearance) &&
                section.sets && ['my', 'his'].every(user => is_valid_set_mode(user, section.sets[user])) &&
                ['raw', 'hidden'].includes(section.scoreMode) && typeof section.missingScoreAsZero === 'boolean' &&
                valid_filters(section.filters) && valid_factors
        }
        const valid_rule = rule => rule && typeof rule.name === 'string' && rule.name.trim() && rule.name.length <= 30 &&
            (rule.description == null || (typeof rule.description === 'string' && rule.description.length <= 300)) &&
            Array.isArray(rule.sections) && rule.sections.length > 0 && rule.sections.every(valid_section) &&
            new Set(rule.sections.map(section => section.id)).size === rule.sections.length
        const rules = {}
        for (const [id, rule] of Object.entries(value.rules)) {
            const valid = /^[A-Za-z0-9_-]{1,80}$/.test(id) && rule?.id === id && valid_rule(rule)
            if (!valid) {
                if (strict) throw new Error(`云端包含无效规则：${id}`)
                custom_sort_data_error = `本地包含无效规则：${id}`
                continue
            }
            rules[id] = rule
        }
        const presetOverrides = {}
        for (const [key, rule] of Object.entries(value.schemaVersion === 5 ? value.presetOverrides || {} : {})) {
            const valid = FIXED_SORT_KEYS.has(key) && rule && Number.isFinite(Number(rule.updatedAt || 0)) &&
                typeof rule.deviceId === 'string' && (rule.deletedAt ? Number.isFinite(Number(rule.deletedAt)) : valid_rule(rule))
            if (!valid) {
                if (strict) throw new Error(`分类规则包含无效内置覆盖：${key}`)
                custom_sort_data_error = `本地包含无效内置覆盖：${key}`
                continue
            }
            presetOverrides[key] = rule
        }
        return { schemaVersion: 5, rules, presetOverrides }
    }

    function load_local_custom_sorts() {
        custom_sort_document = parse_custom_sort_document(localStorage.getItem(CUSTOM_SORTS_LOCAL_KEY))
        if (!Object.keys(custom_sort_document.presetOverrides).length) {
            for (const [key, rule] of Object.entries(preset_rule_overrides)) {
                custom_sort_document.presetOverrides[key] = { ...rule, updatedAt: 0, deletedAt: null, deviceId: 'legacy' }
            }
        }
        for (const key of Object.keys(preset_rule_overrides)) delete preset_rule_overrides[key]
        for (const [key, rule] of Object.entries(custom_sort_document.presetOverrides)) {
            if (!rule.deletedAt) preset_rule_overrides[key] = rule
        }
        localStorage.setItem(PRESET_OVERRIDES_KEY, JSON.stringify(preset_rule_overrides))
        persist_custom_sort_document()
        const active_id = analyze_config.current_sort.startsWith('custom:')
            ? analyze_config.current_sort.slice('custom:'.length)
            : null
        if (!FIXED_SORT_KEYS.has(analyze_config.current_sort) && (!active_id || !custom_sort_document.rules[active_id] || custom_sort_document.rules[active_id].deletedAt)) {
            analyze_config.current_sort = 'important'
            save_settings()
        }
    }

    function persist_custom_sort_document() {
        localStorage.setItem(CUSTOM_SORTS_LOCAL_KEY, JSON.stringify(custom_sort_document))
    }

    function compare_rule_version(a, b) {
        const time_diff = Number(a?.updatedAt || 0) - Number(b?.updatedAt || 0)
        if (time_diff !== 0) return time_diff
        return String(a?.deviceId || '').localeCompare(String(b?.deviceId || ''))
    }

    function merge_important_subject_documents(local_doc, cloud_doc) {
        const subjects = { ...local_doc.subjects }
        for (const [id, cloud_entry] of Object.entries(cloud_doc.subjects)) {
            const local_entry = subjects[id]
            if (!local_entry || compare_rule_version(cloud_entry, local_entry) > 0) subjects[id] = cloud_entry
        }
        return { schemaVersion: 3, subjects }
    }

    function merge_friend_rating_documents(local_doc, cloud_doc) {
        const rules = { ...local_doc.rules }
        for (const id of FRIEND_RULE_IDS) {
            const cloud_rule = cloud_doc.rules[id]
            const local_rule = rules[id]
            if (!local_rule || compare_rule_version(cloud_rule, local_rule) > 0) rules[id] = cloud_rule
        }
        const defaultRule = compare_rule_version(cloud_doc.defaultRule, local_doc.defaultRule) > 0
            ? cloud_doc.defaultRule : local_doc.defaultRule
        const matrixSettings = compare_rule_version(cloud_doc.matrixSettings, local_doc.matrixSettings) > 0
            ? cloud_doc.matrixSettings : local_doc.matrixSettings
        return { schemaVersion: 2, defaultRule, matrixSettings, rules }
    }

    async function sync_friend_rating_rules() {
        if (!IS_BANGUMI_COMPONENT) return false
        try {
            const cloud_raw = chiiApp.cloud_settings.get(FRIEND_RATING_CLOUD_KEY)
            const cloud_doc = parse_friend_rating_document(cloud_raw, true)
            let cloud_value = cloud_raw
            let cloud_schema = null
            try {
                cloud_value = typeof cloud_raw === 'string' ? JSON.parse(cloud_raw) : cloud_raw
                cloud_schema = cloud_value?.schemaVersion
            }
            catch (error) { /* 严格解析会在上方报告格式错误 */ }
            const merged = merge_friend_rating_documents(friend_rating_document, cloud_doc)
            const merged_json = JSON.stringify(merged)
            friend_rating_document = merged
            persist_friend_rating_document()
            if (cloud_schema !== 2 || JSON.stringify(cloud_value) !== merged_json) {
                chiiApp.cloud_settings.update({ [FRIEND_RATING_CLOUD_KEY]: merged_json })
                await Promise.resolve(chiiApp.cloud_settings.save())
            }
            localStorage.removeItem(FRIEND_RATING_PENDING_KEY)
            const pending = localStorage.getItem(CUSTOM_SORTS_PENDING_KEY) || localStorage.getItem(IMPORTANT_SUBJECTS_PENDING_KEY)
            set_cloud_sync_status(pending ? 'pending' : 'synced')
            refresh_friend_rating_ui()
            return true
        } catch (error) {
            localStorage.setItem(FRIEND_RATING_PENDING_KEY, '1')
            set_cloud_sync_status('error', `好友评级规则同步失败：${error.message || error}`)
            return false
        }
    }

    function refresh_important_subject_ui() {
        if (typeof window.__鉴定_refresh_current_list === 'function') window.__鉴定_refresh_current_list()
        if (typeof window.__shadow_refresh_subject_marker === 'function') window.__shadow_refresh_subject_marker()
    }

    async function sync_important_subjects() {
        if (!IS_BANGUMI_COMPONENT) return false
        try {
            const cloud_raw = chiiApp.cloud_settings.get(IMPORTANT_SUBJECTS_CLOUD_KEY)
            const cloud_doc = parse_important_subject_document(cloud_raw, true)
            let cloud_schema = null
            try {
                const cloud_value = typeof cloud_raw === 'string' ? JSON.parse(cloud_raw) : cloud_raw
                cloud_schema = cloud_value?.schemaVersion
            } catch (error) { /* 严格解析会在上方报告格式错误 */ }
            const merged = merge_important_subject_documents(important_subject_document, cloud_doc)
            const merged_json = JSON.stringify(merged)
            important_subject_document = merged
            rebuild_important_subject_ids()
            persist_important_subjects()
            if (cloud_schema !== 3 || JSON.stringify(cloud_doc) !== merged_json) {
                chiiApp.cloud_settings.update({ [IMPORTANT_SUBJECTS_CLOUD_KEY]: merged_json })
                await Promise.resolve(chiiApp.cloud_settings.save())
            }
            localStorage.removeItem(IMPORTANT_SUBJECTS_PENDING_KEY)
            if (!localStorage.getItem(CUSTOM_SORTS_PENDING_KEY) && !localStorage.getItem(FRIEND_RATING_PENDING_KEY)) set_cloud_sync_status('synced')
            refresh_important_subject_ui()
            refresh_friend_rating_ui()
            return true
        } catch (error) {
            localStorage.setItem(IMPORTANT_SUBJECTS_PENDING_KEY, '1')
            set_cloud_sync_status('error', `重要番剧索引同步失败：${error.message || error}`)
            return false
        }
    }

    function schedule_important_subject_sync() {
        localStorage.setItem(IMPORTANT_SUBJECTS_PENDING_KEY, '1')
        set_cloud_sync_status('pending')
        clearTimeout(important_sync_timer)
        important_sync_timer = setTimeout(sync_important_subjects, 800)
    }

    function set_important_subject_marked(subject_id, marked) {
        const id = Number(subject_id)
        if (!Number.isInteger(id) || id <= 0) return
        important_subject_document.subjects[id] = {
            id,
            marked: !!marked,
            updatedAt: Date.now(),
            deviceId: device_id,
        }
        rebuild_important_subject_ids()
        persist_important_subjects()
        schedule_important_subject_sync()
        refresh_important_subject_ui()
        refresh_friend_rating_ui()
    }

    function init_subject_important_marker() {
        const match = location.pathname.match(/^\/subject\/(\d+)\/?$/)
        const subject_id = Number(match?.[1])
        if (!Number.isInteger(subject_id) || subject_id <= 0) return

        if (!document.getElementById('shadow-subject-important-style')) {
            const style = document.createElement('style')
            style.id = 'shadow-subject-important-style'
            style.textContent = `
                #panelInterestWrapper h2.shadow-important-heading { display:flex;align-items:center;gap:8px; }
                #panelInterestWrapper h2.shadow-important-heading .shadow-subject-important-button {
                    margin-left:auto;padding:3px 10px;border:1px solid rgba(127,127,127,.5);border-radius:15px;
                    color:inherit;background:transparent;font:inherit;font-size:12px;line-height:1.5;
                    cursor:pointer;white-space:nowrap;transition:border-color .15s,background .15s,color .15s;
                }
                #panelInterestWrapper h2.shadow-important-heading .shadow-subject-important-button:hover,
                #panelInterestWrapper h2.shadow-important-heading .shadow-subject-important-button:focus-visible {
                    border-color:rgba(127,127,127,.8);background:rgba(127,127,127,.12);outline:none;
                }
                #panelInterestWrapper h2.shadow-important-heading .shadow-subject-important-button.is-important {
                    color:#8a6200;border-color:rgba(196,143,0,.72);background:rgba(242,183,5,.2);
                }
                #panelInterestWrapper h2.shadow-important-heading .shadow-subject-important-button.is-important:hover,
                #panelInterestWrapper h2.shadow-important-heading .shadow-subject-important-button.is-important:focus-visible {
                    border-color:#d39b00;color:#6f4f00;background:rgba(242,183,5,.32);
                }
                html[data-theme=dark] #panelInterestWrapper h2.shadow-important-heading .shadow-subject-important-button.is-important {
                    color:#f1c94b;border-color:rgba(242,183,5,.72);background:rgba(242,183,5,.16);
                }
                @media (max-width:600px) {
                    #panelInterestWrapper h2.shadow-important-heading .shadow-subject-important-button { padding:2px 7px;font-size:11px; }
                }`
            document.head.append(style)
        }

        const update_button = () => {
            const button = document.querySelector('.shadow-subject-important-button')
            if (!button) return
            const marked = important_subject_ids.has(subject_id)
            button.textContent = marked ? '重要' : '标为重要'
            button.title = marked ? '从重要番剧中移除' : '标记为重要番剧'
            button.setAttribute('aria-pressed', marked ? 'true' : 'false')
            button.classList.toggle('is-important', marked)
        }
        const ensure_button = () => {
            const heading = document.querySelector('#panelInterestWrapper h2')
            if (!heading) return
            if (!should_show_subject_important_button()) {
                heading.querySelector('.shadow-subject-important-button')?.remove()
                heading.classList.remove('shadow-important-heading')
                return
            }
            heading.classList.add('shadow-important-heading')
            let button = heading.querySelector('.shadow-subject-important-button')
            if (!button) {
                button = document.createElement('button')
                button.type = 'button'
                button.className = 'shadow-subject-important-button'
                button.addEventListener('click', () => {
                    set_important_subject_marked(subject_id, !important_subject_ids.has(subject_id))
                })
                heading.append(button)
            }
            update_button()
        }

        window.__shadow_refresh_subject_marker = ensure_button
        window.addEventListener('shadow-subject-important-setting-change', ensure_button)
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
        const start = () => {
            ensure_button()
            observer.observe(document.body, { childList: true, subtree: true })
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
        else start()
    }

    if (is_subject_page) {
        init_subject_important_marker()
        sync_important_subjects()
        return
    }

    function merge_custom_sort_documents(local_doc, cloud_doc) {
        const rules = { ...local_doc.rules }
        for (const [id, cloud_rule] of Object.entries(cloud_doc.rules)) {
            const local_rule = rules[id]
            if (!local_rule || compare_rule_version(cloud_rule, local_rule) > 0) rules[id] = cloud_rule
        }
        const presetOverrides = { ...local_doc.presetOverrides }
        for (const [key, cloud_rule] of Object.entries(cloud_doc.presetOverrides)) {
            const local_rule = presetOverrides[key]
            if (!local_rule || compare_rule_version(cloud_rule, local_rule) > 0) presetOverrides[key] = cloud_rule
        }
        return { schemaVersion: 5, rules, presetOverrides }
    }

    function apply_preset_overrides_from_document() {
        for (const key of Object.keys(preset_rule_overrides)) delete preset_rule_overrides[key]
        for (const [key, rule] of Object.entries(custom_sort_document.presetOverrides || {})) {
            if (!rule.deletedAt) preset_rule_overrides[key] = rule
        }
        localStorage.setItem(PRESET_OVERRIDES_KEY, JSON.stringify(preset_rule_overrides))
    }

    function get_active_custom_rules() {
        return Object.values(custom_sort_document.rules)
            .filter(rule => !rule.deletedAt)
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'))
    }

    function update_cloud_status_ui() {
        const button = document.getElementById('custom-cloud-status')
        if (!button) return
        if (!IS_BANGUMI_COMPONENT) {
            button.textContent = '本地'
            button.dataset.status = cloud_sync_status === 'error' ? 'error' : 'local'
            button.title = cloud_sync_status === 'error' && cloud_sync_error
                ? cloud_sync_error
                : '本地油猴模式，数据仅保存在当前浏览器和域名'
            return
        }
        const labels = {
            local: '☁ 云端', pending: '☁ 待同步', syncing: '☁ 同步中',
            synced: '☁ 已同步', error: '☁ 同步失败',
        }
        button.textContent = labels[cloud_sync_status] || labels.local
        button.dataset.status = cloud_sync_status
        button.title = cloud_sync_error || button.textContent
    }

    function set_cloud_sync_status(status, error = '') {
        cloud_sync_status = status
        cloud_sync_error = error
        update_cloud_status_ui()
    }

    async function sync_custom_sorts() {
        if (custom_sort_data_error) {
            set_cloud_sync_status('error', custom_sort_data_error)
            return false
        }
        if (!IS_BANGUMI_COMPONENT) {
            set_cloud_sync_status('local', 'Bangumi 云设置不可用，当前使用本地规则')
            return false
        }
        set_cloud_sync_status('syncing')
        try {
            const cloud_raw = chiiApp.cloud_settings.get(CUSTOM_SORTS_CLOUD_KEY)
            const cloud_doc = parse_custom_sort_document(cloud_raw, true)
            let cloud_schema = null
            try { cloud_schema = (typeof cloud_raw === 'string' ? JSON.parse(cloud_raw) : cloud_raw)?.schemaVersion }
            catch (error) { /* 严格解析会在上方报告格式错误 */ }
            const merged = merge_custom_sort_documents(custom_sort_document, cloud_doc)
            const merged_json = JSON.stringify(merged)
            custom_sort_document = merged
            persist_custom_sort_document()
            apply_preset_overrides_from_document()
            if (cloud_schema !== 5 || JSON.stringify(cloud_doc) !== merged_json) {
                chiiApp.cloud_settings.update({ [CUSTOM_SORTS_CLOUD_KEY]: merged_json })
                await Promise.resolve(chiiApp.cloud_settings.save())
            }
            localStorage.removeItem(CUSTOM_SORTS_PENDING_KEY)
            set_cloud_sync_status(localStorage.getItem(IMPORTANT_SUBJECTS_PENDING_KEY) || localStorage.getItem(FRIEND_RATING_PENDING_KEY) ? 'pending' : 'synced')
            refresh_custom_rule_ui()
            return true
        } catch (error) {
            localStorage.setItem(CUSTOM_SORTS_PENDING_KEY, '1')
            set_cloud_sync_status('error', `云同步失败：${error.message || error}`)
            return false
        }
    }

    function schedule_custom_sort_sync() {
        localStorage.setItem(CUSTOM_SORTS_PENDING_KEY, '1')
        set_cloud_sync_status('pending')
        clearTimeout(cloud_sync_timer)
        cloud_sync_timer = setTimeout(sync_custom_sorts, 800)
    }

    function put_custom_rule(rule) {
        const now = Date.now()
        const id = rule.id || (typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : `rule-${now.toString(36)}-${Math.random().toString(36).slice(2)}`)
        custom_sort_document.rules[id] = {
            ...rule,
            id,
            updatedAt: now,
            deletedAt: null,
            deviceId: device_id,
        }
        persist_custom_sort_document()
        schedule_custom_sort_sync()
        return custom_sort_document.rules[id]
    }

    function delete_custom_rule(id) {
        const existing = custom_sort_document.rules[id]
        if (!existing) return
        custom_sort_document.rules[id] = {
            ...existing,
            updatedAt: Date.now(),
            deletedAt: Date.now(),
            deviceId: device_id,
        }
        persist_custom_sort_document()
        if (analyze_config.current_sort === `custom:${id}`) {
            analyze_config.current_sort = 'important'
            save_settings()
        }
        schedule_custom_sort_sync()
    }

    function refresh_custom_rule_ui() {
        if (typeof window.__鉴定_refresh_custom_rules === 'function') window.__鉴定_refresh_custom_rules()
    }

    load_local_custom_sorts()
    if (custom_sort_data_error) set_cloud_sync_status('error', custom_sort_data_error)
    else if (localStorage.getItem(CUSTOM_SORTS_PENDING_KEY) || localStorage.getItem(IMPORTANT_SUBJECTS_PENDING_KEY) || localStorage.getItem(FRIEND_RATING_PENDING_KEY)) set_cloud_sync_status('pending')
    sync_custom_sorts().then(sync_important_subjects).then(sync_friend_rating_rules).then(sync_threshold_profile)

    const collTypeMap = {
        '1': '想看',
        '2': '看过',
        '3': '在看',
        '4': '搁置',
        '5': '抛弃'
    }

    // ─── 工具函数 ───

    function isValidUserPayload(user) {
        return !!user &&
            typeof user === 'object' &&
            typeof user.username === 'string' &&
            user.username.length > 0 &&
            typeof user.id === 'number'
    }

    function isValidUsernameInput(username) {
        return /^[A-Za-z0-9_]{1,32}$/.test(username)
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
            return await fetch(url, { ...options, signal: controller.signal })
        } finally {
            clearTimeout(timer)
        }
    }

    function getSubjectDisplayName(subject) {
        return subject?.name_cn || subject?.name || '未命名条目'
    }

    function count_text_chars(value) {
        return [...String(value || '')].length
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[char]))
    }

    /** @return {HTMLElement} */
    function create_element(html) {
        const temp = document.createElement('temp')
        temp.innerHTML = html
        return temp.firstElementChild
    }

    function parse_friend_activity_time(value) {
        const text = String(value || '').trim()
        if (!text) return null
        if (/^(?:刚刚|在线|online)$/i.test(text)) return Date.now()
        if (/^\d{10,13}$/.test(text)) {
            const numeric = Number(text)
            return text.length === 10 ? numeric * 1000 : numeric
        }
        const relative = text.match(/(\d+(?:\.\d+)?)\s*(秒|分钟|小时|天|周|个月|月|年)前/)
        if (relative) {
            const units = { 秒: 1000, 分钟: 60000, 小时: 3600000, 天: 86400000, 周: 604800000, 个月: 2592000000, 月: 2592000000, 年: 31536000000 }
            return Date.now() - Number(relative[1]) * units[relative[2]]
        }
        if (/半\s*小时前/.test(text)) return Date.now() - 1800000
        if (/昨天/.test(text)) return Date.now() - 86400000
        if (/前天/.test(text)) return Date.now() - 172800000
        if (!/\d{4}\s*[-/.年]\s*\d{1,2}/.test(text)) return null
        const absolute = Date.parse(text)
        return Number.isFinite(absolute) ? absolute : null
    }

    function read_friend_activity(row) {
        if (!row) return { activity_at: null, activity_label: '' }
        const candidates = row.querySelectorAll('time, [data-time], [data-timestamp], [title*="前"], [title*="活跃"], .time, .tip_j')
        for (const node of candidates) {
            const values = [node.getAttribute('datetime'), node.dataset.time, node.dataset.timestamp, node.getAttribute('title'), node.textContent]
            for (const value of values) {
                const activity_at = parse_friend_activity_time(value)
                if (activity_at == null) continue
                return { activity_at, activity_label: String(value).trim() }
            }
        }
        return { activity_at: null, activity_label: '' }
    }

    function format_friend_activity(friend) {
        if (friend.activity_at == null) return '活动时间未知'
        if (friend.activity_label && !/^\d{10,13}$/.test(friend.activity_label)) return friend.activity_label
        return new Date(friend.activity_at).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
    }

    async function fetch_friend_index(username) {
        const response = await fetchWithTimeout(`/user/${encodeURIComponent(username)}/friends`, {}, 12000)
        if (!response.ok) throw new Error(`好友页面 HTTP ${response.status}`)
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
        const friends = new Map()
        for (const anchor of doc.querySelectorAll('a.avatar[href*="/user/"]')) {
            const match = new URL(anchor.getAttribute('href'), location.origin).pathname.match(/^\/user\/([^/]+)$/)
            if (!match) continue
            const friend_username = decodeURIComponent(match[1])
            if (!isValidUsernameInput(friend_username) || friend_username === username) continue
            const row = anchor.closest('li') || anchor.parentElement
            const nickname = anchor.textContent?.trim() || row?.querySelector('a.l:not(.avatar)')?.textContent?.trim() || friend_username
            const avatar_node = anchor.querySelector('img, .avatarNeue')
            const image = avatar_node?.src || (avatar_node?.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] || '')
            const activity = read_friend_activity(row)
            friends.set(friend_username, { username: friend_username, nickname, avatar: image, ...activity, source_index: friends.size })
        }
        return [...friends.values()].sort((a, b) => {
            if (a.activity_at != null && b.activity_at != null && a.activity_at !== b.activity_at) return b.activity_at - a.activity_at
            if (a.activity_at != null && b.activity_at == null) return -1
            if (a.activity_at == null && b.activity_at != null) return 1
            return a.source_index - b.source_index
        })
    }

    // ─── IndexedDB 缓存层 ───

    const api_cache = (() => {
        function pr(req) {
            return new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result)
                req.onerror = () => reject(req.error)
            })
        }

        async function open_db() {
            const DB = 'bangumi_api_cache_5445_v1'
            const req = indexedDB.open(DB)
            req.onupgradeneeded = () => {
                const db = req.result
                store.create(db)
            }
            return pr(req)
        }

        const store = (() => {
            const STORE = 'store'

            function create(db) {
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE)
                }
            }

            async function get(key) {
                const db = await open_db()
                const store = db.transaction(STORE).objectStore(STORE)
                const value = await pr(store.get(key))
                db.close()
                return value
            }

            async function set(key, value) {
                const db = await open_db()
                const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
                store.put(value, key)
                db.close()
            }

            async function deleteByKey(key) {
                const db = await open_db()
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(STORE, 'readwrite')
                    const store = transaction.objectStore(STORE)
                    const request = store.delete(key)
                    request.onsuccess = () => { db.close(); resolve() }
                    request.onerror = (event) => { db.close(); reject(event.target.error) }
                })
            }

            async function clearAllCache() {
                const db = await open_db()
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(STORE, 'readwrite')
                    transaction.objectStore(STORE).clear()
                    transaction.oncomplete = () => { db.close(); resolve() }
                    transaction.onerror = () => { db.close(); reject(transaction.error) }
                    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('缓存清理事务已中止')) }
                })
            }

            async function getAllUsers() {
                const db = await open_db()
                return new Promise((resolve, reject) => {
                    const users = []
                    const request = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
                    request.onsuccess = event => {
                        const cursor = event.target.result
                        if (!cursor) {
                            db.close()
                            resolve(users)
                            return
                        }
                        const key = cursor.key
                        if (typeof key === 'string' && /^https:\/\/api\.bgm\.tv\/v0\/users\/[^/?]+$/.test(key) && isValidUserPayload(cursor.value)) users.push(cursor.value)
                        cursor.continue()
                    }
                    request.onerror = event => {
                        db.close()
                        reject(event.target.error)
                    }
                })
            }

            async function getCachedCollectionUsernames() {
                const db = await open_db()
                return new Promise((resolve, reject) => {
                    const usernames = new Set()
                    const request = db.transaction(STORE, 'readonly').objectStore(STORE).openKeyCursor()
                    request.onsuccess = event => {
                        const cursor = event.target.result
                        if (!cursor) {
                            db.close()
                            resolve(usernames)
                            return
                        }
                        if (typeof cursor.key === 'string') {
                            const match = cursor.key.match(/^https:\/\/api\.bgm\.tv\/v0\/users\/([^/?]+)\/collections(?:\?|$)/)
                            if (match) usernames.add(decodeURIComponent(match[1]))
                        }
                        cursor.continue()
                    }
                    request.onerror = event => {
                        db.close()
                        reject(event.target.error)
                    }
                })
            }

            async function deleteUserCache(username) {
                const db = await open_db()
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(STORE, 'readwrite')
                    const object_store = transaction.objectStore(STORE)
                    const request = object_store.openCursor()
                    request.onsuccess = event => {
                        const cursor = event.target.result
                        if (!cursor) return
                        const key = String(cursor.key)
                        if (key === transUserKey(username) || key.startsWith(`${transUserKey(username)}/collections`)) cursor.delete()
                        cursor.continue()
                    }
                    transaction.oncomplete = () => { db.close(); resolve() }
                    transaction.onerror = () => { db.close(); reject(transaction.error) }
                })
            }

            function transCollKey(user_id, subject_type) {
                return subject_type > 0
                    ? `https://api.bgm.tv/v0/users/${user_id}/collections?subject_type=${subject_type}`
                    : `https://api.bgm.tv/v0/users/${user_id}/collections`
            }

            function transUserKey(username) {
                return `https://api.bgm.tv/v0/users/${username}`
            }

            function transSubjectKey(subject_id) {
                return `https://api.bgm.tv/v0/subjects/${subject_id}`
            }

            return { create, get, set, deleteByKey, clearAllCache, deleteUserCache, getAllUsers, getCachedCollectionUsernames, transCollKey, transUserKey, transSubjectKey }
        })()

        return store
    })()

    // ─── API 数据加载 ───

    const load_manager_async = (() => {
        async function fetch_all_collections(username, subject_id) {
            const limit = 100
            const typeParam = subject_id > 0 ? `subject_type=${subject_id}&` : ''
            const api = `https://api.bgm.tv/v0/users/${username}/collections?${typeParam}limit=${limit}&offset=`

            const res = await fetch(api + 0)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const page = await res.json()
            if (!Array.isArray(page.data)) throw new Error(page.description || page.message || '收藏数据格式无效')
            const l = page.data

            const p_l = []
            for (let i = limit; i < page.total; i += limit) {
                const p = fetch(api + i).then(async (res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    const page = await res.json()
                    if (!Array.isArray(page.data)) throw new Error(page.description || page.message || '收藏数据格式无效')
                    return page.data
                })
                p_l.push(p)
            }

            const ll = await Promise.all(p_l)
            return l.concat(...ll)
        }

        async function get_coll(username, force = false, requested_subject_ids = null) {
            const subject_ids = normalize_subject_ids(requested_subject_ids || analyze_config.subject_ids)
            const cached = force ? subject_ids.map(() => null) : await Promise.all(
                subject_ids.map(id => api_cache.get(api_cache.transCollKey(username, id)))
            )
            if (cached.every(collections => collections != null)) return cached.flat()

            // 全选五类时一次拉取全部，并回填每个单类型缓存
            if (subject_ids.length === SUBJECT_TYPE_IDS.length) {
                try {
                    const all = await fetch_all_collections(username, 0)
                    for (const id of SUBJECT_TYPE_IDS) {
                        await api_cache.set(
                            api_cache.transCollKey(username, id),
                            all.filter(collection => collection.subject_type === id)
                        )
                    }
                    set_user_cache_time(username)
                    return all.filter(collection => subject_ids.includes(collection.subject_type))
                } catch (e) {
                    throw `自动获取${username}的全部类型缓存失败: ${e.message}`
                }
            }

            // 部分多选时只请求缺失类型，已有类型继续复用缓存
            try {
                const collections_by_type = await Promise.all(subject_ids.map(async (id, index) => {
                    if (cached[index] != null) return cached[index]
                    const collections = await fetch_all_collections(username, id)
                    await api_cache.set(api_cache.transCollKey(username, id), collections)
                    return collections
                }))
                set_user_cache_time(username)
                return collections_by_type.flat()
            } catch (e) {
                throw `自动获取${username}的${get_subject_selection_label()}缓存失败: ${e.message}`
            }
        }

        async function get_cached_coll(username, requested_subject_ids) {
            const subject_ids = normalize_subject_ids(requested_subject_ids)
            const cached = await Promise.all(subject_ids.map(id => api_cache.get(api_cache.transCollKey(username, id))))
            return {
                collections: cached.filter(value => value != null).flat(),
                missingSubjectIds: subject_ids.filter((id, index) => cached[index] == null),
            }
        }

        async function fetch_user(username) {
            if (!isValidUsernameInput(username)) throw new Error('用户名格式无效')
            const api = `https://api.bgm.tv/v0/users/${username}`
            let res = await fetchWithTimeout(api, {}, 5000)
            const user = await res.json()
            if (!res.ok) throw new Error(user.description || user.message || `HTTP ${res.status}`)
            if (!isValidUserPayload(user)) throw new Error('用户数据格式无效')
            return user
        }

        async function get_user(username, force = false) {
            const cache_key = api_cache.transUserKey(username)
            let user = force ? null : await api_cache.get(cache_key)

            if (user && !isValidUserPayload(user)) {
                await api_cache.deleteByKey(cache_key)
                user = null
            }

            if (!user) {
                try {
                    user = await fetch_user(username)
                    await api_cache.set(cache_key, user)
                } catch (e) {
                    throw `自动获取${username}的缓存失败: ${e.message}`
                }
            }
            return user
        }

        async function get_subject(subject_id) {
            const cache_key = api_cache.transSubjectKey(subject_id)
            const cached = await api_cache.get(cache_key)
            if (cached?.id) return cached
            const response = await fetchWithTimeout(cache_key, {}, 8000)
            if (!response.ok) throw new Error(`作品 ${subject_id} HTTP ${response.status}`)
            const subject = await response.json()
            await api_cache.set(cache_key, subject)
            return subject
        }

        async function search_subjects(keyword, subject_ids) {
            const response = await fetchWithTimeout('https://api.bgm.tv/v0/search/subjects?limit=10&offset=0', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword,
                    sort: 'match',
                    filter: { type: normalize_subject_ids(subject_ids) },
                }),
            }, 10000)
            let page = null
            try { page = await response.json() }
            catch (error) { throw new Error(`条目搜索响应不是有效 JSON（HTTP ${response.status}）`) }
            if (!response.ok) throw new Error(page?.description || page?.message || `条目搜索 HTTP ${response.status}`)
            if (!Array.isArray(page?.data)) throw new Error('条目搜索响应格式无效')
            return page.data.slice(0, 10)
        }

        return { get_coll, get_cached_coll, get_user, get_subject, search_subjects }
    })()

    // ─── 评分统计 ───

    /** @param {Collection[]} collections */
    function calc_rate_count_map(collections) {
        const rate_count_map = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }
        for (const c of collections) {
            if (c.rate !== 0) rate_count_map[c.rate] += 1
        }
        return rate_count_map
    }

    function calc_std_frac_map(rate_count_map) {
        const total = Object.values(rate_count_map).reduce((s, v) => s + v, 0)
        if (total === 0) return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }
        const std_frac_map = { 0: 0 }
        let curNum = 0
        for (let i = 1; i <= 10; i++) {
            std_frac_map[i] = (curNum + rate_count_map[i] / 2) / total - 0.5
            curNum += rate_count_map[i]
        }
        return std_frac_map
    }

    /** 基于公评分数排名的百分位映射，与 std_frac_map 语义对等 */
    function calc_pub_frac_map(rated) {
        const scores = rated.map(c => c.subject.score || 0).sort((a, b) => a - b)
        const total = scores.length
        if (total === 0) return {}
        const map = {}
        let i = 0
        while (i < total) {
            const val = scores[i]
            let j = i
            while (j < total && scores[j] === val) j++
            map[val] = (i + (j - i) / 2) / total - 0.5
            i = j
        }
        return map
    }

    function friend_auto_balance_thresholds(rate_map) {
        let total = 0
        for (let i = 1; i <= 10; i++) total += Number(rate_map[i] || 0)
        if (total === 0) return { low: 4, high: 7 }
        const target = threshold_profile?.ratios || { low: 1 / 3, medium: 1 / 3, high: 1 / 3 }
        let best = { low: 4, high: 7 }, best_error = Infinity
        for (let low = 1; low <= 8; low++) {
            for (let high = low + 1; high <= 9; high++) {
                let low_count = 0, medium_count = 0, high_count = 0
                for (let rate = 1; rate <= 10; rate++) {
                    if (rate <= low) low_count += Number(rate_map[rate] || 0)
                    else if (rate <= high) medium_count += Number(rate_map[rate] || 0)
                    else high_count += Number(rate_map[rate] || 0)
                }
                const error = (low_count / total - target.low) ** 2 +
                    (medium_count / total - target.medium) ** 2 + (high_count / total - target.high) ** 2
                if (error < best_error) {
                    best = { low, high }
                    best_error = error
                }
            }
        }
        return best
    }

    function friend_review_tier(review, thresholds) {
        if (!review || !(review.rate > 0)) return 'unrated'
        return review.rate <= thresholds.low ? 'low' : review.rate <= thresholds.high ? 'medium' : 'high'
    }

    function build_friend_rating_context(my_collections, his_collections, rule) {
        const my_map = new Map(my_collections.map(collection => [Number(collection.subject_id), collection]))
        const his_map = new Map(his_collections.map(collection => [Number(collection.subject_id), collection]))
        const cutoff = Date.parse(`${rule.cutoffDate}T00:00:00`)
        const common_ids = [...my_map.keys()].filter(id => his_map.has(id))
        const candidates = common_ids.map(id => {
            const my_review = my_map.get(id)
            const his_review = his_map.get(id)
            const subject = my_review?.subject || his_review?.subject || {}
            return { id, subject, my_review, his_review }
        }).filter(item => item.my_review.rate > 0 && item.his_review.rate > 0)
            .filter(item => rule.scope !== 'important_rated' || important_subject_ids.has(item.id))
            .filter(item => rule.subject_ids.includes(Number(item.subject.type)))
            .filter(item => {
                const subject_date = item.subject.date ? Date.parse(`${item.subject.date}T00:00:00`) : NaN
                return Number.isFinite(subject_date) && subject_date >= cutoff
            })
            .filter(item => rule.filters.my_statuses.includes(Number(item.my_review.type)) &&
                rule.filters.his_statuses.includes(Number(item.his_review.type)))
        const all_reference = user => (user === 'my' ? my_collections : his_collections)
            .filter(collection => collection.rate > 0 && rule.subject_ids.includes(Number(collection.subject?.type)))
        const current_reference = user => candidates.map(item => item[`${user}_review`])
        const my_reference = rule.standardScope === 'filtered' ? current_reference('my') : all_reference('my')
        const his_reference = rule.standardScope === 'filtered' ? current_reference('his') : all_reference('his')
        const my_rate_map = calc_rate_count_map(my_reference)
        const his_rate_map = calc_rate_count_map(his_reference)
        const my_hidden = calc_std_frac_map(my_rate_map)
        const his_hidden = calc_std_frac_map(his_rate_map)
        const my_thresholds = friend_auto_balance_thresholds(my_rate_map)
        const his_thresholds = friend_auto_balance_thresholds(his_rate_map)
        const rated = candidates.filter(item => rule.filters.my_tiers.includes(friend_review_tier(item.my_review, my_thresholds)) &&
            rule.filters.his_tiers.includes(friend_review_tier(item.his_review, his_thresholds)))
        return {
            rated,
            my_hidden, his_hidden, my_thresholds, his_thresholds,
        }
    }

    function friend_level(normalized) {
        const score = Math.round(normalized * 100)
        return Math.max(1, Math.min(10, Math.floor((score + 4) / 10)))
    }

    function evaluate_friend_rule(rule, my_collections, his_collections) {
        const context = build_friend_rating_context(my_collections, his_collections, rule)
        const rated = context.rated
        const sampleCount = rated.length
        let cosine = null
        if (sampleCount) {
            let dot = 0, my_sum = 0, his_sum = 0
            for (const item of rated) {
                const my = Number(context.my_hidden[item.my_review.rate] || 0)
                const his = Number(context.his_hidden[item.his_review.rate] || 0)
                dot += my * his
                my_sum += my * my
                his_sum += his * his
            }
            if (my_sum > 0 && his_sum > 0) cosine = dot / Math.sqrt(my_sum * his_sum)
        }
        const cosine_x = cosine == null ? null : Math.max(0, Math.min(1, cosine))
        const cosine_normalized = cosine_x == null ? null : (261 * cosine_x - 185 * cosine_x ** 2 + 50 * cosine_x ** 3) / 126
        const variance = sampleCount
            ? rated.reduce((sum, item) => sum + (item.my_review.rate - item.his_review.rate) ** 2, 0) / sampleCount
            : null
        const variance_normalized = variance == null ? null : 2 ** (-variance / 3)
        const confidence_target = normalize_friend_confidence_target(rule.confidenceTarget, rule.scope)
        const confidence = Math.min(1, Math.log(1 + 8 * sampleCount / confidence_target) / Math.log(9))
        const metrics = [
            { type: 'cosine', raw: cosine, normalized: cosine_normalized, level: cosine_normalized == null ? null : friend_level(cosine_normalized) },
            { type: 'variance', raw: variance, normalized: variance_normalized, level: variance_normalized == null ? null : friend_level(variance_normalized) },
            { type: 'confidence', raw: confidence, normalized: confidence, level: friend_level(confidence) },
        ]
        const selected = []
        if (rule.display.cosine) selected.push(cosine_normalized)
        if (rule.display.variance) selected.push(variance_normalized)
        const invalid = !selected.length || selected.some(value => value == null)
        if (invalid) {
            return {
                status: 'pending', normalized: null, score: null, level: null, metrics, sampleCount, confidence,
                confidenceBackgroundEnabled: rule.display.confidence,
                reason: !selected.length ? '未选择评级指标' : '缺少可计算数据',
            }
        }
        const normalized = selected.reduce((sum, value) => sum + value, 0) / selected.length
        return {
            status: 'ready', normalized, score: Math.round(normalized * 100),
            level: friend_level(normalized), metrics, sampleCount, confidence,
            confidenceBackgroundEnabled: rule.display.confidence, reason: '',
        }
    }

    // ─── 表情等级系统 ───

    const quickLevelEmos = [
        null,
        { html: '<img src="/img/smiles/tv_500/bgm_518.gif" class="smile" alt="(bgm518)">' },
        { html: '<img src="/img/smiles/tv_500/bgm_524.png" class="smile" alt="(bgm524)">' },
        { html: '<img src="/img/smiles/tv_500/bgm_502.png" class="smile" alt="(bgm502)">' },
        { html: '<img src="/img/smiles/tv/49.gif" class="smile" alt="(bgm72)">' },
        { html: '<img src="/img/smiles/tv/53.gif" class="smile" alt="(bgm76)">' },
        { html: '<img src="/img/smiles/tv/44.gif" class="smile" alt="(bgm67)">' },
        { html: '<img src="/img/smiles/tv/86.gif" class="smile" alt="(bgm109)">' },
        { html: '<img src="/img/smiles/tv_vs/bgm_200.png" class="smile" alt="(bgm200)">' },
        { html: '<img src="/img/smiles/tv/40.gif" class="smile" alt="(bgm63)">' },
        { html: '<img src="/img/smiles/tv_500/bgm_503.png" class="smile" alt="(bgm503)">' },
    ]
    const workbenchLevelEmos = quickLevelEmos
    function getEmoHtml(emo) {
        return emo?.html || ''
    }

    function renderBmoji() { /* 经典表情直接使用官方图片，无需组件渲染 */ }

    // ─── 核心分析引擎 ───

    const analyze = (() => {

        /**
         * 主分析函数
         * @param {string} my_id
         * @param {string} his_id
         * @returns {Object}
         */
        async function run(my_id, his_id, force = false) {
            const [my_collections, his_collections] = await Promise.all([
                load_manager_async.get_coll(my_id, force),
                load_manager_async.get_coll(his_id, force)
            ])

            // 隐藏分基于当前条目类型的全部已评分收藏，不随收藏状态筛选变化
            const my_all_rate_count_map = calc_rate_count_map(my_collections)
            const his_all_rate_count_map = calc_rate_count_map(his_collections)
            const my_hidden_map = calc_std_frac_map(my_all_rate_count_map)
            const his_hidden_map = calc_std_frac_map(his_all_rate_count_map)
            const my_rated_public = my_collections.filter(c => c.rate > 0 && (c.subject.score || 0) > 0)
            const his_rated_public = his_collections.filter(c => c.rate > 0 && (c.subject.score || 0) > 0)
            const my_public_frac_map = calc_pub_frac_map(my_rated_public)
            const his_public_frac_map = calc_pub_frac_map(his_rated_public)

            function hidden_score(rate, map) {
                if (!(rate > 0)) return null
                return Math.round(((map[rate] ?? 0) + 0.5) * 100)
            }

            function to_review(collection, map) {
                if (!collection) return null
                return {
                    rate: collection.rate,
                    hidden: hidden_score(collection.rate, map),
                    comment: collection.comment || '',
                    comment_chars: count_text_chars(collection.comment),
                    date: new Date(collection.updated_at),
                    type: collection.type,
                }
            }

            const my_collection_map = new Map(my_collections.map(c => [c.subject_id, c]))
            const his_collection_map = new Map(his_collections.map(c => [c.subject_id, c]))
            const collection_subject_ids = new Set([...my_collection_map.keys(), ...his_collection_map.keys()])
            const missing_important_ids = [...important_subject_ids].filter(id => !collection_subject_ids.has(id))
            const extra_subjects = new Map()
            let subject_cursor = 0
            const subject_worker = async () => {
                while (subject_cursor < missing_important_ids.length) {
                    const id = missing_important_ids[subject_cursor++]
                    try {
                        const subject = await load_manager_async.get_subject(id)
                        if (analyze_config.subject_ids.includes(Number(subject.type))) extra_subjects.set(id, subject)
                    } catch (error) { /* 单个重要条目失败不阻断整体比较 */ }
                }
            }
            await Promise.all(Array.from({ length: Math.min(4, missing_important_ids.length) }, subject_worker))
            const all_subject_ids = new Set([...collection_subject_ids, ...extra_subjects.keys()])
            const comparison_items = [...all_subject_ids].map(subject_id => {
                const my_collection = my_collection_map.get(subject_id)
                const his_collection = his_collection_map.get(subject_id)
                const subject = my_collection?.subject || his_collection?.subject || extra_subjects.get(subject_id) || {}
                const my_review = to_review(my_collection, my_hidden_map)
                const his_review = to_review(his_collection, his_hidden_map)
                const public_score = Number(subject.score || 0) || null
                const my_public_frac = public_score == null ? null : my_public_frac_map[public_score]
                const his_public_frac = public_score == null ? null : his_public_frac_map[public_score]
                const my_public_percentile = my_public_frac == null ? null : Math.round((my_public_frac + 0.5) * 100)
                const his_public_percentile = his_public_frac == null ? null : Math.round((his_public_frac + 0.5) * 100)
                const raw_gap = my_review?.rate > 0 && his_review?.rate > 0
                    ? Math.abs(my_review.rate - his_review.rate)
                    : null
                const hidden_gap = my_review?.hidden != null && his_review?.hidden != null
                    ? Math.abs(my_review.hidden - his_review.hidden)
                    : null
                const public_diff = raw_gap != null && public_score != null
                    ? (Math.abs(my_review.rate - public_score) + Math.abs(his_review.rate - public_score)) / 2
                    : null
                const popularity_log = Math.log2(Number(subject.collection_total || 0) + 1) || 1
                const rating_sum = raw_gap != null ? my_review.rate + his_review.rate : null
                const latest_updated_ts = Math.max(
                    my_review?.date?.getTime?.() || 0,
                    his_review?.date?.getTime?.() || 0
                ) || null
                return {
                    subject,
                    my_review,
                    his_review,
                    public_score,
                    public_percentile: his_public_percentile,
                    my_public_percentile,
                    his_public_percentile,
                    raw_gap,
                    hidden_gap,
                    hidden_min: my_review?.hidden != null && his_review?.hidden != null
                        ? Math.min(my_review.hidden, his_review.hidden)
                        : null,
                    hidden_max: my_review?.hidden != null && his_review?.hidden != null
                        ? Math.max(my_review.hidden, his_review.hidden)
                        : null,
                    hidden_avg: my_review?.hidden != null && his_review?.hidden != null
                        ? (my_review.hidden + his_review.hidden) / 2
                        : null,
                    his_public_gap: his_review?.hidden != null && his_public_percentile != null
                        ? Math.abs(his_review.hidden - his_public_percentile)
                        : null,
                    public_diff,
                    follow_crowd_score: public_diff == null ? null : 1 / ((public_diff + 0.5) * (raw_gap + 0.5)),
                    united_front_score: public_diff == null ? null : public_diff / (raw_gap + 0.01),
                    niche_consensus_score: rating_sum == null ? null : rating_sum / popularity_log,
                    hot_consensus_score: rating_sum == null ? null : rating_sum * popularity_log,
                    reverse_score: raw_gap == null || public_score == null
                        ? null
                        : (my_review.rate - public_score) * (his_review.rate - public_score),
                    hot_diverge_score: raw_gap == null ? null : raw_gap * popularity_log,
                    cold_diverge_score: raw_gap == null ? null : raw_gap / popularity_log,
                    his_niche_score: his_review?.rate > 0 ? his_review.rate / popularity_log : null,
                    his_hot_score: his_review?.rate > 0 ? his_review.rate * popularity_log : null,
                    latest_updated_ts,
                    subject_date: subject.date || '',
                    subject_date_ts: subject.date ? Date.parse(subject.date) || null : null,
                    collection_total: Number(subject.collection_total || 0),
                    rank: Number(subject.rank || 0) || null,
                }
            })

            // 大众隐藏分：大众评分在当前双方收藏并集中的中位百分位
            const public_hidden_frac_map = calc_pub_frac_map(
                comparison_items.filter(item => item.public_score != null).map(item => ({ subject: { score: item.public_score } }))
            )
            for (const item of comparison_items) {
                const fraction = item.public_score == null ? null : public_hidden_frac_map[item.public_score]
                item.public_hidden = fraction == null ? null : Math.round((fraction + 0.5) * 100)
            }

            // 收藏状态筛选已归入各规则；全局统计始终基于完整收藏集
            const my_filtered = my_collections
            const his_filtered = his_collections

            const my_rate_count_map = calc_rate_count_map(my_filtered)
            const his_rate_count_map = calc_rate_count_map(his_filtered)
            const his_filtered_subject_ids = new Set(his_filtered.map(c => c.subject_id))
            const common_collection_count = my_filtered.filter(c => his_filtered_subject_ids.has(c.subject_id)).length
            const his_rated_subject_ids = new Set(his_filtered.filter(c => c.rate > 0).map(c => c.subject_id))
            const common_rating_count = my_filtered.filter(c => c.rate > 0 && his_rated_subject_ids.has(c.subject_id)).length
            const his_watched_subject_ids = new Set(his_collections.filter(c => c.type === 2).map(c => c.subject_id))
            const common_watched_count = my_collections.filter(c => c.type === 2 && his_watched_subject_ids.has(c.subject_id)).length

            return {
                my_rate_count_map,
                his_rate_count_map,
                comparison_items,
                my_hidden_map: Object.fromEntries(Object.entries(my_hidden_map).map(([rate, value]) => [rate, Math.round((value + 0.5) * 100)])),
                his_hidden_map: Object.fromEntries(Object.entries(his_hidden_map).map(([rate, value]) => [rate, Math.round((value + 0.5) * 100)])),
                my_all_rate_count_map,
                his_all_rate_count_map,
                common_collection_count,
                common_rating_count,
                my_collection_count: my_collections.length,
                his_collection_count: his_collections.length,
                my_watched_count: my_collections.filter(c => c.type === 2).length,
                his_watched_count: his_collections.filter(c => c.type === 2).length,
                common_watched_count,
                my_comment_chars: my_collections.reduce((s, c) => s + count_text_chars(c.comment), 0),
                his_comment_chars: his_collections.reduce((s, c) => s + count_text_chars(c.comment), 0),
            }
        }

        return { run }
    })()

    // ─── 状态 ───

    let analyzeLoading = false
    let self_username = ''
    let visited_username = ''
    let comparison_username = ''
    let cur_user1, cur_user2
    let mobile_settings_open = false

    // ─── 注入分析页面 ───

    async function inject_analyze_page(force = false) {
        document.querySelector('.friend-rating-backdrop')?.remove()
        const $page = document.querySelector('.columns')
        $page.classList.add('鉴定_host')

        if (!cur_user1 || !cur_user2) {
            visited_username = document.querySelector('#headerProfile .name small').textContent.slice(1)
            self_username = CHOBITS_USERNAME
            if (!comparison_username) comparison_username = visited_username
        }
        if (force || !cur_user1 || !cur_user2) {
            // 强制更新收藏缓存时同时刷新双方头像、昵称等用户资料
            ;[cur_user1, cur_user2] = await Promise.all([
                load_manager_async.get_user(comparison_username || visited_username, force),
                load_manager_async.get_user(self_username, force),
            ])
        }
        mark_opponent_viewed(cur_user1.username)

        const my_id = cur_user2.username
        const his_id = cur_user1.username
        const my_avatar = cur_user2.avatar.medium
        const his_avatar = cur_user1.avatar.medium

        try {
            $page.innerHTML = `<section class="鉴定_page" style="padding: 20px;">加载中...</section>`

            await sync_threshold_profile()
            const result = await analyze.run(my_id, his_id, force)

            const SET_MODE_DEFS = {
                any: '不限制',
                collected: '已收藏',
                uncollected: '未收藏（并集内）',
                rated: '已评分',
                important: '重要番剧',
                not_important: '未标重要番剧',
            }

            const LEGACY_SCOPE_SETS = {
                all: { my: 'any', his: 'any' },
                common_collection: { my: 'collected', his: 'collected' },
                common_rated: { my: 'rated', his: 'rated' },
                his_collection: { my: 'any', his: 'collected' },
                his_rated: { my: 'any', his: 'rated' },
            }

            const FACTOR_DEFS = {
                my_rating: { group: '评分', label: '我的评价', positive: '高分优先', negative: '低分优先', relative: false },
                his_rating: { group: '评分', label: '对方评价', positive: '高分优先', negative: '低分优先', relative: false },
                agreement: { group: '评分', label: '双方一致度', positive: '更一致', negative: '分歧更大', relative: false },
                my_conformity: { group: '大众', label: '我的从众度', positive: '更从众', negative: '更逆大众', relative: false },
                his_conformity: { group: '大众', label: '对方从众度', positive: '更从众', negative: '更逆大众', relative: false },
                public_reputation: { group: '大众', label: '大众口碑', positive: '口碑更好', negative: '口碑更差', relative: true },
                popularity: { group: '大众', label: '热门度', positive: '更热门', negative: '更冷门', relative: true },
                freshness: { group: '时间', label: '作品新鲜度', positive: '作品更新', negative: '作品更旧', relative: true },
                my_recency: { group: '时间', label: '我的收藏新鲜度', positive: '最近收藏', negative: '更早收藏', relative: true },
                his_recency: { group: '时间', label: '对方收藏新鲜度', positive: '最近收藏', negative: '更早收藏', relative: true },
                my_comment: { group: '互动', label: '我的吐槽量', positive: '字数更多', negative: '字数更少', relative: true },
                his_comment: { group: '互动', label: '对方吐槽量', positive: '字数更多', negative: '字数更少', relative: true },
            }

            const RANGE_FILTER_DEFS = {
                public_score: { label: '大众评分', min: 0, max: 10, step: 0.1 },
                collection_total: { label: '收藏人数', min: 0, step: 1 },
                rank: { label: 'Bangumi 排名', min: 1, step: 1 },
                subject_date_ts: { label: '作品日期', type: 'date' },
                my_comment_chars: { label: '我的吐槽字数', min: 0, step: 1 },
                his_comment_chars: { label: '对方吐槽字数', min: 0, step: 1 },
            }

            function get_tier(user, review) {
                if (!review) return null
                if (!(review.rate > 0)) return 'unrated'
                const low = analyze_config[user + '_threshold_low']
                const high = analyze_config[user + '_threshold_high']
                return review.rate <= low ? 'low' : review.rate <= high ? 'medium' : 'high'
            }

            function get_rule_sets(rule) {
                return rule.sets
            }

            function set_mode_matches(item, user, mode) {
                const review = item[`${user}_review`]
                if (mode === 'important') return important_subject_ids.has(Number(item.subject.id))
                if (mode === 'not_important') return !important_subject_ids.has(Number(item.subject.id))
                if (mode === 'collected') return !!review
                if (mode === 'uncollected') return !review
                if (mode === 'rated') return review?.rate > 0
                return true
            }

            function sets_match(item, sets) {
                return set_mode_matches(item, 'my', sets.my) && set_mode_matches(item, 'his', sets.his)
            }

            function get_range_value(item, field) {
                if (field === 'my_comment_chars') return item.my_review?.comment_chars
                if (field === 'his_comment_chars') return item.his_review?.comment_chars
                return item[field]
            }

            function saved_filter_matches(item, filters = {}) {
                const tier_match = (user, selected) => {
                    if (!Array.isArray(selected) || selected.length === 4) return true
                    if (selected.length === 0) return false
                    return selected.includes(get_tier(user, item[`${user}_review`]))
                }
                const type_match = (user, selected) => {
                    if (!Array.isArray(selected) || selected.length === 5) return true
                    if (selected.length === 0) return false
                    return selected.includes(item[`${user}_review`]?.type)
                }
                if (!tier_match('my', filters.my_tiers) || !tier_match('his', filters.his_tiers)) return false
                if (!type_match('my', filters.my_types) || !type_match('his', filters.his_types)) return false
                for (const user of ['my', 'his']) {
                    const mode = filters[`${user}_comment`] || 'any'
                    const review = item[`${user}_review`]
                    if (mode === 'has' && !(review?.comment_chars > 0)) return false
                    if (mode === 'empty' && (!review || review.comment_chars !== 0)) return false
                }
                for (const [field, bounds] of Object.entries(filters.ranges || {})) {
                    if (!bounds || (bounds.min == null && bounds.max == null)) continue
                    const actual = get_range_value(item, field)
                    if (actual == null || Number.isNaN(actual)) return false
                    const is_date = RANGE_FILTER_DEFS[field]?.type === 'date'
                    const min = bounds.min === '' || bounds.min == null ? null : is_date ? Date.parse(bounds.min) : Number(bounds.min)
                    const max = bounds.max === '' || bounds.max == null ? null : is_date ? Date.parse(bounds.max) + 86399999 : Number(bounds.max)
                    if (min != null && actual < min) return false
                    if (max != null && actual > max) return false
                }
                return true
            }

            function factor_source_value(item, factor_id, rule) {
                const use_raw = rule?.scoreMode === 'raw'
                if (factor_id === 'my_rating') return use_raw ? (item.my_review?.rate > 0 ? item.my_review.rate * 10 : null) : item.my_review?.hidden
                if (factor_id === 'his_rating') return use_raw ? (item.his_review?.rate > 0 ? item.his_review.rate * 10 : null) : item.his_review?.hidden
                if (factor_id === 'agreement') return use_raw
                    ? (item.raw_gap == null ? null : 100 - item.raw_gap * 10)
                    : (item.hidden_gap == null ? null : 100 - item.hidden_gap)
                if (factor_id === 'my_conformity') return use_raw
                    ? (item.my_review?.rate > 0 && item.public_score != null ? 100 - Math.abs(item.my_review.rate - item.public_score) * 10 : null)
                    : (item.my_review?.hidden == null || item.my_public_percentile == null ? null : 100 - Math.abs(item.my_review.hidden - item.my_public_percentile))
                if (factor_id === 'his_conformity') return use_raw
                    ? (item.his_review?.rate > 0 && item.public_score != null ? 100 - Math.abs(item.his_review.rate - item.public_score) * 10 : null)
                    : (item.his_review?.hidden == null || item.his_public_percentile == null ? null : 100 - Math.abs(item.his_review.hidden - item.his_public_percentile))
                if (factor_id === 'public_reputation') return item.public_score
                if (factor_id === 'popularity') return item.collection_total
                if (factor_id === 'freshness') return item.subject_date_ts
                if (factor_id === 'my_recency') return item.my_review?.date?.getTime?.()
                if (factor_id === 'his_recency') return item.his_review?.date?.getTime?.()
                if (factor_id === 'my_comment') return item.my_review ? item.my_review.comment_chars : null
                if (factor_id === 'his_comment') return item.his_review ? item.his_review.comment_chars : null
                return null
            }

    function factor_value_for_rule(item, factor_id, rule) {
        const value = factor_source_value(item, factor_id, rule)
        if (value != null) return value
        if (['my_rating', 'his_rating'].includes(factor_id)) return 0
        if (rule?.missingScoreAsZero === true && factor_id === 'agreement') return 0
        return null
    }

            function percentile_map(items, factor_id, rule) {
                const sorted = items.map(item => ({ item, value: factor_value_for_rule(item, factor_id, rule) }))
                    .sort((a, b) => a.value - b.value)
                const map = new Map()
                if (sorted.length === 1) {
                    map.set(sorted[0].item, 50)
                    return map
                }
                for (let i = 0; i < sorted.length;) {
                    let j = i + 1
                    while (j < sorted.length && sorted[j].value === sorted[i].value) j++
                    const score = ((i + (j - i) / 2) / sorted.length) * 100
                    for (let k = i; k < j; k++) map.set(sorted[k].item, score)
                    i = j
                }
                return map
            }

            function evaluate_section(section, candidates) {
                const factors = (section.factors || []).filter(factor => FACTOR_DEFS[factor.id])
                const scoped = candidates.filter(item => sets_match(item, section.sets))
                const filtered = scoped.filter(item => saved_filter_matches(item, section.filters))
                const eligible = filtered.filter(item => factors.every(factor => factor_value_for_rule(item, factor.id, section) != null))
                if (factors.length === 0) {
                    const items = [...eligible].sort((a, b) =>
                        (b.his_review?.date?.getTime?.() || 0) - (a.his_review?.date?.getTime?.() || 0) ||
                        Number(a.subject.id || 0) - Number(b.subject.id || 0)
                    )
                    return { items, matchedItems: filtered, scopedCount: scoped.length, filteredCount: filtered.length, excludedCount: 0 }
                }
                const percentile_maps = Object.fromEntries(
                    factors.filter(factor => FACTOR_DEFS[factor.id].relative)
                        .map(factor => [factor.id, percentile_map(eligible, factor.id, section)])
                )
                const items = eligible.map(item => {
                    let weighted_sum = 0
                    let weight_sum = 0
                    const factor_scores = factors.map(factor => {
                        const raw = FACTOR_DEFS[factor.id].relative
                            ? percentile_maps[factor.id].get(item)
                            : factor_value_for_rule(item, factor.id, section)
                        const preferred = factor.direction === 'negative' ? 100 - raw : raw
                        const weight = Number(factor.weight) || 1
                        weighted_sum += preferred * weight
                        weight_sum += weight
                        return { id: factor.id, raw, preferred, weight, contribution: preferred * weight }
                    })
                    return { ...item, _custom_score: weighted_sum / weight_sum, _factor_scores: factor_scores }
                }).sort((a, b) => b._custom_score - a._custom_score || Number(a.subject.id || 0) - Number(b.subject.id || 0))
                return { items, matchedItems: filtered, scopedCount: scoped.length, filteredCount: filtered.length, excludedCount: filtered.length - eligible.length }
            }

            function evaluate_rule(rule, expanded_sections = new Map()) {
                const claimed_ids = new Set()
                const sections = rule.sections.map(section => {
                    const candidates = result.comparison_items.filter(item => !claimed_ids.has(Number(item.subject.id)))
                    const evaluation = evaluate_section(section, candidates)
                    if (section.claimMatches !== false) {
                        evaluation.matchedItems.forEach(item => claimed_ids.add(Number(item.subject.id)))
                    }
                    const extra_count = Math.max(0, Number(expanded_sections.get(section.id) || 0))
                    const visible_items = section.limit == null
                        ? evaluation.items
                        : evaluation.items.slice(0, section.limit + extra_count)
                    return { section, ...evaluation, items: visible_items, totalSortedCount: evaluation.items.length }
                })
                return {
                    sections,
                    items: sections.flatMap(({ section, items, totalSortedCount }) => items.map((item, index) => ({
                        ...item,
                        _section_id: section.id,
                        _section_name: section.name,
                        _section_description: section.description || '',
                        _section_muted: section.appearance === 'muted',
                        _section_start: index === 0,
                        _section_end: index === items.length - 1,
                        _section_hidden_count: index === items.length - 1 ? Math.max(0, totalSortedCount - items.length) : 0,
                        _multi_section: rule.sections.length > 1,
                    }))),
                }
            }

            const default_filter_state = () => ({
                my_types: [1, 2, 3, 4, 5], his_types: [1, 2, 3, 4, 5],
                my_tiers: ['unrated', 'low', 'medium', 'high'], his_tiers: ['unrated', 'low', 'medium', 'high'],
                my_comment: 'any', his_comment: 'any',
            })

            const make_section = (id, name, overrides = {}) => ({
                id, name, description: '', limit: 20, claimMatches: true, appearance: 'normal',
                sets: { my: 'rated', his: 'rated' }, filters: default_filter_state(),
                scoreMode: 'hidden', missingScoreAsZero: false, factors: [], ...overrides,
            })
            const rating_factor = (id, direction, weight) => ({ id, direction, weight })
            const DEFAULT_PRESET_RULES = {
                important: { name: '重要番剧', description: '按对方有评分、已收藏但未评分、未收藏分段展示重要番剧。', sections: [
                    make_section('opponent_rated', '有评分', { sets: { my: 'important', his: 'rated' }, scoreMode: 'raw', factors: [rating_factor('his_rating', 'positive', 3)] }),
                    make_section('opponent_unrated', '未评分', { sets: { my: 'important', his: 'collected' }, filters: { ...default_filter_state(), his_tiers: ['unrated'] }, scoreMode: 'raw', missingScoreAsZero: true, factors: [rating_factor('my_rating', 'positive', 3)] }),
                    make_section('opponent_uncollected', '未收藏', { sets: { my: 'important', his: 'uncollected' }, scoreMode: 'raw', missingScoreAsZero: true, appearance: 'muted', factors: [rating_factor('my_rating', 'positive', 3)] }),
                ] },
                discover_important: { name: '发现重要番剧', description: '先列出已标重要番剧，再按我的高低评分与大众评价差异发现候选，最后补充剩余收藏。', sections: [
                    make_section('marked_important', '已标重要番剧', { sets: { my: 'important', his: 'any' }, scoreMode: 'raw', missingScoreAsZero: true, factors: [rating_factor('my_rating', 'positive', 3)] }),
                    make_section('discover_my_high', '好评高差异番剧', { claimMatches: false, sets: { my: 'not_important', his: 'any' }, filters: { ...default_filter_state(), my_tiers: ['high'] }, factors: [rating_factor('my_conformity', 'negative', 3)] }),
                    make_section('my_high_rated', '高分番剧', { sets: { my: 'rated', his: 'any' }, filters: { ...default_filter_state(), my_tiers: ['high'] }, scoreMode: 'raw', factors: [rating_factor('my_rating', 'positive', 3)] }),
                    make_section('discover_my_low', '差评高差异番剧', { claimMatches: false, sets: { my: 'not_important', his: 'any' }, filters: { ...default_filter_state(), my_tiers: ['low'] }, factors: [rating_factor('my_conformity', 'negative', 3)] }),
                    make_section('my_low_rated', '低分番剧', { sets: { my: 'rated', his: 'any' }, filters: { ...default_filter_state(), my_tiers: ['low'] }, scoreMode: 'raw', factors: [rating_factor('my_rating', 'negative', 3)] }),
                    make_section('remaining_collected', '剩余已收藏番剧', { limit: 20, sets: { my: 'collected', his: 'any' }, factors: [rating_factor('my_recency', 'positive', 3)] }),
                ] },
                high_sync: { name: '高同步率', description: '依次展示双方共同好评、共同差评与共同中评。', sections: [
                    make_section('both_high', '共同好评', { filters: { ...default_filter_state(), my_tiers: ['high'], his_tiers: ['high'] }, factors: [rating_factor('my_rating', 'positive', 2), rating_factor('his_rating', 'positive', 2), rating_factor('agreement', 'positive', 1)] }),
                    make_section('both_low', '共同差评', { filters: { ...default_filter_state(), my_tiers: ['low'], his_tiers: ['low'] }, factors: [rating_factor('my_rating', 'negative', 2), rating_factor('his_rating', 'negative', 2), rating_factor('agreement', 'positive', 1)] }),
                    make_section('both_medium', '共同中评', { filters: { ...default_filter_state(), my_tiers: ['medium'], his_tiers: ['medium'] }, factors: [rating_factor('agreement', 'positive', 3)] }),
                ] },
                low_sync: { name: '低同步率', description: '按评价方向分段展示双方口味分歧。', sections: [
                    ['my_high_his_low', '我好他差', 'high', 'low'], ['my_low_his_high', '我差他好', 'low', 'high'],
                    ['my_medium_his_low', '我中他差', 'medium', 'low'], ['my_low_his_medium', '我差他中', 'low', 'medium'],
                    ['my_high_his_medium', '我好他中', 'high', 'medium'], ['my_medium_his_high', '我中他好', 'medium', 'high'],
                ].map(([id, name, my_tier, his_tier]) => make_section(id, name, { filters: { ...default_filter_state(), my_tiers: [my_tier], his_tiers: [his_tier] }, factors: [rating_factor('agreement', 'negative', 3)] })) },
                common_new: { name: '共同追新', description: '展示双方在看的作品，并补充双方看过、搁置或抛弃的近期收藏交集。', sections: [
                    make_section('both_watching', '双方在看', { sets: { my: 'collected', his: 'collected' }, filters: { ...default_filter_state(), my_types: [3], his_types: [3] }, factors: [rating_factor('freshness', 'positive', 3), rating_factor('my_recency', 'positive', 1), rating_factor('his_recency', 'positive', 1)] }),
                    make_section('shared_recent_history', '共同收藏近况', { limit: 10, sets: { my: 'collected', his: 'collected' }, filters: { ...default_filter_state(), my_types: [2, 4, 5], his_types: [2, 4, 5] }, factors: [rating_factor('my_recency', 'positive', 1), rating_factor('his_recency', 'positive', 1)] }),
                ] },
                wanted_recommendation: { name: '想看推荐', description: '优先展示对方对我想看清单的情况，再补充对方的高分作品。', sections: [
                    make_section('wanted_rated', '想看推荐', { limit: null, sets: { my: 'collected', his: 'collected' }, filters: { ...default_filter_state(), my_types: [1] }, scoreMode: 'raw', factors: [rating_factor('his_rating', 'positive', 3)] }),
                    make_section('opponent_high', '对方高分', { sets: { my: 'any', his: 'rated' }, filters: { ...default_filter_state(), his_tiers: ['high'] }, factors: [rating_factor('his_rating', 'positive', 3)] }),
                ] },
            }

            function get_effective_preset(sort_key) {
                const base = DEFAULT_PRESET_RULES[sort_key] || DEFAULT_PRESET_RULES.important
                const override = preset_rule_overrides[sort_key]
                return override ? { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(override)), name: base.name } : base
            }

            function get_rule_for_sort(sort_key) {
                if (sort_key.startsWith('custom:')) {
                    const rule = custom_sort_document.rules[sort_key.slice('custom:'.length)]
                    return rule && !rule.deletedAt ? rule : get_effective_preset('important')
                }
                return get_effective_preset(sort_key)
            }

            const expanded_result_sections = new Map()
            let expanded_result_sort_key = analyze_config.current_sort

            function getEvaluatedRule(sort_key) {
                if (sort_key !== expanded_result_sort_key) {
                    expanded_result_sections.clear()
                    expanded_result_sort_key = sort_key
                }
                return evaluate_rule(get_rule_for_sort(sort_key), expanded_result_sections)
            }

            const public_rank_values = result.comparison_items
                .map(item => Number(item.subject.rank))
                .filter(rank => rank > 0)
                .sort((a, b) => a - b)
            const public_rank_good_max = public_rank_values[Math.ceil(public_rank_values.length / 3) - 1] ?? null
            const public_rank_medium_max = public_rank_values[Math.ceil(public_rank_values.length * 2 / 3) - 1] ?? null

            function render_custom_sort_buttons_html() {
                return get_active_custom_rules().map(rule => `
                    <button class="sort-tab custom-sort-tab${analyze_config.current_sort === `custom:${rule.id}` ? ' active' : ''}"
                        data-sort="custom:${escapeHtml(rule.id)}" data-rule-id="${escapeHtml(rule.id)}"
                        title="左键应用，右键管理">${escapeHtml(rule.name)}</button>
                `).join('')
            }

            // ─── 构建 UI ───

            function get_compact_score_level(user, rate) {
                if (!Number.isFinite(rate) || rate <= 0) return 'neutral'
                const low = analyze_config[user + '_threshold_low']
                const high = analyze_config[user + '_threshold_high']
                return rate <= low ? 'low' : rate <= high ? 'medium' : 'high'
            }

            function compact_status_badge_html(review, level) {
                const labels = { 1: '想', 3: '在', 4: '搁', 5: '抛' }
                const label = labels[Number(review?.type)]
                return label ? `<span class="_compact_status_badge __${level}" title="${collTypeMap[String(review.type)]}">${label}</span>` : ''
            }

            function get_public_rank_level(subject) {
                const rank = Number(subject.rank)
                if (rank <= 0 || public_rank_good_max == null) return 'neutral'
                if (rank <= public_rank_good_max) return 'high'
                if (rank <= public_rank_medium_max) return 'medium'
                return 'low'
            }

            // 简略图渲染（封面 + 双方评分/吐槽字数 + 展开详情）
            function render_compact_card(review) {
                const my_rate = review.my_review ? review.my_review.rate : null
                const his_rate = review.his_review ? review.his_review.rate : null
                const my_hidden = review.my_review?.hidden ?? null
                const his_hidden = review.his_review?.hidden ?? null
                const my_display_score = analyze_config.score_display === 'hidden' ? my_hidden : my_rate
                const his_display_score = analyze_config.score_display === 'hidden' ? his_hidden : his_rate
                const pub = review.subject.score
                const public_display_score = analyze_config.score_display === 'hidden' ? review.public_hidden : pub
                const my_comment = review.my_review?.comment ? escapeHtml(review.my_review.comment) : ''
                const his_comment = review.his_review?.comment ? escapeHtml(review.his_review.comment) : ''
                const his_comment_chars = review.his_review?.comment_chars ?? count_text_chars(review.his_review?.comment)
                const name = escapeHtml(getSubjectDisplayName(review.subject))
                const subject_type_label = subject_config[Number(review.subject.type)]?.name || ''
                const total = review.subject.collection_total || 0
                const my_type = review.my_review?.type
                const his_type = review.his_review?.type
                const my_score_level = get_compact_score_level('my', my_rate)
                const his_score_level = get_compact_score_level('his', his_rate)
                const my_status = my_type && my_type !== 2 ? `（${collTypeMap[String(my_type)]}）` : ''
                const his_status = his_type && his_type !== 2 ? `（${collTypeMap[String(his_type)]}）` : ''
                const public_hidden = review.public_hidden ?? null
                return `
                <div class="_compact_card${important_subject_ids.has(Number(review.subject.id)) ? ' __important' : ''}${review._section_muted ? ' __section_muted' : ''}" data-subject-id="${Number(review.subject.id)}" data-subject-url="/subject/${Number(review.subject.id)}">
                    <img src="${review.subject.images?.grid || ''}" loading="lazy"/>
                    <div class="_compact_scores _compact_user_scores">
                        ${review.my_review ? `
                        <span class="_compact_score __${my_score_level}" title="我的评分：原始 ${my_rate || '-'} / 隐藏 ${my_hidden ?? '-'}">
                            ${compact_status_badge_html(review.my_review, my_score_level)}
                            <span class="_compact_score_avatar"><img src="${my_avatar}" alt="我" /></span>
                            <b>${my_display_score > 0 ? my_display_score : '-'}</b>
                        </span>` : ''}
                        ${review.his_review ? `
                        <span class="_compact_score __${his_score_level}" title="对方评分：原始 ${his_rate || '-'} / 隐藏 ${his_hidden ?? '-'}">
                            ${compact_status_badge_html(review.his_review, his_score_level)}
                            <span class="_compact_score_avatar"><img src="${his_avatar}" alt="对方" /></span>
                            <b>${his_display_score > 0 ? his_display_score : '-'}</b>
                        </span>` : ''}
                        ${his_comment_chars > 0 ? `<span class="_compact_comment_indicator __${his_score_level}" title="对方有吐槽">+</span>` : ''}
                    </div>
                    <span class="_compact_score _compact_public_score __public __${get_public_rank_level(review.subject)}" title="大众评分：原始 ${pub || '-'} / 隐藏 ${review.public_hidden ?? '-'}（排名 ${review.subject.rank || '无'}）">
                        <b>${public_display_score > 0 ? public_display_score : '-'}</b>
                    </span>
                    <div class="_compact_tip">
                        <div class="_compact_detail_title">${name}${subject_type_label ? `（${escapeHtml(subject_type_label)}）` : ''}（${total.toLocaleString()} 人收藏）</div>
                        <table class="_compact_score_table">
                            <thead><tr><th>评分方</th><th>原始分</th><th>隐藏分</th></tr></thead>
                            <tbody>
                                <tr><th><img src="${my_avatar}" alt="" />${my_status}</th><td>${my_rate || '—'}</td><td>${my_hidden ?? '—'}</td></tr>
                                <tr><th><img src="${his_avatar}" alt="" />${his_status}</th><td>${his_rate || '—'}</td><td>${his_hidden ?? '—'}</td></tr>
                                <tr><th>大众</th><td>${pub ?? '—'}</td><td>${public_hidden ?? '—'}</td></tr>
                            </tbody>
                        </table>
                        <div class="_compact_detail_actions" data-subject-id="${Number(review.subject.id)}" data-subject-url="/subject/${Number(review.subject.id)}">
                            <button type="button" class="_compact_detail_action __important" data-card-action="important">${important_subject_ids.has(Number(review.subject.id)) ? '取消重要' : '标记重要'}</button>
                            <button type="button" class="_compact_detail_action" data-card-action="open">前往链接</button>
                            ${my_comment ? `<button type="button" class="_compact_my_comment_toggle" aria-expanded="${analyze_config.my_comment_collapsed ? 'false' : 'true'}">${analyze_config.my_comment_collapsed ? '展开我的吐槽' : '折叠我的吐槽'}</button>` : ''}
                        </div>
                        ${his_comment ? `<div class="_compact_detail_comment"><b>对方吐槽：</b>${his_comment}</div>` : ''}
                        ${my_comment ? `<div class="_compact_my_comment_block${analyze_config.my_comment_collapsed ? ' is-collapsed' : ''}">
                            <div class="_compact_detail_comment _compact_my_comment"><b>我的吐槽：</b>${my_comment}</div>
                        </div>` : ''}
                    </div>
                </div>`
            }

            // 渲染列表；多分段规则即使某段为空，也保留标题与条目总数。
            function render_rule_result(evaluation) {
                const multi_section = evaluation.sections.length > 1
                return evaluation.sections.map(({ section, items, totalSortedCount }) => {
                    const header = `<div class="rule-section-header">${multi_section ? `<strong>${escapeHtml(section.name)}</strong>` : ''}<b class="rule-section-count">${totalSortedCount} 部</b>${section.description ? `<span>${escapeHtml(section.description)}</span>` : ''}</div>`
                    const cards = items.map((item, index) => {
                        const hidden_count = index === items.length - 1 ? Math.max(0, totalSortedCount - items.length) : 0
                        const review = {
                            ...item,
                            _section_id: section.id,
                            _section_name: section.name,
                            _section_description: section.description || '',
                            _section_muted: section.appearance === 'muted',
                            _section_start: index === 0,
                            _section_end: index === items.length - 1,
                            _section_hidden_count: hidden_count,
                            _multi_section: multi_section,
                        }
                        const more = hidden_count > 0
                            ? `<div class="rule-section-more" data-section-id="${escapeHtml(section.id)}"><strong>还剩 ${hidden_count} 部</strong><button type="button" data-section-expand="10" data-hidden-count="${hidden_count}">展开 10 部</button><button type="button" data-section-expand="all" data-hidden-count="${hidden_count}">展开所有</button></div>`
                            : ''
                        return `${render_compact_card(review)}${more}`
                    }).join('')
                    return `${header}${cards}`
                }).join('')
            }

            function render_hidden_score_panel() {
                const table_rows = Array.from({ length: 10 }, (_, index) => 10 - index).map(rate => {
                    const my_count = result.my_all_rate_count_map[rate] || 0
                    const his_count = result.his_all_rate_count_map[rate] || 0
                    return `<tr>
                        <th>${rate}</th>
                        <td title="${my_count} 个收藏">${my_count ? result.my_hidden_map[rate] : '—'}</td>
                        <td title="${his_count} 个收藏">${his_count ? result.his_hidden_map[rate] : '—'}</td>
                    </tr>`
                }).join('')

                const width = 420, height = 190, left = 38, right = 12, top = 12, bottom = 30
                const plot_w = width - left - right
                const plot_h = height - top - bottom
                const max_count = Math.max(
                    1,
                    ...Object.values(result.my_all_rate_count_map),
                    ...Object.values(result.his_all_rate_count_map)
                )
                const x = rate => left + (rate - 1) / 9 * plot_w
                const y = count => top + (max_count - count) / max_count * plot_h
                const line = counts => Array.from({ length: 10 }, (_, index) => {
                    const rate = index + 1
                    return `${index === 0 ? 'M' : 'L'} ${x(rate).toFixed(1)} ${y(counts[rate] || 0).toFixed(1)}`
                }).join(' ')
                const points = (counts, color) => Array.from({ length: 10 }, (_, index) => {
                    const rate = index + 1
                    const count = counts[rate] || 0
                    return `<circle class="hidden-chart-point" data-rate="${rate}" cx="${x(rate)}" cy="${y(count)}" r="5" fill="${color}" />`
                }).join('')
                const x_labels = Array.from({ length: 10 }, (_, index) => {
                    const rate = index + 1
                    return `<text x="${x(rate)}" y="${height - 8}" text-anchor="middle" font-size="10" fill="currentColor">${rate}</text>`
                }).join('')
                return `
                    <div class="hidden-chart-title">原始分对应隐藏分</div>
                    <table class="hidden-score-table">
                        <thead><tr><th>原始分</th><th><img src="${my_avatar}" alt="我" title="我" /></th><th><img src="${his_avatar}" alt="对方" title="对方" /></th></tr></thead>
                        <tbody>${table_rows}</tbody>
                    </table>
                    <div class="hidden-chart-title">原始分收藏数量</div>
                    <svg viewBox="0 0 ${width} ${height}" aria-label="双方原始分收藏数量折线图">
                        <line x1="${left}" y1="${top + plot_h}" x2="${width - right}" y2="${top + plot_h}" stroke="#888" />
                        <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plot_h}" stroke="#888" />
                        <line x1="${left}" y1="${y(Math.round(max_count / 2))}" x2="${width - right}" y2="${y(Math.round(max_count / 2))}" stroke="#aaa" stroke-dasharray="3 3" opacity="0.45" />
                        <path d="${line(result.my_all_rate_count_map)}" fill="none" stroke="#04f" stroke-width="2" />
                        <path d="${line(result.his_all_rate_count_map)}" fill="none" stroke="#f40" stroke-width="2" />
                        ${points(result.my_all_rate_count_map, '#04f')}
                        ${points(result.his_all_rate_count_map, '#f40')}
                        ${x_labels}
                        <text x="4" y="${top + 5}" font-size="10" fill="currentColor">${max_count}</text>
                        <text x="22" y="${top + plot_h}" font-size="10" fill="currentColor">0</text>
                    </svg>
                    <div class="hidden-chart-legend"><span class="my">● 我</span><span class="his">● 对方</span></div>
                `
            }

            // 完整页面
            const initial_rule_evaluation = getEvaluatedRule(analyze_config.current_sort)
            let subject_search_results = []
            let subject_search_request_id = 0
            let subject_search_status = ''
            let subject_search_status_kind = ''
            const page_html = `
            <style>
                .鉴定_page { line-height: 1.5; font-size: 16px; padding-top: 15px; }
                .鉴定_page * { box-sizing: border-box; }
                .analysis-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
                .sort-area { flex: 0 0 600px; width: 600px; min-width: 0; }
                .sort-track { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
                #panel { width: 450px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; flex-shrink: 0; }
                .mobile-only-control, .mobile-settings-toggle { display: none; }
                .鉴定_page ._compact_card {
                    position: relative;
                    display: block;
                    width: 100px;
                    height: 140px;
                    cursor: pointer;
                }
                .鉴定_page ._compact_card > img {
                    width: 100px;
                    height: 140px;
                    object-fit: cover;
                    border-radius: 4px;
                    display: block;
                }
                .鉴定_page ._compact_card.__important > img { outline: 4px solid #f2b705; outline-offset: -4px; }
                .鉴定_page ._compact_card.__section_muted { opacity: 0.5; }
                .鉴定_page ._compact_card.__section_muted:hover { opacity: 0.72; }
                .rule-section-header { grid-column:1/-1;display:flex;align-items:baseline;gap:8px;width:100%;padding-top:8px;border-top:1px dashed #bbb; }
                .rule-section-header:first-child { padding-top: 0; border-top: 0; }
                .rule-section-count { color:inherit;font-size:15px;font-weight:700;white-space:nowrap; }
                .rule-section-header span { color:#888;font-size:12px; }
                .rule-section-more {
                    width:100px;height:140px;padding:6px;border:2px dashed rgba(127,127,127,0.55);border-radius:4px;
                    color:inherit;background:transparent;
                    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
                }
                .rule-section-more strong { color:inherit;font-size:14px;font-weight:700; }
                .rule-section-more button { padding:2px 6px;border:1px solid rgba(127,127,127,0.45);border-radius:4px;color:inherit;background:transparent;cursor:pointer;font-size:12px; }
                .rule-section-more:hover { border-color:#F09199;background:rgba(240,145,153,0.08); }
                .rule-section-more button:hover { border-color:#F09199;color:#F09199; }
                .鉴定_page ._compact_card:hover > img { opacity: 0.7; }
                .鉴定_page ._compact_scores {
                    position: absolute;
                    top: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    pointer-events: none;
                }
                .鉴定_page ._compact_user_scores {
                    right: 4px;
                    align-items: flex-end;
                }
                .鉴定_page ._compact_score {
                    display: flex;
                    align-items: center;
                    gap: 0;
                    background: #222;
                    color: #fff;
                    font-size: 11px;
                    line-height: 15px;
                    padding: 1px 3px 1px 1px;
                    border-radius: 8px 3px 3px 8px;
                }
                .鉴定_page ._compact_score.__low { background: #04f; }
                .鉴定_page ._compact_score.__medium { background: #fc0; color: #332800; }
                .鉴定_page ._compact_score.__high { background: #f40; }
                .鉴定_page ._compact_score.__neutral { background: #222; }
                .鉴定_page ._compact_status_badge {
                    display:inline-flex;align-items:center;justify-content:center;flex:0 0 15px;width:15px;height:15px;
                    margin-right:2px;border:1px solid rgba(255,255,255,.75);border-radius:50%;box-sizing:border-box;
                    color:#fff;background:#222;font:700 9px/1 sans-serif;
                }
                .鉴定_page ._compact_status_badge.__low { background:#04f; }
                .鉴定_page ._compact_status_badge.__medium { color:#332800;background:#fc0;border-color:rgba(51,40,0,.45); }
                .鉴定_page ._compact_status_badge.__high { background:#f40; }
                .鉴定_page ._compact_status_badge.__neutral { background:#222; }
                .鉴定_page ._compact_public_score {
                    position: absolute;
                    top: 4px;
                    left: 4px;
                    padding: 1px 4px;
                    border-radius: 3px;
                    pointer-events: none;
                }
                .鉴定_page ._compact_score img {
                    width: 15px;
                    height: 15px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .鉴定_page ._compact_score_avatar { position: relative; display: flex; flex: 0 0 15px; width: 15px; height: 15px; }
                .鉴定_page ._compact_comment_indicator {
                    align-self: flex-end; width: 14px; height: 14px; border-radius: 50%;
                    color: #fff; background: #222; font: 700 12px/14px sans-serif; text-align: center;
                }
                .鉴定_page ._compact_comment_indicator.__low { background: #04f; }
                .鉴定_page ._compact_comment_indicator.__medium { color: #332800; background: #fc0; }
                .鉴定_page ._compact_comment_indicator.__high { background: #f40; }
                .鉴定_page ._compact_comment_indicator.__neutral { background: #222; }
                .鉴定_page ._compact_score b {
                    min-width: 1.2em;
                    margin-left: -1px;
                    text-align: right;
                }
                .鉴定_page ._compact_tip {
                    display: none;
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.85);
                    color: #fff;
                    font-size: 14px;
                    padding: 4px 8px;
                    border-radius: 3px;
                    width: max-content;
                    max-width: 450px;
                    word-break: break-all;
                    pointer-events: none;
                    z-index: 1;
                    margin-bottom: 2px;
                }
                .鉴定_page ._compact_inline_detail {
                    grid-column: 1 / -1; width: 100%; min-width: 0; max-width: 100%;
                    padding: 10px 12px; overflow-x: auto; overflow-wrap: anywhere;
                    color: #333; background: rgba(240,145,153,0.12); border-left: 3px solid transparent;
                    border-radius: 5px; line-height: 1.65;
                }
                .鉴定_page ._compact_inline_detail.__locked { border-left-color: #F09199; }
                .鉴定_page ._compact_detail_title { margin-bottom: 7px; font-weight: 700; }
                .鉴定_page ._compact_score_table {
                    width: min(100%, 280px); border-collapse: collapse; table-layout: fixed;
                    font-size: 13px; line-height: 1.35;
                }
                .鉴定_page ._compact_score_table th, .鉴定_page ._compact_score_table td {
                    padding: 5px 7px; border: 1px solid rgba(127,127,127,0.35); text-align: center;
                }
                .鉴定_page ._compact_score_table tbody th { text-align: left; font-weight: 500; }
                .鉴定_page ._compact_score_table img {
                    width: 18px; height: 18px; margin-right: 5px; border-radius: 50%; object-fit: cover; vertical-align: -5px;
                }
                .鉴定_page ._compact_public_hidden_note { margin-top: 4px; color: #888; font-size: 11px; }
                .鉴定_page ._compact_detail_actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
                .鉴定_page ._compact_detail_action, .鉴定_page ._compact_my_comment_toggle {
                    padding:2px 7px;border:1px solid rgba(127,127,127,0.45);border-radius:4px;
                    color:inherit;background:transparent;cursor:pointer;font-size:12px;line-height:1.5;
                }
                .鉴定_page ._compact_detail_action:hover, .鉴定_page ._compact_my_comment_toggle:hover { border-color:#F09199;color:#F09199;background:rgba(240,145,153,0.08); }
                .鉴定_page ._compact_detail_action.__important { border-color:rgba(242,183,5,0.65);background:rgba(242,183,5,0.2); }
                .subject-search-panel { margin:0 0 14px;padding:10px;border:1px solid rgba(127,127,127,.32);border-radius:7px;background:rgba(127,127,127,.04); }
                .subject-search-form { display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px; }
                .subject-search-form input { min-width:0;padding:6px 8px;border:1px solid #bbb;border-radius:4px;color:inherit;background:transparent; }
                .subject-search-form button,.subject-search-important {
                    padding:5px 10px;border:1px solid #bbb;border-radius:4px;color:inherit;background:transparent;cursor:pointer;
                }
                .subject-search-status { display:block;min-height:1.5em;margin-top:5px;color:#888;font-size:12px; }
                .subject-search-status[data-kind="error"] { color:#c33; }
                .subject-search-status[data-kind="fallback"] { color:#a06d00; }
                .subject-search-results { display:grid;gap:6px;margin-top:5px; }
                .subject-search-result { display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:9px;padding:6px;border-radius:5px;background:rgba(127,127,127,.07); }
                .subject-search-result > img { width:44px;height:56px;border-radius:3px;object-fit:cover;background:rgba(127,127,127,.15); }
                .subject-search-result-main { min-width:0; }
                .subject-search-result-main a { display:block;overflow:hidden;color:inherit;font-weight:700;text-overflow:ellipsis;white-space:nowrap; }
                .subject-search-result-main small { color:#888; }
                .subject-search-important { border-color:rgba(196,143,0,.72);color:#8a6200;background:rgba(242,183,5,.2);white-space:nowrap; }
                .subject-search-important:hover { background:rgba(242,183,5,.32); }
                html[data-theme=dark] .subject-search-important { color:#f1c94b;border-color:rgba(242,183,5,.72);background:rgba(242,183,5,.16); }
                @media (max-width:600px) {
                    .subject-search-result { grid-template-columns:38px minmax(0,1fr); }
                    .subject-search-result > img { width:38px;height:50px;grid-row:1/3; }
                    .subject-search-important { grid-column:2;justify-self:start; }
                }
                .鉴定_page ._compact_detail_comment { margin-top: 8px; white-space: pre-wrap; }
                .鉴定_page ._compact_my_comment_block { margin-top: 8px; }
                .鉴定_page ._compact_my_comment_block.is-collapsed ._compact_my_comment { display: none; }
                html[data-theme=dark] .鉴定_page ._compact_inline_detail { color: #ddd; background: rgba(240,145,153,0.16); }
                .鉴定_page .sort-tab { padding: 8px 18px; cursor: pointer; font-size: 1.1em; font-weight: bold; border: 1px solid #ccc; border-radius: 4px; background: transparent; }
                .鉴定_page .sort-tab.active { background: #F09199; color: #fff; border-color: #F09199; }
                #subject-type-menu, #opponent-menu { background: #fff; border: 1px solid #ccc; }
                html[data-theme=dark] #subject-type-menu, html[data-theme=dark] #opponent-menu { background: #2c2c2c; border-color: #555; }
                html[data-theme=dark] #subject-type-menu label:hover, html[data-theme=dark] .opponent-option:hover { background: #3a3a3a; }
                .opponent-option { display: flex; width: 100%; align-items: center; gap: 7px; padding: 6px 9px; border: 0; background: transparent; text-align: left; cursor: pointer; }
                .opponent-option img, #opponent-select-btn img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
                .opponent-row { display: grid; grid-template-columns: minmax(0,1fr) auto auto; align-items: center; }
                .opponent-row:hover { background: rgba(127,127,127,0.1); }
                .opponent-cache-action { width: 28px; height: 28px; padding: 0; border: 0; border-radius: 4px; background: transparent; cursor: pointer; }
                .opponent-cache-action:hover { background: rgba(127,127,127,0.18); }
                .opponent-stale-option { min-width:0;padding:6px 9px;font-weight:700; }
                .opponent-stale-option small { display:block;color:#888;font-weight:400;overflow-wrap:anywhere; }
                .friend-loader-backdrop { position: fixed; inset: 0; z-index: 10035; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0,0,0,0.48); }
                .friend-loader-modal { width: min(900px, 96vw); max-height: 88vh; overflow: hidden; display: flex; flex-direction: column; padding: 16px; color: #333; background: #fff; border-radius: 10px; }
                .friend-loader-bulk { display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px; }
                .friend-loader-bulk input { width:86px;min-width:0;padding:5px 7px; }
                .friend-loader-list { min-height: 180px; overflow-y: auto; display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 7px; margin: 10px 0; }
                .friend-loader-item { position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;padding:8px 4px;border:1px solid #ddd;border-radius:6px;text-align:center;cursor:pointer; }
                .friend-loader-item:has(input:checked) { border-color:#F09199;background:rgba(240,145,153,0.12); }
                .friend-loader-item input { position:absolute;opacity:0;pointer-events:none; }
                .friend-loader-item img { width:40px;height:40px;border-radius:50%;object-fit:cover; }
                .friend-loader-item span { width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px; }
                .friend-loader-item small { width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888;font-size:10px; }
                .friend-loader-actions { display:flex;justify-content:flex-end;gap:8px; }
                html[data-theme=dark] .friend-loader-modal { color: #ddd; background: #2c2c2c; }
                html[data-theme=dark] .friend-loader-item { border-color: #555; }
                #hidden-score-container { position: relative; }
                #hidden-score-container.is-open #hidden-score-overlay { display: block; }
                #hidden-score-overlay {
                    display: none; position: absolute; top: -100px; right: calc(100% + 8px); z-index: 30;
                    width: 460px; max-height: 75vh; overflow-y: auto; padding: 12px;
                    color: #333; background: #fff; border: 1px solid #ccc; border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                #hidden-score-overlay svg { display: block; width: 100%; height: auto; }
                #hidden-chart-tooltip { display:none;position:absolute;z-index:2;padding:3px 7px;transform:translateY(-100%);color:#fff;background:rgba(0,0,0,0.86);border-radius:4px;font-size:12px;white-space:nowrap;pointer-events:none; }
                .hidden-chart-point { cursor: crosshair; }
                #hidden-score-overlay .hidden-chart-title { margin: 4px 0; font-size: 0.85em; font-weight: 700; }
                #hidden-score-overlay .hidden-score-table, .mobile-sheet-content .hidden-score-table { width: 150px; max-width: 100%; margin: 0 auto 12px; border-collapse: collapse; text-align: center; font-size: 0.8em; }
                #hidden-score-overlay .hidden-score-table th,
                #hidden-score-overlay .hidden-score-table td { padding: 3px 8px; border: 1px solid #ddd; }
                #hidden-score-overlay .hidden-score-table th:first-child { width: 34%; }
                #hidden-score-overlay .hidden-score-table img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; vertical-align: middle; }
                #hidden-score-overlay .hidden-chart-legend { display: flex; justify-content: center; gap: 18px; font-size: 0.8em; }
                #hidden-score-overlay .hidden-chart-legend .my { color: #04f; }
                #hidden-score-overlay .hidden-chart-legend .his { color: #f40; }
                html[data-theme=dark] #hidden-score-overlay { color: #ddd; background: #2c2c2c; border-color: #555; }
                html[data-theme=dark] #hidden-score-overlay .hidden-score-table th,
                html[data-theme=dark] #hidden-score-overlay .hidden-score-table td { border-color: #555; }
                #custom-cloud-status[data-status="error"] { color: #d33; border-color: #d33 !important; }
                #custom-cloud-status[data-status="pending"] { color: #b87500; border-color: #b87500 !important; }
                #cloud-sync-menu {
                    display: none; position: absolute; top: 100%; right: 0; z-index: 35;
                    min-width: 130px; padding: 4px; background: #fff; border: 1px solid #ccc;
                    border-radius: 5px; box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                }
                #cloud-sync-menu button { display: block; width: 100%; padding: 5px 8px; border: 0; background: transparent; text-align: left; cursor: pointer; }
                #cloud-sync-menu button:hover { background: #eee; }
                html[data-theme=dark] #cloud-sync-menu { background: #2c2c2c; border-color: #555; }
                html[data-theme=dark] #cloud-sync-menu button:hover { background: #444; }
                .custom-sort-modal-backdrop {
                    position: fixed; inset: 0; z-index: 10020; display: flex; align-items: center;
                    justify-content: center; padding: 24px; background: rgba(0,0,0,0.45);
                }
                .custom-sort-modal {
                    width: min(900px, 95vw); max-height: 90vh; overflow-y: auto; padding: 18px;
                    color: #333; background: #fff; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.35);
                }
                .custom-modal-header {
                    position: sticky; top: -18px; z-index: 4; display: flex; align-items: center;
                    justify-content: space-between; gap: 12px; margin: -18px -18px 12px; padding: 14px 18px 10px;
                    background: inherit; border-bottom: 1px solid rgba(127,127,127,0.2);
                }
                .custom-sort-modal h2 { margin: 0; }
                .custom-sort-modal h3 { margin: 16px 0 8px; font-size: 15px; }
                .custom-sort-modal h3 small { margin-left: 6px; color: #888; font-weight: normal; }
                .custom-sort-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
                .custom-sort-form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85em; }
                .custom-sort-modal input, .custom-sort-modal select, .custom-sort-modal textarea { min-height: 30px; padding: 4px 6px; }
                .custom-sort-modal textarea { resize: vertical; }
                .custom-filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
                .custom-filter-grid > label { display: flex; flex-direction: column; gap: 4px; }
                .custom-chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 5px; }
                .custom-chip-row label { display: flex; align-items: center; gap: 3px; }
                .custom-chip-row input { min-height: auto; }
                .custom-radio-row { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 5px; }
                .custom-radio-row label { display: flex; align-items: center; gap: 3px; white-space: nowrap; }
                .custom-radio-row input { min-height: auto; }
                .custom-advanced-filter { margin-top: 10px; }
                .custom-advanced-filter summary { cursor: pointer; color: #666; }
                .custom-range-row { display: grid; grid-template-columns: 130px 1fr auto 1fr; align-items: center; gap: 6px; margin-top: 7px; }
                .custom-factor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
                .custom-factor-card { position: relative; padding: 9px; border: 1px solid #ddd; border-radius: 7px; opacity: 0.62; }
                .custom-factor-card.enabled { border-color: #F09199; background: rgba(240,145,153,0.08); opacity: 1; }
                .factor-switch { display: flex; align-items: center; gap: 4px; }
                .factor-switch input { min-height: auto; }
                .factor-group { position: absolute; top: 8px; right: 8px; color: #999; font-size: 11px; }
                .factor-controls { display: none; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 7px; }
                .custom-factor-card.enabled .factor-controls { display: grid; }
                .custom-preview { min-height: 82px; margin-top: 10px; padding: 8px; background: #f5f5f5; border-radius: 6px; }
                .custom-preview-items { display: flex; gap: 8px; margin-top: 6px; }
                .custom-preview-item { position: relative; width: 74px; padding: 4px; border: 0; background: transparent; font-size: 10px; overflow: hidden; text-align: left; cursor: pointer; }
                .custom-preview-item img { width: 50px; height: 68px; object-fit: cover; display: block; }
                .custom-preview-item span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .custom-preview-item b { position: absolute; top: 4px; left: 4px; padding: 1px 3px; color: #fff; background: #F09199; }
                .custom-score-detail { margin-top: 8px; }
                .custom-score-detail table { width: 100%; margin-top: 5px; border-collapse: collapse; font-size: 12px; }
                .custom-score-detail th, .custom-score-detail td { padding: 3px 6px; border-bottom: 1px solid #ddd; text-align: right; }
                .custom-score-detail th:first-child, .custom-score-detail td:first-child { text-align: left; }
                .custom-modal-note { margin: 8px 0 0; color: #888; font-size: 12px; }
                .custom-modal-actions { display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
                .rule-section-tabs { display:flex;align-items:flex-end;gap:2px;margin-top:14px;padding:0 6px;border-bottom:1px solid #ccc;overflow-x:auto;scrollbar-width:thin; }
                .rule-section-tab { flex:0 0 auto;min-width:42px;margin-bottom:-1px;padding:7px 14px;border:1px solid transparent;border-bottom-color:#ccc;border-radius:7px 7px 0 0;color:inherit;background:rgba(127,127,127,0.08);cursor:pointer; }
                .rule-section-tab:hover { background:rgba(240,145,153,0.1); }
                .rule-section-tab.active { position:relative;border-color:#ccc;border-bottom-color:#fff;background:#fff;color:#d95d69;font-weight:700; }
                .rule-section-editor { margin-top:0;padding:12px;border:1px solid #ccc;border-top:0;border-radius:0 0 8px 8px; }
                .rule-section-editor > header { display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px; }
                .rule-section-editor > header button { min-width:30px; }
                .section-inline-options { display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0; }
                .section-inline-options label { display:flex;align-items:center;gap:4px;font-size:12px; }
                .section-preview + .section-preview { margin-top:10px;padding-top:8px;border-top:1px solid #ddd; }
                .custom-context-menu {
                    position: fixed; z-index: 10030; min-width: 110px; padding: 4px;
                    background: #fff; border: 1px solid #ccc; border-radius: 5px; box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                }
                .custom-context-menu button { display: block; width: 100%; padding: 5px 9px; border: 0; background: transparent; text-align: left; cursor: pointer; }
                .custom-context-menu button:hover { background: #eee; }
                html[data-theme=dark] .custom-sort-modal, html[data-theme=dark] .custom-context-menu { color: #ddd; background: #2c2c2c; }
                html[data-theme=dark] .custom-preview { background: #222; }
                html[data-theme=dark] .custom-factor-card { border-color: #555; }
                html[data-theme=dark] .custom-factor-card.enabled { border-color: #F09199; }
                html[data-theme=dark] .rule-section-tabs { border-color:#555; }
                html[data-theme=dark] .rule-section-tab { border-bottom-color:#555;background:rgba(255,255,255,0.05); }
                html[data-theme=dark] .rule-section-tab.active { border-color:#555;border-bottom-color:#2c2c2c;background:#2c2c2c;color:#F09199; }
                html[data-theme=dark] .rule-section-editor { border-color:#555; }
                html[data-theme=dark] .section-preview + .section-preview { border-color:#555; }
                html[data-theme=dark] .custom-context-menu button:hover { background: #444; }
                .mobile-sheet-backdrop { display: none; }
                .dual-range-container { position: relative; width: 200px; height: 24px; }
                .dual-range-container .slider-track { position:absolute;top:50%;left:0;right:0;height:4px;transform:translateY(-50%);border-radius:2px;z-index:1; }
                .dual-range-container input[type="range"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; z-index: 2; margin: 0; }
                .dual-range-container input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 2px; background: #007bff; border: 2px solid #fff; box-shadow: 0 0 2px rgba(0,0,0,0.3); cursor: pointer; pointer-events: auto; margin-top: -5px; }
                .dual-range-container input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 2px; background: #007bff; border: 2px solid #fff; box-shadow: 0 0 2px rgba(0,0,0,0.3); cursor: pointer; pointer-events: auto; }
                .dual-range-container input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: transparent; }
                .dual-range-container input[type="range"]::-moz-range-track { height: 4px; background: transparent; border: none; }
                .percent-bar { user-select: none; }
                .threshold-summary-card { width:min(350px,100%);align-self:flex-end;display:grid;grid-template-columns:1fr .82fr 1fr;border:1px solid rgba(127,127,127,.35);border-radius:6px;overflow:hidden; }
                .threshold-summary-card > section { min-width:0;padding:4px 5px;text-align:center; }
                .threshold-summary-card > section + section { border-left:1px solid rgba(127,127,127,.25); }
                .threshold-user-head { display:flex;align-items:center;justify-content:center;gap:5px;margin-bottom:3px;font-size:12px;font-weight:700; }
                .threshold-user-head span { font-weight:400; }
                .threshold-user-head img { width:20px;height:20px;border-radius:50%;object-fit:cover; }
                .threshold-stat-values { display:flex;justify-content:center;gap:9px;font-size:12px;white-space:nowrap; }
                .threshold-common-row { display:flex;align-items:center;justify-content:center;min-height:20px;font-size:12px;white-space:nowrap; }
                .threshold-slider-row { width:234px;align-self:flex-end;display:grid;grid-template-columns:26px 200px;gap:8px;align-items:center; }
                .threshold-slider-avatar { width:26px;height:26px;border-radius:50%;object-fit:cover; }
                .threshold-controls,.threshold-controls .dual-range-container,.threshold-controls .percent-bar { width:200px; }
                .percent-score-label { position:absolute;inset:1px 0 -1px;z-index:2;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;text-shadow:0 1px 1px rgba(0,0,0,.7);pointer-events:none; }
                .percent-score-label.__medium { color:#111;text-shadow:none; }
                @media (min-width: 761px) {
                    .鉴定_host {
                        position: relative; left: 50%; transform: translateX(-50%);
                        width: min(1120px, calc(100vw - 32px)) !important; max-width: none !important;
                    }
                }
                @media (max-width: 760px) {
                    .鉴定_host {
                        float: none !important; width: 100% !important; min-width: 0 !important;
                        max-width: none !important; margin: 0 !important; padding: 0 !important;
                        left: auto !important; transform: none !important;
                    }
                    .鉴定_page { width: 100%; min-width: 0; padding: 10px 8px 24px !important; overflow-x: hidden; font-size: 14px; }
                    .analysis-top { flex-direction: column; gap: 8px; }
                    .sort-area, #panel { width: 100%; min-width: 0; }
                    .sort-area { flex: none; }
                    .sort-track {
                        flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain;
                        scrollbar-width: none; padding: 2px 0 5px; margin-bottom: 4px;
                        -webkit-overflow-scrolling: touch;
                    }
                    .sort-track::-webkit-scrollbar { display: none; }
                    .sort-track > * { flex: 0 0 auto; }
                    .鉴定_page .sort-tab { padding: 6px 11px; font-size: 0.95em; white-space: nowrap; }
                    #panel { align-items: stretch; }
                    .mobile-settings-toggle {
                        display: block; width: 100%; padding: 8px 10px; border: 1px solid #ccc;
                        border-radius: 6px; background: transparent; text-align: left; font-weight: 600;
                    }
                    #panel:not(.mobile-open) > :not(.mobile-settings-toggle) { display: none !important; }
                    #panel-filter, #panel-actions, #panel-summary { width: 100%; flex-wrap: wrap; justify-content: flex-start; }
                    #panel-threshold { width: 100%; }
                    .threshold-slider-row { width:100%;grid-template-columns:26px minmax(0,1fr); }
                    .threshold-controls { width: 100%; }
                    .dual-range-container, .percent-bar { width: 100% !important; }
                    #subject-type-menu { min-width: 0 !important; width: min(180px, calc(100vw - 32px)); }
                    #opponent-menu { min-width: 0 !important; width: min(260px, calc(100vw - 32px)); }
                    #sort-list-container.is-compact {
                        grid-template-columns: repeat(3, 100px) !important;
                        justify-content: space-evenly; gap: 16px 5px !important;
                    }
                    .custom-sort-modal-backdrop { align-items: stretch; padding: 0; }
                    .custom-sort-modal {
                        width: 100%; height: 100vh; height: 100dvh; max-height: none; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
                        border-radius: 0; box-shadow: none;
                    }
                    .custom-factor-grid { grid-template-columns: 1fr 1fr; }
                    .custom-preview-items { overflow-x: auto; }
                    .custom-preview-item { flex: 0 0 74px; }
                    .custom-score-detail { overflow-x: auto; }
                    .friend-loader-backdrop { padding: 0; }
                    .friend-loader-modal { width: 100%; height: 100dvh; max-height: none; border-radius: 0; }
                    .friend-loader-list { grid-template-columns: repeat(3,minmax(0,1fr)); }
                    .custom-modal-header { top: calc(-1 * max(12px, env(safe-area-inset-top))); }
                }
                @media (max-width: 520px) {
                    .custom-sort-form-grid, .custom-filter-grid, .custom-factor-grid { grid-template-columns: minmax(0, 1fr); }
                    .custom-range-row { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
                    .custom-range-row > span:first-child { grid-column: 1 / -1; }
                    .factor-controls { grid-template-columns: minmax(0, 1fr); }
                }
                @media (max-width: 340px) {
                    #sort-list-container.is-compact { grid-template-columns: repeat(2, 100px) !important; }
                }
                @media (hover: none), (pointer: coarse) {
                    .mobile-only-control { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border: 1px solid #ccc; border-radius: 5px; background: transparent; }
                    .鉴定_page ._compact_card:hover ._compact_tip, #hidden-score-container #hidden-score-overlay { display: none; }
                    .mobile-sheet-backdrop:not([hidden]) {
                        position: fixed; inset: 0; z-index: 10040; display: flex; align-items: flex-end;
                        justify-content: center; background: rgba(0,0,0,0.48);
                    }
                    .mobile-sheet {
                        width: 100%; max-width: 680px; max-height: 85vh; max-height: 85dvh; overflow: hidden;
                        padding-bottom: env(safe-area-inset-bottom); color: #333; background: #fff;
                        border-radius: 14px 14px 0 0; box-shadow: 0 -6px 24px rgba(0,0,0,0.25);
                    }
                    .mobile-sheet > header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #ddd; }
                    #mobile-sheet-close { width: 32px; height: 32px; border: 0; background: transparent; font-size: 24px; line-height: 1; }
                    .mobile-sheet-content { max-height: calc(85dvh - 58px); overflow-y: auto; padding: 14px; overflow-wrap: anywhere; }
                    .mobile-sheet-content table { width: 100%; border-collapse: collapse; }
                    .mobile-sheet-content th, .mobile-sheet-content td { padding: 5px; border-bottom: 1px solid #ddd; }
                    .mobile-sheet-content svg { display: block; width: 100%; height: auto; }
                    .mobile-sheet-content .hidden-score-table { text-align: center; }
                    .mobile-sheet-content .hidden-score-table img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
                    .mobile-sheet-content .hidden-chart-title { margin: 6px 0; font-weight: 700; }
                    .mobile-sheet-content .hidden-chart-legend { display: flex; justify-content: center; gap: 18px; }
                    .mobile-sheet-actions { display: grid; gap: 8px; }
                    .mobile-sheet-actions button { width: 100%; padding: 10px; }
                    .鉴定_page ._compact_card[role="button"] { cursor: pointer; }
                    html[data-theme=dark] .mobile-sheet { color: #ddd; background: #2c2c2c; }
                    html[data-theme=dark] .mobile-sheet > header,
                    html[data-theme=dark] .mobile-sheet-content th,
                    html[data-theme=dark] .mobile-sheet-content td { border-color: #555; }
                }
                .friend-rating-backdrop { position:fixed;inset:0;z-index:10045;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.48); }
                .friend-rating-workbench { width:min(900px,96vw);max-height:92vh;overflow:hidden;display:flex;flex-direction:column;color:#333;background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.3); }
                .friend-rating-workbench.matrix-mode { width:min(500px,96vw); }
                .friend-rating-header { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #ddd; }
                .friend-rating-tabs { display:flex;gap:6px;padding:8px 16px;border-bottom:1px solid #eee; }
                .friend-rating-tabs button.active { color:#fff;background:#F09199;border-color:#F09199; }
                .friend-rating-body { overflow:auto;padding:14px 16px; }
                .friend-result-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:12px; }
                .friend-result-card { min-width:0;padding:8px;border:1px solid #ddd;border-radius:8px;background:transparent;text-align:left;cursor:pointer; }
                .friend-result-card > strong { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                .friend-result-card.active { border-color:#F09199;box-shadow:0 0 0 1px #F09199 inset; }
                .friend-result-level { display:flex;align-items:center;gap:7px;margin-top:7px;font-size:18px;font-weight:700; }
                .friend-result-level .smile,.friend-rating-toggle-emo .smile { width:24px;height:24px;object-fit:contain; }
                .friend-rating-toggle-confidence { font-weight:600;color:inherit;line-height:1; font-size: 0.8em;}
                .friend-rule-toolbar { display:flex;flex-wrap:wrap;gap:6px;margin:8px 0; }
                .friend-rule-editor-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px; }
                .friend-rule-editor-grid > label { display:grid;gap:4px; }
                .friend-rule-choice-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px; }
                .friend-rule-choice-grid > div { min-width:0; }
                .friend-rule-filter-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 14px; }
                .friend-rule-filter-grid > div { min-width:0; }
                .friend-rule-editor fieldset { margin:10px 0;padding:9px;border:1px solid #ddd;border-radius:7px; }
                .friend-rule-chip-row { display:flex;flex-wrap:wrap;gap:7px; }
                #friend-selected-breakdown { width:min(460px,100%);margin:12px auto 0; }
                .friend-metric-breakdown { width:100%;margin:0;border-collapse:collapse; }
                .friend-rating-matrix { width:max-content;min-width:100%;border-collapse:collapse; }
                .friend-metric-breakdown th,.friend-metric-breakdown td { padding:3px 6px;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap; }
                .friend-rating-matrix th,.friend-rating-matrix td { padding:4px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:middle; }
                .friend-matrix-sort { display:flex;align-items:center;gap:4px;width:100%;padding:3px 5px;border:0;color:inherit;background:transparent;font-weight:700;text-align:left;cursor:pointer;white-space:nowrap; }
                .friend-matrix-sort:hover,.friend-matrix-sort.active { color:#d95d69;background:rgba(240,145,153,0.1); }
                .friend-metric-breakdown th:first-child,.friend-metric-breakdown td:first-child,.friend-rating-matrix th:first-child,.friend-rating-matrix td:first-child { text-align:left; }
                .friend-metric-breakdown .smile { width:22px;height:22px;object-fit:contain;vertical-align:middle; }
                .friend-matrix-scroll { overflow:auto; }
                .friend-matrix-user { display:flex;align-items:center;gap:6px;min-width:120px;max-width:170px; }
                .friend-matrix-user a { display:block;flex:0 0 auto; }
                .friend-matrix-user img { width:28px;height:28px;border-radius:50%;object-fit:cover;flex:0 0 auto; }
                .friend-matrix-user span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                .friend-matrix-rating { display:grid;grid-template-columns:auto auto;align-items:baseline;gap:2px 8px;white-space:nowrap; }
                .friend-matrix-score,.friend-matrix-level { display:block;min-width:40px;font-size:1.18em;font-weight:700;line-height:1.2;text-align:center;white-space:nowrap; }
                .friend-matrix-count { display:block;min-width:30px;font-size:1.1em;font-weight:600;line-height:1.2;text-align:left;white-space:nowrap; }
                .friend-matrix-choice { display:flex;align-items:center;gap:8px;padding:3px 7px;border:1px solid #ddd;border-radius:6px;white-space:nowrap; }
                .friend-matrix-choice > span { font-weight:700; }
                .friend-matrix-choice label { display:flex;align-items:center;gap:3px;cursor:pointer; }
                .friend-matrix-choice input { min-height:auto;margin:0; }
                #friend-matrix-export { margin-left:auto;align-items:center;gap:5px;color:inherit;white-space:nowrap;cursor:pointer; }
                #friend-matrix-export:not([hidden]) { display:inline-flex; }
                #friend-matrix-export svg { width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round; }
                .friend-matrix-rule-setting { display:flex;align-items:center;gap:4px;white-space:nowrap; }
                .friend-matrix-rule-setting select { min-height:auto;max-width:190px;padding:2px 4px; }
                .friend-matrix-penalty-setting { display:flex;align-items:center;gap:4px;white-space:nowrap; }
                .friend-matrix-penalty-setting input { width:62px;min-height:auto;padding:2px 4px; }
                .friend-matrix-recommendation { color:#888;font-size:11px; }
                html[data-theme=dark] .friend-rating-workbench { color:#ddd;background:#2c2c2c; }
                html[data-theme=dark] .friend-rating-header,html[data-theme=dark] .friend-rating-tabs,html[data-theme=dark] .friend-result-card,html[data-theme=dark] .friend-rule-editor fieldset,html[data-theme=dark] .friend-matrix-choice { border-color:#555; }
                html[data-theme=dark] .friend-metric-breakdown th,html[data-theme=dark] .friend-metric-breakdown td,html[data-theme=dark] .friend-rating-matrix th,html[data-theme=dark] .friend-rating-matrix td { border-color:#555; }
                @media (max-width:700px) { .friend-rating-backdrop{padding:0}.friend-rating-workbench{width:100%;height:100%;max-height:none;border-radius:0}.friend-result-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.friend-rule-editor-grid,.friend-rule-choice-grid,.friend-rule-filter-grid{grid-template-columns:1fr}.friend-matrix-choice{width:100%;box-sizing:border-box} }
            </style>

            <main class="鉴定_page">
                <div class="analysis-top">
                    <div class="sort-area">
                        <div class="sort-track">
                            <button class="sort-tab${analyze_config.current_sort === 'important' ? ' active' : ''}" data-sort="important">重要番剧</button>
                            <button class="sort-tab${analyze_config.current_sort === 'discover_important' ? ' active' : ''}" data-sort="discover_important">发现重要番剧</button>
                            <button class="sort-tab${analyze_config.current_sort === 'high_sync' ? ' active' : ''}" data-sort="high_sync">高同步率</button>
                            <button class="sort-tab${analyze_config.current_sort === 'low_sync' ? ' active' : ''}" data-sort="low_sync">低同步率</button>
                            <button class="sort-tab${analyze_config.current_sort === 'common_new' ? ' active' : ''}" data-sort="common_new">共同追新</button>
                            <button class="sort-tab${analyze_config.current_sort === 'wanted_recommendation' ? ' active' : ''}" data-sort="wanted_recommendation">想看推荐</button>
                            <span id="custom-sort-buttons" style="display: contents;">${render_custom_sort_buttons_html()}</span>
                            <button id="new-custom-sort" class="sort-tab" type="button">＋ 新建规则</button>
                        </div>
                        <button id="mobile-sort-manage" class="mobile-only-control" type="button">规则操作</button>
                    </div>
                    <div id="panel" class="${mobile_settings_open ? 'mobile-open' : ''}">
                        <button id="mobile-settings-toggle" class="mobile-settings-toggle" type="button" aria-expanded="${mobile_settings_open}">
                            ${get_subject_selection_label(true)} · 设置
                        </button>
                        <div id="panel-filter" style="display: flex; gap: 6px; align-items: center;">
                            <button id="friend-rating-toggle" type="button" style="display:flex;align-items:center;gap:5px;padding:4px 8px;cursor:pointer;font-size:.85em;border:1px solid #ccc;border-radius:4px;background:transparent">好友评级</button>
                            <div id="opponent-dropdown" style="position:relative">
                                <button id="opponent-select-btn" type="button" style="display:flex;align-items:center;gap:5px;padding:3px 8px;cursor:pointer;font-size:0.85em;border:1px solid #ccc;border-radius:4px;background:transparent">
                                    <img src="${his_avatar}" alt=""><span>${escapeHtml(cur_user1.nickname || cur_user1.username)}</span> ▾
                                </button>
                                <div id="opponent-menu" style="display:none;position:absolute;top:100%;left:0;z-index:15;min-width:250px;max-height:360px;overflow-y:auto;padding:4px;border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,0.18)"></div>
                            </div>
                            <div id="subject-type-dropdown" style="position:relative">
                                <button id="subject-type-btn" type="button" style="padding:4px 8px;cursor:pointer;font-size:0.9em;border:1px solid #ccc;border-radius:4px;background:transparent">${get_subject_selection_label(true)} ▾</button>
                                <div id="subject-type-menu" style="display:none;position:absolute;top:100%;left:0;border-radius:4px;padding:6px 0;z-index:12;min-width:140px;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
                                    ${SUBJECT_TYPE_IDS.map(id => `<label style="display:flex;align-items:center;gap:6px;padding:5px 12px;cursor:pointer;font-size:0.9em">
                                        <input type="checkbox" class="subject-type-cb" data-type="${id}" ${analyze_config.subject_ids.includes(id) ? 'checked' : ''}>${subject_config[id].name}
                                    </label>`).join('')}
                                    <small style="display:block;padding:4px 12px;color:#888">至少选择一种</small>
                                    <button id="subject-type-apply" type="button" style="display:block;width:calc(100% - 16px);margin:4px 8px;padding:5px">应用</button>
                                </div>
                            </div>
                            <button id="feedback-link" type="button" style="padding:4px 8px;cursor:pointer;font-size:.9em;border:1px solid #ccc;border-radius:4px;background:transparent">✉ 反馈</button>
                        </div>
                        <div id="panel-actions" style="display: flex; gap: 10px; align-items: center;">
                            <button id="score-display-toggle" type="button" style="padding:4px 10px;cursor:pointer;font-size:.85em;border:1px solid #ccc;border-radius:4px;background:transparent">${analyze_config.score_display === 'hidden' ? '显示：隐藏分' : '显示：原始分'}</button>
                            <button id="score-distribution-toggle" type="button" style="padding:4px 10px;cursor:pointer;font-size:.85em;border:1px solid #ccc;border-radius:4px;background:transparent">评分分布</button>
                            <div style="position: relative;">
                                <button id="custom-cloud-status" data-status="${cloud_sync_status}" style="padding: 5px 8px; cursor: pointer; font-size: 0.8em; border: 1px solid #ccc; border-radius: 4px; background: transparent;"></button>
                                <div id="cloud-sync-menu">
                                    <button type="button" data-cloud-action="sync">立即同步</button>
                                    <button type="button" data-cloud-action="export-important">导出重要番剧</button>
                                    <button type="button" data-cloud-action="import-important">导入重要番剧</button>
                                    <button type="button" data-cloud-action="export-category">导出分类规则</button>
                                    <button type="button" data-cloud-action="import-category">导入分类规则</button>
                                    <button type="button" data-cloud-action="export-rating">导出评分规则</button>
                                    <button type="button" data-cloud-action="import-rating">导入评分规则</button>
                                    <button type="button" data-cloud-action="export-all">导出全部</button>
                                    <button type="button" data-cloud-action="import-all">导入全部</button>
                                    <button type="button" data-cloud-action="clear-local-cache">清空本地缓存</button>
                                    <button type="button" data-cloud-action="reset-cloud">重置云端数据</button>
                                </div>
                            </div>
                        </div>
                        <div id="panel-threshold" style="display:flex;flex-direction:column;gap:8px;margin-top:4px;width:100%">
                            <div class="threshold-summary-card">
                                <section>
                                    <div class="threshold-user-head"><img src="${my_avatar}" alt="我"><span>吐槽 ${result.my_comment_chars}字</span></div>
                                    <div class="threshold-stat-values"><span>收藏 ${result.my_collection_count}</span><span>看过 ${result.my_watched_count}</span></div>
                                </section>
                                <section>
                                    <div class="threshold-common-row">共同收藏 ${result.common_collection_count}</div>
                                    <div class="threshold-common-row">共同评分 ${result.common_rating_count}</div>
                                </section>
                                <section>
                                    <div class="threshold-user-head"><img src="${his_avatar}" alt="对方"><span>吐槽 ${result.his_comment_chars}字</span></div>
                                    <div class="threshold-stat-values"><span>收藏 ${result.his_collection_count}</span><span>看过 ${result.his_watched_count}</span></div>
                                </section>
                            </div>
                            ${['my', 'his'].map(user => {
                                const low = analyze_config[user + '_threshold_low']
                                const high = analyze_config[user + '_threshold_high']
                                const avatar = user === 'my' ? my_avatar : his_avatar
                                return `
                                <div class="threshold-slider-row">
                                    <img class="threshold-slider-avatar" src="${avatar}" alt="${user === 'my' ? '我' : '对方'}">
                                    <div class="threshold-controls" style="display:flex;flex-direction:column;gap:4px">
                                        <div class="dual-range-container" data-user="${user}">
                                            <div class="slider-track"></div>
                                            <input type="range" class="range-handle range-low" data-user="${user}" min="0" max="10" step="1" value="${low}" />
                                            <input type="range" class="range-handle range-high" data-user="${user}" min="0" max="10" step="1" value="${high}" />
                                        </div>
                                        <div class="percent-bar" data-user="${user}" style="display:flex;height:16px;overflow:visible;position:relative"></div>
                                    </div>
                                </div>`
                            }).join('')}
                        </div>
                        <div id="panel-summary" style="display: flex; align-items: center; gap: 8px;">
                            <div id="hidden-score-container">
                                <div id="hidden-score-overlay"><div id="hidden-chart-tooltip"></div>${render_hidden_score_panel()}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="sort-description" style="color:inherit;font-size:0.9em;margin-bottom:12px;line-height:1.6"></div>
                <section id="subject-search-panel" class="subject-search-panel" ${analyze_config.current_sort === 'discover_important' ? '' : 'hidden'}>
                    <form id="subject-search-form" class="subject-search-form">
                        <input id="subject-search-input" type="search" placeholder="输入条目 ID、链接或名称" autocomplete="off" aria-label="搜索条目">
                        <button type="submit">搜索</button>
                    </form>
                    <small id="subject-search-status" class="subject-search-status" aria-live="polite"></small>
                    <div id="subject-search-results" class="subject-search-results"></div>
                </section>
                <div id="sort-list-container" class="is-compact" style="display:grid;grid-template-columns:repeat(auto-fill,120px);gap:25px 10px">
                    ${render_rule_result(initial_rule_evaluation)}
                </div>
                <div id="mobile-sheet-backdrop" class="mobile-sheet-backdrop" hidden>
                    <section id="mobile-sheet" class="mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-sheet-title">
                        <header><strong id="mobile-sheet-title"></strong><button id="mobile-sheet-close" type="button" aria-label="关闭">×</button></header>
                        <div id="mobile-sheet-content" class="mobile-sheet-content"></div>
                    </section>
                </div>
            </main>`

            $page.innerHTML = page_html

            renderBmoji()

            function parse_subject_search_id(value) {
                const text = String(value || '').trim()
                if (/^\d+$/.test(text)) return Number(text)
                try {
                    const url = new URL(text, location.origin)
                    if (!['bgm.tv', 'bangumi.tv', 'chii.in'].includes(url.hostname)) return null
                    const match = url.pathname.match(/^\/subject\/(\d+)\/?$/)
                    return match ? Number(match[1]) : null
                } catch (error) {
                    return null
                }
            }

            function normalize_subject_search_text(value) {
                return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, '')
            }

            function normalize_search_subject(subject, collection = null) {
                const id = Number(subject?.id || collection?.subject_id)
                if (!Number.isInteger(id) || id <= 0) return null
                return {
                    ...subject,
                    id,
                    type: Number(subject?.type || collection?.subject_type || 0),
                }
            }

            function set_subject_search_status(message, kind = '') {
                subject_search_status = message
                subject_search_status_kind = kind
                const status = document.getElementById('subject-search-status')
                if (!status) return
                status.textContent = message
                status.dataset.kind = kind
            }

            function render_subject_search_results() {
                const host = document.getElementById('subject-search-results')
                if (!host) return
                host.innerHTML = subject_search_results.map(subject => {
                    const id = Number(subject.id)
                    const name = escapeHtml(getSubjectDisplayName(subject))
                    const original_name = subject.name && subject.name !== subject.name_cn ? ` / ${escapeHtml(subject.name)}` : ''
                    const type_label = subject_config[Number(subject.type)]?.name || '未知类型'
                    const image = escapeHtml(subject.images?.grid || subject.images?.medium || subject.image || '')
                    const marked = important_subject_ids.has(id)
                    return `<article class="subject-search-result" data-subject-id="${id}">
                        ${image ? `<img src="${image}" alt="" loading="lazy">` : '<span></span>'}
                        <div class="subject-search-result-main">
                            <a href="/subject/${id}" target="_blank" rel="noopener">${name}${original_name}</a>
                            <small>ID ${id} · ${escapeHtml(type_label)}</small>
                        </div>
                        <button type="button" class="subject-search-important" data-search-important="${id}" aria-pressed="${marked}">${marked ? '取消重要' : '标记重要'}</button>
                    </article>`
                }).join('')
                if (subject_search_status) set_subject_search_status(subject_search_status, subject_search_status_kind)
            }

            function update_subject_search_visibility() {
                const panel = document.getElementById('subject-search-panel')
                if (panel) panel.hidden = analyze_config.current_sort !== 'discover_important'
            }

            async function search_cached_subjects(keyword) {
                const cached = await load_manager_async.get_cached_coll(my_id, analyze_config.subject_ids)
                const needle = normalize_subject_search_text(keyword)
                const seen = new Set()
                const matches = []
                for (const collection of cached.collections) {
                    const subject = normalize_search_subject(collection.subject, collection)
                    if (!subject || seen.has(subject.id)) continue
                    const names = [subject.name_cn, subject.name].map(normalize_subject_search_text).filter(Boolean)
                    if (!names.some(name => name.includes(needle))) continue
                    seen.add(subject.id)
                    const starts = names.some(name => name.startsWith(needle))
                    matches.push({ subject, starts })
                }
                matches.sort((a, b) => Number(b.starts) - Number(a.starts) || Number(b.subject.collection_total || 0) - Number(a.subject.collection_total || 0))
                return {
                    subjects: matches.slice(0, 10).map(item => item.subject),
                    missingSubjectIds: cached.missingSubjectIds,
                }
            }

            async function run_subject_search(value) {
                const query = String(value || '').trim()
                const request_id = ++subject_search_request_id
                if (!query) {
                    subject_search_results = []
                    set_subject_search_status('请输入条目 ID、链接或名称', 'error')
                    render_subject_search_results()
                    return
                }
                subject_search_results = []
                set_subject_search_status('正在搜索…')
                render_subject_search_results()
                const exact_id = parse_subject_search_id(query)
                try {
                    if (exact_id != null) {
                        if (!Number.isInteger(exact_id) || exact_id <= 0) throw new Error('条目 ID 无效')
                        const subject = normalize_search_subject(await load_manager_async.get_subject(exact_id))
                        if (!subject) throw new Error('条目数据格式无效')
                        if (request_id !== subject_search_request_id) return
                        subject_search_results = [subject]
                        set_subject_search_status(`已精确找到条目 ${exact_id}`)
                    } else {
                        try {
                            subject_search_results = (await load_manager_async.search_subjects(query, analyze_config.subject_ids))
                                .map(subject => normalize_search_subject(subject)).filter(Boolean)
                            if (request_id !== subject_search_request_id) return
                            set_subject_search_status(subject_search_results.length ? `找到 ${subject_search_results.length} 条匹配结果` : '没有找到匹配条目')
                        } catch (api_error) {
                            if (request_id !== subject_search_request_id) return
                            const fallback = await search_cached_subjects(query)
                            if (request_id !== subject_search_request_id) return
                            subject_search_results = fallback.subjects
                            const missing = fallback.missingSubjectIds.map(id => subject_config[id]?.name || id).join('、')
                            const suffix = missing ? `；缺少${missing}收藏缓存` : ''
                            set_subject_search_status(`在线搜索失败，已改用自己的收藏缓存，找到 ${fallback.subjects.length} 条${suffix}`, 'fallback')
                        }
                    }
                } catch (error) {
                    if (request_id !== subject_search_request_id) return
                    subject_search_results = []
                    set_subject_search_status(`搜索失败：${error.message || error}`, 'error')
                }
                render_subject_search_results()
            }

            document.getElementById('subject-search-form').addEventListener('submit', event => {
                event.preventDefault()
                run_subject_search(document.getElementById('subject-search-input').value)
            })
            document.getElementById('subject-search-results').addEventListener('click', event => {
                const button = event.target.closest('[data-search-important]')
                if (!button) return
                const subject_id = Number(button.dataset.searchImportant)
                set_important_subject_marked(subject_id, !important_subject_ids.has(subject_id))
                render_subject_search_results()
            })

            const FRIEND_METRIC_LABELS = {
                cosine: '隐藏分余弦', variance: '原始分方差', confidence: '置信度',
            }
            const friend_result_cache = new Map()
            let friend_workbench = null
            let selected_friend_rule_id = friend_rating_document.defaultRule.id
            let friend_matrix_sort_rule_id = null
            let friend_matrix_sort_mode = FRIEND_MATRIX_SORT_MODES.has(localStorage.getItem(FRIEND_MATRIX_SORT_MODE_KEY))
                ? localStorage.getItem(FRIEND_MATRIX_SORT_MODE_KEY)
                : 'score'

            function friend_rule_cache_key(rule, username, cached_only) {
                return `${username}|${rule.id}|${rule.updatedAt}|${cached_only ? 'cached' : 'live'}|${JSON.stringify(rule.subject_ids)}`
            }

            async function calculate_friend_rule(rule, username = his_id, cached_only = false) {
                const key = friend_rule_cache_key(rule, username, cached_only)
                if (friend_result_cache.has(key)) return friend_result_cache.get(key)
                const promise = (async () => {
                    if (cached_only) {
                        const [mine, his] = await Promise.all([
                            load_manager_async.get_cached_coll(my_id, rule.subject_ids),
                            load_manager_async.get_cached_coll(username, rule.subject_ids),
                        ])
                        const missing = [...new Set([...mine.missingSubjectIds, ...his.missingSubjectIds])]
                        if (missing.length) return { status: 'needs-update', missingSubjectIds: missing }
                        return evaluate_friend_rule(rule, mine.collections, his.collections)
                    }
                    const [mine, his] = await Promise.all([
                        load_manager_async.get_coll(my_id, false, rule.subject_ids),
                        load_manager_async.get_coll(username, false, rule.subject_ids),
                    ])
                    return evaluate_friend_rule(rule, mine, his)
                })()
                friend_result_cache.set(key, promise)
                promise.catch(() => friend_result_cache.delete(key))
                return promise
            }

            function friend_confidence_background_alpha(confidence) {
                const slope = (FRIEND_CONFIDENCE_ALPHA_AT_99 - FRIEND_CONFIDENCE_ALPHA_AT_50) / (0.99 - 0.5)
                const alpha = FRIEND_CONFIDENCE_ALPHA_AT_50 + (confidence - 0.5) * slope
                return Math.max(0, Math.min(1, alpha))
            }

            function friend_confidence_background(evaluation) {
                const confidence = Number(evaluation?.confidence || 0)
                if (!evaluation?.confidenceBackgroundEnabled || !(confidence > 0 && confidence < 1)) return ''
                const alpha = friend_confidence_background_alpha(confidence)
                return `rgba(${FRIEND_CONFIDENCE_BACKGROUND_RGB},${Number(alpha.toFixed(4))})`
            }

            function friend_confidence_background_style(evaluation) {
                const background = friend_confidence_background(evaluation)
                return background ? ` style="background:${background}"` : ''
            }

            function friend_level_html(evaluation) {
                if (!evaluation || evaluation.status !== 'ready' || Number(evaluation.confidence || 0) <= 0) return '<span>待定</span>'
                const emo = workbenchLevelEmos[evaluation.level]
                return `<span>Lv${evaluation.level}</span>${emo ? `<span>${getEmoHtml(emo)}</span>` : ''}`
            }

            function friend_confidence_percent_html(evaluation) {
                const sample_count = Number(evaluation?.sampleCount || 0)
                return evaluation?.status === 'ready' && sample_count > 0
                    ? `<span class="friend-rating-toggle-confidence">${sample_count}条</span>`
                    : ''
            }

            async function update_friend_rating_button() {
                const button = document.getElementById('friend-rating-toggle')
                const rule = get_default_friend_rule()
                if (!button || !rule) return
                try {
                    const evaluation = await calculate_friend_rule(rule)
                    if (!button.isConnected) return
                    if (evaluation.status !== 'ready' || Number(evaluation.confidence || 0) <= 0) {
                        button.style.background = 'transparent'
                        button.textContent = '待定'
                        button.title = `${rule.name}：${evaluation.reason || '数据不足'}`
                    } else {
                        const emo = quickLevelEmos[evaluation.level]
                        button.style.background = friend_confidence_background(evaluation) || 'transparent'
                        const confidence_prefix = friend_confidence_percent_html(evaluation)
                        button.innerHTML = `${confidence_prefix}<strong>Lv${evaluation.level}</strong>${emo ? `<span class="friend-rating-toggle-emo">${getEmoHtml(emo)}</span>` : ''}`
                        button.title = `${rule.name} · ${evaluation.score}分 · ${evaluation.sampleCount}个样本 · 置信度${Math.round(evaluation.confidence * 100)}%`
                        renderBmoji()
                    }
                } catch (error) {
                    if (button.isConnected) {
                        button.style.background = 'transparent'
                        button.textContent = '评级失败'
                        button.title = String(error.message || error)
                    }
                }
            }

            // 固定四栏好友评级界面
            function friend_metric_level_html(metric) {
                if (metric.level == null) return '待定'
                const emo = workbenchLevelEmos[metric.level]
                return `<span>Lv${metric.level}</span>${emo ? `<span>${getEmoHtml(emo)}</span>` : ''}`
            }

            function friend_breakdown_html(evaluation) {
                if (!evaluation?.metrics) return `<p>${escapeHtml(evaluation?.reason || '数据不足')}</p>`
                const value_html = metric => {
                    if (metric.raw == null) return '—'
                    if (metric.type === 'confidence') return `${Math.round(metric.raw * 100)}%`
                    if (metric.type === 'variance') return Number(metric.raw).toFixed(2)
                    return `${(Number(metric.raw) * 100).toFixed(1)}%`
                }
                return `<table class="friend-metric-breakdown"><thead><tr><th>指标</th><th>数值</th><th>等级与表情</th></tr></thead><tbody>
                    ${evaluation.metrics.map(metric => `<tr><td>${FRIEND_METRIC_LABELS[metric.type]}</td><td>${value_html(metric)}</td><td>${friend_metric_level_html(metric)}</td></tr>`).join('')}
                </tbody></table><p><strong>${evaluation.status === 'ready' ? `${evaluation.score}分 · Lv${evaluation.level}` : `待定：${escapeHtml(evaluation.reason)}`}</strong> · ${evaluation.sampleCount}个样本 · 置信度${Math.round(evaluation.confidence * 100)}%</p>`
            }

            function friend_rule_editor_html(rule) {
                const tier_row = user => [['low','差评'],['medium','中评'],['high','好评']].map(([value,label]) => `<label><input type="checkbox" class="friend-filter-tier" data-user="${user}" value="${value}" ${rule.filters[`${user}_tiers`].includes(value) ? 'checked' : ''}>${label}</label>`).join('')
                const status_row = user => FRIEND_STATUSES.map(value => `<label><input type="checkbox" class="friend-filter-status" data-user="${user}" value="${value}" ${rule.filters[`${user}_statuses`].includes(value) ? 'checked' : ''}>${collTypeMap[value]}</label>`).join('')
                return `<section class="friend-rule-editor" data-rule-id="${escapeHtml(rule.id)}">
                    <div class="friend-rule-toolbar">
                        <button type="button" data-fixed-friend-action="default" ${friend_rating_document.defaultRule.id === rule.id ? 'disabled' : ''}>设为默认</button>
                        <button type="button" data-fixed-friend-action="restore">恢复本栏</button>
                        <button type="button" data-fixed-friend-action="save"><strong>保存</strong></button>
                    </div>
                    <div class="friend-rule-editor-grid">
                        <label>标题<input class="friend-rule-name" maxlength="30" value="${escapeHtml(rule.name)}"></label>
                        <label>截止日期<input class="friend-rule-cutoff" type="date" value="${escapeHtml(rule.cutoffDate)}"></label>
                        <label title="有效样本达到此数量时，置信度为 100%">置信度目标样本数<input class="friend-rule-confidence-target" type="number" min="1" max="10000" step="1" value="${normalize_friend_confidence_target(rule.confidenceTarget, rule.scope)}"></label>
                    </div>
                    <div class="friend-rule-choice-grid">
                        <div><b>候选范围</b><div class="custom-radio-row">
                            <label><input type="radio" class="friend-rule-scope" name="friend-rule-scope" value="important_rated" ${rule.scope === 'important_rated' ? 'checked' : ''}>重要番剧 ∩ 双方评分</label>
                            <label><input type="radio" class="friend-rule-scope" name="friend-rule-scope" value="rated_intersection" ${rule.scope === 'rated_intersection' ? 'checked' : ''}>双方评分交集</label>
                        </div></div>
                        <div><b>评分标准范围</b><div class="custom-radio-row">
                            <label><input type="radio" class="friend-rule-standard" name="friend-rule-standard" value="all_rated" ${rule.standardScope === 'all_rated' ? 'checked' : ''}>全部评分</label>
                            <label><input type="radio" class="friend-rule-standard" name="friend-rule-standard" value="filtered" ${rule.standardScope === 'filtered' ? 'checked' : ''}>当前候选</label>
                        </div></div>
                    </div>
                    <fieldset><legend>条目类型</legend><div class="friend-rule-chip-row">${SUBJECT_TYPE_IDS.map(id => `<label><input type="checkbox" class="friend-rule-subject" value="${id}" ${rule.subject_ids.includes(id) ? 'checked' : ''}>${subject_config[id].name}</label>`).join('')}</div></fieldset>
                    <fieldset><legend>双方独立筛选</legend>
                        <div class="friend-rule-filter-grid"><div><b>我的评分档位</b><div class="friend-rule-chip-row">${tier_row('my')}</div></div><div><b>对方评分档位</b><div class="friend-rule-chip-row">${tier_row('his')}</div></div>
                        <div><b>我的收藏状态</b><div class="friend-rule-chip-row">${status_row('my')}</div></div><div><b>对方收藏状态</b><div class="friend-rule-chip-row">${status_row('his')}</div></div></div>
                    </fieldset>
                    <fieldset><legend>影响最终显示</legend><div class="friend-rule-chip-row">
                        <label><input type="checkbox" class="friend-display-cosine" ${rule.display.cosine ? 'checked' : ''}>余弦相似度</label>
                        <label><input type="checkbox" class="friend-display-variance" ${rule.display.variance ? 'checked' : ''}>原始分方差</label>
                        <label><input type="checkbox" class="friend-display-confidence" ${rule.display.confidence ? 'checked' : ''}>置信度背景</label>
                    </div></fieldset>
                </section>`
            }

            function collect_friend_rule_editor(editor, base_rule) {
                const selected = (selector, user, number = false) => [...editor.querySelectorAll(`${selector}[data-user="${user}"]:checked`)].map(input => number ? Number(input.value) : input.value)
                return {
                    ...base_rule,
                    name: editor.querySelector('.friend-rule-name').value.trim(),
                    subject_ids: [...editor.querySelectorAll('.friend-rule-subject:checked')].map(input => Number(input.value)),
                    scope: editor.querySelector('.friend-rule-scope:checked').value,
                    standardScope: editor.querySelector('.friend-rule-standard:checked').value,
                    cutoffDate: editor.querySelector('.friend-rule-cutoff').value,
                    confidenceTarget: Number(editor.querySelector('.friend-rule-confidence-target').value),
                    filters: {
                        my_tiers: selected('.friend-filter-tier', 'my'), his_tiers: selected('.friend-filter-tier', 'his'),
                        my_statuses: selected('.friend-filter-status', 'my', true), his_statuses: selected('.friend-filter-status', 'his', true),
                    },
                    display: {
                        cosine: editor.querySelector('.friend-display-cosine').checked,
                        variance: editor.querySelector('.friend-display-variance').checked,
                        confidence: editor.querySelector('.friend-display-confidence').checked,
                    },
                }
            }

            function validate_friend_rule_draft(rule) {
                if (!rule.name) return '标题不能为空'
                if (!rule.subject_ids.length) return '至少选择一种条目类型'
                if (!rule.cutoffDate || Number.isNaN(Date.parse(rule.cutoffDate))) return '请选择有效的截止日期'
                if (!Number.isInteger(rule.confidenceTarget) || rule.confidenceTarget < 1 || rule.confidenceTarget > 10000) return '置信度目标样本数必须是 1～10000 的整数'
                if (['my_tiers','his_tiers','my_statuses','his_statuses'].some(key => !rule.filters[key].length)) return '双方的评分档位和收藏状态都至少选择一项'
                return ''
            }

            function bind_friend_rule_editor(editor, base_rule, body) {
                editor.addEventListener('click', event => {
                    const action = event.target.closest('[data-fixed-friend-action]')?.dataset.fixedFriendAction
                    if (!action) return
                    if (action === 'default') {
                        set_default_friend_rule(base_rule.id)
                        friend_result_cache.clear()
                        render_friend_current_tab(body, base_rule.id)
                        update_friend_rating_button()
                    }
                    if (action === 'restore') {
                        if (!confirm(`恢复“${base_rule.name}”的默认配置？`)) return
                        const restored = restore_builtin_friend_rule(base_rule.id)
                        if (!restored) return
                        friend_result_cache.clear()
                        render_friend_current_tab(body, restored.id)
                        update_friend_rating_button()
                    }
                    if (action === 'save') {
                        const draft = collect_friend_rule_editor(editor, base_rule)
                        const error = validate_friend_rule_draft(draft)
                        if (error) return alert(error)
                        const saved = put_friend_rule(draft)
                        friend_result_cache.clear()
                        render_friend_current_tab(body, saved.id)
                        update_friend_rating_button()
                    }
                })
            }

            async function render_friend_current_tab(body, selected_id = selected_friend_rule_id) {
                friend_workbench?.querySelector('.friend-rating-workbench')?.classList.remove('matrix-mode')
                const export_button = friend_workbench?.querySelector('#friend-matrix-export')
                if (export_button) {
                    export_button.hidden = true
                    export_button.onclick = null
                }
                const rules = get_active_friend_rules()
                if (!rules.some(rule => rule.id === selected_id)) selected_id = friend_rating_document.defaultRule.id
                selected_friend_rule_id = selected_id
                body.innerHTML = '<p>正在计算当前用户的四栏评级…</p>'
                const evaluations = new Map(await Promise.all(rules.map(async rule => {
                    try { return [rule.id, await calculate_friend_rule(rule)] }
                    catch (error) { return [rule.id, { status:'pending', reason:`计算失败：${error.message || error}`, metrics:[], sampleCount:0, confidence:0, confidenceBackgroundEnabled:false }] }
                })))
                if (!body.isConnected || friend_workbench?.dataset.activeTab !== 'current') return
                const selected_rule = rules.find(rule => rule.id === selected_id) || rules[0]
                body.innerHTML = `<div class="friend-result-grid">${rules.map(rule => {
                    const evaluation = evaluations.get(rule.id)
                    const can_show_result = evaluation.status === 'ready' && Number(evaluation.confidence || 0) > 0
                    const summary = can_show_result
                        ? `${evaluation.score}分 · ${evaluation.sampleCount}样本 · 置信度${Math.round(evaluation.confidence * 100)}%`
                        : `待定 · ${evaluation.sampleCount || 0}样本 · 置信度${Math.round((evaluation.confidence || 0) * 100)}%`
                    return `<button type="button" class="friend-result-card${rule.id === selected_rule.id ? ' active' : ''}" data-friend-result-rule="${escapeHtml(rule.id)}"${friend_confidence_background_style(evaluation)}><strong>${escapeHtml(rule.name)}</strong>${friend_rating_document.defaultRule.id === rule.id ? ' <small>默认</small>' : ''}<div class="friend-result-level">${friend_level_html(evaluation)}</div><small>${summary}</small></button>`
                }).join('')}</div>${friend_rule_editor_html(selected_rule)}<div id="friend-selected-breakdown">${friend_breakdown_html(evaluations.get(selected_rule.id))}</div>`
                renderBmoji()
                body.querySelectorAll('[data-friend-result-rule]').forEach(card => card.addEventListener('click', () => render_friend_current_tab(body, card.dataset.friendResultRule)))
                bind_friend_rule_editor(body.querySelector('.friend-rule-editor'), selected_rule, body)
            }

            function stale_cached_users(users) {
                const stale_before = Date.now() - 7 * 86400000
                return users.filter(user => !Number(user_cache_times[user.username]) || Number(user_cache_times[user.username]) < stale_before)
            }

            async function refresh_cached_users(users, subject_ids, on_progress = () => {}) {
                let cursor = 0, completed = 0
                const failures = []
                const worker = async () => {
                    while (cursor < users.length) {
                        const user = users[cursor++]
                        on_progress(completed, users.length, user)
                        try {
                            await load_manager_async.get_user(user.username, true)
                            await load_manager_async.get_coll(user.username, true, subject_ids)
                        } catch (error) {
                            failures.push(user.username)
                        }
                        completed++
                    }
                }
                await Promise.all(Array.from({ length: Math.min(3, users.length) }, worker))
                friend_result_cache.clear()
                return { completed, failures }
            }

            async function clear_cached_users(users, on_progress = () => {}) {
                let completed = 0
                for (const user of users) {
                    on_progress(completed, users.length, user)
                    await api_cache.deleteUserCache(user.username)
                    delete recent_opponents[user.username]
                    delete user_cache_times[user.username]
                    completed++
                }
                localStorage.setItem(RECENT_OPPONENTS_KEY, JSON.stringify(recent_opponents))
                localStorage.setItem(USER_CACHE_TIMES_KEY, JSON.stringify(user_cache_times))
                friend_result_cache.clear()
                return completed
            }

            function csv_cell(value) {
                if (typeof value === 'number' && Number.isFinite(value)) return String(value)
                let text = String(value ?? '')
                if (/^[=+\-@]/.test(text)) text = `'${text}`
                return `"${text.replace(/"/g, '""')}"`
            }

            function export_friend_matrix_csv(rows, rule, prior) {
                const headers = [
                    '用户名', '昵称', `${rule.name} 原始分`, `${rule.name} 样本惩罚分`,
                    `${rule.name} 贝叶斯收缩分`, `${rule.name} 命中条目数`, `${rule.name} 状态`,
                ]
                const data_rows = rows.map(({ user, cell }) => {
                    if (cell.status === 'ready') {
                        const penalty_score = friend_matrix_sample_penalty_score(cell)
                        const shrinkage_score = friend_matrix_shrinkage_score(cell, prior)
                        return [
                            user.username,
                            user.nickname || user.username,
                            Number(cell.score),
                            penalty_score == null ? '' : Math.round(penalty_score),
                            shrinkage_score == null ? '' : Math.round(shrinkage_score),
                            Number(cell.sampleCount || 0),
                            '有效',
                        ]
                    }
                    const sample_count = Number(cell.sampleCount)
                    return [
                        user.username,
                        user.nickname || user.username,
                        '', '', '', Number.isFinite(sample_count) ? sample_count : '',
                        cell.status === 'needs-update' ? '需更新' : '待定',
                    ]
                })
                const csv = [headers, ...data_rows].map(row => row.map(csv_cell).join(',')).join('\r\n')
                const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const anchor = document.createElement('a')
                const now = new Date()
                const pad = number => String(number).padStart(2, '0')
                const exported_at = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
                anchor.href = url
                anchor.download = `(${self_username}) Shadow 全缓存好友评级 (${exported_at}).csv`
                anchor.click()
                URL.revokeObjectURL(url)
            }

            function friend_matrix_sample_penalty_score(cell) {
                const score = Number(cell?.score)
                const sample_count = Number(cell?.sampleCount)
                if (cell?.status !== 'ready' || !Number.isFinite(score) || !(sample_count > 0)) return null
                return score - get_friend_matrix_sample_penalty() / Math.sqrt(sample_count)
            }

            function build_friend_matrix_recommended_mu(rows) {
                const scores = rows
                    .map(row => row.cell)
                    .filter(cell => cell?.status === 'ready' && Number.isFinite(Number(cell.score)))
                    .map(cell => Number(cell.score))
                    .sort((a, b) => a - b)
                if (!scores.length) return 50
                const middle = Math.floor(scores.length / 2)
                return scores.length % 2 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2
            }

            function friend_matrix_shrinkage_score(cell, prior, k = get_friend_matrix_shrinkage_k()) {
                const score = Number(cell?.score)
                const sample_count = Number(cell?.sampleCount)
                if (cell?.status !== 'ready' || !Number.isFinite(score) || !(sample_count > 0)) return null
                const prior_score = Number.isFinite(Number(prior)) ? Number(prior) : 50
                const prior_sample = Number.isInteger(Number(k)) && Number(k) > 0
                    ? Number(k)
                    : DEFAULT_FRIEND_MATRIX_SHRINKAGE_K
                return prior_score + (sample_count / (sample_count + prior_sample)) * (score - prior_score)
            }

            function friend_matrix_mode_score(cell, prior, mode = friend_matrix_sort_mode) {
                if (mode === 'sample-penalty') return friend_matrix_sample_penalty_score(cell)
                if (mode === 'shrinkage') return friend_matrix_shrinkage_score(cell, prior)
                const score = Number(cell?.score)
                return cell?.status === 'ready' && Number.isFinite(score) ? score : null
            }

            function compare_friend_matrix_rows(a, b, prior, sort_mode = friend_matrix_sort_mode) {
                const a_sort_score = friend_matrix_mode_score(a.cell, prior, sort_mode)
                const b_sort_score = friend_matrix_mode_score(b.cell, prior, sort_mode)
                const a_valid = Number.isFinite(a_sort_score)
                const b_valid = Number.isFinite(b_sort_score)
                if (a_valid !== b_valid) return a_valid ? -1 : 1
                if (a_valid && b_valid) {
                    const sort_score_diff = b_sort_score - a_sort_score
                    if (sort_score_diff) return sort_score_diff
                    const score_diff = Number(b.cell.score) - Number(a.cell.score)
                    if (score_diff) return score_diff
                    const sample_count_diff = Number(b.cell.sampleCount || 0) - Number(a.cell.sampleCount || 0)
                    if (sample_count_diff) return sample_count_diff
                }
                return String(a.user.nickname || a.user.username).localeCompare(String(b.user.nickname || b.user.username), 'zh-CN')
            }

            async function render_friend_matrix_tab(body) {
                friend_workbench?.querySelector('.friend-rating-workbench')?.classList.add('matrix-mode')
                const export_button = friend_workbench?.querySelector('#friend-matrix-export')
                if (export_button) {
                    export_button.hidden = true
                    export_button.onclick = null
                }
                body.innerHTML = '<p>正在读取本地缓存…</p>'
                const cached_users = await api_cache.getCachedCollectionUsernames()
                const users = (await api_cache.getAllUsers()).filter(user => user.username !== my_id && cached_users.has(user.username))
                const rules = get_active_friend_rules()
                const selected_rule = rules.find(rule => rule.id === friend_matrix_sort_rule_id) || get_default_friend_rule()
                friend_matrix_sort_rule_id = selected_rule.id
                const rows = []
                for (const user of users) {
                    let cell
                    try { cell = await calculate_friend_rule(selected_rule, user.username, true) }
                    catch (error) { cell = { status:'pending', reason:String(error.message || error), sampleCount:0, confidence:0 } }
                    rows.push({ user, cell })
                }
                if (!body.isConnected || friend_workbench?.dataset.activeTab !== 'matrix') return
                const recommended_mu = build_friend_matrix_recommended_mu(rows)
                const shrinkage_mu = get_friend_matrix_shrinkage_mu()
                rows.sort((a, b) => compare_friend_matrix_rows(a, b, shrinkage_mu))
                const cell_html = cell => {
                    if (cell.status === 'needs-update') return '<strong class="friend-matrix-level">需更新</strong>'
                    if (cell.status !== 'ready') return '<strong class="friend-matrix-level">待定</strong>'
                    const display_score = friend_matrix_mode_score(cell, shrinkage_mu)
                    const shrinkage_score = friend_matrix_shrinkage_score(cell, shrinkage_mu)
                    const shrinkage_title = friend_matrix_sort_mode === 'shrinkage' && shrinkage_score != null
                        ? ` title="${escapeHtml(`原始分：${Number(cell.score).toFixed(1)}\n收缩分：${shrinkage_score.toFixed(1)}\n命中条目：${Number(cell.sampleCount || 0)}\n先验均值 μ：${shrinkage_mu.toFixed(1)}\n推荐 μ：${recommended_mu.toFixed(1)}\n先验强度 k：${get_friend_matrix_shrinkage_k()}`)}"`
                        : ''
                    return `<div class="friend-matrix-rating"${shrinkage_title}><strong class="friend-matrix-score">${display_score == null ? '—' : Math.round(display_score)}分</strong><strong class="friend-matrix-count">${Number(cell.sampleCount || 0)}条</strong></div>`
                }
                const user_html = user => {
                    const avatar = user.avatar?.small || user.avatar?.medium || ''
                    const profile_url = `${location.origin}/user/${encodeURIComponent(user.username)}`
                    return `<div class="friend-matrix-user">${avatar ? `<a href="${escapeHtml(profile_url)}" target="_blank" rel="noopener noreferrer" title="在新标签页打开 ${escapeHtml(user.nickname || user.username)} 的个人页"><img src="${escapeHtml(avatar)}" alt=""></a>` : ''}<span>${escapeHtml(user.nickname || user.username)}</span></div>`
                }
                const sample_penalty = get_friend_matrix_sample_penalty()
                const shrinkage_k = get_friend_matrix_shrinkage_k()
                body.innerHTML = `<div class="friend-rule-toolbar"><label class="friend-matrix-rule-setting">评级规则<select id="friend-matrix-rule">${rules.map(rule => `<option value="${escapeHtml(rule.id)}" ${rule.id === selected_rule.id ? 'selected' : ''}>${escapeHtml(rule.name)}</option>`).join('')}</select></label><div class="friend-matrix-choice friend-matrix-sort-mode" role="radiogroup" aria-label="分数模式"><span>分数</span><label><input type="radio" name="friend-matrix-sort-mode" value="score" ${friend_matrix_sort_mode === 'score' ? 'checked' : ''}>原始分</label><label title="样本惩罚分 = 原始分 - 惩罚值 / √命中条目数"><input type="radio" name="friend-matrix-sort-mode" value="sample-penalty" ${friend_matrix_sort_mode === 'sample-penalty' ? 'checked' : ''}>惩罚分</label><label title="受 μ k 控制，原理：贝叶斯收缩。"><input type="radio" name="friend-matrix-sort-mode" value="shrinkage" ${friend_matrix_sort_mode === 'shrinkage' ? 'checked' : ''}>收缩分</label></div><label class="friend-matrix-penalty-setting" title="样本惩罚分 = 原始分 - 惩罚值 / √命中数。">惩罚值<input type="number" id="friend-matrix-sample-penalty" min="0" max="${MAX_FRIEND_MATRIX_SAMPLE_PENALTY}" step="1" value="${sample_penalty}"></label><label class="friend-matrix-penalty-setting" title="贝叶斯收缩的中心值，影响收缩分。右侧推荐值是当前评级规则下用户原始分的中位数。">先验均值 μ<input type="number" id="friend-matrix-shrinkage-mu" min="0" max="100" step="0.1" value="${shrinkage_mu}"><small class="friend-matrix-recommendation">推荐 ${recommended_mu.toFixed(1)}</small></label><label class="friend-matrix-penalty-setting" title="影响收缩分，k 越大越依赖 μ，k 越小越接近原始分。">先验强度 k<input type="number" id="friend-matrix-shrinkage-k" min="1" max="${MAX_FRIEND_MATRIX_SHRINKAGE_K}" step="1" value="${shrinkage_k}"></label></div><div class="friend-matrix-scroll"><table class="friend-rating-matrix"><thead><tr><th>用户</th><th aria-sort="descending">${escapeHtml(selected_rule.name)} ↓</th></tr></thead><tbody>${rows.map(({user,cell}) => `<tr><td>${user_html(user)}</td><td>${cell_html(cell)}</td></tr>`).join('')}</tbody></table></div>`
                body.querySelector('#friend-matrix-rule').addEventListener('change', event => {
                    friend_matrix_sort_rule_id = event.target.value
                    render_friend_matrix_tab(body)
                })
                body.querySelectorAll('[name="friend-matrix-sort-mode"]').forEach(input => input.addEventListener('change', () => {
                    if (!input.checked || !FRIEND_MATRIX_SORT_MODES.has(input.value)) return
                    friend_matrix_sort_mode = input.value
                    localStorage.setItem(FRIEND_MATRIX_SORT_MODE_KEY, friend_matrix_sort_mode)
                    render_friend_matrix_tab(body)
                }))
                body.querySelector('#friend-matrix-sample-penalty').addEventListener('change', event => {
                    const value = Number(event.target.value)
                    if (!event.target.value.trim() || !Number.isFinite(value) || value < 0 || value > MAX_FRIEND_MATRIX_SAMPLE_PENALTY) {
                        alert(`样本惩罚值必须是 0～${MAX_FRIEND_MATRIX_SAMPLE_PENALTY} 之间的数字`)
                        event.target.value = get_friend_matrix_sample_penalty()
                        return
                    }
                    set_friend_matrix_sample_penalty(value)
                    render_friend_matrix_tab(body)
                })
                body.querySelector('#friend-matrix-shrinkage-k').addEventListener('change', event => {
                    const value = Number(event.target.value)
                    if (!event.target.value.trim() || !Number.isInteger(value) || value < 1 || value > MAX_FRIEND_MATRIX_SHRINKAGE_K) {
                        alert(`先验强度 k 必须是 1～${MAX_FRIEND_MATRIX_SHRINKAGE_K} 之间的整数`)
                        event.target.value = get_friend_matrix_shrinkage_k()
                        return
                    }
                    set_friend_matrix_shrinkage_k(value)
                    render_friend_matrix_tab(body)
                })
                body.querySelector('#friend-matrix-shrinkage-mu').addEventListener('change', event => {
                    const value = Number(event.target.value)
                    if (!event.target.value.trim() || !Number.isFinite(value) || value < 0 || value > 100) {
                        alert('先验均值 μ 必须是 0～100 之间的数字')
                        event.target.value = get_friend_matrix_shrinkage_mu()
                        return
                    }
                    set_friend_matrix_shrinkage_mu(value)
                    render_friend_matrix_tab(body)
                })
                if (export_button) {
                    export_button.hidden = false
                    export_button.onclick = () => export_friend_matrix_csv(rows, selected_rule, shrinkage_mu)
                }
            }

            function open_friend_rating_workbench() {
                document.querySelector('.friend-rating-backdrop')?.remove()
                friend_workbench = create_element(`<div class="friend-rating-backdrop"><section class="friend-rating-workbench" role="dialog" aria-modal="true"><header class="friend-rating-header"><h2 style="margin:0">好友评级工作台</h2><button type="button" data-friend-workbench-close>×</button></header><nav class="friend-rating-tabs"><button type="button" class="active" data-friend-tab="current">当前评级</button><button type="button" data-friend-tab="matrix">全缓存好友评级</button><button type="button" id="friend-matrix-export" title="导出当前评级规则的 CSV" aria-label="导出 CSV" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 15v5h14v-5"/></svg><span>导出 CSV</span></button></nav><div class="friend-rating-body"></div></section></div>`)
                document.body.append(friend_workbench)
                friend_workbench.dataset.activeTab = 'current'
                const body = friend_workbench.querySelector('.friend-rating-body')
                render_friend_current_tab(body)
                friend_workbench.addEventListener('click', event => {
                    if (event.target === friend_workbench || event.target.closest('[data-friend-workbench-close]')) {
                        friend_workbench.remove()
                        friend_workbench = null
                        return
                    }
                    const tab = event.target.closest('[data-friend-tab]')
                    if (!tab) return
                    friend_workbench.querySelectorAll('[data-friend-tab]').forEach(item => item.classList.toggle('active', item === tab))
                    friend_workbench.dataset.activeTab = tab.dataset.friendTab
                    if (tab.dataset.friendTab === 'current') render_friend_current_tab(body)
                    if (tab.dataset.friendTab === 'matrix') {
                        friend_matrix_sort_rule_id = friend_rating_document.defaultRule.id
                        render_friend_matrix_tab(body)
                    }
                })
            }

            window.__鉴定_refresh_friend_rating = () => {
                friend_result_cache.clear()
                update_friend_rating_button()
                if (friend_workbench?.dataset.activeTab === 'matrix') {
                    render_friend_matrix_tab(friend_workbench.querySelector('.friend-rating-body'))
                }
            }
            update_friend_rating_button()

            async function render_opponent_menu() {
                const menu = document.getElementById('opponent-menu')
                if (!menu) return
                menu.innerHTML = '<div style="padding:8px;color:#888">读取本地缓存...</div>'
                try {
                    const cached_collection_users = await api_cache.getCachedCollectionUsernames()
                    const users = (await api_cache.getAllUsers())
                        .filter(user => user.username !== self_username && cached_collection_users.has(user.username))
                        .sort((a, b) => {
                            const recent_diff = Number(recent_opponents[b.username] || 0) - Number(recent_opponents[a.username] || 0)
                            if (recent_diff !== 0) return recent_diff
                            return String(a.nickname || a.username).localeCompare(String(b.nickname || b.username), 'zh-CN')
                        })
                    const stale_users = stale_cached_users(users)
                    menu.innerHTML = `<form id="opponent-search-form" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;padding:5px">
                            <input id="opponent-search-input" type="text" placeholder="@用户名" autocomplete="off" style="min-width:0;padding:5px 7px">
                            <button type="submit">搜索并添加</button>
                            <small id="opponent-search-status" style="grid-column:1/-1;color:#888"></small>
                        </form>
                        <button type="button" class="opponent-option" data-opponent-action="friends"><b>＋ 从好友中载入用户</b></button>
                        ${stale_users.length ? `<div class="opponent-row">
                            <div class="opponent-stale-option" data-cache-bulk-progress>7天前缓存（${stale_users.length}）</div>
                            <button type="button" class="opponent-cache-action" data-cache-bulk-action="refresh" title="更新 7 天前缓存">↻</button>
                            <button type="button" class="opponent-cache-action" data-cache-bulk-action="clean" title="删除 7 天前缓存">×</button>
                        </div>` : ''}
                        <div class="opponent-row">
                            <div class="opponent-option">
                                <img src="${escapeHtml(cur_user2.avatar?.medium || '')}" alt=""><span>我 · ${escapeHtml(cur_user2.nickname || cur_user2.username)}<small style="display:block;color:#888">@${escapeHtml(cur_user2.username)} · ${escapeHtml(format_cache_time(cur_user2.username))}</small></span>
                            </div>
                            <button type="button" class="opponent-cache-action" data-cache-action="refresh" data-cache-username="${escapeHtml(cur_user2.username)}" title="更新自己的资料和收藏缓存">↻</button>
                        </div>
                        ${users.map(user => `<div class="opponent-row">
                            <button type="button" class="opponent-option" data-opponent-username="${escapeHtml(user.username)}">
                                <img src="${escapeHtml(user.avatar?.medium || '')}" alt=""><span>${escapeHtml(user.nickname || user.username)}<small style="display:block;color:#888">@${escapeHtml(user.username)} · ${escapeHtml(format_cache_time(user.username))}</small></span>
                            </button>
                            <button type="button" class="opponent-cache-action" data-cache-action="refresh" data-cache-username="${escapeHtml(user.username)}" title="刷新用户资料和收藏缓存">↻</button>
                            <button type="button" class="opponent-cache-action" data-cache-action="delete" data-cache-username="${escapeHtml(user.username)}" title="删除缓存">×</button>
                        </div>`).join('') || '<div style="padding:8px;color:#888">暂无其他缓存用户</div>'}`
                } catch (error) {
                    menu.innerHTML = `<div style="padding:8px;color:#d33">读取缓存失败：${escapeHtml(error.message || error)}</div>`
                }
            }

            async function open_friend_loader() {
                const modal = create_element(`<div class="friend-loader-backdrop">
                    <section class="friend-loader-modal" role="dialog" aria-modal="true">
                        <h2 style="margin:0">从好友中载入用户</h2>
                        <p style="margin:5px 0;color:#888">载入当前选择的条目类型：${escapeHtml(get_subject_selection_label())}。</p>
                        <div class="friend-loader-bulk">
                            <label>数量 <input type="number" min="1" step="1" data-friend-quantity disabled></label>
                            <button type="button" data-friend-action="select-count" disabled>选择前 N 名</button>
                            <button type="button" data-friend-action="select-all" disabled>全选</button>
                        </div>
                        <div class="friend-loader-list"><div style="padding:20px;color:#888">读取好友列表...</div></div>
                        <div class="friend-loader-progress" style="min-height:1.5em;color:#888"></div>
                        <div class="friend-loader-actions">
                            <button type="button" data-friend-action="close">关闭</button>
                            <button type="button" data-friend-action="load">载入所选好友</button>
                        </div>
                    </section>
                </div>`)
                document.body.append(modal)
                const list = modal.querySelector('.friend-loader-list')
                const progress = modal.querySelector('.friend-loader-progress')
                const quantity_input = modal.querySelector('[data-friend-quantity]')
                let friends = []
                const update_selection_summary = () => {
                    const checked = list.querySelectorAll('input[data-friend-index]:checked')
                    progress.textContent = `已选择 ${checked.length} 名好友`
                }
                try {
                    friends = await fetch_friend_index(self_username)
                    list.innerHTML = friends.map((friend, index) => `<label class="friend-loader-item">
                        <input type="checkbox" data-friend-index="${index}">
                        <img src="${escapeHtml(friend.avatar || '')}" alt="">
                        <span title="${escapeHtml(friend.nickname)}">${escapeHtml(friend.nickname)}</span>
                        <small title="${escapeHtml(format_friend_activity(friend))}">${escapeHtml(format_friend_activity(friend))}</small>
                    </label>`).join('') || '<div style="padding:20px;color:#888">没有读取到好友</div>'
                    if (friends.length) {
                        quantity_input.max = String(friends.length)
                        quantity_input.value = String(Math.min(20, friends.length))
                        modal.querySelectorAll('[data-friend-action="select-count"], [data-friend-action="select-all"], [data-friend-quantity]').forEach(control => { control.disabled = false })
                    }
                } catch (error) {
                    list.innerHTML = `<div style="padding:20px;color:#d33">好友列表读取失败：${escapeHtml(error.message || error)}</div>`
                }
                modal.addEventListener('click', async event => {
                    if (event.target === modal) modal.remove()
                    const action = event.target.closest('[data-friend-action]')?.dataset.friendAction
                    if (!action) return
                    if (action === 'close') modal.remove()
                    if (action === 'select-count') {
                        const count = Number(quantity_input.value)
                        if (!Number.isInteger(count) || count < 1 || count > friends.length) return alert(`请输入 1～${friends.length} 的整数`)
                        list.querySelectorAll('input[data-friend-index]').forEach((input, index) => { input.checked = index < count })
                        update_selection_summary()
                    }
                    if (action === 'select-all') {
                        list.querySelectorAll('input[data-friend-index]').forEach(input => { input.checked = true })
                        update_selection_summary()
                    }
                    if (action === 'load') {
                        const selected = [...list.querySelectorAll('input[data-friend-index]:checked')].map(input => friends[Number(input.dataset.friendIndex)]).filter(Boolean)
                        if (!selected.length) return alert('请至少选择一位好友')
                        modal.querySelectorAll('button,input').forEach(control => { control.disabled = true })
                        let cursor = 0
                        let completed = 0
                        const failures = []
                        const worker = async () => {
                            while (cursor < selected.length) {
                                const friend = selected[cursor++]
                                progress.textContent = `正在载入 ${friend.nickname}（${completed}/${selected.length}）`
                                try {
                                    await load_manager_async.get_user(friend.username)
                                    await load_manager_async.get_coll(friend.username)
                                    mark_opponent_viewed(friend.username)
                                } catch (error) {
                                    failures.push(`${friend.username}: ${error.message || error}`)
                                }
                                completed++
                            }
                        }
                        await Promise.all(Array.from({ length: Math.min(3, selected.length) }, worker))
                        progress.textContent = `完成：成功 ${selected.length - failures.length}，失败 ${failures.length}${failures.length ? `（${failures.join('；')}）` : ''}`
                        modal.querySelectorAll('button,input').forEach(control => { control.disabled = false })
                        await render_opponent_menu()
                    }
                })
                list.addEventListener('change', event => {
                    if (!event.target.matches('input[data-friend-index]')) return
                    update_selection_summary()
                })
            }

            // ─── 事件绑定 ───

            function updateDescription() {
                const rule = get_rule_for_sort(analyze_config.current_sort)
                const rule_note = rule?.description?.trim()
                const description = rule_note ? `${preset_rule_overrides[analyze_config.current_sort] ? '已修改 · ' : ''}${escapeHtml(rule_note)}` : ''
                const description_element = document.getElementById('sort-description')
                description_element.innerHTML = description
                description_element.hidden = !description
            }

            const touch_media = window.matchMedia('(hover: none), (pointer: coarse)')
            let page_overflow_before_sheet = ''
            let body_overflow_before_sheet = ''

            function is_touch_mode() {
                return touch_media.matches
            }

            function update_mobile_settings_summary() {
                const button = document.getElementById('mobile-settings-toggle')
                if (!button) return
                button.textContent = `${get_subject_selection_label(true)} · 设置`
            }

            function close_mobile_sheet() {
                const backdrop = document.getElementById('mobile-sheet-backdrop')
                if (!backdrop || backdrop.hidden) return
                backdrop.hidden = true
                document.documentElement.style.overflow = page_overflow_before_sheet
                document.body.style.overflow = body_overflow_before_sheet
            }

            function open_mobile_sheet(title, html, bind_content) {
                const backdrop = document.getElementById('mobile-sheet-backdrop')
                if (!backdrop) return
                document.getElementById('mobile-sheet-title').textContent = title
                const content = document.getElementById('mobile-sheet-content')
                content.innerHTML = html
                if (backdrop.hidden) {
                    page_overflow_before_sheet = document.documentElement.style.overflow
                    body_overflow_before_sheet = document.body.style.overflow
                }
                document.documentElement.style.overflow = 'hidden'
                document.body.style.overflow = 'hidden'
                backdrop.hidden = false
                if (typeof bind_content === 'function') bind_content(content)
                document.getElementById('mobile-sheet-close').focus({ preventScroll: true })
            }

            function bind_compact_card_interactions() {
                const container = document.getElementById('sort-list-container')
                if (!container) return
                const apply_my_comment_state = () => {
                    container.querySelectorAll('._compact_my_comment_block').forEach(block => {
                        block.classList.toggle('is-collapsed', analyze_config.my_comment_collapsed)
                        const button = block.closest('._compact_tip, ._compact_inline_detail')?.querySelector('._compact_my_comment_toggle')
                        if (!button) return
                        button.textContent = analyze_config.my_comment_collapsed ? '展开我的吐槽' : '折叠我的吐槽'
                        button.setAttribute('aria-expanded', analyze_config.my_comment_collapsed ? 'false' : 'true')
                    })
                }
                function open_subject_link(subject_url) {
                    const opened = window.open(new URL(subject_url, location.origin).href, '_blank', 'noopener')
                    if (opened) opened.opener = null
                }
                function handle_subject_card_action(action, subject_id, subject_url) {
                    if (action === 'important') {
                        set_important_subject_marked(subject_id, !important_subject_ids.has(subject_id))
                    }
                    if (action === 'open') open_subject_link(subject_url)
                }
                if (container.dataset.detailControlsBound !== '1') {
                    container.dataset.detailControlsBound = '1'
                    container.addEventListener('click', event => {
                        const action_button = event.target.closest('._compact_detail_action[data-card-action]')
                        if (action_button) {
                            event.preventDefault()
                            event.stopPropagation()
                            const action_root = action_button.closest('._compact_detail_actions')
                            const subject_id = Number(action_button.dataset.subjectId || action_root?.dataset.subjectId)
                            const subject_url = action_button.dataset.subjectUrl || action_root?.dataset.subjectUrl
                            handle_subject_card_action(action_button.dataset.cardAction, subject_id, subject_url)
                            return
                        }
                        const toggle = event.target.closest('._compact_my_comment_toggle')
                        if (!toggle) return
                        event.preventDefault()
                        event.stopPropagation()
                        analyze_config.my_comment_collapsed = !analyze_config.my_comment_collapsed
                        save_settings()
                        apply_my_comment_state()
                    })
                }
                container.querySelectorAll('.rule-section-more [data-section-expand]').forEach(button => button.addEventListener('click', event => {
                    event.preventDefault()
                    event.stopPropagation()
                    const section_id = button.closest('.rule-section-more').dataset.sectionId
                    const current = Number(expanded_result_sections.get(section_id) || 0)
                    const hidden_count = Number(button.dataset.hiddenCount || 0)
                    const increment = button.dataset.sectionExpand === 'all' ? hidden_count : Math.min(10, hidden_count)
                    expanded_result_sections.set(section_id, current + increment)
                    refreshList()
                }))
                const close_detail = detail => {
                    if (!detail) return
                    detail.sourceCard?.setAttribute('aria-expanded', 'false')
                    detail.remove()
                }
                const show_detail = (card, tip) => {
                    const current = container.querySelector('._compact_inline_detail')
                    if (current?.sourceCard === card) {
                        return current
                    }
                    close_detail(current)
                    const detail = document.createElement('div')
                    detail.className = '_compact_inline_detail'
                    detail.innerHTML = tip.innerHTML
                    detail.sourceCard = card
                    detail.classList.add('__locked')
                    card.setAttribute('aria-expanded', 'true')
                    const row_top = card.offsetTop
                    const row_cards = [...container.querySelectorAll('._compact_card, .rule-section-more')].filter(item => item.offsetTop === row_top)
                    const row_last_card = row_cards[row_cards.length - 1] || card
                    row_last_card.insertAdjacentElement('afterend', detail)
                    return detail
                }
                container.querySelectorAll('._compact_card').forEach(card => {
                    const tip = card.querySelector('._compact_tip')
                    if (!tip || card.dataset.compactInteractionBound === '1') return
                    card.dataset.compactInteractionBound = '1'
                    card.setAttribute('role', 'button')
                    card.tabIndex = 0
                    const toggle_detail = event => {
                        event.preventDefault()
                        event.stopPropagation()
                        const current = container.querySelector('._compact_inline_detail')
                        if (current?.sourceCard === card) {
                            close_detail(current)
                            return
                        }
                        show_detail(card, tip)
                    }
                    card.addEventListener('click', toggle_detail)
                    card.addEventListener('keydown', event => {
                        if (event.key === 'Enter' || event.key === ' ') toggle_detail(event)
                    })
                    card.addEventListener('contextmenu', event => {
                        event.preventDefault()
                        event.stopPropagation()
                        document.querySelector('.custom-context-menu')?.remove()
                        const subject_id = Number(card.dataset.subjectId)
                        const marked = important_subject_ids.has(subject_id)
                        const menu = create_element(`<div class="custom-context-menu" style="left:${event.clientX}px;top:${event.clientY}px">
                            <button type="button" data-card-action="important">${marked ? '取消标记为重要番剧' : '标记为重要番剧'}</button>
                            <button type="button" data-card-action="open">在新窗口打开作品链接</button>
                        </div>`)
                        document.body.append(menu)
                        const menu_rect = menu.getBoundingClientRect()
                        menu.style.left = `${Math.max(4, Math.min(event.clientX, window.innerWidth - menu_rect.width - 4))}px`
                        menu.style.top = `${Math.max(4, Math.min(event.clientY, window.innerHeight - menu_rect.height - 4))}px`
                        menu.addEventListener('click', menu_event => {
                            const action = menu_event.target.dataset.cardAction
                            if (!action) return
                            menu.remove()
                            handle_subject_card_action(action, subject_id, card.dataset.subjectUrl)
                        })
                        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0)
                    })
                })
            }

            function refreshList() {
                const evaluation = getEvaluatedRule(analyze_config.current_sort)
                const container = document.getElementById('sort-list-container')
                container.innerHTML = render_rule_result(evaluation)
                bind_compact_card_interactions()
                updateDescription()
                update_subject_search_visibility()
            }

            function open_custom_sort_editor_legacy(source_rule = null, copy_mode = false, edit_preset_key = null) {
                let initial = source_rule
                    ? JSON.parse(JSON.stringify(source_rule))
                    : {
                        name: '我的规则', description: '', sets: { my: 'rated', his: 'rated' }, filters: default_filter_state(),
                        factors: [{ id: 'agreement', direction: 'positive', weight: 2 }],
                    }
                if (copy_mode) {
                    delete initial.id
                    initial.name = `${initial.name} 副本`
                }
                const tier_options = (user, selected = []) => ['unrated', 'low', 'medium', 'high'].map(tier => {
                    const labels = { unrated: '未评分', low: '差', medium: '中', high: '好' }
                    return `<label><input type="checkbox" class="tier-filter" data-user="${user}" value="${tier}" ${selected.includes(tier) ? 'checked' : ''}>${labels[tier]}</label>`
                }).join('')
                const status_options = user => [1, 2, 3, 4, 5].map(type => `
                    <label><input type="checkbox" class="status-filter" data-user="${user}" value="${type}">${collTypeMap[String(type)]}</label>
                `).join('')
                const comment_options = user => [['any', '不限'], ['has', '有吐槽'], ['empty', '无吐槽']].map(([value, label]) => `
                    <label><input type="radio" name="${user}-comment-filter" value="${value}">${label}</label>
                `).join('')
                const set_mode_options = user => Object.entries(SET_MODE_DEFS)
                    .filter(([value]) => !['important', 'not_important'].includes(value) || user === 'my')
                    .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('')
                const factor_cards = Object.entries(FACTOR_DEFS).map(([id, def]) => `
                    <div class="custom-factor-card" data-factor-id="${id}">
                        <label class="factor-switch"><input type="checkbox" class="factor-enabled"> <strong>${def.label}</strong></label>
                        <span class="factor-group">${def.group}</span>
                        <div class="factor-controls">
                            <select class="factor-direction"><option value="positive">${def.positive}</option><option value="negative">${def.negative}</option></select>
                            <select class="factor-weight"><option value="1">低权重</option><option value="2">中权重</option><option value="3">高权重</option></select>
                        </div>
                    </div>`).join('')
                const range_rows = Object.entries(RANGE_FILTER_DEFS).map(([id, def]) => `
                    <label class="custom-range-row"><span>${def.label}</span>
                        <input class="range-min" data-range="${id}" type="${def.type || 'number'}" ${def.min != null ? `min="${def.min}"` : ''} ${def.step ? `step="${def.step}"` : ''} placeholder="最小">
                        <span>—</span>
                        <input class="range-max" data-range="${id}" type="${def.type || 'number'}" ${def.max != null ? `max="${def.max}"` : ''} ${def.step ? `step="${def.step}"` : ''} placeholder="最大">
                    </label>`).join('')
                const backdrop = create_element(`
                    <div class="custom-sort-modal-backdrop">
                        <section class="custom-sort-modal" role="dialog" aria-modal="true">
                            <header class="custom-modal-header">
                                <h2>${edit_preset_key ? `编辑默认规则：${DEFAULT_PRESET_RULES[edit_preset_key].name}` : source_rule && !copy_mode ? '编辑规则' : '新建规则'}</h2>
                                <div class="custom-modal-actions">
                                    <button type="button" data-action="cancel">取消</button>
                                    <button type="button" data-action="save">保存并应用</button>
                                </div>
                            </header>
                            <div class="custom-sort-form-grid">
                                <label>名称<input id="custom-rule-name" maxlength="30" /></label>
                                <label>从内置预设开始
                                    <select id="custom-rule-template">
                                        <option value="">空白 / 保持当前</option>
                                        ${Object.entries(DEFAULT_PRESET_RULES).map(([id, preset]) => `<option value="${id}">${escapeHtml(preset.name)}</option>`).join('')}
                                    </select>
                                </label>
                                <label>我的条目范围
                                    <select id="custom-rule-my-set">
                                        ${set_mode_options('my')}
                                    </select>
                                </label>
                                <label>对方条目范围
                                    <select id="custom-rule-his-set">
                                        ${set_mode_options('his')}
                                    </select>
                                </label>
                                <label style="grid-column:1/-1">说明备注<textarea id="custom-rule-description" maxlength="300" rows="2" placeholder="说明这条规则适合找什么条目"></textarea></label>
                            </div>
                            <section class="custom-filter-section">
                                <h3>硬筛选 <small>组间同时满足，组内可多选</small></h3>
                                <div class="custom-filter-grid">
                                    <div><b>我的评分档位</b><div class="custom-chip-row" data-tier-host="my">${tier_options('my')}</div></div>
                                    <div><b>对方评分档位</b><div class="custom-chip-row" data-tier-host="his">${tier_options('his')}</div></div>
                                    <div><b>我的收藏状态</b><div class="custom-chip-row" data-status-host="my">${status_options('my')}</div></div>
                                    <div><b>对方收藏状态</b><div class="custom-chip-row" data-status-host="his">${status_options('his')}</div></div>
                                    <div><b>我的吐槽</b><div class="custom-radio-row">${comment_options('my')}</div></div>
                                    <div><b>对方吐槽</b><div class="custom-radio-row">${comment_options('his')}</div></div>
                                </div>
                                <details class="custom-advanced-filter"><summary>高级数值范围</summary>${range_rows}</details>
                            </section>
                            <section class="custom-factor-section">
                                <h3>综合评分 <small>启用因素后选择偏好方向和权重</small>
                                    <button id="custom-score-mode-toggle" type="button" data-score-mode="hidden" style="float:right">评分依据：隐藏分</button>
                                </h3>
                                <div class="custom-factor-grid">${factor_cards}</div>
                            </section>
                            <div id="custom-rule-preview" class="custom-preview"></div>
                            <div id="custom-score-detail" class="custom-score-detail"></div>
                        </section>
                    </div>`)
                document.body.append(backdrop)

                const name_input = backdrop.querySelector('#custom-rule-name')
                const description_input = backdrop.querySelector('#custom-rule-description')
                if (edit_preset_key) name_input.disabled = true
                const my_set_select = backdrop.querySelector('#custom-rule-my-set')
                const his_set_select = backdrop.querySelector('#custom-rule-his-set')

                function collect_draft() {
                    const selected_tiers = user => [...backdrop.querySelectorAll(`.tier-filter[data-user="${user}"]:checked`)].map(input => input.value)
                    const selected_types = user => [...backdrop.querySelectorAll(`.status-filter[data-user="${user}"]:checked`)].map(input => Number(input.value))
                    const ranges = {}
                    for (const id of Object.keys(RANGE_FILTER_DEFS)) {
                        const min = backdrop.querySelector(`.range-min[data-range="${id}"]`).value
                        const max = backdrop.querySelector(`.range-max[data-range="${id}"]`).value
                        if (min !== '' || max !== '') ranges[id] = { min: min || null, max: max || null }
                    }
                    const factors = [...backdrop.querySelectorAll('.custom-factor-card')].filter(card => card.querySelector('.factor-enabled').checked).map(card => ({
                        id: card.dataset.factorId,
                        direction: card.querySelector('.factor-direction').value,
                        weight: Number(card.querySelector('.factor-weight').value),
                    }))
                    return {
                        ...(initial.id ? { id: initial.id } : {}),
                        name: name_input.value.trim(),
                        description: description_input.value.trim(),
                        scoreMode: backdrop.querySelector('#custom-score-mode-toggle').dataset.scoreMode,
                        sets: { my: my_set_select.value, his: his_set_select.value },
                        filters: {
                            my_tiers: selected_tiers('my'),
                            his_tiers: selected_tiers('his'),
                            my_types: selected_types('my'),
                            his_types: selected_types('his'),
                            my_comment: backdrop.querySelector('input[name="my-comment-filter"]:checked')?.value || 'any',
                            his_comment: backdrop.querySelector('input[name="his-comment-filter"]:checked')?.value || 'any',
                            ranges,
                        },
                        factors,
                        sourcePreset: backdrop.querySelector('#custom-rule-template').value || initial.sourcePreset || null,
                        ...(initial.missingScoreAsZero ? { missingScoreAsZero: true } : {}),
                    }
                }

                function show_score_detail(item) {
                    const host = backdrop.querySelector('#custom-score-detail')
                    if (!item?._factor_scores?.length) {
                        host.innerHTML = '<span>该规则未启用评分因素。</span>'
                        return
                    }
                    host.innerHTML = `<strong>${escapeHtml(getSubjectDisplayName(item.subject))} · 综合 ${item._custom_score.toFixed(1)}</strong>
                        <table><thead><tr><th>因素</th><th>原分</th><th>偏好分</th><th>权重</th><th>加权值</th></tr></thead><tbody>
                        ${item._factor_scores.map(score => `<tr><td>${FACTOR_DEFS[score.id].label}</td><td>${score.raw.toFixed(1)}</td><td>${score.preferred.toFixed(1)}</td><td>${score.weight}</td><td>${score.contribution.toFixed(1)}</td></tr>`).join('')}
                        </tbody></table>`
                }

                function update_preview() {
                    const draft = collect_draft()
                    const evaluation = evaluate_rule(draft)
                    const items = evaluation.items
                    const preview = backdrop.querySelector('#custom-rule-preview')
                    preview.innerHTML = `<strong>条目范围交集 ${evaluation.scopedCount} 条 → 筛选命中 ${items.length} 条${evaluation.excludedCount ? `，缺少评分数据排除 ${evaluation.excludedCount} 条` : ''}</strong><div class="custom-preview-items">${items.slice(0, 5).map((item, index) => `
                        <button type="button" class="custom-preview-item" data-preview-index="${index}" title="点击查看评分明细">
                            <img src="${item.subject.images?.grid || ''}" loading="lazy" />
                            <span>${escapeHtml(getSubjectDisplayName(item.subject))}</span>
                            ${item._custom_score == null ? '' : `<b>${item._custom_score.toFixed(1)}</b>`}
                        </button>`).join('')}</div>`
                    preview.querySelectorAll('[data-preview-index]').forEach(button => button.addEventListener('click', () => show_score_detail(items[Number(button.dataset.previewIndex)])))
                    backdrop.querySelector('#custom-score-detail').innerHTML = ''
                }

                function fill_form(rule) {
                    name_input.value = rule.name || '我的规则'
                    description_input.value = rule.description || ''
                    const score_mode_button = backdrop.querySelector('#custom-score-mode-toggle')
                    score_mode_button.dataset.scoreMode = rule.scoreMode === 'raw' ? 'raw' : 'hidden'
                    score_mode_button.textContent = `评分依据：${score_mode_button.dataset.scoreMode === 'raw' ? '原始分' : '隐藏分'}`
                    const sets = get_rule_sets(rule)
                    my_set_select.value = sets.my
                    his_set_select.value = sets.his
                    backdrop.querySelector('#custom-rule-template').value = rule.sourcePreset || ''
                    for (const user of ['my', 'his']) {
                        const selected_tiers = Object.prototype.hasOwnProperty.call(rule.filters || {}, `${user}_tiers`)
                            ? rule.filters[`${user}_tiers`]
                            : ['unrated', 'low', 'medium', 'high']
                        backdrop.querySelectorAll(`.tier-filter[data-user="${user}"]`).forEach(input => {
                            input.checked = selected_tiers.includes(input.value)
                        })
                        const selected_types = Object.prototype.hasOwnProperty.call(rule.filters || {}, `${user}_types`)
                            ? rule.filters[`${user}_types`].map(Number)
                            : [1, 2, 3, 4, 5]
                        backdrop.querySelectorAll(`.status-filter[data-user="${user}"]`).forEach(input => {
                            input.checked = selected_types.includes(Number(input.value))
                        })
                        const comment_mode = rule.filters?.[`${user}_comment`] || 'any'
                        const comment_input = backdrop.querySelector(`input[name="${user}-comment-filter"][value="${comment_mode}"]`)
                        if (comment_input) comment_input.checked = true
                    }
                    for (const id of Object.keys(RANGE_FILTER_DEFS)) {
                        backdrop.querySelector(`.range-min[data-range="${id}"]`).value = rule.filters?.ranges?.[id]?.min ?? ''
                        backdrop.querySelector(`.range-max[data-range="${id}"]`).value = rule.filters?.ranges?.[id]?.max ?? ''
                    }
                    backdrop.querySelectorAll('.custom-factor-card').forEach(card => {
                        const factor = (rule.factors || []).find(item => item.id === card.dataset.factorId)
                        card.querySelector('.factor-enabled').checked = !!factor
                        card.querySelector('.factor-direction').value = factor?.direction || 'positive'
                        card.querySelector('.factor-weight').value = String(factor?.weight || 2)
                        card.classList.toggle('enabled', !!factor)
                    })
                    update_preview()
                }

                backdrop.querySelector('#custom-rule-template').addEventListener('change', event => {
                    const preset = get_effective_preset(event.target.value)
                    if (!preset) return
                    const preserved_id = initial.id
                    initial = { ...JSON.parse(JSON.stringify(preset)), ...(preserved_id ? { id: preserved_id } : {}), sourcePreset: event.target.value }
                    initial.name = edit_preset_key ? DEFAULT_PRESET_RULES[edit_preset_key].name : `${preset.name} 自定义`
                    fill_form(initial)
                })
                backdrop.querySelector('#custom-score-mode-toggle').addEventListener('click', event => {
                    event.currentTarget.dataset.scoreMode = event.currentTarget.dataset.scoreMode === 'hidden' ? 'raw' : 'hidden'
                    event.currentTarget.textContent = `评分依据：${event.currentTarget.dataset.scoreMode === 'raw' ? '原始分' : '隐藏分'}`
                    update_preview()
                })
                backdrop.querySelectorAll('input,select,textarea').forEach(element => {
                    element.addEventListener('input', update_preview)
                    element.addEventListener('change', () => {
                        if (element.classList.contains('factor-enabled')) element.closest('.custom-factor-card').classList.toggle('enabled', element.checked)
                        update_preview()
                    })
                })
                backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => backdrop.remove())
                backdrop.addEventListener('click', event => {
                    if (event.target === backdrop) backdrop.remove()
                })
                backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
                    const draft = collect_draft()
                    if (edit_preset_key) {
                        draft.name = DEFAULT_PRESET_RULES[edit_preset_key].name
                        delete draft.id
                        preset_rule_overrides[edit_preset_key] = draft
                        persist_preset_overrides()
                        analyze_config.current_sort = edit_preset_key
                        backdrop.remove()
                        refresh_custom_rule_ui()
                        return
                    }
                    if (!draft.name) return alert('规则名称不能为空')
                    const duplicate = get_active_custom_rules().find(rule => rule.name === draft.name && rule.id !== draft.id)
                    if (duplicate) return alert('规则名称不能重复')
                    const saved = put_custom_rule(draft)
                    analyze_config.current_sort = `custom:${saved.id}`
                    save_settings()
                    backdrop.remove()
                    refresh_custom_rule_ui()
                })
                fill_form(initial)
            }

            function open_custom_sort_editor(source_rule = null, copy_mode = false, edit_preset_key = null) {
                const clone = value => JSON.parse(JSON.stringify(value))
                let working = source_rule ? clone(source_rule) : {
                    name: '我的规则', description: '', sourcePreset: null,
                    sections: [make_section(`section-${Date.now().toString(36)}`, '结果')],
                }
                if (copy_mode) {
                    delete working.id
                    working.name = `${working.name} 副本`
                }
                const modal = create_element(`<div class="custom-sort-modal-backdrop"><section class="custom-sort-modal" role="dialog" aria-modal="true">
                    <header class="custom-modal-header"><h2>${edit_preset_key ? `编辑默认规则：${DEFAULT_PRESET_RULES[edit_preset_key].name}` : source_rule && !copy_mode ? '编辑规则' : '新建规则'}</h2>
                        <div class="custom-modal-actions"><button type="button" data-modal-action="cancel">取消</button><button type="button" data-modal-action="save">保存并应用</button></div>
                    </header>
                    <div class="custom-sort-form-grid">
                        <label>名称<input id="multi-rule-name" maxlength="30"></label>
                        <label>从默认规则开始<select id="multi-rule-template"><option value="">空白 / 保持当前</option>${Object.entries(DEFAULT_PRESET_RULES).map(([id, rule]) => `<option value="${id}">${escapeHtml(rule.name)}</option>`).join('')}</select></label>
                        <label style="grid-column:1/-1">规则说明<textarea id="multi-rule-description" maxlength="300" rows="2" placeholder="可不填写"></textarea></label>
                    </div>
                    <div id="multi-section-tabs" class="rule-section-tabs" role="tablist" aria-label="规则分段"></div>
                    <div id="multi-section-host"></div>
                    <button type="button" id="add-rule-section" style="width:100%;margin-top:10px;padding:8px">＋ 新增分段</button>
                    <div id="multi-rule-preview" class="custom-preview"></div>
                </section></div>`)
                document.body.append(modal)
                const name_input = modal.querySelector('#multi-rule-name')
                const description_input = modal.querySelector('#multi-rule-description')
                const template_select = modal.querySelector('#multi-rule-template')
                const section_tabs = modal.querySelector('#multi-section-tabs')
                const section_host = modal.querySelector('#multi-section-host')
                let active_section_id = working.sections[0]?.id || null
                if (edit_preset_key) name_input.disabled = true

                const set_options = (user, selected) => Object.entries(SET_MODE_DEFS)
                    .filter(([value]) => !['important', 'not_important'].includes(value) || user === 'my')
                    .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')
                const tier_html = (section, user) => [['unrated', '未评分'], ['low', '差'], ['medium', '中'], ['high', '好']]
                    .map(([value, label]) => `<label><input type="checkbox" class="section-tier" data-user="${user}" value="${value}" ${section.filters[`${user}_tiers`].includes(value) ? 'checked' : ''}>${label}</label>`).join('')
                const status_html = (section, user) => [1, 2, 3, 4, 5]
                    .map(value => `<label><input type="checkbox" class="section-status" data-user="${user}" value="${value}" ${section.filters[`${user}_types`].includes(value) ? 'checked' : ''}>${collTypeMap[value]}</label>`).join('')
                const comment_html = (section, user) => [['any', '不限'], ['has', '有吐槽'], ['empty', '无吐槽']]
                    .map(([value, label]) => `<label><input type="radio" name="${section.id}-${user}-comment" value="${value}" ${section.filters[`${user}_comment`] === value ? 'checked' : ''}>${label}</label>`).join('')
                const factor_html = section => Object.entries(FACTOR_DEFS).map(([id, def]) => {
                    const factor = section.factors.find(item => item.id === id)
                    return `<div class="custom-factor-card${factor ? ' enabled' : ''}" data-factor-id="${id}">
                        <label class="factor-switch"><input type="checkbox" class="factor-enabled" ${factor ? 'checked' : ''}> <strong>${def.label}</strong></label><span class="factor-group">${def.group}</span>
                        <div class="factor-controls"><select class="factor-direction"><option value="positive" ${factor?.direction !== 'negative' ? 'selected' : ''}>${def.positive}</option><option value="negative" ${factor?.direction === 'negative' ? 'selected' : ''}>${def.negative}</option></select>
                        <select class="factor-weight">${[1, 2, 3].map(weight => `<option value="${weight}" ${Number(factor?.weight || 2) === weight ? 'selected' : ''}>${['低', '中', '高'][weight - 1]}权重</option>`).join('')}</select></div></div>`
                }).join('')
                const range_html = section => Object.entries(RANGE_FILTER_DEFS).map(([id, def]) => `<label class="custom-range-row"><span>${def.label}</span>
                    <input class="range-min" data-range="${id}" type="${def.type || 'number'}" value="${escapeHtml(section.filters.ranges?.[id]?.min ?? '')}" placeholder="最小"><span>—</span>
                    <input class="range-max" data-range="${id}" type="${def.type || 'number'}" value="${escapeHtml(section.filters.ranges?.[id]?.max ?? '')}" placeholder="最大"></label>`).join('')

                function collect_rule() {
                    const card = section_host.querySelector('.rule-section-editor')
                    let sections = working.sections
                    if (card) {
                        const original = working.sections.find(section => section.id === card.dataset.sectionId)
                        const selected = (selector, user, number = false) => [...card.querySelectorAll(`${selector}[data-user="${user}"]:checked`)].map(input => number ? Number(input.value) : input.value)
                        const ranges = {}
                        for (const id of Object.keys(RANGE_FILTER_DEFS)) {
                            const min = card.querySelector(`.range-min[data-range="${id}"]`).value
                            const max = card.querySelector(`.range-max[data-range="${id}"]`).value
                            if (min !== '' || max !== '') ranges[id] = { min: min || null, max: max || null }
                        }
                        const factors = [...card.querySelectorAll('.custom-factor-card')].filter(node => node.querySelector('.factor-enabled').checked).map(node => ({
                            id: node.dataset.factorId, direction: node.querySelector('.factor-direction').value, weight: Number(node.querySelector('.factor-weight').value),
                        }))
                        const active_section = {
                            id: original.id,
                            name: card.querySelector('.section-name').value.trim(),
                            description: card.querySelector('.section-description').value.trim(),
                            limit: card.querySelector('.section-limit').value === 'all' ? null : Number(card.querySelector('.section-limit').value),
                            claimMatches: card.querySelector('.section-claim-matches').checked,
                            appearance: card.querySelector('.section-muted').checked ? 'muted' : 'normal',
                            sets: { my: card.querySelector('.section-my-set').value, his: card.querySelector('.section-his-set').value },
                            filters: {
                                my_tiers: selected('.section-tier', 'my'), his_tiers: selected('.section-tier', 'his'),
                                my_types: selected('.section-status', 'my', true), his_types: selected('.section-status', 'his', true),
                                my_comment: card.querySelector(`input[name="${original.id}-my-comment"]:checked`)?.value || 'any',
                                his_comment: card.querySelector(`input[name="${original.id}-his-comment"]:checked`)?.value || 'any', ranges,
                            },
                            scoreMode: card.querySelector('.section-score-mode').value,
                            // 编辑器不再暴露此兼容开关；保留已有分段的内部行为。
                            missingScoreAsZero: original.missingScoreAsZero === true,
                            factors,
                        }
                        sections = working.sections.map(section => section.id === active_section.id ? active_section : section)
                    }
                    return { ...(working.id ? { id: working.id } : {}), name: name_input.value.trim(), description: description_input.value.trim(), sourcePreset: template_select.value || working.sourcePreset || null, sections }
                }

                function update_preview() {
                    working = { ...working, ...collect_rule() }
                    const evaluation = evaluate_rule(working)
                    const active = evaluation.sections.find(({ section }) => section.id === active_section_id)
                    modal.querySelector('#multi-rule-preview').innerHTML = active ? `
                        <section class="section-preview"><strong>${escapeHtml(active.section.name || '未命名分段')}：命中 ${active.filteredCount}，可排序 ${active.totalSortedCount}，显示 ${active.items.length}${active.excludedCount ? `，缺少评分 ${active.excludedCount}` : ''}</strong>
                        <div class="custom-preview-items">${active.items.slice(0, 8).map(item => `<div class="custom-preview-item"><img src="${item.subject.images?.grid || ''}" loading="lazy"><span>${escapeHtml(getSubjectDisplayName(item.subject))}</span>${item._custom_score == null ? '' : `<b>${item._custom_score.toFixed(1)}</b>`}</div>`).join('')}</div></section>
                    ` : '<span>请新增至少一个分段。</span>'
                }

                function render_sections() {
                    name_input.value = working.name || '我的规则'
                    description_input.value = working.description || ''
                    template_select.value = working.sourcePreset || ''
                    if (!working.sections.some(section => section.id === active_section_id)) active_section_id = working.sections[0]?.id || null
                    section_tabs.innerHTML = working.sections.map((section, index) => `<button type="button" class="rule-section-tab${section.id === active_section_id ? ' active' : ''}" role="tab" aria-selected="${section.id === active_section_id}" data-section-tab="${escapeHtml(section.id)}" title="${escapeHtml(section.name)}">${index + 1}</button>`).join('')
                    const index = working.sections.findIndex(section => section.id === active_section_id)
                    const section = working.sections[index]
                    section_host.innerHTML = section ? `<section class="rule-section-editor" data-section-id="${escapeHtml(section.id)}">
                        <header><strong>分段 ${index + 1}</strong><div><button type="button" data-section-action="up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-section-action="down" ${index === working.sections.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-section-action="copy">复制</button><button type="button" data-section-action="delete" ${working.sections.length === 1 ? 'disabled' : ''}>删除</button></div></header>
                        <div class="custom-sort-form-grid"><label>分段名称<input class="section-name" maxlength="30" value="${escapeHtml(section.name)}"></label>
                        <label>显示数量<select class="section-limit">${[['5','前5项'],['10','前10项'],['20','前20项'],['50','前50项'],['all','全部']].map(([value,label]) => `<option value="${value}" ${(section.limit == null ? 'all' : String(section.limit)) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
                        <label style="grid-column:1/-1">分段说明<textarea class="section-description" maxlength="300" rows="2" placeholder="可不填写">${escapeHtml(section.description || '')}</textarea></label></div>
                        <div class="section-inline-options"><label>我的范围<select class="section-my-set">${set_options('my', section.sets.my)}</select></label><label>对方范围<select class="section-his-set">${set_options('his', section.sets.his)}</select></label>
                        <label>评分依据<select class="section-score-mode"><option value="hidden" ${section.scoreMode === 'hidden' ? 'selected' : ''}>隐藏分</option><option value="raw" ${section.scoreMode === 'raw' ? 'selected' : ''}>原始分</option></select></label>
                        <label><input type="checkbox" class="section-claim-matches" ${section.claimMatches !== false ? 'checked' : ''}>固定本段命中项（后续分段不再重复）</label>
                        <label><input type="checkbox" class="section-muted" ${section.appearance === 'muted' ? 'checked' : ''}>弱化显示</label></div>
                        <div class="custom-filter-grid"><div><b>我的评分档位</b><div class="custom-chip-row">${tier_html(section,'my')}</div></div><div><b>对方评分档位</b><div class="custom-chip-row">${tier_html(section,'his')}</div></div>
                        <div><b>我的收藏状态</b><div class="custom-chip-row">${status_html(section,'my')}</div></div><div><b>对方收藏状态</b><div class="custom-chip-row">${status_html(section,'his')}</div></div>
                        <div><b>我的吐槽</b><div class="custom-radio-row">${comment_html(section,'my')}</div></div><div><b>对方吐槽</b><div class="custom-radio-row">${comment_html(section,'his')}</div></div></div>
                        <details class="custom-advanced-filter"><summary>高级数值范围</summary>${range_html(section)}</details>
                        <h3>综合评分</h3><div class="custom-factor-grid">${factor_html(section)}</div>
                    </section>` : ''
                    section_host.querySelectorAll('.factor-enabled').forEach(input => input.addEventListener('change', () => input.closest('.custom-factor-card').classList.toggle('enabled', input.checked)))
                    update_preview()
                }

                section_host.addEventListener('input', update_preview)
                section_host.addEventListener('change', update_preview)
                section_tabs.addEventListener('click', event => {
                    const tab = event.target.closest('[data-section-tab]')
                    if (!tab || tab.dataset.sectionTab === active_section_id) return
                    working = { ...working, ...collect_rule() }
                    active_section_id = tab.dataset.sectionTab
                    render_sections()
                })
                section_host.addEventListener('click', event => {
                    const action = event.target.dataset.sectionAction
                    if (!action || event.target.disabled) return
                    working = { ...working, ...collect_rule() }
                    const card = event.target.closest('.rule-section-editor')
                    const index = working.sections.findIndex(section => section.id === card.dataset.sectionId)
                    if (action === 'up' || action === 'down') {
                        const target = index + (action === 'up' ? -1 : 1)
                        ;[working.sections[index], working.sections[target]] = [working.sections[target], working.sections[index]]
                    }
                    if (action === 'copy') {
                        const copied = clone(working.sections[index])
                        copied.id = `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
                        copied.name += ' 副本'
                        working.sections.splice(index + 1, 0, copied)
                        active_section_id = copied.id
                    }
                    if (action === 'delete') {
                        working.sections.splice(index, 1)
                        active_section_id = working.sections[Math.min(index, working.sections.length - 1)]?.id || null
                    }
                    render_sections()
                })
                modal.querySelector('#add-rule-section').addEventListener('click', () => {
                    working = { ...working, ...collect_rule() }
                    const added = make_section(`section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, `分段 ${working.sections.length + 1}`)
                    working.sections.push(added)
                    active_section_id = added.id
                    render_sections()
                })
                template_select.addEventListener('change', event => {
                    if (!event.target.value) return
                    const preserved_id = working.id
                    working = clone(get_effective_preset(event.target.value))
                    if (preserved_id) working.id = preserved_id
                    working.sourcePreset = event.target.value
                    working.name = edit_preset_key ? DEFAULT_PRESET_RULES[edit_preset_key].name : `${working.name} 自定义`
                    active_section_id = working.sections[0]?.id || null
                    render_sections()
                })
                name_input.addEventListener('input', update_preview)
                description_input.addEventListener('input', update_preview)
                modal.querySelector('[data-modal-action="cancel"]').addEventListener('click', () => modal.remove())
                modal.addEventListener('click', event => { if (event.target === modal) modal.remove() })
                modal.querySelector('[data-modal-action="save"]').addEventListener('click', () => {
                    const draft = collect_rule()
                    if (!draft.name) return alert('规则名称不能为空')
                    if (!draft.sections.length || draft.sections.some(section => !section.name)) return alert('每个分段都需要名称')
                    if (edit_preset_key) {
                        draft.name = DEFAULT_PRESET_RULES[edit_preset_key].name
                        delete draft.id
                        preset_rule_overrides[edit_preset_key] = draft
                        persist_preset_overrides()
                        analyze_config.current_sort = edit_preset_key
                    } else {
                        const duplicate = get_active_custom_rules().find(rule => rule.name === draft.name && rule.id !== draft.id)
                        if (duplicate) return alert('规则名称不能重复')
                        const saved = put_custom_rule(draft)
                        analyze_config.current_sort = `custom:${saved.id}`
                    }
                    save_settings()
                    modal.remove()
                    refresh_custom_rule_ui()
                })
                render_sections()
            }

            function bind_sort_tab(tab) {
                tab.addEventListener('click', () => {
                    $page.querySelectorAll('.sort-tab[data-sort]').forEach(item => item.classList.remove('active'))
                    tab.classList.add('active')
                    if (analyze_config.current_sort !== tab.dataset.sort) expanded_result_sections.clear()
                    analyze_config.current_sort = tab.dataset.sort
                    save_settings()
                    refreshList()
                })
                if (tab.dataset.ruleId) {
                    tab.addEventListener('contextmenu', event => {
                        event.preventDefault()
                        document.querySelector('.custom-context-menu')?.remove()
                        const rule = custom_sort_document.rules[tab.dataset.ruleId]
                        if (!rule || rule.deletedAt) return
                        const menu = create_element(`<div class="custom-context-menu" style="left:${event.clientX}px;top:${event.clientY}px">
                            <button data-action="edit">编辑</button><button data-action="copy">复制</button><button data-action="delete">删除</button>
                        </div>`)
                        document.body.append(menu)
                        menu.addEventListener('click', menu_event => {
                            const action = menu_event.target.dataset.action
                            menu.remove()
                            if (action === 'edit') open_custom_sort_editor(rule)
                            if (action === 'copy') open_custom_sort_editor(rule, true)
                            if (action === 'delete' && confirm(`删除规则“${rule.name}”？`)) {
                                delete_custom_rule(rule.id)
                                refresh_custom_rule_ui()
                            }
                        })
                        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0)
                    })
                } else if (DEFAULT_PRESET_RULES[tab.dataset.sort]) {
                    tab.title = '左键应用，右键编辑、复制或恢复默认'
                    tab.addEventListener('contextmenu', event => {
                        event.preventDefault()
                        document.querySelector('.custom-context-menu')?.remove()
                        const sort_key = tab.dataset.sort
                        const menu = create_element(`<div class="custom-context-menu" style="left:${event.clientX}px;top:${event.clientY}px">
                            <button data-action="edit">编辑规则</button>
                            <button data-action="copy">复制为我的规则</button>
                            <button data-action="reset" ${preset_rule_overrides[sort_key] ? '' : 'disabled'}>恢复默认</button>
                        </div>`)
                        document.body.append(menu)
                        menu.addEventListener('click', menu_event => {
                            const action = menu_event.target.dataset.action
                            if (!action || menu_event.target.disabled) return
                            menu.remove()
                            const preset = { ...JSON.parse(JSON.stringify(get_effective_preset(sort_key))), sourcePreset: sort_key }
                            if (action === 'edit') open_custom_sort_editor(preset, false, sort_key)
                            if (action === 'copy') open_custom_sort_editor(preset, true)
                            if (action === 'reset') {
                                if (!confirm(`恢复“${DEFAULT_PRESET_RULES[sort_key].name}”的默认规则？`)) return
                                delete preset_rule_overrides[sort_key]
                                persist_preset_overrides()
                                refresh_custom_rule_ui()
                            }
                        })
                        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0)
                    })
                }
            }

            function refresh_custom_buttons_local() {
                const host = document.getElementById('custom-sort-buttons')
                if (!host) return
                if (analyze_config.current_sort.startsWith('custom:')) {
                    const current = custom_sort_document.rules[analyze_config.current_sort.slice(7)]
                    if (!current || current.deletedAt) {
                        analyze_config.current_sort = 'important'
                        save_settings()
                    }
                }
                host.innerHTML = render_custom_sort_buttons_html()
                host.querySelectorAll('.sort-tab[data-sort]').forEach(bind_sort_tab)
                $page.querySelectorAll('.sort-tab[data-sort]').forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.sort === analyze_config.current_sort)
                })
                refreshList()
            }

            window.__鉴定_refresh_custom_rules = refresh_custom_buttons_local
            window.__鉴定_refresh_current_list = refreshList

            updateDescription()

            // 切换排序 tab
            $page.querySelectorAll('.sort-tab[data-sort]').forEach(bind_sort_tab)
            document.getElementById('new-custom-sort').addEventListener('click', () => open_custom_sort_editor())

            // 切换本地缓存中的对方 / 批量载入好友
            const opponentButton = document.getElementById('opponent-select-btn')
            const opponentMenu = document.getElementById('opponent-menu')
            opponentButton.addEventListener('click', async event => {
                event.stopPropagation()
                const opening = opponentMenu.style.display === 'none'
                opponentMenu.style.display = opening ? 'block' : 'none'
                if (opening) await render_opponent_menu()
            })
            opponentMenu.addEventListener('click', async event => {
                event.stopPropagation()
                const action = event.target.closest('[data-opponent-action]')?.dataset.opponentAction
                const username = event.target.closest('[data-opponent-username]')?.dataset.opponentUsername
                const bulk_button = event.target.closest('[data-cache-bulk-action]')
                if (bulk_button) {
                    const cached_collection_users = await api_cache.getCachedCollectionUsernames()
                    const users = (await api_cache.getAllUsers()).filter(user => user.username !== self_username && cached_collection_users.has(user.username))
                    const stale_users = stale_cached_users(users)
                    if (!stale_users.length) return render_opponent_menu()
                    const progress = opponentMenu.querySelector('[data-cache-bulk-progress]')
                    opponentMenu.querySelectorAll('[data-cache-bulk-action]').forEach(button => { button.disabled = true })
                    if (bulk_button.dataset.cacheBulkAction === 'refresh') {
                        const subject_ids = [...new Set([...analyze_config.subject_ids, ...get_active_friend_rules().flatMap(rule => rule.subject_ids)])]
                        const { completed, failures } = await refresh_cached_users(stale_users, subject_ids, (done, total, user) => {
                            progress.textContent = `更新 ${done}/${total}：${user.nickname || user.username}`
                        })
                        await render_opponent_menu()
                        const summary = opponentMenu.querySelector('[data-cache-bulk-progress]')
                        if (summary) summary.textContent = `更新完成 ${completed - failures.length}/${completed}${failures.length ? `，失败：${failures.join('、')}` : ''}`
                    }
                    if (bulk_button.dataset.cacheBulkAction === 'clean') {
                        if (!confirm(`删除 ${stale_users.length} 名用户超过 7 天或时间未知的本地缓存？`)) {
                            opponentMenu.querySelectorAll('[data-cache-bulk-action]').forEach(button => { button.disabled = false })
                            return
                        }
                        const completed = await clear_cached_users(stale_users, (done, total, user) => {
                            progress.textContent = `清理 ${done}/${total}：${user.nickname || user.username}`
                        })
                        await render_opponent_menu()
                        const summary = opponentMenu.querySelector('[data-cache-bulk-progress]')
                        if (summary) summary.textContent = `已清理 ${completed} 名用户缓存`
                    }
                    return
                }
                const cache_button = event.target.closest('[data-cache-action]')
                if (cache_button) {
                    const cache_username = cache_button.dataset.cacheUsername
                    cache_button.disabled = true
                    if (cache_button.dataset.cacheAction === 'refresh') {
                        try {
                            const user = await load_manager_async.get_user(cache_username, true)
                            await load_manager_async.get_coll(user.username, true)
                            set_user_cache_time(user.username)
                            if (cache_username === cur_user2.username) {
                                cur_user2 = user
                                await inject_analyze_page(false)
                            } else if (cache_username === cur_user1.username) {
                                cur_user1 = user
                                comparison_username = user.username
                                await inject_analyze_page(false)
                            } else {
                                await render_opponent_menu()
                            }
                        } catch (error) {
                            alert(`刷新缓存失败：${error.message || error}`)
                            cache_button.disabled = false
                        }
                    }
                    if (cache_button.dataset.cacheAction === 'delete') {
                        await api_cache.deleteUserCache(cache_username)
                        delete_user_cache_time(cache_username)
                        delete recent_opponents[cache_username]
                        localStorage.setItem(RECENT_OPPONENTS_KEY, JSON.stringify(recent_opponents))
                        await render_opponent_menu()
                    }
                    return
                }
                if (action === 'friends') {
                    opponentMenu.style.display = 'none'
                    await open_friend_loader()
                }
                if (username && username !== cur_user1.username) {
                    opponentMenu.style.display = 'none'
                    opponentButton.disabled = true
                    try {
                        comparison_username = username
                        cur_user1 = await load_manager_async.get_user(username)
                        await inject_analyze_page(false)
                    } catch (error) {
                        alert(`切换对方失败：${error.message || error}`)
                        opponentButton.disabled = false
                    }
                }
            })
            opponentMenu.addEventListener('submit', async event => {
                if (event.target.id !== 'opponent-search-form') return
                event.preventDefault()
                event.stopPropagation()
                const input = event.target.querySelector('#opponent-search-input')
                const status = event.target.querySelector('#opponent-search-status')
                const submit = event.target.querySelector('button[type="submit"]')
                const username = input.value.trim().replace(/^@/, '')
                if (!isValidUsernameInput(username)) {
                    status.textContent = '请输入有效的 @用户名'
                    status.style.color = '#d33'
                    return
                }
                submit.disabled = true
                status.style.color = '#888'
                status.textContent = '正在读取用户资料和收藏…'
                try {
                    const user = await load_manager_async.get_user(username, true)
                    await load_manager_async.get_coll(user.username)
                    set_user_cache_time(user.username)
                    mark_opponent_viewed(user.username)
                    status.style.color = '#188038'
                    status.textContent = `已添加 ${user.nickname || user.username}`
                    await render_opponent_menu()
                } catch (error) {
                    submit.disabled = false
                    status.style.color = '#d33'
                    status.textContent = `添加失败：${error.message || error}`
                }
            })
            document.addEventListener('click', () => { opponentMenu.style.display = 'none' })

            // 手机端设置折叠与通用底部面板
            document.getElementById('mobile-settings-toggle').addEventListener('click', event => {
                mobile_settings_open = !mobile_settings_open
                document.getElementById('panel').classList.toggle('mobile-open', mobile_settings_open)
                event.currentTarget.setAttribute('aria-expanded', String(mobile_settings_open))
            })
            document.getElementById('mobile-sheet-close').addEventListener('click', close_mobile_sheet)
            document.getElementById('mobile-sheet-backdrop').addEventListener('click', event => {
                if (event.target === event.currentTarget) close_mobile_sheet()
            })
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape') close_mobile_sheet()
            })
            document.getElementById('mobile-sort-manage').addEventListener('click', () => {
                const sort_key = analyze_config.current_sort
                if (sort_key.startsWith('custom:')) {
                    const rule = custom_sort_document.rules[sort_key.slice('custom:'.length)]
                    if (!rule || rule.deletedAt) return
                    open_mobile_sheet(`管理规则：${rule.name}`, `
                        <div class="mobile-sheet-actions">
                            <button type="button" data-rule-action="edit">编辑</button>
                            <button type="button" data-rule-action="copy">复制</button>
                            <button type="button" data-rule-action="delete">删除</button>
                        </div>`, content => {
                        content.addEventListener('click', event => {
                            const action = event.target.dataset.ruleAction
                            if (!action) return
                            close_mobile_sheet()
                            if (action === 'edit') open_custom_sort_editor(rule)
                            if (action === 'copy') open_custom_sort_editor(rule, true)
                            if (action === 'delete' && confirm(`删除规则“${rule.name}”？`)) {
                                delete_custom_rule(rule.id)
                                refresh_custom_rule_ui()
                            }
                        })
                    })
                    return
                }
                const preset = get_effective_preset(sort_key)
                open_mobile_sheet(`规则操作：${preset.name}`, `
                    <div class="mobile-sheet-actions">
                        <button type="button" data-rule-action="edit">编辑规则</button>
                        <button type="button" data-rule-action="copy">复制为我的规则</button>
                        <button type="button" data-rule-action="reset" ${preset_rule_overrides[sort_key] ? '' : 'disabled'}>恢复默认</button>
                    </div>
                `, content => {
                    content.addEventListener('click', event => {
                        const action = event.target.dataset.ruleAction
                        if (!action || event.target.disabled) return
                        close_mobile_sheet()
                        const source = { ...JSON.parse(JSON.stringify(preset)), sourcePreset: sort_key }
                        if (action === 'edit') open_custom_sort_editor(source, false, sort_key)
                        if (action === 'copy') open_custom_sort_editor(source, true)
                        if (action === 'reset') {
                            if (!confirm(`恢复“${DEFAULT_PRESET_RULES[sort_key].name}”的默认规则？`)) return
                            delete preset_rule_overrides[sort_key]
                            persist_preset_overrides()
                            refresh_custom_rule_ui()
                        }
                    })
                })
            })

            // 隐藏分显示切换
            document.getElementById('score-display-toggle').addEventListener('click', event => {
                analyze_config.score_display = analyze_config.score_display === 'hidden' ? 'raw' : 'hidden'
                event.currentTarget.textContent = analyze_config.score_display === 'hidden' ? '显示：隐藏分' : '显示：原始分'
                save_settings()
                refreshList()
            })

            // 评分分布与好友评级工作台
            const hidden_score_container = document.getElementById('hidden-score-container')
            const hidden_score_overlay = document.getElementById('hidden-score-overlay')
            const hidden_chart_tooltip = document.getElementById('hidden-chart-tooltip')
            document.getElementById('score-distribution-toggle').addEventListener('click', event => {
                event.stopPropagation()
                if (is_touch_mode()) return open_mobile_sheet('隐藏分与评分分布', hidden_score_overlay.innerHTML)
                hidden_score_container.classList.toggle('is-open')
            })
            document.getElementById('friend-rating-toggle').addEventListener('click', event => {
                event.stopPropagation()
                hidden_score_container.classList.remove('is-open')
                open_friend_rating_workbench()
            })
            hidden_score_overlay.addEventListener('click', event => event.stopPropagation())
            document.addEventListener('click', () => {
                hidden_score_container.classList.remove('is-open')
            })
            hidden_score_overlay.querySelectorAll('.hidden-chart-point').forEach(point => {
                point.addEventListener('mouseenter', event => {
                    const rate = Number(event.currentTarget.dataset.rate)
                    const rect = hidden_score_overlay.getBoundingClientRect()
                    hidden_chart_tooltip.textContent = `${rate}分：我 ${result.my_all_rate_count_map[rate] || 0}，对方 ${result.his_all_rate_count_map[rate] || 0}`
                    hidden_chart_tooltip.style.left = `${Math.max(4, Math.min(event.clientX - rect.left + 8, rect.width - 150))}px`
                    hidden_chart_tooltip.style.top = `${event.clientY - rect.top - 4}px`
                    hidden_chart_tooltip.style.display = 'block'
                })
                point.addEventListener('mouseleave', () => { hidden_chart_tooltip.style.display = 'none' })
            })

            // 自定义规则云同步菜单
            update_cloud_status_ui()
            const cloud_status_button = document.getElementById('custom-cloud-status')
            const cloud_sync_menu = document.getElementById('cloud-sync-menu')
            cloud_status_button.addEventListener('click', event => {
                event.stopPropagation()
                cloud_sync_menu.style.display = cloud_sync_menu.style.display === 'block' ? 'none' : 'block'
            })

            function download_config(document_value, label) {
                const blob = new Blob([JSON.stringify(document_value, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const anchor = document.createElement('a')
                const now = new Date()
                const pad = number => String(number).padStart(2, '0')
                const exported_at = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
                anchor.href = url
                anchor.download = `(${self_username}) Shadow ${label} (${exported_at}).json`
                anchor.click()
                URL.revokeObjectURL(url)
            }

            function choose_config_file() {
                return new Promise(resolve => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'application/json'
                    input.addEventListener('change', async () => {
                        const file = input.files?.[0]
                        if (!file) return resolve(null)
                        try { resolve(JSON.parse(await file.text())) }
                        catch (error) { alert(`文件不是有效 JSON：${error.message || error}`); resolve(null) }
                    })
                    input.click()
                })
            }

            function export_important_document() {
                return {
                    schemaVersion: 3,
                    subjects: Object.fromEntries(Object.entries(important_subject_document.subjects).filter(([, entry]) => entry.marked)),
                }
            }

            function export_category_document() {
                return {
                    schemaVersion: 5,
                    rules: Object.fromEntries(Object.entries(custom_sort_document.rules).filter(([, rule]) => !rule.deletedAt)),
                    presetOverrides: Object.fromEntries(Object.entries(custom_sort_document.presetOverrides || {}).filter(([, rule]) => !rule.deletedAt)),
                }
            }

            function export_rating_document() {
                return JSON.parse(JSON.stringify(friend_rating_document))
            }

            function import_important_document(value) {
                const imported = parse_important_subject_document(value, true)
                let offset = 0
                for (const entry of Object.values(imported.subjects)) {
                    if (!entry.marked) continue
                    important_subject_document.subjects[entry.id] = {
                        id: entry.id, marked: true, updatedAt: Date.now() + offset++, deviceId: device_id,
                    }
                }
                rebuild_important_subject_ids()
                persist_important_subjects()
                schedule_important_subject_sync()
                refresh_important_subject_ui()
                refresh_friend_rating_ui()
            }

            function import_category_document(value) {
                const imported = parse_custom_sort_document(value, true)
                let offset = 0
                for (const [id, rule] of Object.entries(imported.rules)) {
                    custom_sort_document.rules[id] = { ...rule, id, updatedAt: Date.now() + offset++, deletedAt: null, deviceId: device_id }
                }
                for (const [key, rule] of Object.entries(imported.presetOverrides)) {
                    custom_sort_document.presetOverrides[key] = { ...rule, updatedAt: Date.now() + offset++, deletedAt: null, deviceId: device_id }
                }
                persist_custom_sort_document()
                apply_preset_overrides_from_document()
                schedule_custom_sort_sync()
                refresh_custom_rule_ui()
            }

            function import_rating_document(value) {
                const imported = parse_friend_rating_document(value, true)
                let offset = 0
                friend_rating_document = {
                    schemaVersion: 2,
                    defaultRule: { id: imported.defaultRule.id, updatedAt: Date.now() + FRIEND_RULE_IDS.length, deviceId: device_id },
                    matrixSettings: { ...imported.matrixSettings, updatedAt: Date.now() + FRIEND_RULE_IDS.length + 1, deviceId: device_id },
                    rules: Object.fromEntries(FRIEND_RULE_IDS.map(id => [id, {
                        ...imported.rules[id], updatedAt: Date.now() + offset++, deviceId: device_id,
                    }])),
                }
                persist_friend_rating_document()
                schedule_friend_rating_sync()
                refresh_friend_rating_ui()
            }

            async function reset_synced_configuration() {
                if (!confirm('重置重要番剧、分类规则、四栏评分规则和评级矩阵设置？本地与云端配置都会被覆盖，缓存、最近用户和档位画像会保留。')) return
                const now = Date.now()
                let cloud_custom = { schemaVersion: 5, rules: {}, presetOverrides: {} }
                let cloud_important = { schemaVersion: 3, subjects: {} }
                if (IS_BANGUMI_COMPONENT) {
                    cloud_custom = parse_custom_sort_document(chiiApp.cloud_settings.get(CUSTOM_SORTS_CLOUD_KEY), true)
                    cloud_important = parse_important_subject_document(chiiApp.cloud_settings.get(IMPORTANT_SUBJECTS_CLOUD_KEY), true)
                }
                const custom_union = { ...cloud_custom.rules, ...custom_sort_document.rules }
                const override_union = { ...cloud_custom.presetOverrides, ...custom_sort_document.presetOverrides }
                custom_sort_document = {
                    schemaVersion: 5,
                    rules: Object.fromEntries(Object.entries(custom_union).map(([id, rule]) => [id, { ...rule, updatedAt: now, deletedAt: now, deviceId: device_id }])),
                    presetOverrides: Object.fromEntries(Object.entries(override_union).map(([key, rule]) => [key, { ...rule, updatedAt: now, deletedAt: now, deviceId: device_id }])),
                }
                const important_union = { ...cloud_important.subjects, ...important_subject_document.subjects }
                important_subject_document = {
                    schemaVersion: 3,
                    subjects: Object.fromEntries(Object.entries(important_union).map(([id]) => [id, {
                        id: Number(id), marked: false, updatedAt: now, deviceId: device_id,
                    }])),
                }
                friend_rating_document = new_friend_rating_document()
                for (const id of FRIEND_RULE_IDS) friend_rating_document.rules[id] = { ...friend_rating_document.rules[id], updatedAt: now, deviceId: device_id }
                friend_rating_document.defaultRule = { id: FRIEND_RULE_IDS[0], updatedAt: now, deviceId: device_id }
                friend_rating_document.matrixSettings = { ...friend_rating_document.matrixSettings, updatedAt: now, deviceId: device_id }
                custom_sort_data_error = ''
                persist_custom_sort_document()
                apply_preset_overrides_from_document()
                persist_important_subjects()
                persist_friend_rating_document()
                rebuild_important_subject_ids()
                analyze_config.current_sort = 'important'
                save_settings()
                if (IS_BANGUMI_COMPONENT) {
                    set_cloud_sync_status('syncing')
                    chiiApp.cloud_settings.update({
                        [CUSTOM_SORTS_CLOUD_KEY]: JSON.stringify(custom_sort_document),
                        [IMPORTANT_SUBJECTS_CLOUD_KEY]: JSON.stringify(important_subject_document),
                        [FRIEND_RATING_CLOUD_KEY]: JSON.stringify(friend_rating_document),
                    })
                    await Promise.resolve(chiiApp.cloud_settings.save())
                    localStorage.removeItem(CUSTOM_SORTS_PENDING_KEY)
                    localStorage.removeItem(IMPORTANT_SUBJECTS_PENDING_KEY)
                    localStorage.removeItem(FRIEND_RATING_PENDING_KEY)
                    set_cloud_sync_status('synced')
                } else {
                    set_cloud_sync_status('local', '已重置当前浏览器中的本地配置')
                }
                refresh_custom_rule_ui()
                refresh_important_subject_ui()
                refresh_friend_rating_ui()
            }

            cloud_sync_menu.addEventListener('click', async event => {
                event.stopPropagation()
                const action = event.target.dataset.cloudAction
                if (!action) return
                cloud_sync_menu.style.display = 'none'
                if (action === 'export-important') return download_config(export_important_document(), '重要番剧')
                if (action === 'export-category') return download_config(export_category_document(), '分类规则')
                if (action === 'export-rating') return download_config(export_rating_document(), '评分规则')
                if (action === 'export-all') return download_config({
                    schemaVersion: 1,
                    importantSubjects: export_important_document(),
                    categoryRules: export_category_document(),
                    ratingRules: export_rating_document(),
                }, '全部配置')
                if (action === 'clear-local-cache') {
                    if (!confirm('清空当前域名下的用户资料、收藏和条目缓存？重要番剧、分类规则、好友评级规则及其他配置不会删除。清理完成后页面将刷新。')) return
                    try {
                        await api_cache.clearAllCache()
                        localStorage.removeItem(RECENT_OPPONENTS_KEY)
                        localStorage.removeItem(USER_CACHE_TIMES_KEY)
                        location.reload()
                    } catch (error) {
                        alert(`清空本地缓存失败：${error.message || error}`)
                    }
                    return
                }
                if (['import-important', 'import-category', 'import-rating', 'import-all'].includes(action)) {
                    const value = await choose_config_file()
                    if (!value) return
                    try {
                        if (action === 'import-important') import_important_document(value)
                        if (action === 'import-category') import_category_document(value)
                        if (action === 'import-rating') import_rating_document(value)
                        if (action === 'import-all') {
                            if (value.schemaVersion !== 1 || !value.importantSubjects || !value.categoryRules || !value.ratingRules) throw new Error('全部配置文件版本不兼容')
                            parse_important_subject_document(value.importantSubjects, true)
                            parse_custom_sort_document(value.categoryRules, true)
                            parse_friend_rating_document(value.ratingRules, true)
                            import_important_document(value.importantSubjects)
                            import_category_document(value.categoryRules)
                            import_rating_document(value.ratingRules)
                        }
                    } catch (error) {
                        alert(`导入失败：${error.message || error}`)
                    }
                    return
                }
                if (action === 'reset-cloud') {
                    try { await reset_synced_configuration() }
                    catch (error) {
                        set_cloud_sync_status('error', `重置失败：${error.message || error}`)
                        alert(`重置失败：${error.message || error}`)
                    }
                    return
                }
                if (action === 'sync') {
                    await sync_custom_sorts()
                    await sync_important_subjects()
                    await sync_friend_rating_rules()
                    await sync_threshold_profile()
                    return
                }
            })
            document.addEventListener('click', () => { cloud_sync_menu.style.display = 'none' })

            // ── 评分分段滑块 ──

            function autoBalanceThresholds(rateMap) {
                let total = 0
                for (let i = 1; i <= 10; i++) total += rateMap[i]
                if (total === 0) return { low: 4, high: 7 }
                let bestLow = 4, bestHigh = 7, bestDiff = Infinity
                for (let lo = 1; lo <= 8; lo++) {
                    for (let hi = lo + 1; hi <= 9; hi++) {
                        let low = 0, mid = 0, high = 0
                        for (let i = 1; i <= 10; i++) {
                            const c = rateMap[i]
                            if (i <= lo) low += c
                            else if (i <= hi) mid += c
                            else high += c
                        }
                        const diff = Math.max(low, mid, high) - Math.min(low, mid, high)
                        if (diff < bestDiff) {
                            bestDiff = diff
                            bestLow = lo
                            bestHigh = hi
                        }
                    }
                }
                return { low: bestLow, high: bestHigh }
            }

            function calcThresholdRatios(rateMap, low, high) {
                let low_count = 0, medium_count = 0, high_count = 0
                for (let score = 1; score <= 10; score++) {
                    const count = rateMap[score] || 0
                    if (score <= low) low_count += count
                    else if (score <= high) medium_count += count
                    else high_count += count
                }
                const total = low_count + medium_count + high_count
                return total > 0
                    ? { low: low_count / total, medium: medium_count / total, high: high_count / total }
                    : { low: 1 / 3, medium: 1 / 3, high: 1 / 3 }
            }

            function matchThresholdRatios(rateMap, target) {
                let best = autoBalanceThresholds(rateMap)
                let best_error = Infinity
                for (let low = 1; low <= 8; low++) {
                    for (let high = low + 1; high <= 9; high++) {
                        const ratios = calcThresholdRatios(rateMap, low, high)
                        const error = (ratios.low - target.low) ** 2 + (ratios.medium - target.medium) ** 2 + (ratios.high - target.high) ** 2
                        if (error < best_error) {
                            best_error = error
                            best = { low, high }
                        }
                    }
                }
                return best
            }

            function updateSliderTrack(container, lowVal, highVal) {
                const track = container.querySelector('.slider-track')
                const lowPercent = (lowVal / 10 * 100).toFixed(1)
                const highPercent = (highVal / 10 * 100).toFixed(1)
                track.innerHTML = ''
                track.style.background = `linear-gradient(to right, #04f 0%, #04f ${lowPercent}%, #fc0 ${lowPercent}%, #fc0 ${highPercent}%, #f40 ${highPercent}%, #f40 100%)`
            }

            function updatePercentBar(userType) {
                const barEl = document.querySelector(`.percent-bar[data-user="${userType}"]`)
                if (!barEl) return
                const rateMap = userType === 'my' ? result.my_rate_count_map : result.his_rate_count_map
                const lowT = analyze_config[userType + '_threshold_low']
                const highT = analyze_config[userType + '_threshold_high']
                let total = 0
                for (let i = 1; i <= 10; i++) total += rateMap[i]
                if (total === 0) { barEl.innerHTML = '<div style="width:100%;height:100%;background:#ccc;border-radius:3px;"></div>'; return }
                const lighten = { '#04f': 'rgba(60,130,255,0.5)', '#fc0': 'rgba(180,140,0,0.5)', '#f40': 'rgba(255,123,90,0.5)' }
                const getColor = (r) => r <= lowT ? '#04f' : r <= highT ? '#fc0' : '#f40'
                const boundary_scores = new Set([lowT, lowT + 1, highT, highT + 1].filter(score => score >= 1 && score <= 10))
                const active = []
                for (let i = 1; i <= 10; i++) if (rateMap[i] > 0) active.push({ score: i, count: rateMap[i], color: getColor(i) })
                let html = ''
                for (let j = 0; j < active.length; j++) {
                    const { count, color } = active[j]
                    const prev = j > 0 ? active[j - 1] : null
                    const next = j < active.length - 1 ? active[j + 1] : null
                    if (prev && prev.color !== color) {
                        html += `<div style="width:0;height:100%;border-left:2px solid #ff000000;flex-shrink:0;"></div>`
                    }
                    const rL = (!prev || prev.color !== color) ? '2px' : '0'
                    const rR = (!next || next.color !== color) ? '2px' : '0'
                    const borderR = (next && next.color === color) ? `border-right:2px solid ${lighten[color]};` : ''
                    const score_label = boundary_scores.has(active[j].score) ? `<span class="percent-score-label${color === '#fc0' ? ' __medium' : ''}">${active[j].score}</span>` : ''
                    html += `<div style="position:relative;flex:${count};background:${color};min-width:0;overflow:hidden;border-radius:${rL} ${rR} ${rR} ${rL};${borderR}">${score_label}</div>`
                }
                barEl.innerHTML = html
            }

            // 初始化滑块
            const automatic_my_balance = autoBalanceThresholds(result.my_rate_count_map)
            const target_ratios = threshold_profile?.ratios || calcThresholdRatios(result.my_rate_count_map, automatic_my_balance.low, automatic_my_balance.high)
            const myBalance = threshold_profile?.ratios
                ? matchThresholdRatios(result.my_rate_count_map, target_ratios)
                : automatic_my_balance
            const hisBalance = matchThresholdRatios(result.his_rate_count_map, target_ratios)
            analyze_config.my_threshold_low = myBalance.low
            analyze_config.my_threshold_high = myBalance.high
            analyze_config.his_threshold_low = hisBalance.low
            analyze_config.his_threshold_high = hisBalance.high

            // 同步滑块值和视觉
            document.querySelectorAll('.range-handle').forEach(input => {
                const user = input.dataset.user
                const isLow = input.classList.contains('range-low')
                input.value = isLow ? analyze_config[user + '_threshold_low'] : analyze_config[user + '_threshold_high']
            })
            document.querySelectorAll('.dual-range-container').forEach(container => {
                const user = container.dataset.user
                updateSliderTrack(container, analyze_config[user + '_threshold_low'], analyze_config[user + '_threshold_high'])
            })
            updatePercentBar('my')
            updatePercentBar('his')
            refreshList()

            // 滑块事件
            document.querySelectorAll('.range-handle').forEach(input => {
                input.addEventListener('input', () => {
                    const container = input.closest('.dual-range-container')
                    const user = input.dataset.user
                    const isLow = input.classList.contains('range-low')
                    const lowInput = container.querySelector('.range-low')
                    const highInput = container.querySelector('.range-high')
                    let lowVal = parseInt(lowInput.value)
                    let highVal = parseInt(highInput.value)
                    if (isLow && lowVal >= highVal) { lowVal = highVal - 1; lowInput.value = lowVal }
                    if (!isLow && highVal <= lowVal) { highVal = lowVal + 1; highInput.value = highVal }
                    analyze_config[user + '_threshold_low'] = lowVal
                    analyze_config[user + '_threshold_high'] = highVal
                    updateSliderTrack(container, lowVal, highVal)
                    updatePercentBar(user)
                    if (user === 'my') {
                        const ratios = calcThresholdRatios(result.my_rate_count_map, lowVal, highVal)
                        save_threshold_profile(ratios)
                        const matched_his = matchThresholdRatios(result.his_rate_count_map, ratios)
                        analyze_config.his_threshold_low = matched_his.low
                        analyze_config.his_threshold_high = matched_his.high
                        const his_container = document.querySelector('.dual-range-container[data-user="his"]')
                        his_container.querySelector('.range-low').value = matched_his.low
                        his_container.querySelector('.range-high').value = matched_his.high
                        updateSliderTrack(his_container, matched_his.low, matched_his.high)
                        updatePercentBar('his')
                    }
                    refreshList()
                })
            })

            // 条目类型多选菜单
            const subjectTypeBtn = document.getElementById('subject-type-btn')
            const subjectTypeMenu = document.getElementById('subject-type-menu')
            subjectTypeBtn.addEventListener('click', event => {
                event.stopPropagation()
                subjectTypeMenu.style.display = subjectTypeMenu.style.display === 'none' ? 'block' : 'none'
            })
            subjectTypeMenu.addEventListener('click', event => event.stopPropagation())
            subjectTypeMenu.addEventListener('change', event => {
                const checked = subjectTypeMenu.querySelectorAll('.subject-type-cb:checked')
                if (checked.length === 0) event.target.checked = true
            })
            async function apply_subject_type_selection() {
                subjectTypeMenu.style.display = 'none'
                const next_ids = SUBJECT_TYPE_IDS.filter(id => subjectTypeMenu.querySelector(`.subject-type-cb[data-type="${id}"]`).checked)
                const old_ids = analyze_config.subject_ids
                const changed = next_ids.length !== old_ids.length || next_ids.some(id => !old_ids.includes(id))
                if (!changed) return
                analyze_config.subject_ids = next_ids
                save_settings()
                await inject_analyze_page(false)
            }
            document.getElementById('subject-type-apply').addEventListener('click', apply_subject_type_selection)
            document.addEventListener('click', async () => {
                if (subjectTypeMenu.style.display === 'none') return
                await apply_subject_type_selection()
            })

            // 反馈链接
            document.getElementById('feedback-link').addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                window.open(FEEDBACK_URL, '_blank')
            })

        } catch (e) {
            $page.innerHTML = `<section class="鉴定_page" style="padding: 20px; color: red;">错误: ${escapeHtml(String(e))}</section>`
            throw e
        }
    }

    // ─── UI 标签页注入 ───

    {
        const $navTabs = document.querySelector('.navTabs')
        const $btn = create_element(`<li><a href="javascript:">${TITLE}</a></li>`)

        $btn.addEventListener('click', () => {
            for (const $focus of $navTabs.querySelectorAll('.focus')) {
                $focus.classList.remove('focus')
            }
            $btn.querySelector('a').classList.add('focus')
            inject_analyze_page()
        })

        $navTabs.append($btn)

        // shadow=1 固定进入官方组件；shadow_test=1 优先进入本地版，找不到时回退官方组件。
        const shadow_params = new URLSearchParams(window.location.search)
        if (shadow_params.get('shadow') === '1' && IS_BANGUMI_COMPONENT) {
            $btn.click()
        }
        if (shadow_params.get('shadow_test') === '1') {
            if (!IS_BANGUMI_COMPONENT) {
                $btn.click()
            } else {
                let attempts = 0
                const open_local_or_fallback = () => {
                    const local_tab = [...document.querySelectorAll('.navTabs a')]
                        .find(tab => tab.textContent.trim() === 'Shadow(L)')
                    if (local_tab) {
                        local_tab.click()
                        return
                    }
                    if (attempts++ < 10) {
                        setTimeout(open_local_or_fallback, 100)
                        return
                    }
                    $btn.click()
                }
                setTimeout(open_local_or_fallback, 0)
            }
        }
    }
})()
