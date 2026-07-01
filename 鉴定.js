// ==UserScript==
// @name         鉴定
// @homepage     https://bangumi.tv/dev/app/5446
// @author       https://bangumi.tv/user/air_chika
// @match        *://bgm.tv/user/*
// @match        *://bangumi.tv/user/*
// @match        *://chii.in/user/*
// ==/UserScript==
(function () {

    const TITLE = false ? '影之智慧' : '影实测试'
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
        display_count: 10,
        show_comments: false,
        score_display: 'raw',
        current_sort: 'common_love',
        my_filter_types: [1, 2, 3, 4, 5],
        his_filter_types: [1, 2, 3, 4, 5],
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
    const FIXED_SORT_KEYS = new Set([
        'important', 'common_love', 'common_hate', 'diff_high', 'common_new',
        'his_public_diff', 'his_comment', 'his_love',
    ])
    const CUSTOM_FACTOR_IDS = new Set([
        'my_rating', 'his_rating', 'agreement', 'my_conformity', 'his_conformity',
        'public_reputation', 'popularity', 'freshness', 'my_recency', 'his_recency',
        'my_comment', 'his_comment',
    ])
    const CUSTOM_SCOPE_IDS = new Set(['all', 'common_collection', 'common_rated', 'his_collection', 'his_rated'])
    const CUSTOM_SET_MODE_IDS = new Set(['any', 'collected', 'uncollected', 'rated'])
    const CUSTOM_RANGE_IDS = new Set(['public_score', 'collection_total', 'rank', 'subject_date_ts', 'my_comment_chars', 'his_comment_chars'])

    function is_valid_set_mode(user, mode) {
        return CUSTOM_SET_MODE_IDS.has(mode) || (user === 'my' && mode === 'important')
    }

    function load_important_subjects() {
        try {
            const value = JSON.parse(localStorage.getItem(IMPORTANT_SUBJECTS_KEY))
            return new Set(Array.isArray(value) ? value.map(Number).filter(id => Number.isInteger(id) && id > 0) : [])
        } catch (error) {
            return new Set()
        }
    }

    const important_subject_ids = load_important_subjects()

    function persist_important_subjects() {
        localStorage.setItem(IMPORTANT_SUBJECTS_KEY, JSON.stringify([...important_subject_ids].sort((a, b) => a - b)))
    }

    function load_settings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
            if (saved) {
                if (typeof saved.display_count === 'number') analyze_config.display_count = saved.display_count
                if (typeof saved.show_comments === 'boolean') analyze_config.show_comments = saved.show_comments
                if (saved.score_display === 'raw' || saved.score_display === 'hidden') analyze_config.score_display = saved.score_display
                if (Array.isArray(saved.subject_ids)) analyze_config.subject_ids = normalize_subject_ids(saved.subject_ids)
                else if (typeof saved.cur_subject_id === 'number') analyze_config.subject_ids = normalize_subject_ids(saved.cur_subject_id)
                if (typeof saved.current_sort === 'string') analyze_config.current_sort = saved.current_sort
                const legacy_types = Array.isArray(saved.filter_types) ? saved.filter_types : null
                if (Array.isArray(saved.my_filter_types)) analyze_config.my_filter_types = saved.my_filter_types
                else if (legacy_types) analyze_config.my_filter_types = [...legacy_types]
                if (Array.isArray(saved.his_filter_types)) analyze_config.his_filter_types = saved.his_filter_types
                else if (legacy_types) analyze_config.his_filter_types = [...legacy_types]
            }
        } catch (e) { /* ignore */ }
    }

    function save_settings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            display_count: analyze_config.display_count,
            show_comments: analyze_config.show_comments,
            score_display: analyze_config.score_display,
            subject_ids: analyze_config.subject_ids,
            current_sort: analyze_config.current_sort,
            my_filter_types: analyze_config.my_filter_types,
            his_filter_types: analyze_config.his_filter_types,
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
    let custom_sort_document = { schemaVersion: 2, rules: {} }
    let cloud_sync_status = 'local'
    let cloud_sync_error = ''
    let cloud_sync_timer = null

    function parse_custom_sort_document(raw, strict = false) {
        if (raw == null || raw === '') return { schemaVersion: 2, rules: {} }
        let value = raw
        try {
            if (typeof value === 'string') value = JSON.parse(value)
        } catch (error) {
            if (strict) throw new Error('云端自定义规则不是有效 JSON')
            return { schemaVersion: 2, rules: {} }
        }
        if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
            return { schemaVersion: 2, rules: {} }
        }
        if (!value || value.schemaVersion !== 2 || !value.rules || typeof value.rules !== 'object' || Array.isArray(value.rules)) {
            if (strict) throw new Error('云端自定义规则版本不兼容')
            return { schemaVersion: 2, rules: {} }
        }
        const rules = {}
        for (const [id, rule] of Object.entries(value.rules)) {
            const valid_factors = Array.isArray(rule?.factors) && rule.factors.every(factor =>
                factor && CUSTOM_FACTOR_IDS.has(factor.id) &&
                (factor.direction === 'positive' || factor.direction === 'negative') &&
                [1, 2, 3].includes(Number(factor.weight))
            ) && new Set(rule.factors.map(factor => factor.id)).size === rule.factors.length
            const filters = rule?.filters || {}
            const valid_tiers = user => !filters[`${user}_tiers`] ||
                (Array.isArray(filters[`${user}_tiers`]) && filters[`${user}_tiers`].every(tier => ['unrated', 'low', 'medium', 'high'].includes(tier)))
            const valid_comments = ['my', 'his'].every(user => !filters[`${user}_comment`] || ['any', 'has', 'empty'].includes(filters[`${user}_comment`]))
            const valid_ranges = !filters.ranges || (filters.ranges && typeof filters.ranges === 'object' && !Array.isArray(filters.ranges) &&
                Object.entries(filters.ranges).every(([field, bounds]) => CUSTOM_RANGE_IDS.has(field) && bounds && typeof bounds === 'object'))
            const valid_sets = rule?.sets && ['my', 'his'].every(user => is_valid_set_mode(user, rule.sets[user]))
            const valid_legacy_scope = CUSTOM_SCOPE_IDS.has(rule?.scope)
            const valid = /^[A-Za-z0-9_-]{1,80}$/.test(id) &&
                rule && typeof rule === 'object' && rule.id === id &&
                typeof rule.name === 'string' && rule.name.trim() && rule.name.length <= 30 &&
                (valid_sets || valid_legacy_scope) && valid_factors && valid_tiers('my') && valid_tiers('his') && valid_comments && valid_ranges
            if (!valid) {
                if (strict) throw new Error(`云端包含无效规则：${id}`)
                continue
            }
            rules[id] = rule
        }
        return { schemaVersion: 2, rules }
    }

    function load_local_custom_sorts() {
        custom_sort_document = parse_custom_sort_document(localStorage.getItem(CUSTOM_SORTS_LOCAL_KEY))
        const active_id = analyze_config.current_sort.startsWith('custom:')
            ? analyze_config.current_sort.slice('custom:'.length)
            : null
        if (!FIXED_SORT_KEYS.has(analyze_config.current_sort) && (!active_id || !custom_sort_document.rules[active_id] || custom_sort_document.rules[active_id].deletedAt)) {
            analyze_config.current_sort = 'common_love'
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

    function merge_custom_sort_documents(local_doc, cloud_doc) {
        const rules = { ...local_doc.rules }
        for (const [id, cloud_rule] of Object.entries(cloud_doc.rules)) {
            const local_rule = rules[id]
            if (!local_rule || compare_rule_version(cloud_rule, local_rule) > 0) rules[id] = cloud_rule
        }
        return { schemaVersion: 2, rules }
    }

    function get_active_custom_rules() {
        return Object.values(custom_sort_document.rules)
            .filter(rule => !rule.deletedAt)
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'))
    }

    function update_cloud_status_ui() {
        const button = document.getElementById('custom-cloud-status')
        if (!button) return
        const labels = {
            local: '☁ 本地', pending: '☁ 待同步', syncing: '☁ 同步中',
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
        if (typeof window.chiiApp?.cloud_settings === 'undefined') {
            set_cloud_sync_status('local', 'Bangumi 云设置不可用，当前使用本地规则')
            return false
        }
        set_cloud_sync_status('syncing')
        try {
            const cloud_raw = chiiApp.cloud_settings.get(CUSTOM_SORTS_CLOUD_KEY)
            const cloud_doc = parse_custom_sort_document(cloud_raw, true)
            const merged = merge_custom_sort_documents(custom_sort_document, cloud_doc)
            const merged_json = JSON.stringify(merged)
            custom_sort_document = merged
            persist_custom_sort_document()
            if (JSON.stringify(cloud_doc) !== merged_json) {
                chiiApp.cloud_settings.update({ [CUSTOM_SORTS_CLOUD_KEY]: merged_json })
                await Promise.resolve(chiiApp.cloud_settings.save())
            }
            localStorage.removeItem(CUSTOM_SORTS_PENDING_KEY)
            set_cloud_sync_status('synced')
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
            analyze_config.current_sort = 'common_love'
            save_settings()
        }
        schedule_custom_sort_sync()
    }

    function refresh_custom_rule_ui() {
        if (typeof window.__鉴定_refresh_custom_rules === 'function') window.__鉴定_refresh_custom_rules()
    }

    load_local_custom_sorts()
    if (localStorage.getItem(CUSTOM_SORTS_PENDING_KEY)) set_cloud_sync_status('pending')
    sync_custom_sorts()

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

            function transCollKey(user_id, subject_type) {
                return subject_type > 0
                    ? `https://api.bgm.tv/v0/users/${user_id}/collections?subject_type=${subject_type}`
                    : `https://api.bgm.tv/v0/users/${user_id}/collections`
            }

            function transUserKey(username) {
                return `https://api.bgm.tv/v0/users/${username}`
            }

            return { create, get, set, deleteByKey, transCollKey, transUserKey }
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

        async function get_coll(username, force = false) {
            const subject_ids = normalize_subject_ids(analyze_config.subject_ids)
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
                return collections_by_type.flat()
            } catch (e) {
                throw `自动获取${username}的${get_subject_selection_label()}缓存失败: ${e.message}`
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

        return { get_coll, get_user }
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

    // ─── 表情等级系统 ───

    const emoMap = {
        freeze:     { lv: 0,  descript: '霜之哀伤',         html: `<img src="/img/smiles/tv_500/bgm_518.gif" class="smile" smileid="518" alt="(bgm518)">` },
        killed:     { lv: 1,  descript: '幻想杀手',         html: `<img src="/img/smiles/tv/89.gif" smileid="128" class="smile" alt="(bgm112)">` },
        ques:       { lv: 2,  descript: '',               html: `<img src="/img/smiles/tv_500/bgm_502.png" class="smile" smileid="502" alt="(bgm502)">` },
        silence:    { lv: 3,  descript: '一方通行',         html: `<img src="/img/smiles/tv_500/bgm_524.png" class="smile" smileid="524" alt="(bgm524)">` },
        nosense:    { lv: 4,  descript: 'A.T.Field 100%',   html: `<img src="/img/smiles/tv/60.gif" smileid="99" class="smile" alt="(bgm83)">` },
        mildnosense:{ lv: 5,  descript: '= =',            html: `<img src="/img/smiles/tv/49.gif" smileid="88" class="smile" alt="(bgm72)">` },
        mildgood:   { lv: 6,  descript: '无口',           html: `<img src="/img/smiles/tv/44.gif" smileid="83" class="smile" alt="(bgm67)">` },
        mildnice:   { lv: 7,  descript: '玩乐关系',         code: '(bmoCAIASgCWAiwE)' },
        good:       { lv: 8,  descript: '愉悦',           html: `<img src="/img/smiles/tv/83.gif" smileid="122" class="smile" alt="(bgm106)">` },
        nice:       { lv: 9,  descript: 'KIRA★KIRA',      code: '(bmoCAIAsgIgB)' },
        best:       { lv: 10, descript: '',               code: '(bmoCAIASgF6AiwE)' },
        ultra:      { lv: 11, descript: '君は薔薇より美しい', code: '(bmoCAIAKgCyAiwE)' },
        starrose:   { lv: 12, descript: '',               code: '(bmoCAIAsgDs)' },
        loverose:   { lv: 13, descript: '心之壁瓦解',       html: `<img src="/img/smiles/tv_500/bgm_503.png" class="smile" smileid="503" alt="(bgm503)">` },
        blindrose:  { lv: 14, descript: '',               code: '(bmoCAIAggDs)' },
        blindheart: { lv: 15, descript: '',               html: `<img src="/img/smiles/tv_vs/bgm_201.png" class="smile" smileid="201" alt="(bgm201)">` },
        gquuuuuux:  { lv: 16, descript: '',               code: '(bmoCAIAggEGARA)' },
    }

    const levelEmos = Object.values(emoMap).filter(e => e.descript || e.html || e.code)
        .reduce((arr, e) => { arr[e.lv] = e; return arr }, new Array(17))

    function getEmoHtml(emo) {
        if (emo.html) return emo.html
        return `<span class="bmo" data-code="${emo.code}"></span>`
    }

    async function renderBmoji() {
        if (!window.bmoji) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script')
                s.src = `/js/lib/bmo/bmo.js?${window.CHOBITS_VER || ''}`
                s.onload = resolve
                s.onerror = reject
                document.head.appendChild(s)
            })
        }
        document.querySelectorAll('[data-code]').forEach(el => {
            if (!el.querySelector('img')) {
                window.bmoji.render(el, { width: 21, height: 21 })
            }
        })
    }

    // ─── 核心分析引擎 ───

    const analyze = (() => {

        /**
         * 获取条目的公众分数（基于排名，0-10）
         * @param {Object} subject
         * @returns {number}
         */
        function get_public_score(subject) {
            return subject.score || 0
        }

        /**
         * 计算共同收藏的交集及各项指标（使用原始分数）
         * @param {Collection[]} col1
         * @param {Collection[]} col2
         * @returns {Object[]}
         */
        function calc_intersections(col1, col2) {
            const map2 = new Map(col2.map(o => [o.subject_id, o]))
            const intersections = []

            for (const c1 of col1) {
                const c2 = map2.get(c1.subject_id)
                if (!c2 || c1.rate === 0 || c2.rate === 0) continue

                const pub = get_public_score(c1.subject)
                intersections.push({
                    subject: c1.subject,
                    my_review: {
                        rate: c1.rate,
                        comment: c1.comment,
                        date: new Date(c1.updated_at),
                        type: c1.type,
                    },
                    his_review: {
                        rate: c2.rate,
                        comment: c2.comment,
                        date: new Date(c2.updated_at),
                        type: c2.type,
                    },
                    diff: Math.abs(c1.rate - c2.rate),
                    user_diff: Math.abs(c1.rate - c2.rate),
                    public_diff: (Math.abs(c1.rate - pub) + Math.abs(c2.rate - pub)) / 2,
                })
            }

            return intersections
        }

        // ── 相似度计算 ──

        function calc_cosine_raw(vec_a, vec_b) {
            let dot = 0, sum_a = 0, sum_b = 0
            for (let i = 0; i < vec_a.length; i++) {
                dot += vec_a[i] * vec_b[i]
                sum_a += vec_a[i] * vec_a[i]
                sum_b += vec_b[i] * vec_b[i]
            }
            const denom = Math.sqrt(sum_a * sum_b)
            return denom === 0 ? 0 : dot / denom
        }

        function calc_public_simi(collections) {
            const rated = collections.filter(c => c.rate > 0)
            const count = rated.length
            if (count === 0) return { cosine_norm: 0, confidence: 0, count: 0, variance: 0 }

            const variance = rated.reduce((s, c) => s + (c.rate - (c.subject.score || 0)) ** 2, 0) / count

            // 皮尔逊余弦：user 侧用 std_frac_map，pub 侧用公评排名百分位
            const rate_map = calc_rate_count_map(collections)
            const std_map = calc_std_frac_map(rate_map)
            const pub_frac_map = calc_pub_frac_map(rated)
            const pub_vec = rated.map(c => pub_frac_map[c.subject.score || 0] ?? 0)
            const user_std_vec = rated.map(c => std_map[c.rate] || 0)
            const cosine_norm = calc_cosine_raw(user_std_vec, pub_vec)

            return {
                cosine_norm,
                confidence: count / (count + 50),
                count,
                variance,
            }
        }

        function calc_rating_simi(intersections, my_std_frac_map, his_std_frac_map) {
            const count = intersections.length
            if (count === 0) return { cosine_norm: 0, confidence: 0, count: 0, variance: 0 }

            const variance = intersections.reduce((s, a) => s + (a.my_review.rate - a.his_review.rate) ** 2, 0) / count

            // 皮尔逊余弦
            const my_std = intersections.map(a => my_std_frac_map[a.my_review.rate] || 0)
            const his_std = intersections.map(a => his_std_frac_map[a.his_review.rate] || 0)
            const cosine_norm = calc_cosine_raw(my_std, his_std)

            return {
                cosine_norm,
                confidence: count / (count + 30),
                count,
                variance,
            }
        }

        function calc_friend_level(result) {
            const { rating_simi, my_public_simi, his_public_simi } = result

            const count = rating_simi.count
            if (count === 0) return {
                level: 0,
                score: 0,
                components: { base: 0, penalty: 0, confidence: 0, raw_score: 0 },
            }

            const base = rating_simi.cosine_norm
            const confidence = rating_simi.confidence

            const my_pub = Math.max(0, my_public_simi.cosine_norm)
            const his_pub = Math.max(0, his_public_simi.cosine_norm)
            const penalty = my_pub * his_pub

            const raw_score = base * (1 - 0.2 * penalty)
            const final_score = Math.max(0, Math.min(1, raw_score * (0.5 + 0.5 * confidence)))
            const level = Math.round(final_score * 16)

            return {
                level,
                score: Math.round(final_score * 100),
                components: { base, penalty, confidence, raw_score },
            }
        }

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
            const all_subject_ids = new Set([...my_collection_map.keys(), ...his_collection_map.keys()])
            const comparison_items = [...all_subject_ids].map(subject_id => {
                const my_collection = my_collection_map.get(subject_id)
                const his_collection = his_collection_map.get(subject_id)
                const subject = my_collection?.subject || his_collection?.subject || {}
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

            // 按收藏类型过滤
            const my_active_types = new Set(analyze_config.my_filter_types)
            const his_active_types = new Set(analyze_config.his_filter_types)
            const my_filtered = my_collections.filter(c => my_active_types.has(c.type))
            const his_filtered = his_collections.filter(c => his_active_types.has(c.type))

            const my_rate_count_map = calc_rate_count_map(my_filtered)
            const his_rate_count_map = calc_rate_count_map(his_filtered)
            const intersections = calc_intersections(my_filtered, his_filtered)
            const his_filtered_subject_ids = new Set(his_filtered.map(c => c.subject_id))
            const common_collection_count = my_filtered.filter(c => his_filtered_subject_ids.has(c.subject_id)).length

            // ── 相似度计算 ──
            const my_std_frac_map = calc_std_frac_map(my_rate_count_map)
            const his_std_frac_map = calc_std_frac_map(his_rate_count_map)
            const my_public_simi = calc_public_simi(my_collections)
            const his_public_simi = calc_public_simi(his_collections)
            const rating_simi = calc_rating_simi(intersections, my_std_frac_map, his_std_frac_map)

            const friend_level = calc_friend_level({ rating_simi, my_public_simi, his_public_simi })

            return {
                my_rate_count_map,
                his_rate_count_map,
                my_public_simi,
                his_public_simi,
                rating_simi,
                friend_level,
                comparison_items,
                my_hidden_map: Object.fromEntries(Object.entries(my_hidden_map).map(([rate, value]) => [rate, Math.round((value + 0.5) * 100)])),
                his_hidden_map: Object.fromEntries(Object.entries(his_hidden_map).map(([rate, value]) => [rate, Math.round((value + 0.5) * 100)])),
                my_all_rate_count_map,
                his_all_rate_count_map,
                common_collection_count,
                common_rating_count: intersections.length,
                my_coll_count: my_collections.filter(c => c.type === 2).length,
                his_coll_count: his_collections.filter(c => c.type === 2).length,
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
    let cur_user1, cur_user2
    let mobile_settings_open = false

    // ─── 注入分析页面 ───

    async function inject_analyze_page(force = false) {
        const $page = document.querySelector('.columns')
        $page.classList.add('鉴定_host')

        if (!cur_user1 || !cur_user2) {
            visited_username = document.querySelector('#headerProfile .name small').textContent.slice(1)
            self_username = CHOBITS_USERNAME
        }
        if (force || !cur_user1 || !cur_user2) {
            cur_user1 = await load_manager_async.get_user(visited_username, force)
            cur_user2 = await load_manager_async.get_user(self_username, force)
        }

        const my_id = cur_user2.username
        const his_id = cur_user1.username
        const my_avatar = cur_user2.avatar.medium
        const his_avatar = cur_user1.avatar.medium

        try {
            $page.innerHTML = `<section class="鉴定_page" style="padding: 20px;">加载中...</section>`

            const result = await analyze.run(my_id, his_id, force)

            const SET_MODE_DEFS = {
                any: '不限制',
                collected: '已收藏',
                uncollected: '未收藏（并集内）',
                rated: '已评分',
                important: '重要番剧',
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
                my_recency: { group: '时间', label: '我的收藏进度', positive: '最近收藏', negative: '更早收藏', relative: true },
                his_recency: { group: '时间', label: '对方收藏进度', positive: '最近收藏', negative: '更早收藏', relative: true },
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
                if (rule?.sets && is_valid_set_mode('my', rule.sets.my) && is_valid_set_mode('his', rule.sets.his)) {
                    return rule.sets
                }
                return LEGACY_SCOPE_SETS[rule?.scope] || LEGACY_SCOPE_SETS.common_rated
            }

            function set_mode_matches(item, user, mode) {
                const review = item[`${user}_review`]
                if (mode === 'important') return important_subject_ids.has(Number(item.subject.id))
                if (mode === 'collected') return !!review
                if (mode === 'uncollected') return !review
                if (mode === 'rated') return review?.rate > 0
                return true
            }

            function sets_match(item, sets) {
                return set_mode_matches(item, 'my', sets.my) && set_mode_matches(item, 'his', sets.his)
            }

            function temporary_status_matches(item, sets) {
                const matches = (review, selected, mode) => {
                    if (mode === 'uncollected' || selected.length === 0 || selected.length === 5) return true
                    if (!review) return mode === 'any' || mode === 'important'
                    return selected.includes(review.type)
                }
                return matches(item.my_review, analyze_config.my_filter_types, sets.my) &&
                    matches(item.his_review, analyze_config.his_filter_types, sets.his)
            }

            function get_range_value(item, field) {
                if (field === 'my_comment_chars') return item.my_review?.comment_chars
                if (field === 'his_comment_chars') return item.his_review?.comment_chars
                return item[field]
            }

            function saved_filter_matches(item, filters = {}) {
                const tier_match = (user, selected) => !selected?.length || selected.includes(get_tier(user, item[`${user}_review`]))
                if (!tier_match('my', filters.my_tiers) || !tier_match('his', filters.his_tiers)) return false
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

            function factor_source_value(item, factor_id) {
                if (factor_id === 'my_rating') return item.my_review?.hidden
                if (factor_id === 'his_rating') return item.his_review?.hidden
                if (factor_id === 'agreement') return item.hidden_gap == null ? null : 100 - item.hidden_gap
                if (factor_id === 'my_conformity') return item.my_review?.hidden == null || item.my_public_percentile == null ? null : 100 - Math.abs(item.my_review.hidden - item.my_public_percentile)
                if (factor_id === 'his_conformity') return item.his_review?.hidden == null || item.his_public_percentile == null ? null : 100 - Math.abs(item.his_review.hidden - item.his_public_percentile)
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
                const value = factor_source_value(item, factor_id)
                if (value != null) return value
                if (rule?.missingScoreAsZero === true && ['my_rating', 'his_rating', 'agreement'].includes(factor_id)) return 0
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

            function evaluate_rule(rule) {
                const factors = (rule?.factors || []).filter(factor => FACTOR_DEFS[factor.id])
                const sets = get_rule_sets(rule)
                const scoped = result.comparison_items.filter(item => sets_match(item, sets))
                const filtered = scoped.filter(item => saved_filter_matches(item, rule?.filters) && temporary_status_matches(item, sets))
                const eligible = filtered.filter(item => factors.every(factor => factor_value_for_rule(item, factor.id, rule) != null))
                if (factors.length === 0) {
                    const items = [...eligible].sort((a, b) =>
                        (b.his_review?.date?.getTime?.() || 0) - (a.his_review?.date?.getTime?.() || 0) ||
                        Number(a.subject.id || 0) - Number(b.subject.id || 0)
                    )
                    return { items, scopedCount: scoped.length, filteredCount: filtered.length, excludedCount: 0 }
                }
                const percentile_maps = Object.fromEntries(
                    factors.filter(factor => FACTOR_DEFS[factor.id].relative)
                        .map(factor => [factor.id, percentile_map(eligible, factor.id, rule)])
                )
                const items = eligible.map(item => {
                    let weighted_sum = 0
                    let weight_sum = 0
                    const factor_scores = factors.map(factor => {
                        const raw = FACTOR_DEFS[factor.id].relative
                            ? percentile_maps[factor.id].get(item)
                            : factor_value_for_rule(item, factor.id, rule)
                        const preferred = factor.direction === 'negative' ? 100 - raw : raw
                        const weight = Number(factor.weight) || 1
                        weighted_sum += preferred * weight
                        weight_sum += weight
                        return { id: factor.id, raw, preferred, weight, contribution: preferred * weight }
                    })
                    return { ...item, _custom_score: weighted_sum / weight_sum, _factor_scores: factor_scores }
                }).sort((a, b) => b._custom_score - a._custom_score || Number(a.subject.id || 0) - Number(b.subject.id || 0))
                return { items, scopedCount: scoped.length, filteredCount: filtered.length, excludedCount: filtered.length - eligible.length }
            }

            const PRESET_RULES = {
                important: { name: '重要番剧', sets: { my: 'important', his: 'any' }, filters: {}, missingScoreAsZero: true, factors: [{ id: 'my_rating', direction: 'positive', weight: 2 }, { id: 'his_rating', direction: 'positive', weight: 2 }, { id: 'agreement', direction: 'positive', weight: 1 }] },
                common_love: { name: '共同喜欢', sets: { my: 'rated', his: 'rated' }, filters: { my_tiers: ['medium', 'high'], his_tiers: ['medium', 'high'] }, factors: [{ id: 'my_rating', direction: 'positive', weight: 2 }, { id: 'his_rating', direction: 'positive', weight: 2 }, { id: 'agreement', direction: 'positive', weight: 1 }] },
                common_hate: { name: '共同低分', sets: { my: 'rated', his: 'rated' }, filters: { my_tiers: ['low'], his_tiers: ['low'] }, factors: [{ id: 'my_rating', direction: 'negative', weight: 2 }, { id: 'his_rating', direction: 'negative', weight: 2 }, { id: 'agreement', direction: 'positive', weight: 1 }] },
                diff_high: { name: '分歧最大', sets: { my: 'rated', his: 'rated' }, filters: {}, factors: [{ id: 'agreement', direction: 'negative', weight: 3 }] },
                common_new: { name: '共同追新', sets: { my: 'collected', his: 'collected' }, filters: {}, factors: [{ id: 'freshness', direction: 'positive', weight: 3 }, { id: 'my_recency', direction: 'positive', weight: 1 }, { id: 'his_recency', direction: 'positive', weight: 1 }] },
                his_public_diff: { name: '对方独特', sets: { my: 'any', his: 'rated' }, filters: {}, factors: [{ id: 'his_conformity', direction: 'negative', weight: 3 }, { id: 'his_rating', direction: 'positive', weight: 1 }] },
                his_comment: { name: '对方吐槽', sets: { my: 'any', his: 'collected' }, filters: { his_comment: 'has' }, factors: [{ id: 'his_comment', direction: 'positive', weight: 3 }] },
                his_love: { name: '对方高分', sets: { my: 'any', his: 'rated' }, filters: { his_tiers: ['medium', 'high'] }, factors: [{ id: 'his_rating', direction: 'positive', weight: 3 }] },
            }

            function get_rule_for_sort(sort_key) {
                if (sort_key.startsWith('custom:')) {
                    const rule = custom_sort_document.rules[sort_key.slice('custom:'.length)]
                    return rule && !rule.deletedAt ? rule : PRESET_RULES.common_love
                }
                return PRESET_RULES[sort_key] || PRESET_RULES.common_love
            }

            function getFilteredList(sort_key) {
                return evaluate_rule(get_rule_for_sort(sort_key)).items
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

            // 分布图工厂
            function create_distribution_chart(rate_count_map) {
                let bars = ''
                for (let i = 10; i > 0; i--) {
                    const count = rate_count_map[i] || 0
                    const cls = i >= 8 ? '__high' : i >= 5 ? '__medium' : '__low'
                    bars += `<div class="${cls}"></div>`
                }
                return function (rate) {
                    return `<div class="_distribution_chart __v${rate}"><div>${bars}</div><b>${rate}</b></div>`
                }
            }

            const my_dist_chart = create_distribution_chart(result.my_rate_count_map)
            const his_dist_chart = create_distribution_chart(result.his_rate_count_map)

            function get_compact_score_level(user, rate) {
                if (!Number.isFinite(rate) || rate <= 0) return 'neutral'
                const low = analyze_config[user + '_threshold_low']
                const high = analyze_config[user + '_threshold_high']
                return rate <= low ? 'low' : rate <= high ? 'medium' : 'high'
            }

            function get_compact_status_class(review) {
                if (review?.type === 3) return '__watching'
                if (review?.type === 4) return '__on_hold'
                if (review?.type === 5) return '__dropped'
                return ''
            }

            function get_public_rank_level(subject) {
                const rank = Number(subject.rank)
                if (rank <= 0 || public_rank_good_max == null) return 'neutral'
                if (rank <= public_rank_good_max) return 'high'
                if (rank <= public_rank_medium_max) return 'medium'
                return 'low'
            }

            // 渲染条目卡片（复用 Your Angle 的 _review 格式）
            function render_review_card(review) {
                const public_score = Number(review.subject.score || 0)
                return `
                <div class="_review">
                    <aside>
                        <a href="/subject/${review.subject.id}" target="_blank">
                            <img src="${review.subject.images?.grid || ''}" loading="lazy"/>
                        </a>
                        <h3>${review.subject.date || ''}</h3>
                        <div class="_collection_total" style="background-color: rgb(255 0 0 / ${(
                            (review.subject.collection_total || 0) / 500
                        ).toFixed(2)}%)">${(review.subject.collection_total || 0).toLocaleString()}</div>
                    </aside>
                    <section>
                        <h3>${escapeHtml(review.subject.name_cn || '')}</h3>
                        <h3>${escapeHtml(review.subject.name || '')}</h3>

                        <div>
                            ${review.his_review ? his_dist_chart(review.his_review.rate) : ''}
                            <div class="_rank_chart">
                                <div>
                                    <div style="flex:${(10 - public_score).toFixed(1)}"></div>
                                    <div class="_rank_marker" style="background-color:${public_score >= 8 ? '#f40' : public_score >= 5 ? '#fc0' : '#04f'}"></div>
                                    <div style="flex:${public_score.toFixed(1)}"></div>
                                </div>
                                <b>${public_score || '-'}</b>
                            </div>
                            ${review.my_review ? my_dist_chart(review.my_review.rate) : ''}
                        </div>
                        ${review.his_review ? `
                        <article class="_comment">
                            <img src="${his_avatar}" />
                            <section>
                                <h3>${review.his_review.date.toLocaleDateString()}${review.his_review.type != 2 ? ` （${collTypeMap[review.his_review.type] || ''}）` : ''}</h3>
                                ${analyze_config.show_comments ? `<div>${escapeHtml(review.his_review.comment ?? '')}</div>` : ''}
                            </section>
                        </article>
                        ` : ''}
                        ${review.my_review ? `
                        <article class="_comment">
                            <img src="${my_avatar}" />
                            <section>
                                <h3>${review.my_review.date.toLocaleDateString()}${review.my_review.type != 2 ? ` （${collTypeMap[review.my_review.type] || ''}）` : ''}</h3>
                                ${analyze_config.show_comments ? `<div>${escapeHtml(review.my_review.comment ?? '')}</div>` : ''}
                            </section>
                        </article>
                        ` : ''}
                    </section>
                </div>`
            }

            // 简略图渲染（封面 + 对方吐槽字数 + 悬停提示）
            function render_compact_card(review) {
                const my_rate = review.my_review ? review.my_review.rate : null
                const his_rate = review.his_review ? review.his_review.rate : null
                const my_hidden = review.my_review?.hidden ?? null
                const his_hidden = review.his_review?.hidden ?? null
                const my_display_score = analyze_config.score_display === 'hidden' ? my_hidden : my_rate
                const his_display_score = analyze_config.score_display === 'hidden' ? his_hidden : his_rate
                const pub = review.subject.score
                const his_comment = review.his_review?.comment ? escapeHtml(review.his_review.comment) : '无'
                const his_comment_chars = review.his_review?.comment_chars ?? count_text_chars(review.his_review?.comment)
                const name = escapeHtml(getSubjectDisplayName(review.subject))
                const total = review.subject.collection_total || 0
                const my_type = review.my_review?.type
                const his_type = review.his_review?.type
                const my_status = my_type && my_type !== 2 ? `（${collTypeMap[String(my_type)]}）` : ''
                const his_status = his_type && his_type !== 2 ? `（${collTypeMap[String(his_type)]}）` : ''
                const score_line = my_rate != null
                    ? `我${my_status}：原始 ${my_rate || '-'} / 隐藏 ${my_hidden ?? '-'}　对方${his_status}：原始 ${his_rate || '-'} / 隐藏 ${his_hidden ?? '-'}`
                    : `对方${his_status}：原始 ${his_rate || '-'} / 隐藏 ${his_hidden ?? '-'}`
                return `
                <div class="_compact_card${important_subject_ids.has(Number(review.subject.id)) ? ' __important' : ''}" data-subject-id="${Number(review.subject.id)}" data-subject-url="/subject/${Number(review.subject.id)}">
                    <img src="${review.subject.images?.grid || ''}" loading="lazy"/>
                    <div class="_compact_scores _compact_user_scores">
                        ${review.my_review ? `
                        <span class="_compact_score __${get_compact_score_level('my', my_rate)} ${get_compact_status_class(review.my_review)}" title="我的评分：原始 ${my_rate || '-'} / 隐藏 ${my_hidden ?? '-'}">
                            <img src="${my_avatar}" alt="我" />
                            <b>${my_display_score ?? '-'}</b>
                        </span>` : ''}
                        ${review.his_review ? `
                        <span class="_compact_score __${get_compact_score_level('his', his_rate)} ${get_compact_status_class(review.his_review)}" title="对方评分：原始 ${his_rate || '-'} / 隐藏 ${his_hidden ?? '-'}">
                            <img src="${his_avatar}" alt="对方" />
                            <b>${his_display_score ?? '-'}</b>
                        </span>` : ''}
                    </div>
                    <span class="_compact_score _compact_public_score __public __${get_public_rank_level(review.subject)}" title="大众评分（排名 ${review.subject.rank || '无'}）">
                        <b>${pub ?? '-'}</b>
                    </span>
                    ${his_comment_chars > 0 ? `<span class="_compact_comment_chars __${get_compact_score_level('his', his_rate)}" title="对方吐槽字数">${his_comment_chars} 字</span>` : ''}
                    <div class="_compact_tip">
                        ${name} (${total.toLocaleString()}人收藏)<br>
                        ${score_line}　大众：${pub}<br>
                        <br>对方: ${his_comment}
                    </div>
                </div>`
            }

            // 渲染列表
            function render_list(list, count) {
                const fn = analyze_config.show_comments ? render_review_card : render_compact_card
                return list.slice(0, count).map(r => fn(r)).join('')
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
                    return `<circle cx="${x(rate)}" cy="${y(count)}" r="3" fill="${color}"><title>${rate}分：${count}个收藏</title></circle>`
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
            const page_html = `
            <style>
                .鉴定_page { line-height: 1.5; font-size: 16px; padding-top: 15px; }
                .鉴定_page * { box-sizing: border-box; }
                .analysis-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
                .sort-area { flex: 1; min-width: 0; }
                .sort-track { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
                #panel { width: 400px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; flex-shrink: 0; }
                .mobile-only-control, .mobile-settings-toggle { display: none; }
                .鉴定_page ._review {
                    display: grid;
                    grid-template-columns: 120px 1fr;
                    padding: 10px 0;
                }
                .鉴定_page ._review h3 { font-size: 16px; }
                .鉴定_page ._review > aside img {
                    max-width: 90%;
                    min-height: 100px;
                    max-height: 200px;
                    object-fit: contain;
                }
                .鉴定_page ._collection_total {
                    padding: 5px 10px;
                    width: fit-content;
                    border-radius: 5px;
                    color: #fff;
                    font-weight: bold;
                    text-shadow: 0px 1px 1px #000, 0px -1px 1px #000, 1px 0px 1px #000, -1px 0px 1px #000;
                }
                .鉴定_page ._comment {
                    display: grid;
                    grid-template-columns: max-content 1fr;
                    gap: 10px;
                    margin-top: 10px;
                }
                .鉴定_page ._comment img { width: 40px; height: 40px; }
                .鉴定_page ._comment div { white-space: pre-wrap; }
                .鉴定_page ._distribution_chart {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .鉴定_page ._distribution_chart > div {
                    display: flex;
                    width: 300px;
                    height: 1em;
                }
                .鉴定_page ._distribution_chart > div > div { flex: 1; background-color: rgba(170,170,170,0.35); }
                ${[1,2,3,4,5,6,7,8,9,10].map(n =>
                    `.鉴定_page ._distribution_chart.__v${n} > div > :nth-last-child(${n}).__high { background-color: #f40; }
                     .鉴定_page ._distribution_chart.__v${n} > div > :nth-last-child(${n}).__medium { background-color: #fc0; }
                     .鉴定_page ._distribution_chart.__v${n} > div > :nth-last-child(${n}).__low { background-color: #04f; }`
                ).join('\n                ')}
                .鉴定_page ._rank_chart {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .鉴定_page ._rank_chart > div {
                    display: flex;
                    width: 300px;
                    height: 1em;
                }
                .鉴定_page ._rank_chart > div > div:not(._rank_marker) {
                    height: 100%;
                    background-color: rgba(170,170,170,0.35);
                }
                .鉴定_page ._rank_marker {
                    width: 10px;
                    height: 100%;
                    flex-shrink: 0;
                }
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
                .鉴定_page ._compact_card.__important > img { outline: 2px solid #f2b705; outline-offset: -2px; }
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
                    gap: 3px;
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
                .鉴定_page ._compact_score.__watching b { opacity: 0.45; }
                .鉴定_page ._compact_score.__on_hold b {
                    text-decoration: underline;
                    text-decoration-thickness: 2px;
                    text-underline-offset: 1px;
                }
                .鉴定_page ._compact_score.__dropped {
                    opacity: 0.6;
                }
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
                .鉴定_page ._compact_score b {
                    min-width: 1.2em;
                    text-align: right;
                }
                .鉴定_page ._compact_comment_chars {
                    position: absolute;
                    top: 24px;
                    left: 4px;
                    color: #fff;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 15px;
                    padding: 1px 4px;
                    border-radius: 8px;
                    pointer-events: none;
                    background: #222;
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
                    color: #333; background: rgba(240,145,153,0.12); border-left: 3px solid #F09199;
                    border-radius: 5px; line-height: 1.65;
                }
                html[data-theme=dark] .鉴定_page ._compact_inline_detail { color: #ddd; background: rgba(240,145,153,0.16); }
                .鉴定_page .sort-tab { padding: 8px 18px; cursor: pointer; font-size: 1.1em; font-weight: bold; border: 1px solid #ccc; border-radius: 4px; background: transparent; }
                .鉴定_page .sort-tab.active { background: #F09199; color: #fff; border-color: #F09199; }
                #type-filter-menu, #subject-type-menu { background: #fff; border: 1px solid #ccc; }
                html[data-theme=dark] #type-filter-menu, html[data-theme=dark] #subject-type-menu { background: #2c2c2c; border-color: #555; }
                html[data-theme=dark] #type-filter-menu label:hover, html[data-theme=dark] #subject-type-menu label:hover { background: #3a3a3a; }
                #simi-container:hover #simi-overlay { display: block; }
                #simi-overlay { display: none; position: absolute; top: 100%; right: 0; z-index: 20; background: #fff; border: 1px solid #ccc; border-radius: 6px; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 420px; }
                #simi-overlay .simi-header { border-bottom: 1px solid #ddd; }
                #simi-overlay .simi-row { border-bottom: 1px solid #eee; }
                html[data-theme=dark] #simi-overlay { background: #2c2c2c; border-color: #555; }
                html[data-theme=dark] #simi-overlay .simi-header { border-bottom-color: #555; }
                html[data-theme=dark] #simi-overlay .simi-row { border-bottom-color: #444; }
                html[data-theme=dark] #simi-overlay th { color: #ccc; }
                html[data-theme=dark] #simi-overlay td { color: #ddd; }
                #hidden-score-container { position: relative; }
                #hidden-score-container:hover #hidden-score-overlay { display: block; }
                #hidden-score-overlay {
                    display: none; position: absolute; top: 100%; right: 0; z-index: 30;
                    width: 460px; max-height: 75vh; overflow-y: auto; padding: 12px;
                    color: #333; background: #fff; border: 1px solid #ccc; border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                #hidden-score-overlay svg { display: block; width: 100%; height: auto; }
                #hidden-score-overlay .hidden-chart-title { margin: 4px 0; font-size: 0.85em; font-weight: 700; }
                #hidden-score-overlay .hidden-score-table { width: 100%; margin-bottom: 12px; border-collapse: collapse; text-align: center; font-size: 0.8em; }
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
                #custom-cloud-status[data-status="synced"] { color: #188038; border-color: #188038 !important; }
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
                .custom-sort-modal h2 { margin: 0 0 14px; }
                .custom-sort-modal h3 { margin: 16px 0 8px; font-size: 15px; }
                .custom-sort-modal h3 small { margin-left: 6px; color: #888; font-weight: normal; }
                .custom-sort-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
                .custom-sort-form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85em; }
                .custom-sort-modal input, .custom-sort-modal select { min-height: 30px; padding: 4px 6px; }
                .custom-filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
                .custom-filter-grid > label { display: flex; flex-direction: column; gap: 4px; }
                .custom-chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 5px; }
                .custom-chip-row label { display: flex; align-items: center; gap: 3px; }
                .custom-chip-row input { min-height: auto; }
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
                .custom-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
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
                html[data-theme=dark] .custom-context-menu button:hover { background: #444; }
                .mobile-sheet-backdrop { display: none; }
                .dual-range-container { position: relative; width: 200px; height: 24px; }
                .dual-range-container .slider-track { position: absolute; top: 50%; left: 0; right: 0; height: 4px; transform: translateY(-50%); border-radius: 2px; z-index: 1; }
                .dual-range-container input[type="range"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; z-index: 2; margin: 0; }
                .dual-range-container input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 2px; background: #007bff; border: 2px solid #fff; box-shadow: 0 0 2px rgba(0,0,0,0.3); cursor: pointer; pointer-events: auto; margin-top: -5px; }
                .dual-range-container input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 2px; background: #007bff; border: 2px solid #fff; box-shadow: 0 0 2px rgba(0,0,0,0.3); cursor: pointer; pointer-events: auto; }
                .dual-range-container input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: transparent; }
                .dual-range-container input[type="range"]::-moz-range-track { height: 4px; background: transparent; border: none; }
                .percent-bar { user-select: none; }
                @media (max-width: 760px) {
                    .鉴定_host {
                        float: none !important; width: 100% !important; min-width: 0 !important;
                        max-width: none !important; margin: 0 !important; padding: 0 !important;
                    }
                    .鉴定_page { width: 100%; min-width: 0; padding: 10px 8px 24px !important; overflow-x: hidden; font-size: 14px; }
                    .analysis-top { flex-direction: column; gap: 8px; }
                    .sort-area, #panel { width: 100%; min-width: 0; }
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
                    .threshold-slider-row { width: 100%; flex-direction: column; gap: 3px !important; }
                    .threshold-meta { width: 100% !important; align-items: flex-start !important; }
                    .threshold-controls { width: 100%; }
                    .dual-range-container, .percent-bar { width: 100% !important; }
                    #type-filter-menu { min-width: 0 !important; width: min(280px, calc(100vw - 32px)); }
                    #subject-type-menu { min-width: 0 !important; width: min(180px, calc(100vw - 32px)); }
                    #sort-list-container.is-compact {
                        grid-template-columns: repeat(3, 100px) !important;
                        justify-content: space-evenly; gap: 10px 5px !important;
                    }
                    #sort-list-container.is-detailed { grid-template-columns: minmax(0, 1fr) !important; gap: 14px !important; }
                    .鉴定_page ._review { grid-template-columns: 82px minmax(0, 1fr); gap: 8px; padding: 8px 0; }
                    .鉴定_page ._review > aside img { width: 76px; max-width: 100%; min-height: 0; max-height: 120px; }
                    .鉴定_page ._review h3 { margin: 2px 0; font-size: 13px; overflow-wrap: anywhere; }
                    .鉴定_page ._distribution_chart > div, .鉴定_page ._rank_chart > div { width: 100%; min-width: 0; }
                    .鉴定_page ._comment { gap: 6px; margin-top: 6px; }
                    .鉴定_page ._comment img { width: 30px; height: 30px; }
                    .custom-sort-modal-backdrop { align-items: stretch; padding: 0; }
                    .custom-sort-modal {
                        width: 100%; height: 100vh; height: 100dvh; max-height: none; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
                        border-radius: 0; box-shadow: none;
                    }
                    .custom-factor-grid { grid-template-columns: 1fr 1fr; }
                    .custom-preview-items { overflow-x: auto; }
                    .custom-preview-item { flex: 0 0 74px; }
                    .custom-score-detail { overflow-x: auto; }
                    .custom-modal-actions {
                        position: sticky; bottom: calc(-1 * max(12px, env(safe-area-inset-bottom)));
                        z-index: 3; padding: 10px 0 max(10px, env(safe-area-inset-bottom)); background: inherit;
                    }
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
                    .鉴定_page ._compact_card:hover ._compact_tip, #simi-container:hover #simi-overlay, #hidden-score-container:hover #hidden-score-overlay { display: none; }
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
            </style>

            <main class="鉴定_page">
                <div class="analysis-top">
                    <div class="sort-area">
                        <div class="sort-track">
                            <button class="sort-tab${analyze_config.current_sort === 'important' ? ' active' : ''}" data-sort="important">重要番剧</button>
                            <button class="sort-tab${analyze_config.current_sort === 'common_love' ? ' active' : ''}" data-sort="common_love">共同喜欢</button>
                            <button class="sort-tab${analyze_config.current_sort === 'common_hate' ? ' active' : ''}" data-sort="common_hate">共同低分</button>
                            <button class="sort-tab${analyze_config.current_sort === 'diff_high' ? ' active' : ''}" data-sort="diff_high">分歧最大</button>
                        </div>
                        <div class="sort-track">
                            <button class="sort-tab${analyze_config.current_sort === 'common_new' ? ' active' : ''}" data-sort="common_new">共同追新</button>
                            <button class="sort-tab${analyze_config.current_sort === 'his_public_diff' ? ' active' : ''}" data-sort="his_public_diff">对方独特</button>
                            <button class="sort-tab${analyze_config.current_sort === 'his_love' ? ' active' : ''}" data-sort="his_love">对方高分</button>
                            <button class="sort-tab${analyze_config.current_sort === 'his_comment' ? ' active' : ''}" data-sort="his_comment">对方吐槽</button>
                        </div>
                        <div class="sort-track">
                            <span id="custom-sort-buttons" style="display: contents;">${render_custom_sort_buttons_html()}</span>
                            <button id="new-custom-sort" class="sort-tab" type="button">＋ 新建分类</button>
                        </div>
                        <button id="mobile-sort-manage" class="mobile-only-control" type="button">分类操作</button>
                    </div>
                    <div id="panel" class="${mobile_settings_open ? 'mobile-open' : ''}">
                        <button id="mobile-settings-toggle" class="mobile-settings-toggle" type="button" aria-expanded="${mobile_settings_open}">
                            ${get_subject_selection_label(true)} · ${analyze_config.display_count >= 9999 ? '全部' : `前${analyze_config.display_count}条`} · 设置
                        </button>
                        <div id="panel-filter" style="display: flex; gap: 6px; align-items: center;">
                            <div id="type-filter-dropdown" style="position: relative;">
                                <button id="type-filter-btn" style="padding: 4px 10px; cursor: pointer; font-size: 0.85em; border: 1px solid #ccc; border-radius: 4px; background: transparent;">临时状态 ▾</button>
                                <div id="type-filter-menu" style="display: none; position: absolute; top: 100%; left: 0; border-radius: 4px; padding: 8px 10px; z-index: 10; min-width: 250px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                                    ${['my', 'his'].map(user => `<div style="margin-bottom:6px"><b>${user === 'my' ? '我' : '对方'}</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
                                        ${[1,2,3,4,5].map(t => `<label style="display:flex;align-items:center;gap:2px;cursor:pointer;font-size:0.85em">
                                            <input type="checkbox" class="type-filter-cb" data-user="${user}" data-type="${t}" ${analyze_config[`${user}_filter_types`].includes(t) ? 'checked' : ''}>${collTypeMap[String(t)]}
                                        </label>`).join('')}</div></div>`).join('')}
                                    <small style="color:#888">全选或全不选表示不限制该侧</small>
                                </div>
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
                            <select id="display-count-select" style="padding: 4px 8px; font-size: 1em;">
                                <option value="5" ${analyze_config.display_count === 5 ? 'selected' : ''}>前5条</option>
                                <option value="10" ${analyze_config.display_count === 10 ? 'selected' : ''}>前10条</option>
                                <option value="20" ${analyze_config.display_count === 20 ? 'selected' : ''}>前20条</option>
                                <option value="50" ${analyze_config.display_count === 50 ? 'selected' : ''}>前50条</option>
                                <option value="9999" ${analyze_config.display_count >= 9999 ? 'selected' : ''}>全部</option>
                            </select>
                        </div>
                        <div id="panel-actions" style="display: flex; gap: 10px; align-items: center;">
                            <button id="force-update-btn" style="padding: 6px 14px; cursor: pointer; font-size: 0.9em; border: 1px solid #ccc; border-radius: 4px; background: transparent;">更新缓存</button>
                            <div style="position: relative;">
                                <button id="custom-cloud-status" data-status="${cloud_sync_status}" style="padding: 5px 8px; cursor: pointer; font-size: 0.8em; border: 1px solid #ccc; border-radius: 4px; background: transparent;"></button>
                                <div id="cloud-sync-menu">
                                    <button type="button" data-cloud-action="sync">立即同步</button>
                                    <button type="button" data-cloud-action="export">导出规则</button>
                                    <button type="button" data-cloud-action="import">导入规则</button>
                                </div>
                            </div>
                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.9em;">
                                <input type="checkbox" id="show-comments-toggle" ${analyze_config.show_comments ? 'checked' : ''} />
                                详细
                            </label>
                            <a href="${FEEDBACK_URL}" id="feedback-link" style="font-size: 0.9em; color: #888; cursor: pointer;">点我反馈</a>
                        </div>
                        <div id="panel-threshold" style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
                            ${['my', 'his'].map(user => {
                                const low = analyze_config[user + '_threshold_low']
                                const high = analyze_config[user + '_threshold_high']
                                const label = user === 'my' ? '我' : '对方'
                                const collCount = result[user + '_coll_count']
                                const commentChars = result[user + '_comment_chars']
                                const stats = `看过${collCount} 吐槽${commentChars}字`
                                return `
                                <div class="threshold-slider-row" style="display: flex; gap: 8px; align-items: flex-start;">
                                    <div class="threshold-meta" style="width: 170px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; padding-top: 2px;">
                                        <span class="threshold-label" data-user="${user}" style="font-size: 0.85em; white-space: nowrap;"></span>
                                        <span style="font-size: 0.75em;">${label} ${stats}</span>
                                    </div>
                                    <div class="threshold-controls" style="display: flex; flex-direction: column; gap: 4px;">
                                        <div class="dual-range-container" data-user="${user}">
                                            <div class="slider-track"></div>
                                            <input type="range" class="range-handle range-low" data-user="${user}" min="0" max="10" step="1" value="${low}" />
                                            <input type="range" class="range-handle range-high" data-user="${user}" min="0" max="10" step="1" value="${high}" />
                                        </div>
                                        <div class="percent-bar" data-user="${user}" style="display: flex; width: 200px; height: 16px; overflow: visible; position: relative;"></div>
                                    </div>
                                </div>`
                            }).join('')}
                        </div>
                        <div id="panel-summary" style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.8em; white-space: nowrap;">共同收藏 ${result.common_collection_count} / 共同评分 ${result.common_rating_count}</span>
                            <div id="hidden-score-container">
                                <button id="score-display-toggle" style="padding: 4px 10px; cursor: pointer; font-size: 0.85em; border: 1px solid #ccc; border-radius: 4px; background: transparent;">${analyze_config.score_display === 'hidden' ? '显示：隐藏分' : '显示：原始分'}</button>
                                <button id="mobile-score-distribution" class="mobile-only-control" type="button">评分分布</button>
                                <div id="hidden-score-overlay">${render_hidden_score_panel()}</div>
                            </div>
                            <div id="simi-container" style="position: relative;">
                                <button id="simi-toggle-btn" style="padding: 4px 10px; cursor: pointer; font-size: 0.85em; border: 1px solid #ccc; border-radius: 4px; background: transparent;">好友评级</button>
                                <div id="simi-overlay">
                                <div style="text-align: center; font-size: 0.8em; color: #888; margin-bottom: 8px;">（实验性质）</div>
                                <table style="width: 100%; font-size: 0.85em; border-collapse: collapse;">
                                    <tr class="simi-header">
                                        <th style="text-align: left; padding: 4px 8px;"></th>
                                        <th style="text-align: right; padding: 4px 8px;">方差</th>
                                        <th style="text-align: right; padding: 4px 8px;">皮尔逊余弦</th>
                                        <th style="text-align: right; padding: 4px 16px 4px 8px;">置信度</th>
                                    </tr>
                                    ${[
                                        { name: '双方相似度', d: result.rating_simi },
                                        { name: '我·公评相似度', d: result.my_public_simi },
                                        { name: '对方·公评相似度', d: result.his_public_simi },
                                    ].map(({ name, d }) => {
                                        const conf = (d.confidence * 100).toFixed(0)
                                        const opacity = (0.4 + 0.6 * d.confidence).toFixed(2)
                                        return `<tr class="simi-row" style="opacity: ${opacity};">
                                            <td style="padding: 4px 8px;">${name}</td>
                                            <td style="text-align: right; padding: 4px 8px;">${d.variance.toFixed(2)}</td>
                                            <td style="text-align: right; padding: 4px 8px;">${(d.cosine_norm * 100).toFixed(0)}%</td>
                                            <td style="text-align: right; padding: 4px 16px 4px 8px; opacity: ${opacity};">${conf}% (${d.count}部)</td>
                                        </tr>`
                                    }).join('')}
                                </table>
                                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #eee; text-align: center;">
                                    ${(() => {
                                        const fl = result.friend_level
                                        const emo = levelEmos[fl.level] || levelEmos[0]
                                        return `<span style="font-size: 1.3em;">${getEmoHtml(emo)}</span>
                                            <span style="font-size: 1.1em; font-weight: 600; margin-left: 6px;">Lv.${fl.level}</span>
                                            <span style="font-size: 0.9em; color: #888; margin-left: 6px;">${fl.score}分</span>`
                                    })()}
                                </div>
                                <div style="margin-top: 8px; font-size: 0.75em; color: #999; line-height: 1.6; border-top: 1px solid #eee; padding-top: 6px;">
                                    <div>评分相似度 = Pearson 余弦（消除个人评分习惯差异）</div>
                                    <div>从众惩罚：公评相似度乘积 ${(result.friend_level.components.penalty * 100).toFixed(0)}%，折扣系数 ${(1 - 0.2 * result.friend_level.components.penalty).toFixed(2)}</div>
                                    <div>置信度：${result.rating_simi.count}部共同条目，置信度 ${(result.friend_level.components.confidence * 100).toFixed(0)}%</div>
                                    <div style="margin-top: 4px; font-family: monospace; font-size: 0.9em;">
                                        score = base × (1 − 0.2 × penalty) × (0.5 + 0.5 × conf)<br>
                                        = ${(result.friend_level.components.base * 100).toFixed(0)}% × ${(1 - 0.2 * result.friend_level.components.penalty).toFixed(2)} × ${(0.5 + 0.5 * result.friend_level.components.confidence).toFixed(2)}<br>
                                        = ${result.friend_level.score}%
                                    </div>
                                </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="sort-description" style="color: #888; font-size: 0.9em; margin-bottom: 12px; line-height: 1.6;">共 ${getFilteredList(analyze_config.current_sort).length} 条</div>
                <div id="sort-list-container" class="${analyze_config.show_comments ? 'is-detailed' : 'is-compact'}" style="display: grid; grid-template-columns: ${analyze_config.show_comments ? 'repeat(auto-fill, minmax(450px, 1fr))' : 'repeat(auto-fill, 120px)'}; gap: ${analyze_config.show_comments ? '50px 10px' : '10px 10px'};">
                    ${render_list(getFilteredList(analyze_config.current_sort), analyze_config.display_count)}
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

            // ─── 事件绑定 ───

            const sort_desc = {
                important: '仅展示标记的重要番剧；按共同喜欢的 2:2:1 权重排序，无评分与缺失一致度按 0 计。',
                common_love: '双方均为中/好评；综合双方评价与一致度。',
                common_hate: '双方均为差评；综合双方低评价与一致度。',
                diff_high: '双方共同评分；优先展示隐藏分分歧最大的条目。',
                common_new: '双方共同收藏；综合作品新鲜度和双方收藏时间。',
                his_public_diff: '对方已评分；综合逆大众程度与对方评价。',
                his_comment: '对方有吐槽；仅按吐槽字数从多到少排序。',
                his_love: '对方中/好评；按对方隐藏分综合评分。',
            }

            function describe_custom_rule(rule) {
                if (!rule) return '自定义规则不存在'
                const factor_names = (rule.factors || []).map(factor => FACTOR_DEFS[factor.id]?.label).filter(Boolean)
                const sets = get_rule_sets(rule)
                const range = `我：${SET_MODE_DEFS[sets.my]} / 对方：${SET_MODE_DEFS[sets.his]}`
                return `${escapeHtml(range)} · ${factor_names.length ? escapeHtml(factor_names.join('、')) : '纯筛选，按对方收藏时间排序'}`
            }

            function updateDescription() {
                const list = getFilteredList(analyze_config.current_sort)
                const description = analyze_config.current_sort.startsWith('custom:')
                    ? describe_custom_rule(custom_sort_document.rules[analyze_config.current_sort.slice(7)])
                    : sort_desc[analyze_config.current_sort] || sort_desc.common_love
                document.getElementById('sort-description').innerHTML = `共 ${list.length} 条 · ${description}`
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
                const count = analyze_config.display_count >= 9999 ? '全部' : `前${analyze_config.display_count}条`
                button.textContent = `${get_subject_selection_label(true)} · ${count} · 设置`
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
                            current.remove()
                            card.setAttribute('aria-expanded', 'false')
                            return
                        }
                        if (current?.sourceCard) current.sourceCard.setAttribute('aria-expanded', 'false')
                        current?.remove()
                        const detail = document.createElement('div')
                        detail.className = '_compact_inline_detail'
                        detail.innerHTML = tip.innerHTML
                        detail.sourceCard = card
                        card.setAttribute('aria-expanded', 'true')
                        const row_top = card.offsetTop
                        const row_cards = [...container.querySelectorAll('._compact_card')].filter(item => item.offsetTop === row_top)
                        const row_last_card = row_cards[row_cards.length - 1] || card
                        row_last_card.insertAdjacentElement('afterend', detail)
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
                            if (action === 'important') {
                                if (important_subject_ids.has(subject_id)) important_subject_ids.delete(subject_id)
                                else important_subject_ids.add(subject_id)
                                persist_important_subjects()
                                refreshList()
                            }
                            if (action === 'open') {
                                const opened = window.open(new URL(card.dataset.subjectUrl, location.origin).href, '_blank', 'noopener')
                                if (opened) opened.opener = null
                            }
                        })
                        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0)
                    })
                })
            }

            function refreshList() {
                const count = parseInt(document.getElementById('display-count-select').value)
                const list = getFilteredList(analyze_config.current_sort)
                const container = document.getElementById('sort-list-container')
                container.innerHTML = render_list(list, count)
                container.style.gridTemplateColumns = analyze_config.show_comments
                    ? 'repeat(auto-fill, minmax(450px, 1fr))'
                    : 'repeat(auto-fill, 120px)'
                container.style.gap = analyze_config.show_comments ? '50px 10px' : '10px 10px'
                container.classList.toggle('is-detailed', analyze_config.show_comments)
                container.classList.toggle('is-compact', !analyze_config.show_comments)
                bind_compact_card_interactions()
                updateDescription()
            }

            function open_custom_sort_editor(source_rule = null, copy_mode = false) {
                let initial = source_rule
                    ? JSON.parse(JSON.stringify(source_rule))
                    : {
                        name: '我的分类', sets: { my: 'rated', his: 'rated' }, filters: {},
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
                const set_mode_options = user => Object.entries(SET_MODE_DEFS)
                    .filter(([value]) => value !== 'important' || user === 'my')
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
                            <h2>${source_rule && !copy_mode ? '编辑分类' : '新建分类'}</h2>
                            <div class="custom-sort-form-grid">
                                <label>名称<input id="custom-rule-name" maxlength="30" /></label>
                                <label>从内置预设开始
                                    <select id="custom-rule-template">
                                        <option value="">空白 / 保持当前</option>
                                        ${Object.entries(PRESET_RULES).map(([id, preset]) => `<option value="${id}">${escapeHtml(preset.name)}</option>`).join('')}
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
                            </div>
                            <section class="custom-filter-section">
                                <h3>硬筛选 <small>组间同时满足，组内可多选</small></h3>
                                <div class="custom-filter-grid">
                                    <div><b>我的评分档位</b><div class="custom-chip-row" data-tier-host="my">${tier_options('my')}</div></div>
                                    <div><b>对方评分档位</b><div class="custom-chip-row" data-tier-host="his">${tier_options('his')}</div></div>
                                    <label>我的吐槽<select id="my-comment-filter"><option value="any">不限</option><option value="has">有吐槽</option><option value="empty">无吐槽</option></select></label>
                                    <label>对方吐槽<select id="his-comment-filter"><option value="any">不限</option><option value="has">有吐槽</option><option value="empty">无吐槽</option></select></label>
                                </div>
                                <details class="custom-advanced-filter"><summary>高级数值范围</summary>${range_rows}</details>
                            </section>
                            <section class="custom-factor-section">
                                <h3>综合评分 <small>启用因素后选择偏好方向和权重</small></h3>
                                <div class="custom-factor-grid">${factor_cards}</div>
                            </section>
                            <div id="custom-rule-preview" class="custom-preview"></div>
                            <div id="custom-score-detail" class="custom-score-detail"></div>
                            <p class="custom-modal-note">“未收藏”仅指双方收藏并集中的补集；两侧都选“未收藏”时结果为空。缺少任一启用因素数据的条目会自动排除；未启用因素时按对方收藏时间排序。</p>
                            <div class="custom-modal-actions">
                                <button type="button" data-action="cancel">取消</button>
                                <button type="button" data-action="save">保存并应用</button>
                            </div>
                        </section>
                    </div>`)
                document.body.append(backdrop)

                const name_input = backdrop.querySelector('#custom-rule-name')
                const my_set_select = backdrop.querySelector('#custom-rule-my-set')
                const his_set_select = backdrop.querySelector('#custom-rule-his-set')

                function collect_draft() {
                    const selected_tiers = user => [...backdrop.querySelectorAll(`.tier-filter[data-user="${user}"]:checked`)].map(input => input.value)
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
                        sets: { my: my_set_select.value, his: his_set_select.value },
                        filters: {
                            my_tiers: selected_tiers('my'),
                            his_tiers: selected_tiers('his'),
                            my_comment: backdrop.querySelector('#my-comment-filter').value,
                            his_comment: backdrop.querySelector('#his-comment-filter').value,
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
                        host.innerHTML = '<span>该分类未启用评分因素。</span>'
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
                    preview.innerHTML = `<strong>范围 ${evaluation.scopedCount} 条 → 命中 ${items.length} 条${evaluation.excludedCount ? `，缺少评分数据排除 ${evaluation.excludedCount} 条` : ''}</strong><div class="custom-preview-items">${items.slice(0, 5).map((item, index) => `
                        <button type="button" class="custom-preview-item" data-preview-index="${index}" title="点击查看评分明细">
                            <img src="${item.subject.images?.grid || ''}" loading="lazy" />
                            <span>${escapeHtml(getSubjectDisplayName(item.subject))}</span>
                            ${item._custom_score == null ? '' : `<b>${item._custom_score.toFixed(1)}</b>`}
                        </button>`).join('')}</div>`
                    preview.querySelectorAll('[data-preview-index]').forEach(button => button.addEventListener('click', () => show_score_detail(items[Number(button.dataset.previewIndex)])))
                    backdrop.querySelector('#custom-score-detail').innerHTML = ''
                }

                function fill_form(rule) {
                    name_input.value = rule.name || '我的分类'
                    const sets = get_rule_sets(rule)
                    my_set_select.value = sets.my
                    his_set_select.value = sets.his
                    backdrop.querySelector('#custom-rule-template').value = rule.sourcePreset || ''
                    for (const user of ['my', 'his']) {
                        backdrop.querySelectorAll(`.tier-filter[data-user="${user}"]`).forEach(input => {
                            input.checked = (rule.filters?.[`${user}_tiers`] || []).includes(input.value)
                        })
                        backdrop.querySelector(`#${user}-comment-filter`).value = rule.filters?.[`${user}_comment`] || 'any'
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
                    const preset = PRESET_RULES[event.target.value]
                    if (!preset) return
                    const preserved_id = initial.id
                    initial = { ...JSON.parse(JSON.stringify(preset)), ...(preserved_id ? { id: preserved_id } : {}), sourcePreset: event.target.value }
                    initial.name = `${preset.name} 自定义`
                    fill_form(initial)
                })
                backdrop.querySelectorAll('input,select').forEach(element => {
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
                    if (!draft.name) return alert('分类名称不能为空')
                    const duplicate = get_active_custom_rules().find(rule => rule.name === draft.name && rule.id !== draft.id)
                    if (duplicate) return alert('分类名称不能重复')
                    const saved = put_custom_rule(draft)
                    analyze_config.current_sort = `custom:${saved.id}`
                    save_settings()
                    backdrop.remove()
                    refresh_custom_rule_ui()
                })
                fill_form(initial)
            }

            function bind_sort_tab(tab) {
                tab.addEventListener('click', () => {
                    $page.querySelectorAll('.sort-tab[data-sort]').forEach(item => item.classList.remove('active'))
                    tab.classList.add('active')
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
                            if (action === 'delete' && confirm(`删除分类“${rule.name}”？`)) {
                                delete_custom_rule(rule.id)
                                refresh_custom_rule_ui()
                            }
                        })
                        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0)
                    })
                } else if (PRESET_RULES[tab.dataset.sort]) {
                    tab.title = '左键应用，右键复制为我的分类'
                    tab.addEventListener('contextmenu', event => {
                        event.preventDefault()
                        const preset = { ...JSON.parse(JSON.stringify(PRESET_RULES[tab.dataset.sort])), sourcePreset: tab.dataset.sort }
                        open_custom_sort_editor(preset, true)
                    })
                }
            }

            function refresh_custom_buttons_local() {
                const host = document.getElementById('custom-sort-buttons')
                if (!host) return
                if (analyze_config.current_sort.startsWith('custom:')) {
                    const current = custom_sort_document.rules[analyze_config.current_sort.slice(7)]
                    if (!current || current.deletedAt) {
                        analyze_config.current_sort = 'common_love'
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

            updateDescription()

            // 切换排序 tab
            $page.querySelectorAll('.sort-tab[data-sort]').forEach(bind_sort_tab)
            document.getElementById('new-custom-sort').addEventListener('click', () => open_custom_sort_editor())

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
            document.getElementById('mobile-score-distribution').addEventListener('click', () => {
                open_mobile_sheet('隐藏分与评分分布', document.getElementById('hidden-score-overlay').innerHTML)
            })
            document.getElementById('simi-toggle-btn').addEventListener('click', event => {
                if (!is_touch_mode()) return
                event.preventDefault()
                open_mobile_sheet('好友评级', document.getElementById('simi-overlay').innerHTML)
            })

            document.getElementById('mobile-sort-manage').addEventListener('click', () => {
                const sort_key = analyze_config.current_sort
                if (sort_key.startsWith('custom:')) {
                    const rule = custom_sort_document.rules[sort_key.slice('custom:'.length)]
                    if (!rule || rule.deletedAt) return
                    open_mobile_sheet(`管理分类：${rule.name}`, `
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
                            if (action === 'delete' && confirm(`删除分类“${rule.name}”？`)) {
                                delete_custom_rule(rule.id)
                                refresh_custom_rule_ui()
                            }
                        })
                    })
                    return
                }
                const preset = PRESET_RULES[sort_key] || PRESET_RULES.common_love
                open_mobile_sheet(`分类操作：${preset.name}`, `
                    <div class="mobile-sheet-actions"><button type="button" data-rule-action="copy">复制为我的分类</button></div>
                `, content => {
                    content.querySelector('[data-rule-action="copy"]').addEventListener('click', () => {
                        close_mobile_sheet()
                        open_custom_sort_editor({ ...JSON.parse(JSON.stringify(preset)), sourcePreset: sort_key }, true)
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

            // 自定义规则云同步菜单
            update_cloud_status_ui()
            const cloud_status_button = document.getElementById('custom-cloud-status')
            const cloud_sync_menu = document.getElementById('cloud-sync-menu')
            cloud_status_button.addEventListener('click', event => {
                event.stopPropagation()
                cloud_sync_menu.style.display = cloud_sync_menu.style.display === 'block' ? 'none' : 'block'
            })
            cloud_sync_menu.addEventListener('click', async event => {
                event.stopPropagation()
                const action = event.target.dataset.cloudAction
                if (!action) return
                cloud_sync_menu.style.display = 'none'
                if (action === 'sync') await sync_custom_sorts()
                if (action === 'export') {
                    const blob = new Blob([JSON.stringify(custom_sort_document, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const anchor = document.createElement('a')
                    anchor.href = url
                    anchor.download = `鉴定_自定义分类_v2_${new Date().toISOString().slice(0, 10)}.json`
                    anchor.click()
                    URL.revokeObjectURL(url)
                }
                if (action === 'import') {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'application/json'
                    input.addEventListener('change', async () => {
                        const file = input.files?.[0]
                        if (!file) return
                        try {
                            const imported = parse_custom_sort_document(await file.text(), true)
                            let offset = 0
                            for (const [id, rule] of Object.entries(imported.rules)) {
                                custom_sort_document.rules[id] = {
                                    ...rule,
                                    id,
                                    updatedAt: Date.now() + offset++,
                                    deletedAt: rule.deletedAt ? Date.now() : null,
                                    deviceId: device_id,
                                }
                            }
                            persist_custom_sort_document()
                            schedule_custom_sort_sync()
                            refresh_custom_rule_ui()
                        } catch (error) {
                            alert(`导入失败：${error.message || error}`)
                        }
                    })
                    input.click()
                }
            })
            document.addEventListener('click', () => { cloud_sync_menu.style.display = 'none' })

            // 显示数量下拉框
            document.getElementById('display-count-select').addEventListener('change', (e) => {
                analyze_config.display_count = parseInt(e.target.value)
                save_settings()
                update_mobile_settings_summary()
                refreshList()
            })

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

            function updateSliderTrack(container, lowVal, highVal) {
                const track = container.querySelector('.slider-track')
                const lowPercent = (lowVal / 10 * 100).toFixed(1)
                const highPercent = (highVal / 10 * 100).toFixed(1)
                track.style.background = `linear-gradient(to right, #04f 0%, #04f ${lowPercent}%, #fc0 ${lowPercent}%, #fc0 ${highPercent}%, #f40 ${highPercent}%, #f40 100%)`
            }

            function updateThresholdLabel(labelEl, lowVal, highVal) {
                const lowPart = lowVal === 0 ? '无差' : `1-${lowVal}差`
                const midPart = `${lowVal === 0 ? 1 : lowVal + 1}-${highVal === 10 ? 10 : highVal}中`
                const highPart = highVal === 10 ? '无好' : `${highVal + 1}-10好`
                labelEl.textContent = `${lowPart} ${midPart} ${highPart}`
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
                    html += `<div style="flex:${count};background:${color};min-width:0;border-radius:${rL} ${rR} ${rR} ${rL};${borderR}"></div>`
                }
                barEl.innerHTML = html
            }

            // 初始化滑块
            const myBalance = autoBalanceThresholds(result.my_rate_count_map)
            const hisBalance = autoBalanceThresholds(result.his_rate_count_map)
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
                const label = container.closest('.threshold-slider-row').querySelector('.threshold-label')
                updateThresholdLabel(label, analyze_config[user + '_threshold_low'], analyze_config[user + '_threshold_high'])
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
                    const label = container.closest('.threshold-slider-row').querySelector('.threshold-label')
                    updateThresholdLabel(label, lowVal, highVal)
                    updatePercentBar(user)
                    refreshList()
                })
            })

            // 收藏类型下拉菜单
            const typeFilterBtn = document.getElementById('type-filter-btn')
            const typeFilterMenu = document.getElementById('type-filter-menu')
            typeFilterBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                typeFilterMenu.style.display = typeFilterMenu.style.display === 'none' ? 'block' : 'none'
            })
            typeFilterMenu.addEventListener('click', (e) => {
                e.stopPropagation()
            })
            document.addEventListener('click', () => {
                if (typeFilterMenu.style.display === 'none') return
                typeFilterMenu.style.display = 'none'
                const next = {}
                for (const user of ['my', 'his']) {
                    next[user] = [...$page.querySelectorAll(`.type-filter-cb[data-user="${user}"]:checked`)].map(c => Number(c.dataset.type))
                }
                const changed = ['my', 'his'].some(user => {
                    const old_types = analyze_config[`${user}_filter_types`]
                    return next[user].length !== old_types.length || next[user].some(type => !old_types.includes(type))
                })
                if (changed) {
                    analyze_config.my_filter_types = next.my
                    analyze_config.his_filter_types = next.his
                    save_settings()
                    inject_analyze_page(false)
                }
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

            // 吐槽开关
            document.getElementById('show-comments-toggle').addEventListener('change', (e) => {
                analyze_config.show_comments = e.target.checked
                save_settings()
                refreshList()
            })

            // 反馈链接
            document.getElementById('feedback-link').addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                window.open(FEEDBACK_URL, '_blank')
            })

            // 强制更新缓存
            document.getElementById('force-update-btn').addEventListener('click', async () => {
                const btn = document.getElementById('force-update-btn')
                btn.textContent = '更新中...'
                btn.disabled = true
                try {
                    await inject_analyze_page(true)
                } catch (e) {
                    alert(`更新失败: ${e.message}`)
                }
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

        // 开发快捷入口：由 VS Code Task 打开测试 URL 时自动进入分析页
        if (new URLSearchParams(window.location.search).get('ying-shi') === '1') {
            $btn.click()
        }
    }
})()
