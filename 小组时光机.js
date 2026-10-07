// ==UserScript==
// @name         小组时光机
// @namespace    bangumi-group-time-machine
// @version      0.3.1
// @description  按北京时间的发布日期浏览 1～7 天的小组话题，本地排序、过滤加入的小组与绝交用户
// @match        https://bgm.tv/group
// @match        https://bgm.tv/group?*
// @match        https://bgm.tv/group/
// @match        https://bgm.tv/group/?*
// @match        https://bangumi.tv/group
// @match        https://bangumi.tv/group?*
// @match        https://bangumi.tv/group/
// @match        https://bangumi.tv/group/?*
// @match        https://chii.in/group
// @match        https://chii.in/group?*
// @match        https://chii.in/group/
// @match        https://chii.in/group/?*
// @downloadURL  none
// @grant        none
// @run-at       document-end
// ==/UserScript==

;(function () {
    'use strict'

    if (!/^\/group\/?$/.test(location.pathname)) return
    const previous_view = window.bgm_date_browser?.snapshot?.()
    window.bgm_date_browser?.destroy()
    const heading = document.querySelector('#header h1')
    const table = document.querySelector('#columnA table.topic_list')
    if (!heading || !table) return

    // SearchEncore 提供日期索引；个人小组与绝交列表只在本机参与过滤。
    const API = 'https://bgmdb.ry.mk/v1/groups/-/topics/by-date'
    const USER_API = 'https://api.bgm.tv/v0/users/'
    const PROFILE_API = 'https://api.bgm.tv/user/'
    const FIRST_DATE = '2008-07-01'
    const DAY_MS = 86400000
    const CACHE_TTL = 5 * 60 * 1000
    const CACHE_KEY = 'bgm-date-browser:days:v1'
    const AVATAR_KEY = 'bgm-date-browser:avatars:v1'
    const VIEW_KEY = 'bgm-date-browser:view:v1'
    const HISTORY_KEY = 'bgmDateBrowser'
    const URL_KEYS = { date: 'bgm_date', days: 'bgm_days', sort: 'bgm_sort', scope: 'bgm_scope', mode: 'bgm_view' }
    const DEFAULT_AVATAR = 'https://lain.bgm.tv/pic/user/m/icon.jpg'
    const original_nodes = [...table.childNodes]
    const original_title = table.querySelector('h2')?.textContent
    const original_rows = [...table.querySelectorAll('tr')].slice(1)
    const header_row = table.querySelector('tr')?.cloneNode(true)
    const four_columns = header_row?.querySelectorAll('td').length === 4
    const disposers = []
    const day_cache = new Map(read_storage('sessionStorage', CACHE_KEY))
    const avatars = new Map(read_storage('localStorage', AVATAR_KEY))
    const known_avatars = new Map()
    for (const row of original_rows) {
        const image = row.querySelector('img.avatar')
        const id = image?.src.match(/\/user\/[a-z]\/\d+\/\d+\/\d+\/(\d+)/)?.[1]
        if (id) known_avatars.set(String(Number(id)), image.src)
    }
    const initial_view = entry_view(previous_view)
    const state = {
        date: initial_view.date, days: initial_view.days, items: null, controller: null, sequence: 0,
        timer: null, active: initial_view.mode === 'date', destroyed: false, joined: null, blocked: new Set(),
        filters_ready: false, filter_error: null, filter_sequence: 0, loaded_at: null, cached: false,
        filters_started: false, profile_queue: [], profile_tasks: new Map(), profile_active: 0, observers: null,
        pending_restore: initial_view, restore_frame: null, scroll_timer: null
    }

    function default_view() {
        return { date: beijing_date(Date.now()), days: 1, sort: 'reply', scope: 'joined', mode: 'recent',
            scroll_y: 0, anchor_id: null, anchor_top: 0 }
    }

    function normalize_view(value) {
        if (!value || typeof value !== 'object' || !valid_date(value.date)) return null
        return {
            date: value.date,
            days: Number.isInteger(Number(value.days)) && Number(value.days) >= 1 && Number(value.days) <= 7 ? Number(value.days) : 1,
            sort: ['reply', 'old', 'new', 'count'].includes(value.sort) ? value.sort : 'reply',
            scope: value.scope === 'all' ? 'all' : 'joined',
            mode: value.mode === 'recent' ? 'recent' : 'date',
            scroll_y: Number.isFinite(value.scroll_y) ? Math.max(0, value.scroll_y) : 0,
            anchor_id: Number.isInteger(value.anchor_id) && value.anchor_id > 0 ? value.anchor_id : null,
            anchor_top: Number.isFinite(value.anchor_top) ? value.anchor_top : 0
        }
    }

    function history_view() {
        try { return normalize_view(history.state?.[HISTORY_KEY]) } catch (_) { return null }
    }

    function saved_view() {
        try {
            const from_history = history_view()
            if (from_history) return from_history
            return normalize_view(JSON.parse(sessionStorage.getItem(VIEW_KEY)))
        } catch (_) { return null }
    }

    function entry_view(previous) {
        // 普通 /group 入口只复用选项，不继承其他历史项的展开状态和滚动位置。
        return location_view() || normalize_view(previous) || history_view() || {
            ...(saved_view() || default_view()), mode: 'recent', scroll_y: 0, anchor_id: null, anchor_top: 0
        }
    }

    function same_view(a, b) {
        return a && b && a.date === b.date && a.days === b.days && a.sort === b.sort && a.scope === b.scope && a.mode === b.mode
    }

    function location_view() {
        const params = new URL(location.href).searchParams
        if (!Object.values(URL_KEYS).some(key => params.has(key))) return null
        const value = normalize_view({
            date: params.get(URL_KEYS.date) || beijing_date(Date.now()),
            days: params.get(URL_KEYS.days),
            sort: params.get(URL_KEYS.sort), scope: params.get(URL_KEYS.scope), mode: params.get(URL_KEYS.mode)
        }) || default_view()
        const saved = saved_view()
        return same_view(value, saved) ? saved : value
    }

    function read_storage(storage_name, key) {
        try {
            const entries = JSON.parse(window[storage_name].getItem(key))
            return Array.isArray(entries) ? entries.filter(entry => Array.isArray(entry) &&
                entry.length === 2 && typeof entry[0] === 'string' && entry[1] && typeof entry[1] === 'object') : []
        } catch (_) { return [] }
    }

    function write_storage(storage_name, key, value) {
        try { window[storage_name].setItem(key, JSON.stringify(value)) } catch (_) { /* 缓存不可用时仍能浏览 */ }
    }

    function node(tag, class_name, text) {
        const el = document.createElement(tag)
        if (class_name) el.className = class_name
        if (text !== undefined) el.textContent = String(text)
        return el
    }

    function on(el, event, fn) {
        el.addEventListener(event, fn)
        disposers.push(() => el.removeEventListener(event, fn))
    }

    function beijing_date(ms) {
        return new Date(ms + 8 * 3600000).toISOString().slice(0, 10)
    }

    function date_ms(value) { return Date.parse(value + 'T00:00:00+08:00') }

    function valid_date(value) {
        const ms = date_ms(value)
        return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(ms) &&
            beijing_date(ms) === value && value >= FIRST_DATE && value <= beijing_date(Date.now())
    }

    function range_dates(date = state.date, days = state.days) {
        const dates = []
        for (let index = days - 1; index >= 0; index--) {
            const value = beijing_date(date_ms(date) - index * DAY_MS)
            if (value >= FIRST_DATE) dates.push(value)
        }
        return dates
    }

    function range_label() {
        const dates = range_dates()
        return dates.length === 1 ? state.date : `${dates[0]} ～ ${state.date}`
    }

    function time_text(seconds) {
        const value = Number(seconds)
        if (!Number.isFinite(value) || value <= 0) return '时间未知'
        return new Date(value * 1000 + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
    }

    async function request(url, signal, json = true) {
        const controller = new AbortController()
        const abort = () => controller.abort()
        if (signal?.aborted) controller.abort()
        signal?.addEventListener('abort', abort, { once: true })
        let timed_out = false
        const timeout = setTimeout(() => { timed_out = true; controller.abort() }, 15000)
        try {
            const same_origin = new URL(url, location.origin).origin === location.origin
            const response = await fetch(url, {
                signal: controller.signal, credentials: same_origin ? 'same-origin' : 'omit'
            })
            if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`)
            if (same_origin && new URL(response.url).pathname.startsWith('/login')) {
                throw new Error('登录已失效，请重新登录')
            }
            return await (json ? response.json() : response.text())
        } catch (error) {
            if (timed_out) throw new Error('请求超时，请重试')
            throw error
        } finally {
            clearTimeout(timeout)
            signal?.removeEventListener('abort', abort)
        }
    }

    function remember_avatar(user) {
        const url = user.avatar?.small
        if (!Number.isInteger(user.id) || !url) return
        try {
            const parsed = new URL(url, location.origin)
            if (parsed.protocol === 'http:' && /(^|\.)bgm\.tv$/.test(parsed.hostname)) parsed.protocol = 'https:'
            if (parsed.protocol !== 'https:' || !/(^|\.)bgm\.tv$/.test(parsed.hostname)) return
            avatars.delete(String(user.id))
            avatars.set(String(user.id), { url: parsed.href, at: Date.now() })
            while (avatars.size > 400) avatars.delete(avatars.keys().next().value)
            write_storage('localStorage', AVATAR_KEY, [...avatars])
        } catch (_) { /* 不接受异常头像地址 */ }
    }

    async function load_filters() {
        state.filters_started = true
        const filter_sequence = ++state.filter_sequence
        state.filters_ready = false
        state.filter_error = null
        const current_user = document.querySelector('#dock a[href*="/user/"]')
        const ignored = typeof data_ignore_users !== 'undefined' ? data_ignore_users : null
        try {
            if (current_user && !Array.isArray(ignored)) throw new Error('无法读取绝交列表，已暂停显示')
            const identifiers = [...new Set((ignored || []).map(String))]
            const blocked = new Set()
            // 站点列表可能是用户名；接口话题给的是数字 ID，不能用昵称作匹配。
            for (const name of identifiers) {
                if (/^\d+$/.test(name)) blocked.add(String(Number(name)))
                else {
                    const user = await request(USER_API + encodeURIComponent(name))
                    if (!Number.isInteger(user.id)) throw new Error('绝交用户 ID 解析失败，已暂停显示')
                    blocked.add(String(user.id))
                }
            }
            let joined = null
            if (current_user) {
                const html = await request('/group/mine', undefined, false)
                const doc = new DOMParser().parseFromString(html, 'text/html')
                const list = doc.querySelector('#memberGroupList')
                if (!list) throw new Error('无法读取加入的小组，请检查登录状态')
                const slugs = new Set()
                const ids = new Set()
                for (const link of list.querySelectorAll('a[href^="/group/"]')) {
                    const slug = link.getAttribute('href').match(/^\/group\/([^/?#]+)/)?.[1]
                    if (slug) slugs.add(decodeURIComponent(slug))
                    const id = link.querySelector('img')?.getAttribute('src')?.match(/\/icon\/[a-z]\/\d+\/\d+\/\d+\/(\d+)\./)?.[1]
                    if (Number(id) > 0) ids.add(String(Number(id)))
                }
                joined = { slugs, ids }
            }
            if (state.destroyed || filter_sequence !== state.filter_sequence) return
            state.blocked = blocked
            state.joined = joined
            if (!current_user) {
                scope.value = 'all'
                scope.querySelector('option[value="joined"]').disabled = true
            }
            state.filters_ready = true
        } catch (error) {
            if (!state.destroyed && filter_sequence === state.filter_sequence) state.filter_error = error.message
        }
    }

    const style = node('style')
    style.id = 'bgm-date-style'
    style.textContent = `
        .bgm-date-header { display:flex; align-items:center; flex-wrap:wrap; gap:12px 18px; }
        #bgm-date-toggle { font-size:12px; font-weight:normal; }
        #bgm-date-controls { display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:12px; }
        #bgm-date-controls[hidden], #bgm-date-status[hidden] { display:none !important; }
        #bgm-date-controls button, #bgm-date-controls input, #bgm-date-controls select {
            box-sizing:border-box; height:28px; padding:2px 7px; border:1px solid var(--bgm-date-border,#ddd);
            border-radius:4px; background:var(--bgm-date-bg,#fff); color:inherit; font:inherit;
        }
        #bgm-date-controls button { cursor:pointer; }
        #bgm-date-controls button:hover { color:#f09199; border-color:#f09199; }
        #bgm-date-controls button:disabled { cursor:default; opacity:.4; }
        #bgm-date-controls input { width:135px; color-scheme:light; }
        #bgm-date-controls input:focus-visible, #bgm-date-controls button:focus-visible,
        #bgm-date-controls select:focus-visible { outline:2px solid #f09199; outline-offset:2px; }
        #bgm-date-status { margin:0 0 10px; font-size:12px; line-height:1.6; }
        #bgm-date-status[data-error="true"] { color:#c35656; }
        .bgm-date-empty { padding:28px 8px !important; text-align:center; }
        .bgm-date-row td { vertical-align:top; }
        .bgm-date-avatar { object-fit:cover; }
        .bgm-date-row .bgm-date-group { overflow-wrap:anywhere; }
        html[data-theme="dark"] #bgm-date-controls {
            --bgm-date-bg:#292929; --bgm-date-border:#555; color:#ccc;
        }
        html[data-theme="dark"] #bgm-date-controls input { color-scheme:dark; }
        @media(max-width:700px) {
            #bgm-date-controls { gap:5px; width:100%; }
            .bgm-date-row .bgm-date-meta { width:32%; }
        }
    `
    document.head.append(style)
    const toggle = node('a', 'l', '展开时光机')
    toggle.id = 'bgm-date-toggle'
    toggle.href = '#'
    toggle.setAttribute('aria-controls', 'bgm-date-controls')
    const toolbar = node('div')
    toolbar.id = 'bgm-date-controls'
    toolbar.setAttribute('aria-label', '小组话题日期过滤')
    const prev = node('button', '', '‹')
    prev.title = '前一天'
    prev.setAttribute('aria-label', '前一天')
    const input = node('input')
    input.type = 'date'
    input.min = FIRST_DATE
    input.max = beijing_date(Date.now())
    input.value = state.date
    input.setAttribute('aria-label', '话题发布日期')
    const next = node('button', '', '›')
    next.title = '后一天'
    next.setAttribute('aria-label', '后一天')
    const random = node('button', '', '随机日期')
    random.title = `${FIRST_DATE} 至今天之间等概率随机；部分日期可能没有收录的话题`
    const days = node('select')
    days.setAttribute('aria-label', '话题天数')
    days.title = '包含所选日期，向前合计 1～7 天'
    for (let value = 1; value <= 7; value++) {
        const option = node('option', '', `${value} 天`)
        option.value = value
        days.append(option)
    }
    days.value = String(state.days)
    const sort = node('select')
    sort.setAttribute('aria-label', '排序方式')
    for (const [value, label] of [['reply', '最后回复'], ['old', '最早发布'], ['new', '最晚发布'], ['count', '回复数']]) {
        const option = node('option', '', label)
        option.value = value
        sort.append(option)
    }
    sort.value = initial_view.sort
    const scope = node('select')
    scope.setAttribute('aria-label', '小组范围')
    for (const [value, label] of [['joined', '我加入的小组'], ['all', '全部小组']]) {
        const option = node('option', '', label)
        option.value = value
        scope.append(option)
    }
    scope.value = initial_view.scope
    const refresh = node('button', '', '刷新')
    refresh.title = '重新获取所选日期范围的话题和个人过滤列表'
    const recent = node('button', '', '近期话题')
    recent.title = '恢复页面原来的近期话题列表'
    toolbar.append(prev, input, next, random, days, sort, scope, refresh, recent)
    const heading_parent = heading.parentElement
    heading_parent.classList.add('bgm-date-header')
    heading.after(toggle, toolbar)
    const status = node('div', 'grey')
    status.id = 'bgm-date-status'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    table.before(status)

    function snapshot() {
        const view = { date: state.date, days: state.days, sort: sort.value, scope: scope.value, mode: state.active ? 'date' : 'recent' }
        if (same_view(view, state.pending_restore)) return { ...state.pending_restore }
        const row = [...table.querySelectorAll('tr')].find(item => {
            const rect = item.getBoundingClientRect()
            return rect.bottom > 0 && rect.top < innerHeight && item.querySelector('a[href*="/group/topic/"]')
        })
        const topic = row?.querySelector('a[href*="/group/topic/"]')?.getAttribute('href')?.match(/\/group\/topic\/(\d+)/)
        return { ...view, scroll_y: scrollY, anchor_id: topic ? Number(topic[1]) : null,
            anchor_top: row?.getBoundingClientRect().top || 0 }
    }

    function persist_view() {
        if (state.destroyed) return
        const view = snapshot()
        try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)) } catch (_) { /* URL 仍可恢复日期和选项 */ }
        try {
            const url = new URL(location.href)
            for (const [field, key] of Object.entries(URL_KEYS)) {
                if (state.active) url.searchParams.set(key, view[field])
                else url.searchParams.delete(key)
            }
            // 只更新当前历史项；进入话题后返回仍指向这一页，不堆积每一天的历史。
            const existing = history.state
            const next_state = existing === null || (typeof existing === 'object' && !Array.isArray(existing)) ?
                { ...existing, [HISTORY_KEY]: view } : existing
            history.replaceState(next_state, '', url)
        } catch (_) { /* 浏览器禁止修改历史时使用标签页存储 */ }
    }

    function cancel_restore() {
        if (state.restore_frame !== null) cancelAnimationFrame(state.restore_frame)
        state.restore_frame = null
        state.pending_restore = null
    }

    function restore_scroll() {
        const view = state.pending_restore
        if (!view) return
        if (state.restore_frame !== null) cancelAnimationFrame(state.restore_frame)
        // 等异步话题列表完成排版，再恢复位置；不依赖加载前高度不足的空列表。
        state.restore_frame = requestAnimationFrame(() => {
            state.restore_frame = requestAnimationFrame(() => {
                state.restore_frame = null
                if (state.destroyed || state.pending_restore !== view) return
                const link = view.anchor_id ? table.querySelector(`a[href$="/group/topic/${view.anchor_id}"]`) : null
                const row = link?.closest('tr')
                const top = view.scroll_y === 0 ? 0 : row ? scrollY + row.getBoundingClientRect().top - view.anchor_top : view.scroll_y
                scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' })
                state.pending_restore = null
                persist_view()
            })
        })
    }

    function set_status(text, error = false) {
        status.textContent = text
        status.dataset.error = String(error)
    }

    function update_visibility() {
        toolbar.hidden = !state.active
        status.hidden = !state.active
        toggle.textContent = state.active ? '收起时光机' : '展开时光机'
        toggle.setAttribute('aria-expanded', String(state.active))
    }

    function update_arrows() {
        input.max = beijing_date(Date.now())
        prev.disabled = state.date <= FIRST_DATE
        next.disabled = state.date >= beijing_date(Date.now())
    }

    function blank_table(message) {
        state.observers?.disconnect()
        const body = node('tbody')
        if (header_row) body.append(header_row.cloneNode(true))
        const title = body.querySelector('h2')
        if (title) title.textContent = `${range_label()} 发布的话题`
        const row = node('tr')
        const cell = node('td', 'grey bgm-date-empty', message)
        cell.colSpan = four_columns ? 4 : 2
        row.append(cell)
        body.append(row)
        table.replaceChildren(body)
    }

    async function get_day(date, signal, force, progress) {
        const cached = day_cache.get(date)
        if (!force && cached && Date.now() - cached.at < CACHE_TTL && Array.isArray(cached.items)) {
            return { ...cached, cached: true }
        }
        const topics = new Map()
        let offset = 0
        for (;;) {
            if (offset > 5000) throw new Error('当天话题超出接口分页上限，无法保证完整排序')
            const response = await request(`${API}?date=${date}&limit=50&offset=${offset}`, signal)
            if (signal.aborted) throw new DOMException('已取消', 'AbortError')
            if (!Array.isArray(response.data) || !response.pagination) throw new Error('日期接口返回格式异常')
            for (const topic of response.data) {
                if (!Number.isInteger(topic.id) || !Number.isFinite(topic.createdAt)) {
                    throw new Error('日期接口话题字段异常')
                }
                if (beijing_date(topic.createdAt * 1000) !== date) throw new Error('日期接口返回了其他日期的话题')
                topics.set(topic.id, topic)
            }
            offset += response.data.length
            progress(topics.size)
            const total = Number(response.pagination.total)
            if (response.data.length < 50 ||
                (response.pagination.totalIsEstimate === false && Number.isFinite(total) && offset >= total)) break
        }
        const result = { items: [...topics.values()], at: Date.now() }
        day_cache.delete(date)
        day_cache.set(date, result)
        while (day_cache.size > 20) day_cache.delete(day_cache.keys().next().value)
        write_storage('sessionStorage', CACHE_KEY, [...day_cache])
        return { ...result, cached: false }
    }

    async function get_range(date, count, signal, force) {
        const dates = range_dates(date, count)
        const topics = new Map()
        let cached = true
        let at = Infinity
        // 逐日读取并复用每天的缓存；左右移动时通常只需补齐新进入范围的一天。
        for (const [index, value] of dates.entries()) {
            if (signal.aborted) throw new DOMException('已取消', 'AbortError')
            const progress = size => set_status(`${range_label()} · 正在读取 ${value}（${index + 1}/${dates.length} 天） · 已读取 ${size} 条…`)
            progress(0)
            const result = await get_day(value, signal, force, progress)
            if (signal.aborted) throw new DOMException('已取消', 'AbortError')
            for (const topic of result.items) topics.set(topic.id, topic)
            cached = cached && result.cached
            at = Math.min(at, result.at)
        }
        return { items: [...topics.values()], cached, at }
    }

    function cached_avatar(id) {
        const known = known_avatars.get(String(id))
        if (known) return known
        const cached = avatars.get(String(id))
        return cached && Date.now() - cached.at < 7 * DAY_MS ? cached.url : null
    }

    function profile_avatar(id) {
        const cached = cached_avatar(id)
        if (cached) return Promise.resolve(cached)
        if (state.profile_tasks.has(id)) return state.profile_tasks.get(id)
        const promise = new Promise(resolve => { state.profile_queue.push({ id, resolve }) })
        state.profile_tasks.set(id, promise)
        pump_avatars()
        return promise
    }

    function pump_avatars() {
        while (!state.destroyed && state.profile_active < 3 && state.profile_queue.length) {
            const job = state.profile_queue.shift()
            state.profile_active++
            // v0/users 仅接受用户名；旧版公开接口也能解析已改名用户的数字 ID。
            request(PROFILE_API + encodeURIComponent(job.id)).then(user => {
                remember_avatar(user)
                job.resolve(cached_avatar(job.id))
            }).catch(() => job.resolve(null)).finally(() => {
                state.profile_active--
                pump_avatars()
            })
        }
    }

    function discard_avatar_queue() {
        state.profile_queue.splice(0).forEach(job => {
            state.profile_tasks.delete(job.id)
            job.resolve(null)
        })
    }

    function render() {
        if (!state.active || state.destroyed || state.items === null) return
        if (!state.filters_ready) {
            blank_table('个人过滤列表暂不可用，请点击刷新重试。')
            set_status(state.filter_error || '正在读取个人过滤列表…', !!state.filter_error)
            return
        }
        state.observers?.disconnect()
        const body = node('tbody')
        if (header_row) body.append(header_row.cloneNode(true))
        const title = body.querySelector('h2')
        if (title) title.textContent = `${range_label()} 发布的话题`
        let blocked_count = 0
        let unknown_count = 0
        const items = state.items.filter(topic => {
            if (state.blocked.size && !Number.isInteger(topic.creatorID)) { unknown_count++; return false }
            if (state.blocked.has(String(topic.creatorID))) { blocked_count++; return false }
            return scope.value !== 'joined' || (state.joined &&
                (state.joined.ids.has(String(topic.groupID)) || state.joined.slugs.has(topic.groupName)))
        })
        const reply_time = item => Number(item.lastPostAt) || item.createdAt
        items.sort((a, b) => {
            const order = sort.value === 'old' ? a.createdAt - b.createdAt :
                sort.value === 'new' ? b.createdAt - a.createdAt :
                    sort.value === 'count' ? b.replyCount - a.replyCount || reply_time(b) - reply_time(a) :
                        reply_time(b) - reply_time(a)
            return order || (sort.value === 'old' ? a.id - b.id : b.id - a.id)
        })
        for (const [index, topic] of items.entries()) {
            const row = node('tr', 'bgm-date-row')
            row.dataset.topicId = topic.id
            row.dataset.itemUser = String(topic.creatorID || '')
            const cell = node('td', index % 2 === 0 ? 'odd' : '')
            const link = node('a', 'l avatar')
            link.href = `/group/topic/${topic.id}`
            link.title = `发布：${time_text(topic.createdAt)}；最后回复：${time_text(reply_time(topic))}`
            const image = node('img', 'avatar avatarNeue ll bgm-date-avatar')
            image.width = 32
            image.loading = 'lazy'
            image.alt = ''
            image.title = topic.creatorName || '作者未知'
            image.src = cached_avatar(topic.creatorID) || DEFAULT_AVATAR
            if (Number.isInteger(topic.creatorID)) image.dataset.creatorId = topic.creatorID
            link.append(image, document.createTextNode(' ' + topic.title))
            cell.append(link, document.createTextNode(' '), node('small', 'grey', `(+${topic.replyCount})`))
            const author = node('small', 'sub_title', '作者:')
            const author_link = node(topic.creatorID ? 'a' : 'span', '', topic.creatorName || '作者未知')
            if (topic.creatorID) author_link.href = `/user/${topic.creatorID}`
            author.append(author_link)
            if (!four_columns) cell.append(node('br'), author)
            const meta = node('td', `${index % 2 === 0 ? 'odd ' : ''}bgm-date-meta`)
            meta.align = 'right'
            meta.width = '38%'
            const group = node(topic.groupName ? 'a' : 'span', 'bgm-date-group', topic.groupTitle || topic.groupName || `小组 ${topic.groupID}`)
            if (topic.groupName) group.href = '/group/' + encodeURIComponent(topic.groupName)
            const time = node('small', 'grey', time_text(reply_time(topic)))
            time.title = '最后回复时间（无回复时为发布时间）'
            if (four_columns) {
                const group_cell = node('td', cell.className)
                const author_cell = node('td', cell.className)
                group_cell.append(group)
                author_cell.append(author_link)
                meta.removeAttribute('width')
                meta.append(time)
                row.append(cell, group_cell, author_cell, meta)
            } else {
                meta.append(group, node('br'), time)
                row.append(cell, meta)
            }
            body.append(row)
        }
        table.replaceChildren(body)
        if (!items.length) {
            blank_table(state.items.length ? '所选日期范围内没有符合当前过滤条件的话题，可切换到全部小组。' : '接口未收录所选日期范围内的话题，可换个日期看看。')
        }
        set_status(`${range_label()} · 显示 ${items.length} / 收录 ${state.items.length} 条` +
            (blocked_count ? ` · 已排除 ${blocked_count} 条绝交用户话题` : '') +
            (unknown_count ? ` · ${unknown_count} 条作者缺失，暂不显示` : '') +
            ` · ${state.cached ? '缓存' : '获取'}于 ${time_text(state.loaded_at / 1000)}（北京时间）`)
        if (typeof IntersectionObserver !== 'undefined') {
            state.observers = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue
                    const image = entry.target
                    state.observers.unobserve(image)
                    profile_avatar(Number(image.dataset.creatorId)).then(url => {
                        if (url && image.isConnected && !state.destroyed) image.src = url
                    })
                }
            })
            for (const image of table.querySelectorAll('img[data-creator-id]')) state.observers.observe(image)
        }
        persist_view()
        restore_scroll()
    }

    async function load_date(date, force = false) {
        if (!valid_date(date)) return
        if (state.pending_restore && (state.pending_restore.date !== date || state.pending_restore.days !== state.days || state.pending_restore.mode !== 'date')) cancel_restore()
        state.controller?.abort()
        const sequence = ++state.sequence
        state.controller = new AbortController()
        const signal = state.controller.signal
        state.active = true
        update_visibility()
        state.date = date
        input.value = date
        state.items = null
        discard_avatar_queue()
        update_arrows()
        blank_table('正在读取所选日期范围内发布的话题…')
        table.setAttribute('aria-busy', 'true')
        set_status(`${range_label()} · 正在读取…`)
        persist_view()
        try {
            if (force || !state.filters_started) filters_promise = load_filters()
            const [result] = await Promise.all([get_range(date, state.days, signal, force), filters_promise])
            if (sequence !== state.sequence || state.destroyed) return
            state.items = result.items
            state.loaded_at = result.at
            state.cached = result.cached
            render()
        } catch (error) {
            if (sequence !== state.sequence || state.destroyed || signal.aborted) return
            blank_table('暂时无法获取话题，请点击刷新重试。')
            set_status(error.message === 'Failed to fetch' ? '连接失败，请检查网络后重试' : error.message, true)
        } finally {
            if (sequence === state.sequence) table.removeAttribute('aria-busy')
        }
    }

    function choose(date) {
        if (!valid_date(date)) {
            set_status('请选择有效日期（2008-07-01 至今天）', true)
            return
        }
        clearTimeout(state.timer)
        cancel_restore()
        state.controller?.abort()
        state.sequence++
        state.date = date
        state.active = true
        update_visibility()
        state.items = null
        discard_avatar_queue()
        input.value = date
        update_arrows()
        blank_table('正在读取所选日期范围内发布的话题…')
        table.setAttribute('aria-busy', 'true')
        persist_view()
        state.timer = setTimeout(() => load_date(date), 150)
    }

    function show_recent() {
        clearTimeout(state.timer)
        state.controller?.abort()
        state.sequence++
        state.active = false
        update_visibility()
        discard_avatar_queue()
        state.observers?.disconnect()
        table.removeAttribute('aria-busy')
        table.replaceChildren(...original_nodes)
        update_arrows()
        set_status('')
        persist_view()
        restore_scroll()
    }

    function restore_location() {
        const view = entry_view()
        const current = { date: state.date, days: state.days, sort: sort.value, scope: scope.value, mode: state.active ? 'date' : 'recent' }
        // bfcache 返回也可能触发 popstate；同一视图沿用现有 DOM，避免重复读取。
        if (same_view(view, current)) {
            cancel_restore()
            state.pending_restore = view
            if (!state.active || state.items !== null) restore_scroll()
            return
        }
        cancel_restore()
        state.pending_restore = view
        state.date = view.date
        state.days = view.days
        days.value = String(view.days)
        input.value = view.date
        sort.value = view.sort
        scope.value = view.scope
        if (view.mode === 'recent') show_recent()
        else load_date(view.date)
    }

    on(input, 'change', () => choose(input.value))
    on(toggle, 'click', event => {
        event.preventDefault()
        cancel_restore()
        if (state.active) show_recent()
        else load_date(state.date)
    })
    on(days, 'change', () => { state.days = Number(days.value); choose(state.date) })
    on(prev, 'click', () => choose(beijing_date(date_ms(state.date) - DAY_MS)))
    on(next, 'click', () => choose(beijing_date(date_ms(state.date) + DAY_MS)))
    on(random, 'click', () => {
        const days = Math.floor((date_ms(beijing_date(Date.now())) - date_ms(FIRST_DATE)) / DAY_MS) + 1
        choose(beijing_date(date_ms(FIRST_DATE) + Math.floor(Math.random() * days) * DAY_MS))
    })
    on(sort, 'change', () => { cancel_restore(); persist_view(); render() })
    on(scope, 'change', () => { cancel_restore(); persist_view(); render() })
    on(refresh, 'click', () => { clearTimeout(state.timer); load_date(state.date, true) })
    on(recent, 'click', () => {
        cancel_restore()
        show_recent()
    })
    on(table, 'pointerdown', persist_view)
    on(table, 'click', persist_view)
    on(window, 'scroll', () => {
        clearTimeout(state.scroll_timer)
        state.scroll_timer = setTimeout(persist_view, 200)
    })
    on(window, 'pagehide', persist_view)
    on(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') persist_view() })
    on(window, 'popstate', restore_location)
    on(window, 'pageshow', event => {
        if (!event.persisted) return
        if (state.active && (state.items === null || table.hasAttribute('aria-busy'))) load_date(state.date, true)
        else persist_view()
    })
    let filters_promise = Promise.resolve()
    window.bgm_date_browser = {
        load_date, snapshot,
        destroy() {
            state.destroyed = true
            state.sequence++
            clearTimeout(state.timer)
            clearTimeout(state.scroll_timer)
            cancel_restore()
            state.controller?.abort()
            state.observers?.disconnect()
            discard_avatar_queue()
            disposers.forEach(dispose => dispose())
            table.replaceChildren(...original_nodes)
            table.removeAttribute('aria-busy')
            if (original_title && table.querySelector('h2')) table.querySelector('h2').textContent = original_title
            toolbar.remove()
            toggle.remove()
            status.remove()
            style.remove()
            heading_parent.classList.remove('bgm-date-header')
            delete window.bgm_date_browser
        }
    }
    if (state.active) load_date(state.date)
    else show_recent()
})()
