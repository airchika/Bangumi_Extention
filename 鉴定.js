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
        1: { name: "书籍", id: 1 },
        2: { name: "动画", id: 2 },
        3: { name: "音乐", id: 3 },
        4: { name: "游戏", id: 4 },
        6: { name: "三次元", id: 6 },
    }

    const analyze_config = {
        cur_subject_id: 2,
        display_count: 10,
        show_comments: true,
    }

    // ─── 本地设置缓存 ───

    const SETTINGS_KEY = '鉴定_settings'

    function load_settings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
            if (saved) {
                if (typeof saved.display_count === 'number') analyze_config.display_count = saved.display_count
                if (typeof saved.show_comments === 'boolean') analyze_config.show_comments = saved.show_comments
            }
        } catch (e) { /* ignore */ }
    }

    function save_settings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            display_count: analyze_config.display_count,
            show_comments: analyze_config.show_comments,
        }))
    }

    load_settings()

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
                return `https://api.bgm.tv/v0/users/${user_id}/collections?subject_type=${subject_type}`
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
            const api = `https://api.bgm.tv/v0/users/${username}/collections?subject_type=${subject_id}&limit=${limit}&offset=`

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
            const cache_key = api_cache.transCollKey(username, analyze_config.cur_subject_id)
            let collections = force ? null : await api_cache.get(cache_key)

            if (!collections) {
                try {
                    collections = await fetch_all_collections(username, analyze_config.cur_subject_id)
                    await api_cache.set(cache_key, collections)
                } catch (e) {
                    throw `自动获取${username}的${subject_config[analyze_config.cur_subject_id].name}缓存失败: ${e.message}`
                }
            }
            return collections
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

        /**
         * 计算共同在看列表（双方 type=3，不限评分，含未评分）
         * @param {Collection[]} col1
         * @param {Collection[]} col2
         * @returns {Object[]}
         */
        function calc_watching_list(col1, col2) {
            const map2 = new Map(col2.map(o => [o.subject_id, o]))
            const list = []

            for (const c1 of col1) {
                if (c1.type !== 3) continue
                const c2 = map2.get(c1.subject_id)
                if (!c2 || c2.type !== 3) continue

                const pub = get_public_score(c1.subject)
                list.push({
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

            // 排序：优先按最近更新时间，无评分时按冷门共鸣
            list.sort((a, b) => {
                const aDate = Math.max(a.my_review.date.getTime(), a.his_review.date.getTime())
                const bDate = Math.max(b.my_review.date.getTime(), b.his_review.date.getTime())
                const aHasRate = a.my_review.rate > 0 && a.his_review.rate > 0
                const bHasRate = b.my_review.rate > 0 && b.his_review.rate > 0

                // 有评分的排在前面
                if (aHasRate !== bHasRate) return aHasRate ? -1 : 1

                // 都有评分：按更新时间
                if (aHasRate && bHasRate) return bDate - aDate

                // 都没评分或一方没评分：按冷门共鸣，再按时间
                const aNiche = (a.my_review.rate + a.his_review.rate) / Math.log2((a.subject.collection_total || 1) + 1)
                const bNiche = (b.my_review.rate + b.his_review.rate) / Math.log2((b.subject.collection_total || 1) + 1)
                if (aNiche !== bNiche) return bNiche - aNiche
                return bDate - aDate
            })

            return list
        }

        /**
         * 计算弱评分交集（双方都收藏，不要求有评分）
         * @param {Collection[]} col1
         * @param {Collection[]} col2
         * @returns {Object[]}
         */
        function calc_weak_intersections(col1, col2) {
            const map2 = new Map(col2.map(o => [o.subject_id, o]))
            const list = []

            for (const c1 of col1) {
                const c2 = map2.get(c1.subject_id)
                if (!c2) continue

                const pub = get_public_score(c1.subject)
                list.push({
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

            return list
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

            const my_rate_count_map = calc_rate_count_map(my_collections)
            const his_rate_count_map = calc_rate_count_map(his_collections)
            const intersections = calc_intersections(my_collections, his_collections)

            // 共同喜爱：双方分数都高为前提，再比较与大众评分的差异
            const common_love_list = [...intersections].sort((a, b) => {
                const sumA = a.my_review.rate + a.his_review.rate
                const sumB = b.my_review.rate + b.his_review.rate
                if (sumA !== sumB) return sumB - sumA
                return b.public_diff - a.public_diff
            })

            // 共同厌恶：双方分数都低为前提，再比较与大众评分的差异
            const common_hate_list = [...intersections].sort((a, b) => {
                const maxA = Math.max(a.my_review.rate, a.his_review.rate)
                const maxB = Math.max(b.my_review.rate, b.his_review.rate)
                if (maxA !== maxB) return maxA - maxB
                const sumA = a.my_review.rate + a.his_review.rate
                const sumB = b.my_review.rate + b.his_review.rate
                if (sumA !== sumB) return sumA - sumB
                return b.public_diff - a.public_diff
            })

            // 一致对外：两人评分接近但与公众差异大
            const united_front_list = [...intersections].sort((a, b) => {
                const scoreA = a.public_diff / (a.user_diff + 0.01)
                const scoreB = b.public_diff / (b.user_diff + 0.01)
                return scoreB - scoreA
            })

            // 冷门共鸣：双方都给高分但收藏人数少
            const niche_list = [...intersections].sort((a, b) => {
                const totalA = a.subject.collection_total || 1
                const totalB = b.subject.collection_total || 1
                const nicheA = (a.my_review.rate + a.his_review.rate) / Math.log2(totalA + 1)
                const nicheB = (b.my_review.rate + b.his_review.rate) / Math.log2(totalB + 1)
                return nicheB - nicheA
            })

            // 争议最大：二人差异度最大
            const diff_high_list = [...intersections].sort((a, b) => b.diff - a.diff)

            // 共同在看：双方都是在看状态，含未评分
            const watching_list = calc_watching_list(my_collections, his_collections)

            // ── 对方维度（对方全部收藏，不限于共同交集） ──

            const his_all = his_collections.filter(c => c.rate > 0).map(c => ({
                subject: c.subject,
                my_review: null,
                his_review: {
                    rate: c.rate,
                    comment: c.comment,
                    date: new Date(c.updated_at),
                    type: c.type,
                },
            }))

            // 对方最爱：对方评分最高
            const his_love_list = [...his_all].sort((a, b) => b.his_review.rate - a.his_review.rate)

            // 对方最厌恶：对方评分最低
            const his_hate_list = [...his_all].sort((a, b) => a.his_review.rate - b.his_review.rate)

            // 对方与大众差距最大：|对方评分 - 大众均分|
            const his_public_diff_list = [...his_all].sort((a, b) => {
                const diffA = Math.abs(a.his_review.rate - get_public_score(a.subject))
                const diffB = Math.abs(b.his_review.rate - get_public_score(b.subject))
                return diffB - diffA
            })

            // 对方最冷门高分：对方高分 + 收藏少
            const his_niche_list = [...his_all].sort((a, b) => {
                const nicheA = a.his_review.rate / Math.log2((a.subject.collection_total || 1) + 1)
                const nicheB = b.his_review.rate / Math.log2((b.subject.collection_total || 1) + 1)
                return nicheB - nicheA
            })

            // ── 双方分歧维度 ──

            // 分歧反转：一人高于大众、一人低于大众
            const diverge_reverse_list = [...intersections]
                .filter(r => r.diff >= 3)
                .sort((a, b) => {
                    const pubA = get_public_score(a.subject)
                    const pubB = get_public_score(b.subject)
                    const scoreA = (a.my_review.rate - pubA) * (a.his_review.rate - pubA)
                    const scoreB = (b.my_review.rate - pubB) * (b.his_review.rate - pubB)
                    return scoreA - scoreB
                })

            // 热门分歧：大热门但两人看法相反
            const hot_diverge_list = [...intersections]
                .filter(r => (r.subject.collection_total || 0) > 5000)
                .sort((a, b) => b.diff - a.diff)

            // 我高他低：我比对方高分最多
            const i_high_he_low_list = [...intersections]
                .filter(r => r.my_review.rate > r.his_review.rate)
                .sort((a, b) => (b.my_review.rate - b.his_review.rate) - (a.my_review.rate - a.his_review.rate))

            // 我低他高：对方比我高分最多
            const i_low_he_high_list = [...intersections]
                .filter(r => r.his_review.rate > r.my_review.rate)
                .sort((a, b) => (b.his_review.rate - b.my_review.rate) - (a.his_review.rate - a.my_review.rate))

            // ── 对方补全 ──

            // 接近大众：对方评分最贴近大众共识
            const his_close_public_list = [...his_all].sort((a, b) => {
                const diffA = Math.abs(a.his_review.rate - get_public_score(a.subject))
                const diffB = Math.abs(b.his_review.rate - get_public_score(b.subject))
                return diffA - diffB
            })

            // ── 弱评分类（含无评分收藏） ──

            const weak_intersections = calc_weak_intersections(my_collections, his_collections)

            // 共同追新：按作品日期从新到旧
            const common_new_list = [...weak_intersections].sort((a, b) => {
                const dateA = a.subject.date || ''
                const dateB = b.subject.date || ''
                return dateB.localeCompare(dateA)
            })

            // 共同回忆：按作品日期从旧到新
            const common_old_list = [...weak_intersections].sort((a, b) => {
                const dateA = a.subject.date || ''
                const dateB = b.subject.date || ''
                return dateA.localeCompare(dateB)
            })

            // 想看推荐：我想看 + 对方已看（非想看）
            const his_col_map = new Map(his_collections.map(c => [c.subject_id, c]))
            const want_recommend_list = my_collections
                .filter(c => c.type === 1)
                .map(c => {
                    const his = his_col_map.get(c.subject_id)
                    if (!his || his.type === 1) return null
                    return {
                        subject: c.subject,
                        my_review: { rate: c.rate, comment: c.comment, date: new Date(c.updated_at), type: c.type },
                        his_review: { rate: his.rate, comment: his.comment, date: new Date(his.updated_at), type: his.type },
                    }
                })
                .filter(Boolean)
                .sort((a, b) => (b.his_review.rate || 0) - (a.his_review.rate || 0))

            return {
                diff_high_list,
                common_love_list,
                common_hate_list,
                united_front_list,
                niche_list,
                watching_list,
                his_love_list,
                his_hate_list,
                his_public_diff_list,
                his_niche_list,
                diverge_reverse_list,
                hot_diverge_list,
                i_high_he_low_list,
                i_low_he_high_list,
                his_close_public_list,
                common_new_list,
                common_old_list,
                want_recommend_list,
                my_rate_count_map,
                his_rate_count_map,
            }
        }

        return { run }
    })()

    // ─── 状态 ───

    let analyzeLoading = false
    let self_username = ''
    let visited_username = ''
    let cur_user1, cur_user2

    // ─── 注入分析页面 ───

    async function inject_analyze_page(force = false) {
        const $page = document.querySelector('.columns')

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

            // 渲染条目卡片（复用 Your Angle 的 _review 格式）
            function render_review_card(review) {
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
                            ${his_dist_chart(review.his_review.rate)}
                            <div class="_rank_chart">
                                <div>
                                    <div style="flex:${(10 - review.subject.score).toFixed(1)}"></div>
                                    <div class="_rank_marker" style="background-color:${review.subject.score >= 8 ? '#f40' : review.subject.score >= 5 ? '#fc0' : '#04f'}"></div>
                                    <div style="flex:${review.subject.score.toFixed(1)}"></div>
                                </div>
                                <b>${review.subject.score}</b>
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

            // 简略图渲染（仅封面 + 悬停提示分数）
            function render_compact_card(review) {
                const my_rate = review.my_review ? review.my_review.rate : '—'
                const his_rate = review.his_review ? review.his_review.rate : '—'
                const pub_score = review.subject.score
                const his_comment = review.his_review?.comment ? escapeHtml(review.his_review.comment) : '无'
                const my_comment = review.my_review?.comment ? escapeHtml(review.my_review.comment) : '无'
                const name = escapeHtml(getSubjectDisplayName(review.subject))
                return `
                <a href="/subject/${review.subject.id}" target="_blank" class="_compact_card">
                    <img src="${review.subject.images?.grid || ''}" loading="lazy"/>
                    <div class="_compact_tip">
                        ${name}<br>
                        我:${my_rate} 对方:${his_rate} 大众:${pub_score}<br>
                        对方: ${his_comment}<br>
                        我: ${my_comment}
                    </div>
                </a>`
            }

            // 渲染列表
            function render_list(list, count) {
                const fn = analyze_config.show_comments ? render_review_card : render_compact_card
                return list.slice(0, count).map(r => fn(r)).join('')
            }

            // 完整页面
            const page_html = `
            <style>
                .鉴定_page { line-height: 1.5; font-size: 16px; padding-top: 15px; }
                .鉴定_page * { box-sizing: border-box; }
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
                }
                .鉴定_page ._compact_card img {
                    width: 100px;
                    height: 140px;
                    object-fit: cover;
                    border-radius: 4px;
                    display: block;
                }
                .鉴定_page ._compact_card:hover img { opacity: 0.7; }
                .鉴定_page ._compact_tip {
                    display: none;
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.85);
                    color: #fff;
                    font-size: 14px;
                    padding: 4px 8px;
                    border-radius: 3px;
                    width: max-content;
                    max-width: 360px;
                    word-break: break-all;
                    pointer-events: none;
                    z-index: 1;
                    margin-top: 2px;
                }
                .鉴定_page ._compact_card:hover ._compact_tip { display: block; }
                .鉴定_page .sort-tab { padding: 8px 18px; cursor: pointer; font-size: 1.1em; font-weight: bold; border: 1px solid #ccc; border-radius: 4px; background: transparent; }
                .鉴定_page .sort-tab.active { background: #FE8A95; color: #fff; border-color: #FE8A95; }
            </style>

            <main class="鉴定_page">
                <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
                            <button class="sort-tab active" data-sort="common_love">共同喜爱</button>
                            <button class="sort-tab" data-sort="common_hate">共同厌恶</button>
                            <button class="sort-tab" data-sort="united_front">一致对外</button>
                            <button class="sort-tab" data-sort="niche">冷门共鸣</button>
                            <span class="sort-count-label" style="color: #888; font-size: 0.9em;">共 ${result.common_love_list.length} 条</span>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
                        <button class="sort-tab" data-sort="i_high_he_low">我高他低</button>
                        <button class="sort-tab" data-sort="i_low_he_high">我低他高</button>
                        <button class="sort-tab" data-sort="diff_high">争议最大</button>
                        <button class="sort-tab" data-sort="diverge_reverse">大众反转</button>
                            <button class="sort-tab" data-sort="hot_diverge">热门分歧</button>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
                            <button class="sort-tab" data-sort="his_love">对方高分</button>
                            <button class="sort-tab" data-sort="his_hate">对方低分</button>
                            <button class="sort-tab" data-sort="his_public_diff">对方独特</button>
                            <button class="sort-tab" data-sort="his_niche">对方冷门</button>
                            <button class="sort-tab" data-sort="his_close_public">接近大众</button>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <button class="sort-tab" data-sort="watching">共同在看</button>
                            <button class="sort-tab" data-sort="common_new">共同追新</button>
                            <button class="sort-tab" data-sort="common_old">共同回忆</button>
                            <button class="sort-tab" data-sort="want_recommend">想看推荐</button>
                        </div>
                    </div>
                    <div style="width: 300px; display: flex; gap: 10px; align-items: center; justify-content: flex-end; flex-shrink: 0;">
                        <button id="force-update-btn" style="padding: 6px 14px; cursor: pointer; font-size: 0.9em; border: 1px solid #ccc; border-radius: 4px; background: transparent;">更新缓存</button>
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.9em;">
                            <input type="checkbox" id="show-comments-toggle" ${analyze_config.show_comments ? 'checked' : ''} />
                            详细
                        </label>
                        <select id="display-count-select" style="padding: 4px 8px; font-size: 1em;">
                            <option value="5" ${analyze_config.display_count === 5 ? 'selected' : ''}>5</option>
                            <option value="10" ${analyze_config.display_count === 10 ? 'selected' : ''}>10</option>
                            <option value="20" ${analyze_config.display_count === 20 ? 'selected' : ''}>20</option>
                            <option value="50" ${analyze_config.display_count === 50 ? 'selected' : ''}>50</option>
                            <option value="9999" ${analyze_config.display_count >= 9999 ? 'selected' : ''}>全部</option>
                        </select>
                        <a href="${FEEDBACK_URL}" id="feedback-link" style="font-size: 0.9em; color: #888; cursor: pointer;">点我反馈</a>
                    </div>
                </div>
                <div id="sort-description" style="color: #888; font-size: 0.9em; margin-bottom: 12px; line-height: 1.6;"></div>
                <div id="sort-list-container" style="display: grid; grid-template-columns: ${analyze_config.show_comments ? 'repeat(auto-fill, minmax(450px, 1fr))' : 'repeat(auto-fill, 120px)'}; gap: ${analyze_config.show_comments ? '50px 10px' : '10px 10px'};">
                    ${render_list(result.common_love_list, analyze_config.display_count)}
                </div>
            </main>`

            $page.innerHTML = page_html

            // ─── 事件绑定 ───

            const sort_map = {
                common_love: result.common_love_list,
                common_hate: result.common_hate_list,
                united_front: result.united_front_list,
                niche: result.niche_list,
                diff_high: result.diff_high_list,
                i_high_he_low: result.i_high_he_low_list,
                i_low_he_high: result.i_low_he_high_list,
                hot_diverge: result.hot_diverge_list,
                diverge_reverse: result.diverge_reverse_list,
                his_love: result.his_love_list,
                his_hate: result.his_hate_list,
                his_public_diff: result.his_public_diff_list,
                his_niche: result.his_niche_list,
                his_close_public: result.his_close_public_list,
                watching: result.watching_list,
                common_new: result.common_new_list,
                common_old: result.common_old_list,
                want_recommend: result.want_recommend_list,
            }
            const sort_desc = {
                common_love: '双方都给了高分的条目。优先按双方评分之和降序，同分时按与大众均分的差异降序。<br>公式：<code>(我 + 对方)</code> 高优先 → <code>(|我 − 大众| + |对方 − 大众|) / 2</code> 大优先',
                common_hate: '双方都给了低分的条目。优先按两人中较高分升序（确保双方都低），再按评分之和升序，最后按与大众均分的差异降序。<br>公式：<code>max(我, 对方)</code> 低优先 → <code>(我 + 对方)</code> 低优先 → <code>(|我 − 大众| + |对方 − 大众|) / 2</code> 大优先',
                united_front: '两人评分接近，但与大众均分差异大——你俩一致，和外面的人不一样。<br>公式：<code>(|我 − 大众| + |对方 − 大众|) / 2 / (|我 − 对方| + 0.01)</code> 大优先',
                niche: '双方都给了高分，但收藏人数很少——冷门中的共同宝藏。<br>公式：<code>(我 + 对方) / log₂(收藏数 + 1)</code> 大优先',
                diff_high: '两人评分差距最大的条目。<br>公式：<code>|我 − 对方|</code> 大优先',
                i_high_he_low: '我比对方高分最多的作品——"我觉得好但 TA 不太认同"。<br>公式：<code>我 − 对方</code> 大优先（仅取正值）',
                i_low_he_high: '对方比我高分最多的作品——"TA 觉得好但我不太认同"。<br>公式：<code>对方 − 我</code> 大优先（仅取正值）',
                hot_diverge: '收藏人数 > 5000 的大热门作品中，两人评分差距最大的条目。<br>公式：热门 → <code>|我 − 对方|</code> 大优先',
                diverge_reverse: '一人高于大众、一人低于大众，方向完全相反。<br>公式：<code>(我 − 大众) × (对方 − 大众)</code> 越负越优先（需差值 ≥ 3）',
                his_love: '对方全部收藏中评分最高的条目。<br>公式：<code>对方评分</code> 高优先',
                his_hate: '对方全部收藏中评分最低的条目。<br>公式：<code>对方评分</code> 低优先',
                his_public_diff: '对方全部收藏中与大众均分差距最大的条目——TA 的独特品味。<br>公式：<code>|对方评分 − 大众均分|</code> 大优先',
                his_niche: '对方全部收藏中高分但收藏人数少的条目——TA 的冷门宝藏。<br>公式：<code>对方评分 / log₂(收藏数 + 1)</code> 大优先',
                his_close_public: '对方全部收藏中评分最贴近大众共识的条目——TA 的主流品味。<br>公式：<code>|对方评分 − 大众均分|</code> 小优先',
                watching: '双方都在看的条目，包含未评分的。优先按最近更新时间排序，无评分时按冷门共鸣排序。',
                common_new: '双方都收藏的条目中，按作品日期从新到旧。<br>公式：<code>作品日期</code> 降序',
                common_old: '双方都收藏的条目中，按作品日期从旧到新。<br>公式：<code>作品日期</code> 升序',
                want_recommend: '我想看但对方已看过的条目，按对方评分降序——TA 的高分作品值得优先看。',
            }
            let currentSort = 'common_love'

            function updateDescription() {
                document.getElementById('sort-description').innerHTML = sort_desc[currentSort]
            }

            function refreshList() {
                const count = parseInt(document.getElementById('display-count-select').value)
                const list = sort_map[currentSort]
                const container = document.getElementById('sort-list-container')
                container.innerHTML = render_list(list, count)
                container.style.gridTemplateColumns = analyze_config.show_comments
                    ? 'repeat(auto-fill, minmax(450px, 1fr))'
                    : 'repeat(auto-fill, 120px)'
                container.style.gap = analyze_config.show_comments ? '50px 10px' : '10px 10px'
                $page.querySelector('.sort-count-label').textContent = `共 ${list.length} 条`
                updateDescription()
            }

            updateDescription()

            // 切换排序 tab
            $page.querySelectorAll('.sort-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    $page.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('active'))
                    tab.classList.add('active')
                    currentSort = tab.dataset.sort
                    refreshList()
                })
            })

            // 显示数量下拉框
            document.getElementById('display-count-select').addEventListener('change', (e) => {
                analyze_config.display_count = parseInt(e.target.value)
                save_settings()
                refreshList()
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
    }
})()
