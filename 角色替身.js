// ==UserScript==
// @name         角色替身
// @homepage     https://bgm.tv/dev/app/5454
// @author       https://bgm.tv/user/air_chika
// @match        *://bgm.tv/subject/*
// @match        *://bangumi.tv/subject/*
// @match        *://chii.in/subject/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict'

    if (!/^\/subject\/\d+\/?$/.test(location.pathname)) return

    const DB_NAME = 'bangumi_va_role_lookup_v1'
    const STORE_NAME = 'store'
    const CACHE_TTL = 12 * 60 * 60 * 1000
    const SUBJECT_TYPES = [1, 2, 4]
    const ROLE_SUBJECT_TYPES = [2, 4]
    const REFRESH_CONFIG_KEY = 'va_role_lookup_refresh_cache'
    const IMPORTANT_ROLES_CONFIG_KEY = 'va_role_lookup_important_roles_v1'
    const IMPORTANT_ROLES_LOCAL_KEY = 'bangumi_va_role_lookup_important_roles_v1'
    const NO_IMAGE = 'https://bgm.tv/img/info_only.png'
    const ANIME_PRODUCTION_GROUPS = [{
        id: 'animation',
        label: '动画制作',
        keywords: ['动画制作', 'アニメーション制作', 'アニメ制作'],
    }, {
        id: 'original',
        label: '原作',
        keywords: ['原作'],
    }, {
        id: 'director',
        label: '导演',
        keywords: ['导演', '監督'],
        exclude: ['副导演', '副監督', '副监督'],
    }, {
        id: 'script',
        label: '脚本',
        keywords: ['脚本', '脚本協力', '系列构成', 'シリーズ構成'],
    }, {
        id: 'storyboard',
        label: '分镜',
        keywords: ['分镜', '絵コンテ'],
    }, {
        id: 'episode-direction',
        label: '演出',
        keywords: ['演出'],
    }]
    const GAME_PRODUCTION_GROUPS = [{
        id: 'developer',
        label: '开发',
        keywords: ['开发', '開發', '开发商', '开发公司', '開発', 'Developer', 'developer', 'development'],
    }]
    const BOOK_PRODUCTION_GROUPS = [{
        id: 'author',
        label: '作者',
        keywords: ['作者', '著者'],
    }, {
        id: 'illustration',
        label: '插图',
        keywords: ['插图', '插圖', '插画', '插畫', 'イラスト'],
    }]
    const state = {
        subject_id: Number(location.pathname.match(/^\/subject\/(\d+)/)?.[1] || 0),
        subject_type: 0,
        mode: 'voice',
        collection_promise: null,
        collection_loaded_at: 0,
        collection_index: null,
        actor_results: new Map(),
        actor_loaded_at: new Map(),
        production_people_promise: null,
        production_results: new Map(),
        production_loaded_at: new Map(),
        role_actor_names: new Map(),
        role_actor_names_complete: new Set(),
        selected_actor_id: '',
        selected_character_id: '',
        selected_production_key: '',
        request_serial: 0,
        refresh_value: 'idle',
        status_text: '',
        important_roles: { version: 1, actors: {} },
        important_roles_loaded: false,
        current_character_actors: new Map(),
        actor_by_id: new Map(),
        current_panel: null,
    }

    function pr(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
    }

    async function open_db() {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
        }
        return pr(req)
    }

    const cache = {
        async get(key) {
            const db = await open_db()
            try {
                const value = await pr(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key))
                if (!value || typeof value.updatedAt !== 'number') return null
                if (Date.now() - value.updatedAt > CACHE_TTL) return null
                return value.data
            } finally {
                db.close()
            }
        },

        async set(key, data) {
            const db = await open_db()
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite')
                transaction.objectStore(STORE_NAME).put({ updatedAt: Date.now(), data }, key)
                transaction.oncomplete = () => { db.close(); resolve() }
                transaction.onerror = () => { db.close(); reject(transaction.error) }
                transaction.onabort = () => { db.close(); reject(transaction.error || new Error('缓存写入已中止')) }
            })
        },

        async delete_prefix(prefix) {
            const db = await open_db()
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite')
                const store = transaction.objectStore(STORE_NAME)
                const request = store.openCursor()
                request.onsuccess = event => {
                    const cursor = event.target.result
                    if (!cursor) return
                    if (String(cursor.key).startsWith(prefix)) cursor.delete()
                    cursor.continue()
                }
                transaction.oncomplete = () => { db.close(); resolve() }
                transaction.onerror = () => { db.close(); reject(transaction.error) }
                transaction.onabort = () => { db.close(); reject(transaction.error || new Error('缓存清理已中止')) }
            })
        },
    }

    function get_username() {
        const from_href = href => {
            if (!href) return ''
            try {
                const match = new URL(href, location.origin).pathname.match(/^\/user\/([^/]+)\/?$/)
                const username = match ? decodeURIComponent(match[1]) : ''
                return /^[A-Za-z0-9_]{1,32}$/.test(username) ? username : ''
            } catch (error) {
                return ''
            }
        }

        try {
            if (typeof window.CHOBITS_USERNAME === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(window.CHOBITS_USERNAME)) {
                return window.CHOBITS_USERNAME
            }
            if (typeof CHOBITS_USERNAME === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(CHOBITS_USERNAME)) {
                return CHOBITS_USERNAME
            }
        } catch (error) {
            /* 旧页面可能没有注入 CHOBITS_USERNAME */
        }

        for (const link of document.querySelectorAll('#dock a[href*="/user/"], #badgeUserPanel a[href*="/user/"]')) {
            const username = from_href(link.getAttribute('href'))
            if (username) return username
        }

        return ''
    }

    function create_element(html) {
        const temp = document.createElement('template')
        temp.innerHTML = html.trim()
        return temp.content.firstElementChild
    }

    function parse_numeric_id(href, type) {
        if (!href) return ''
        try {
            const url = new URL(href, location.origin)
            const match = url.pathname.match(new RegExp(`^/${type}/(\\d+)/?$`))
            return match ? match[1] : ''
        } catch (error) {
            return ''
        }
    }

    function image_from(images) {
        return images?.medium || images?.large || images?.small || images?.grid || ''
    }

    function character_image_from(images) {
        const url = image_from(images)
        return url
            .replace(/\/r\/\d+\/pic\/crt\/[a-z]\//, '/pic/crt/m/')
            .replace(/\/pic\/crt\/[a-z]\//, '/pic/crt/m/')
    }

    function fetch_json(url, options = {}, timeout = 12000) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)
        return fetch(url, { ...options, signal: controller.signal }).then(async response => {
            clearTimeout(timer)
            let data = null
            try { data = await response.json() }
            catch (error) { throw new Error(`响应不是有效 JSON（HTTP ${response.status}）`) }
            if (!response.ok) throw new Error(data?.description || data?.message || `HTTP ${response.status}`)
            return data
        }, error => {
            clearTimeout(timer)
            if (error.name === 'AbortError') throw new Error('请求超时')
            throw error
        })
    }

    function fetch_text(url, options = {}, timeout = 12000) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)
        return fetch(url, { ...options, signal: controller.signal }).then(async response => {
            clearTimeout(timer)
            const text = await response.text()
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return text
        }, error => {
            clearTimeout(timer)
            if (error.name === 'AbortError') throw new Error('请求超时')
            throw error
        })
    }

    function has_cloud_settings() {
        try {
            return typeof chiiApp !== 'undefined' && !!chiiApp?.cloud_settings
        } catch (error) {
            return false
        }
    }

    function normalize_important_roles(value) {
        if (!value) return { version: 1, actors: {} }
        let parsed = value
        if (typeof value === 'string') {
            try {
                parsed = JSON.parse(value)
            } catch (error) {
                return { version: 1, actors: {} }
            }
        }
        if (!parsed || typeof parsed !== 'object') return { version: 1, actors: {} }
        if (!parsed.actors || typeof parsed.actors !== 'object') parsed.actors = {}
        parsed.version = 1
        return parsed
    }

    function load_important_roles() {
        if (state.important_roles_loaded) return state.important_roles
        try {
            state.important_roles = normalize_important_roles(localStorage.getItem(IMPORTANT_ROLES_LOCAL_KEY))
        } catch (error) {
            state.important_roles = { version: 1, actors: {} }
        }
        try {
            if (has_cloud_settings()) {
                const cloud_roles = normalize_important_roles(chiiApp.cloud_settings.get(IMPORTANT_ROLES_CONFIG_KEY))
                state.important_roles = merge_important_roles(state.important_roles, cloud_roles)
                localStorage.setItem(IMPORTANT_ROLES_LOCAL_KEY, JSON.stringify(state.important_roles))
            }
        } catch (error) {
            /* 本地存储仍可用 */
        }
        state.important_roles_loaded = true
        return state.important_roles
    }

    function merge_important_roles(local_roles, cloud_roles) {
        const merged = normalize_important_roles(local_roles)
        const cloud = normalize_important_roles(cloud_roles)
        for (const [actor_id, roles] of Object.entries(cloud.actors)) {
            if (!merged.actors[actor_id] || typeof merged.actors[actor_id] !== 'object') merged.actors[actor_id] = {}
            Object.assign(merged.actors[actor_id], roles)
        }
        return merged
    }

    function save_important_roles() {
        try {
            localStorage.setItem(IMPORTANT_ROLES_LOCAL_KEY, JSON.stringify(state.important_roles))
        } catch (error) {
            set_status(`已标记本地保存失败：${error.message || error}`)
            return false
        }

        if (!has_cloud_settings()) {
            return true
        }
        try {
            chiiApp.cloud_settings.update({ [IMPORTANT_ROLES_CONFIG_KEY]: JSON.stringify(state.important_roles) })
            chiiApp.cloud_settings.save()
        } catch (error) {
            set_status(`已标记保存到本地，云同步失败：${error.message || error}`)
        }
        return true
    }

    function important_actor_roles(actor_id) {
        load_important_roles()
        const key = String(actor_id)
        if (!state.important_roles.actors[key] || typeof state.important_roles.actors[key] !== 'object') {
            state.important_roles.actors[key] = {}
        }
        return state.important_roles.actors[key]
    }

    function is_important_role(actor, role) {
        return !!important_actor_roles(actor.id)[role.key]
    }

    function set_important_role(actor, role, important) {
        const roles = important_actor_roles(actor.id)
        if (important) {
            roles[role.key] = {
                id: Number(role.id),
                name: role.name,
                name_cn: role.name_cn,
                image: role.image,
                updated_at: Date.now(),
            }
        } else {
            delete roles[role.key]
        }
        return save_important_roles()
    }

    async function fetch_all_collections(username, subject_type) {
        const limit = 100
        const base = `https://api.bgm.tv/v0/users/${encodeURIComponent(username)}/collections?subject_type=${subject_type}&limit=${limit}&offset=`
        const first = await fetch_json(base + 0)
        if (!Array.isArray(first.data)) throw new Error('收藏响应格式无效')
        const requests = []
        for (let offset = limit; offset < Number(first.total || 0); offset += limit) {
            requests.push(fetch_json(base + offset).then(page => {
                if (!Array.isArray(page.data)) throw new Error('收藏分页响应格式无效')
                return page.data
            }))
        }
        const pages = await Promise.all(requests)
        return first.data.concat(...pages)
    }

    async function get_collections(force = false) {
        const is_fresh = state.collection_loaded_at && Date.now() - state.collection_loaded_at <= CACHE_TTL
        if (state.collection_promise && !force && (!state.collection_loaded_at || is_fresh)) return state.collection_promise
        state.collection_promise = (async () => {
            const username = get_username()
            if (!username) throw new Error('需要登录后才能读取自己的收藏')

            const all = []
            for (const subject_type of SUBJECT_TYPES) {
                const key = `collections:${username}:subject_type=${subject_type}`
                let collections = force ? null : await cache.get(key)
                if (!collections) {
                    collections = await fetch_all_collections(username, subject_type)
                    await cache.set(key, collections)
                }
                all.push(...collections)
            }

            const index = new Map()
            for (const collection of all) {
                const subject_id = Number(collection.subject_id)
                if (!subject_id || !SUBJECT_TYPES.includes(Number(collection.subject_type))) continue
                index.set(subject_id, collection)
            }
            state.collection_index = index
            state.collection_loaded_at = Date.now()
            return index
        })()
        state.collection_promise.catch(() => {
            state.collection_promise = null
            state.collection_loaded_at = 0
        })
        return state.collection_promise
    }

    async function get_person_characters(person_id, force = false) {
        const key = `person-characters:${person_id}`
        let characters = force ? null : await cache.get(key)
        if (!characters) {
            characters = await fetch_json(`https://api.bgm.tv/v0/persons/${person_id}/characters`)
            if (!Array.isArray(characters)) throw new Error('人物角色响应格式无效')
            await cache.set(key, characters)
        }
        return characters
    }

    async function get_character_detail(character_id, force = false) {
        const key = `character:${character_id}`
        let detail = force ? null : await cache.get(key)
        if (!detail) {
            detail = await fetch_json(`https://api.bgm.tv/v0/characters/${character_id}`)
            if (!detail || Number(detail.id) !== Number(character_id)) throw new Error('角色详情响应格式无效')
            await cache.set(key, detail)
        }
        return detail
    }

    async function get_character_persons(character_id, force = false) {
        const key = `character-persons:${character_id}`
        let persons = force ? null : await cache.get(key)
        if (!persons) {
            persons = await fetch_json(`https://api.bgm.tv/v0/characters/${character_id}/persons`)
            if (!Array.isArray(persons)) throw new Error('角色人物响应格式无效')
            await cache.set(key, persons)
        }
        return persons
    }

    async function get_subject(subject_id, force = false) {
        const key = `subject:${subject_id}`
        let subject = force ? null : await cache.get(key)
        if (!subject) {
            subject = await fetch_json(`https://api.bgm.tv/v0/subjects/${subject_id}`)
            if (!subject || Number(subject.id) !== Number(subject_id)) throw new Error('条目响应格式无效')
            await cache.set(key, subject)
        }
        return subject
    }

    async function get_subject_persons(subject_id, force = false) {
        const key = `subject-persons:${subject_id}`
        let persons = force ? null : await cache.get(key)
        if (!persons) {
            persons = await fetch_json(`https://api.bgm.tv/v0/subjects/${subject_id}/persons`)
            if (!Array.isArray(persons)) throw new Error('条目人物响应格式无效')
            await cache.set(key, persons)
        }
        return persons
    }

    async function get_person_subjects(person_id, force = false) {
        const key = `person-subjects:${person_id}`
        let subjects = force ? null : await cache.get(key)
        if (!subjects) {
            subjects = await fetch_json(`https://api.bgm.tv/v0/persons/${person_id}/subjects`)
            if (!Array.isArray(subjects)) throw new Error('人物条目响应格式无效')
            await cache.set(key, subjects)
        }
        return subjects
    }

    function collection_label(collection) {
        const type = Number(collection?.type)
        const subject_type = Number(collection?.subject_type)
        const book = { 1: '想读', 2: '读过', 3: '在读', 4: '搁置', 5: '抛弃' }
        const anime = { 1: '想看', 2: '看过', 3: '在看', 4: '搁置', 5: '抛弃' }
        const game = { 1: '想玩', 2: '玩过', 3: '在玩', 4: '搁置', 5: '抛弃' }
        const labels = subject_type === 1 ? book : subject_type === 4 ? game : anime
        return labels[type] || '已收藏'
    }

    function collection_order(collection) {
        const order = { 3: 0, 2: 1, 1: 2, 4: 3, 5: 4 }
        return order[Number(collection?.type)] ?? 9
    }

    function relation_matches(relation, group) {
        const text = String(relation || '').trim()
        if (!text) return false
        const tokens = text.split(/[、，,／/・＆&]+/).map(token => token.trim()).filter(Boolean)
        const values = tokens.length ? tokens : [text]
        if (group.exclude?.some(keyword => values.includes(keyword))) return false
        return group.keywords.some(keyword => values.includes(keyword))
    }

    function production_groups_for_subject_type(subject_type = state.subject_type) {
        if (Number(subject_type) === 1) return BOOK_PRODUCTION_GROUPS
        if (Number(subject_type) === 4) return GAME_PRODUCTION_GROUPS
        return ANIME_PRODUCTION_GROUPS
    }

    function production_labels_for_relation(relation) {
        const labels = []
        for (const group of production_groups_for_subject_type()) {
            if (relation_matches(relation, group)) labels.push(group.label)
        }
        return labels
    }

    function role_key(role) {
        return String(Number(role.id))
    }

    function normalize_role(role, collection, actor) {
        return {
            id: Number(role.id),
            name: String(role.name || ''),
            name_cn: String(role.name_cn || ''),
            image: character_image_from(role.images),
            subject_id: Number(role.subject_id),
            subject_type: Number(role.subject_type),
            subject_name: String(role.subject_name || ''),
            subject_name_cn: String(role.subject_name_cn || ''),
            collection,
            actor_id: actor.id,
            actor_name: actor.name,
            key: role_key(role),
            works: [],
            actor_names: [],
        }
    }

    async function load_actor_roles(actor, force = false) {
        const loaded_at = Number(state.actor_loaded_at.get(actor.id) || 0)
        if (state.actor_results.has(actor.id) && !force && Date.now() - loaded_at <= CACHE_TTL) return state.actor_results.get(actor.id)
        const [collection_index, characters] = await Promise.all([
            get_collections(force),
            get_person_characters(actor.id, force),
        ])
        const seen = new Set()
        const roles = []
        const candidates = []
        for (const role of characters) {
            const subject_id = Number(role.subject_id)
            const subject_type = Number(role.subject_type)
            if (!ROLE_SUBJECT_TYPES.includes(subject_type) || !collection_index.has(subject_id)) continue
            candidates.push(normalize_role(role, collection_index.get(subject_id), actor))
        }
        candidates.sort((a, b) => {
            const selected_character_id = String(state.selected_character_id || '')
            const a_selected = selected_character_id && String(a.id) === selected_character_id ? 0 : 1
            const b_selected = selected_character_id && String(b.id) === selected_character_id ? 0 : 1
            if (a_selected !== b_selected) return a_selected - b_selected
            const a_current = actor.current_character_ids?.has(String(a.id)) ? 0 : 1
            const b_current = actor.current_character_ids?.has(String(b.id)) ? 0 : 1
            if (a_current !== b_current) return a_current - b_current
            const state_diff = collection_order(a.collection) - collection_order(b.collection)
            if (state_diff) return state_diff
            if (b.subject_id !== a.subject_id) return b.subject_id - a.subject_id
            return a.id - b.id
        })
        for (const role of candidates) {
            if (!seen.has(role.id)) {
                seen.add(role.id)
                role.works = collect_role_works(role.id, candidates)
                role.actor_names = [actor.name]
                roles.push(role)
            }
        }

        clear_actor_role_names(actor.id)
        state.actor_results.set(actor.id, roles)
        state.actor_loaded_at.set(actor.id, Date.now())
        for (const role of roles) {
            if (!state.role_actor_names.has(role.key)) state.role_actor_names.set(role.key, new Map())
            state.role_actor_names.get(role.key).set(actor.id, actor.name)
            role.actor_names = actor_names_for_role(role)
        }
        return roles
    }

    function actor_names_for_role(role) {
        return [...(state.role_actor_names.get(role.key)?.values() || [])]
    }

    function role_actor_label(role) {
        const names = role.actor_names?.length ? role.actor_names : actor_names_for_role(role)
        return names.length ? names.join(' / ') : '暂无'
    }

    function cache_full_role_actor_names(role, persons) {
        const names = new Map()
        const seen = new Set()
        for (const person of persons) {
            const name = String(person?.name || '').trim()
            if (!name || seen.has(name)) continue
            seen.add(name)
            names.set(String(person?.id || name), name)
        }
        if (names.size) state.role_actor_names.set(role.key, names)
        state.role_actor_names_complete.add(role.key)
        return names.size ? [...names.values()] : actor_names_for_role(role)
    }

    function build_role_title(role) {
        const works = role.works?.length ? role.works.map(work => work.name).join(' / ') : '暂无'
        return [
            `日语名：${display_origin_name(role)}`,
            `声优：${role_actor_label(role)}`,
            `出演作品：${works}`,
        ].join('\n')
    }

    async function hydrate_role_actor_names(role, card) {
        if (state.role_actor_names_complete.has(role.key)) {
            role.actor_names = actor_names_for_role(role)
            role.actor_names_loaded = true
            card.title = build_role_title(role)
            return
        }
        try {
            const persons = await get_character_persons(role.id)
            role.actor_names = cache_full_role_actor_names(role, persons)
            role.actor_names_loaded = true
            card.title = build_role_title(role)
        } catch (error) {
            role.actor_names = actor_names_for_role(role)
            card.title = build_role_title(role)
        }
    }

    function collect_role_works(character_id, candidates) {
        const seen_subjects = new Set()
        const works = []
        for (const role of candidates) {
            if (role.id !== character_id || seen_subjects.has(role.subject_id)) continue
            seen_subjects.add(role.subject_id)
            works.push({
                subject_id: role.subject_id,
                name: role.subject_name_cn || role.subject_name || `条目 ${role.subject_id}`,
            })
            if (works.length >= 3) break
        }
        return works
    }

    function extract_cn_name(detail) {
        if (typeof detail?.name_cn === 'string' && detail.name_cn.trim()) return detail.name_cn.trim()
        if (!Array.isArray(detail?.infobox)) return ''
        const keys = new Set(['简体中文名', '中文名', '中文', '别名'])
        for (const item of detail.infobox) {
            if (!keys.has(String(item?.key || '').trim())) continue
            if (typeof item.value === 'string' && item.value.trim()) return item.value.trim()
            if (Array.isArray(item.value)) {
                const value = item.value.find(entry => typeof entry?.v === 'string' && entry.v.trim())?.v
                if (value) return value.trim()
            }
        }
        return ''
    }

    async function hydrate_cn_names(roles) {
        const missing = roles.filter(role => !role.name_cn)
        if (!missing.length) return
        const details = await Promise.allSettled([...new Set(missing.map(role => role.id))].map(id => get_character_detail(id)))
        const cn_by_id = new Map()
        for (const result of details) {
            if (result.status !== 'fulfilled') continue
            const cn_name = extract_cn_name(result.value)
            if (cn_name) cn_by_id.set(Number(result.value.id), cn_name)
        }
        for (const role of roles) {
            if (cn_by_id.has(role.id)) role.name_cn = cn_by_id.get(role.id)
        }
    }

    function display_cn_name(role) {
        return role.name_cn || role.name || `角色 ${role.id}`
    }

    function display_origin_name(role) {
        return role.name || role.name_cn || `角色 ${role.id}`
    }

    function find_character_section(root = document) {
        const sections = [...root.querySelectorAll('.subject_section')]
        return sections.find(section => section.querySelector('h2.subtitle')?.textContent?.trim().includes('角色介绍'))
            || root.querySelector('#browserItemList')?.closest('.subject_section')
    }

    function find_subject_panel_host() {
        return find_character_section()
            || document.querySelector('#panelInterestWrapper')?.closest('.subject_section')
            || document.querySelector('#columnSubjectHomeB .subject_section')
            || document.querySelector('#columnSubjectHomeB')
            || document.querySelector('#columnSubjectHomeA')
            || document.querySelector('#main')
            || document.body
    }

    function read_actors(section) {
        const actors = []
        const characters = []
        const by_id = new Map()
        const character_by_id = new Map()
        const current_character_actors = new Map()
        for (const li of section.querySelectorAll('.item')) {
            const character_link = li.querySelector('a[href*="/character/"].title, p.title a[href*="/character/"], h2 > a[href*="/character/"]')
            const current_character_id = parse_numeric_id(character_link?.getAttribute('href'), 'character')
            if (!current_character_id) continue
            const thumb = li.querySelector('a.thumbTip[href*="/character/"]')
            const cn_tip = li.querySelector('h2 .tip')
            const character = character_by_id.get(current_character_id) || {
                id: current_character_id,
                name: character_link?.textContent?.trim() || `角色 ${current_character_id}`,
                name_cn: thumb?.getAttribute('data-original-title')?.trim()
                    || thumb?.getAttribute('title')?.trim()
                    || cn_tip?.textContent?.trim()
                    || character_link?.textContent?.trim()
                    || `角色 ${current_character_id}`,
                actors: [],
            }
            character_by_id.set(current_character_id, character)
            if (!characters.includes(character)) characters.push(character)

            for (const link of li.querySelectorAll('p.badge_actor a[href*="/person/"], .actorBadge p a[href*="/person/"]')) {
                const id = parse_numeric_id(link.getAttribute('href'), 'person')
                if (!id) continue
                const actor = by_id.get(id) || {
                    id,
                    name: link.textContent.trim() || `person/${id}`,
                    href: `/person/${id}`,
                    current_character_ids: new Set(),
                }
                actor.current_character_ids.add(current_character_id)
                if (!character.actors.some(item => item.id === actor.id)) character.actors.push(actor)
                if (!current_character_actors.has(current_character_id)) current_character_actors.set(current_character_id, new Map())
                current_character_actors.get(current_character_id).set(id, actor.name)
                if (!by_id.has(id)) {
                    by_id.set(id, actor)
                    actors.push(actor)
                }
            }
        }
        return { actors, characters, current_character_actors }
    }

    async function read_full_subject_characters() {
        const html = await fetch_text(`/subject/${state.subject_id}/characters`)
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const section = doc.querySelector('#browserItemList') || find_character_section(doc) || doc
        const result = read_actors(section)
        if (!result.characters.length) throw new Error('完整角色页没有找到角色')
        return result
    }

    async function read_subject_characters(character_section) {
        const current = character_section
            ? read_actors(character_section)
            : { actors: [], characters: [], current_character_actors: new Map() }
        if (state.subject_type === 1) return current
        try {
            const full = await read_full_subject_characters()
            return full.characters.length >= current.characters.length ? full : current
        } catch (error) {
            console.warn('[角色替身] 完整角色列表加载失败，使用当前页面角色', error)
            return current
        }
    }

    function set_status(text) {
        state.status_text = text
        const node = document.querySelector('.va-role-lookup-status')
        if (node) node.textContent = text
    }

    function render_role_cards(container, roles, options = {}) {
        container.textContent = ''
        if (!roles.length) {
            container.append(create_element('<div class="va-role-lookup-empty">自己的动画/游戏收藏中没有找到该声优配过的角色。</div>'))
            return
        }

        const grid = create_element('<div class="va-role-lookup-grid"></div>')
        for (const role of roles) {
            const card = document.createElement('a')
            card.className = 'va-role-lookup-card'
            card.href = `/character/${role.id}`
            card.title = build_role_title(role)

            const avatar = document.createElement('span')
            avatar.className = 'va-role-lookup-avatar avatarNeue avatarCoverPortrait avatarTop'
            avatar.style.backgroundImage = `url("${role.image || NO_IMAGE}")`

            const name = document.createElement('span')
            name.className = 'va-role-lookup-role-name'
            name.textContent = display_cn_name(role)

            card.addEventListener('mouseenter', () => hydrate_role_actor_names(role, card), { once: true })
            card.addEventListener('focus', () => hydrate_role_actor_names(role, card), { once: true })

            card.append(avatar, name)
            if (options.action === 'toggle-important' && options.actor) {
                const important = options.importantSet?.has(role.key)
                const button = document.createElement('button')
                button.type = 'button'
                button.className = 'va-role-lookup-important-toggle'
                button.dataset.action = important ? 'remove' : 'add'
                button.textContent = important ? '-' : '+'
                button.title = important ? '移出已标记' : '加入已标记'
                button.addEventListener('click', event => {
                    event.preventDefault()
                    event.stopPropagation()
                    options.onToggle?.(role, !important)
                })
                card.append(button)
            }
            grid.append(card)
        }
        container.append(grid)
    }

    function render_actor_role_groups(container, actor, roles) {
        load_important_roles()
        const important_map = important_actor_roles(actor.id)
        const important_set = new Set(Object.keys(important_map))
        const important_roles = roles.filter(role => important_set.has(role.key))
        const existing_details = container.querySelector('.va-role-lookup-role-details')
        const preserve_open = existing_details ? existing_details.open : null

        container.textContent = ''

        const important_section = document.createElement('section')
        important_section.className = 'va-role-lookup-role-group'
        const important_title = document.createElement('h4')
        important_title.className = 'va-role-lookup-role-group-title'
        important_title.textContent = '已标记'
        const important_body = document.createElement('div')
        important_body.className = 'va-role-lookup-role-group-body'
        if (important_roles.length) render_role_cards(important_body, important_roles)
        else important_body.append(create_element('<div class="va-role-lookup-empty va-role-lookup-small-empty">还没有已标记角色。</div>'))
        important_section.append(important_title, important_body)

        const all_section = document.createElement('details')
        all_section.className = 'va-role-lookup-role-group va-role-lookup-role-details'
        all_section.open = preserve_open === null ? !important_roles.length : preserve_open
        const all_title = document.createElement('summary')
        all_title.className = 'va-role-lookup-role-group-title'
        all_title.textContent = `所有角色（${roles.length}）`
        const all_body = document.createElement('div')
        all_body.className = 'va-role-lookup-role-group-body'
        render_role_cards(all_body, roles, {
            action: 'toggle-important',
            actor,
            importantSet: important_set,
            onToggle: (role, important) => {
                const saved = set_important_role(actor, role, important)
                if (saved) render_actor_role_groups(container, actor, roles)
            },
        })
        all_section.append(all_title, all_body)

        container.append(important_section, all_section)
    }

    async function load_production_people(force = false) {
        if (state.production_people_promise && !force) return state.production_people_promise
        state.production_people_promise = (async () => {
            const persons = await get_subject_persons(state.subject_id, force)
            const grouped = production_groups_for_subject_type().map(group => ({ ...group, people: [] }))
            const seen = new Set()

            for (const person of persons) {
                const person_id = Number(person.id)
                if (!person_id) continue
                const relation = String(person.relation || '')
                for (const group of grouped) {
                    if (!relation_matches(relation, group)) continue
                    const key = `${group.id}:${person_id}`
                    if (seen.has(key)) continue
                    seen.add(key)
                    group.people.push({
                        key,
                        id: String(person_id),
                        name: String(person.name || `person/${person_id}`),
                        relation,
                        group_id: group.id,
                        group_label: group.label,
                    })
                }
            }
            return grouped
        })()
        state.production_people_promise.catch(() => {
            state.production_people_promise = null
        })
        return state.production_people_promise
    }

    function normalize_subject(subject, collection, person, staff_groups) {
        const staff = String(subject.staff || person.relation || '')
        return {
            id: Number(subject.id),
            name: String(subject.name || ''),
            name_cn: String(subject.name_cn || ''),
            image: subject.image || image_from(subject.images),
            type: Number(subject.type),
            staff,
            staff_groups,
            collection,
        }
    }

    async function load_production_subjects(person, force = false) {
        const loaded_at = Number(state.production_loaded_at.get(person.key) || 0)
        if (state.production_results.has(person.key) && !force && Date.now() - loaded_at <= CACHE_TTL) return state.production_results.get(person.key)
        const [collection_index, subjects] = await Promise.all([
            get_collections(force),
            get_person_subjects(person.id, force),
        ])
        const by_subject = new Map()
        for (const subject of subjects) {
            const subject_id = Number(subject.id)
            const subject_type = Number(subject.type)
            if (!SUBJECT_TYPES.includes(subject_type) || !collection_index.has(subject_id)) continue
            const staff_groups = production_labels_for_relation(subject.staff || person.relation)
            if (!staff_groups.length) continue
            const normalized = normalize_subject(subject, collection_index.get(subject_id), person, staff_groups)
            const existing = by_subject.get(subject_id)
            if (existing) {
                const staffs = new Set([existing.staff, normalized.staff].filter(Boolean))
                existing.staff = [...staffs].join(' / ')
                existing.staff_groups = [...new Set([...existing.staff_groups, ...normalized.staff_groups])]
            } else {
                by_subject.set(subject_id, normalized)
            }
        }
        const result = [...by_subject.values()]
        result.sort((a, b) => {
            const state_diff = collection_order(a.collection) - collection_order(b.collection)
            if (state_diff) return state_diff
            return b.id - a.id
        })
        state.production_results.set(person.key, result)
        state.production_loaded_at.set(person.key, Date.now())
        return result
    }

    function display_subject_name(subject) {
        return subject.name_cn || subject.name || `条目 ${subject.id}`
    }

    function render_subject_cards(container, subjects) {
        container.textContent = ''
        if (!subjects.length) {
            container.append(create_element('<div class="va-role-lookup-empty">自己的动画/游戏收藏中没有找到该作者参与的条目。</div>'))
            return
        }

        const grid = create_element('<div class="va-role-lookup-grid"></div>')
        for (const subject of subjects) {
            const card = document.createElement('a')
            card.className = 'va-role-lookup-card'
            card.href = `/subject/${subject.id}`
            card.title = [
                `原名：${subject.name || display_subject_name(subject)}`,
                `职位：${subject.staff || '暂无'}`,
                `收藏状态：${collection_label(subject.collection)}`,
            ].join('\n')

            const avatar = document.createElement('span')
            avatar.className = 'va-role-lookup-avatar avatarNeue avatarCoverPortrait avatarTop'
            avatar.style.backgroundImage = `url("${subject.image || NO_IMAGE}")`

            const name = document.createElement('span')
            name.className = 'va-role-lookup-role-name'
            name.textContent = display_subject_name(subject)

            card.append(avatar, name)
            grid.append(card)
        }
        container.append(grid)
    }

    function render_subject_sections(container, subjects) {
        container.textContent = ''
        if (!subjects.length) {
            container.append(create_element('<div class="va-role-lookup-empty">自己的动画/游戏收藏中没有找到该作者参与的条目。</div>'))
            return
        }
        const groups = new Map()
        for (const subject of subjects) {
            for (const key of subject.staff_groups || []) {
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key).push(subject)
            }
        }
        const ordered_groups = [...groups.entries()].sort((a, b) => {
            const production_groups = production_groups_for_subject_type()
            const a_index = production_groups.findIndex(group => group.label === a[0])
            const b_index = production_groups.findIndex(group => group.label === b[0])
            return (a_index < 0 ? 99 : a_index) - (b_index < 0 ? 99 : b_index)
        })
        for (const [staff, items] of ordered_groups) {
            const section = document.createElement('section')
            section.className = 'va-role-lookup-result-section'
            const title = document.createElement('h3')
            title.className = 'va-role-lookup-result-title'
            title.textContent = staff
            const content = document.createElement('div')
            content.className = 'va-role-lookup-section-content'
            render_subject_cards(content, items)
            section.append(title, content)
            container.append(section)
        }
    }

    function set_active_actor(panel, actor_id) {
        for (const button of panel.querySelectorAll('.va-role-lookup-actor')) {
            button.classList.toggle('is-active', button.dataset.actorId === actor_id)
        }
    }

    function set_active_character(panel, character_id) {
        for (const button of panel.querySelectorAll('.va-role-lookup-character')) {
            button.classList.toggle('is-active', button.dataset.characterId === character_id)
        }
    }

    function set_active_production(panel, key) {
        for (const button of panel.querySelectorAll('.va-role-lookup-person')) {
            button.classList.toggle('is-active', button.dataset.personKey === key)
        }
    }

    async function select_actor(panel, actor, force = false) {
        if (!actor?.id) return
        state.selected_actor_id = actor.id
        set_active_actor(panel, actor.id)
        const body = panel.querySelector('.va-role-lookup-result')
        const serial = ++state.request_serial
        body.innerHTML = '<div class="va-role-lookup-loading">加载中...</div>'
        set_status(`正在加载 ${actor.name}`)

        try {
            const roles = await load_actor_roles(actor, force)
            if (serial !== state.request_serial) return
            set_status(`正在加载 ${actor.name} 的中文名`)
            await hydrate_cn_names(roles)
            if (serial !== state.request_serial) return
            render_role_cards(body, roles)
            set_status('')
        } catch (error) {
            if (serial !== state.request_serial) return
            body.textContent = ''
            const error_box = create_element('<div class="va-role-lookup-error"><p></p><button type="button">重试</button></div>')
            error_box.querySelector('p').textContent = error.message || String(error)
            error_box.querySelector('button').addEventListener('click', () => select_actor(panel, actor, true))
            body.append(error_box)
            set_status(`${actor.name} 加载失败`)
        }
    }

    async function select_character(panel, character, force = false) {
        if (!character?.id) return
        state.selected_character_id = character.id
        set_active_character(panel, character.id)
        const body = panel.querySelector('.va-role-lookup-result')
        const serial = ++state.request_serial
        body.textContent = ''
        set_status(`正在加载 ${character.name_cn}`)

        try {
            if (!character.actors.length) {
                body.append(create_element('<div class="va-role-lookup-empty">该角色没有可查询的声优。</div>'))
                set_status('')
                return
            }
            for (const actor of character.actors) {
                const section = document.createElement('section')
                section.className = 'va-role-lookup-result-section'
                const title = document.createElement('h3')
                title.className = 'va-role-lookup-result-title va-role-lookup-actor-title'
                const actor_link = document.createElement('a')
                actor_link.className = 'va-role-lookup-actor-link'
                actor_link.href = actor.href || `/person/${actor.id}`
                actor_link.textContent = actor.name
                actor_link.title = `查看 ${actor.name}`
                title.append(actor_link)
                const content = document.createElement('div')
                content.className = 'va-role-lookup-section-content'
                content.innerHTML = '<div class="va-role-lookup-loading">加载中...</div>'
                section.append(title, content)
                body.append(section)

                const roles = await load_actor_roles(actor, force)
                if (serial !== state.request_serial) return
                await hydrate_cn_names(roles)
                if (serial !== state.request_serial) return
                render_actor_role_groups(content, actor, roles)
            }
            set_status('')
        } catch (error) {
            if (serial !== state.request_serial) return
            body.textContent = ''
            const error_box = create_element('<div class="va-role-lookup-error"><p></p><button type="button">重试</button></div>')
            error_box.querySelector('p').textContent = error.message || String(error)
            error_box.querySelector('button').addEventListener('click', () => select_character(panel, character, true))
            body.append(error_box)
            set_status(`${character.name_cn} 加载失败`)
        }
    }

    async function select_production_person(panel, person, force = false) {
        if (!person?.key) return
        state.selected_production_key = person.key
        set_active_production(panel, person.key)
        const body = panel.querySelector('.va-role-lookup-result')
        const serial = ++state.request_serial
        body.innerHTML = '<div class="va-role-lookup-loading">加载中...</div>'
        set_status(`正在加载 ${person.name}`)

        try {
            const subjects = await load_production_subjects(person, force)
            if (serial !== state.request_serial) return
            render_subject_sections(body, subjects)
            set_status('')
        } catch (error) {
            if (serial !== state.request_serial) return
            body.textContent = ''
            const error_box = create_element('<div class="va-role-lookup-error"><p></p><button type="button">重试</button></div>')
            error_box.querySelector('p').textContent = error.message || String(error)
            error_box.querySelector('button').addEventListener('click', () => select_production_person(panel, person, true))
            body.append(error_box)
            set_status(`${person.name} 加载失败`)
        }
    }

    function render_voice_left(panel, characters) {
        const left = panel.querySelector('.va-role-lookup-left')
        left.classList.remove('va-role-lookup-production-left')
        left.textContent = ''
        for (const character of characters) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'va-role-lookup-character'
            button.dataset.characterId = character.id
            button.textContent = character.name_cn
            button.addEventListener('click', () => select_character(panel, character))
            left.append(button)
        }
        return characters[0] || null
    }

    async function render_production_left(panel, force = false) {
        const left = panel.querySelector('.va-role-lookup-left')
        left.classList.add('va-role-lookup-production-left')
        left.innerHTML = '<div class="va-role-lookup-loading">加载中...</div>'
        set_status('正在加载制作人员')
        try {
            const groups = await load_production_people(force)
            left.textContent = ''
            let first_person = null
            for (const group of groups) {
                for (const person of group.people) {
                    const button = document.createElement('button')
                    button.type = 'button'
                    button.className = 'va-role-lookup-person'
                    button.dataset.personKey = person.key
                    button.title = person.relation
                    button.textContent = `${group.label}: ${person.name}`
                    button.addEventListener('click', () => select_production_person(panel, person))
                    left.append(button)
                    if (!first_person) first_person = person
                }
            }
            set_status('')
            if (first_person) {
                select_production_person(panel, first_person)
            } else {
                left.append(create_element('<div class="va-role-lookup-production-empty">无匹配制作人员</div>'))
                panel.querySelector('.va-role-lookup-result').innerHTML = '<div class="va-role-lookup-empty">没有找到可查询的制作人员。</div>'
            }
        } catch (error) {
            left.textContent = ''
            const error_box = create_element('<div class="va-role-lookup-error"><p></p><button type="button">重试</button></div>')
            error_box.querySelector('p').textContent = error.message || String(error)
            error_box.querySelector('button').addEventListener('click', () => render_production_left(panel, true))
            left.append(error_box)
            set_status('制作人员加载失败')
        }
    }

    function set_mode(panel, characters, mode) {
        if (mode === 'voice' && !characters.length) mode = 'production'
        state.mode = mode
        panel.classList.toggle('is-production-mode', mode === 'production')
        panel.closest('.va-role-lookup-host')?.querySelectorAll('.va-role-lookup-mode').forEach(button => {
            button.classList.toggle('is-active', button.dataset.mode === mode)
        })
        panel.querySelector('.va-role-lookup-result').innerHTML = mode === 'voice'
            ? '<div class="va-role-lookup-hint">点击左侧角色后开始加载。</div>'
            : '<div class="va-role-lookup-hint">点击左侧作者或公司后开始加载。</div>'
        set_status('')
        if (mode === 'voice') {
            const first_character = render_voice_left(panel, characters)
            if (first_character) select_character(panel, first_character)
        } else render_production_left(panel)
    }

    async function refresh_cache(force_status = true) {
        const username = get_username()
        if (!username) {
            set_status('需要登录后才能刷新角色替身缓存')
            return
        }
        if (force_status) set_status('正在刷新角色替身缓存...')
        state.collection_promise = null
        state.collection_loaded_at = 0
        state.collection_index = null
        state.actor_results.clear()
        state.actor_loaded_at.clear()
        state.production_people_promise = null
        state.production_results.clear()
        state.production_loaded_at.clear()
        state.role_actor_names.clear()
        state.role_actor_names_complete.clear()
        seed_current_character_actor_names(state.current_character_actors)
        await get_collections(true)
        await cache.delete_prefix('person-characters:')
        await cache.delete_prefix('character:')
        await cache.delete_prefix('character-persons:')
        await cache.delete_prefix('subject-persons:')
        await cache.delete_prefix('person-subjects:')
        if (force_status) set_status('角色替身缓存已刷新')
    }

    function clear_actor_role_names(actor_id) {
        for (const [key, actors] of state.role_actor_names) {
            if (state.role_actor_names_complete.has(key)) continue
            actors.delete(actor_id)
            if (!actors.size) state.role_actor_names.delete(key)
        }
    }

    function seed_current_character_actor_names(current_character_actors) {
        for (const [character_id, actors] of current_character_actors) {
            if (actors.size > 1) state.role_actor_names.set(String(Number(character_id)), new Map(actors))
        }
    }

    function register_settings() {
        let attempts = 0
        const try_register = () => {
            if (typeof chiiLib !== 'undefined' && chiiLib?.ukagaka?.addGeneralConfig) {
                chiiLib.ukagaka.addGeneralConfig({
                    title: '角色替身缓存',
                    name: REFRESH_CONFIG_KEY,
                    type: 'radio',
                    defaultValue: 'idle',
                    getCurrentValue: () => state.refresh_value,
                    onChange: value => {
                        state.refresh_value = value
                        if (value !== 'refresh') return
                        refresh_cache().catch(error => {
                            set_status(`角色替身缓存刷新失败：${error.message || error}`)
                        }).finally(() => {
                            state.refresh_value = 'idle'
                            try {
                                if (typeof chiiApp !== 'undefined' && chiiApp?.cloud_settings) {
                                    chiiApp.cloud_settings.update({ [REFRESH_CONFIG_KEY]: 'idle' })
                                    chiiApp.cloud_settings.save()
                                }
                            } catch (error) { /* 个性化设置不可用时忽略 */ }
                        })
                    },
                    options: [
                        { value: 'idle', label: '12H过期后刷新' },
                        { value: 'refresh', label: '立即刷新' },
                    ],
                })
            } else if (attempts < 10) {
                attempts++
                setTimeout(try_register, 500)
            }
        }
        try_register()
    }

    function install_styles() {
        if (document.getElementById('va-role-lookup-style')) return
        const style = document.createElement('style')
        style.id = 'va-role-lookup-style'
        style.textContent = `
            .va-role-lookup-toolbar { display:flex; align-items:center; gap:10px; margin:10px 0 8px; }
            .va-role-lookup-toggle { border:1px solid #d8d8d8; border-radius:999px; background:#fff; color:#555; cursor:pointer; padding:5px 12px; line-height:1.2; }
            .va-role-lookup-toggle:hover { color:#000; border-color:#aaa; }
            .va-role-lookup-toggle.is-active { color:#c45; border-color:#e6a9ba; background:rgba(255,128,160,.14); }
            .va-role-lookup-status { color:#888; font-size:12px; }
            .va-role-lookup-panel { display:none; grid-template-columns:minmax(120px, 170px) minmax(0, 1fr); gap:12px; margin:8px 0 12px; padding:10px; border:1px solid #ddd; border-radius:6px; background:rgba(255,255,255,.72); box-sizing:border-box; }
            .va-role-lookup-panel.is-open { display:grid; }
            .va-role-lookup-panel.is-production-mode { grid-template-columns:minmax(180px, 240px) minmax(0, 1fr); }
            .va-role-lookup-left { display:flex; flex-direction:column; gap:4px; max-height:360px; overflow:auto; padding-right:4px; border-right:1px solid #e5e5e5; }
            .va-role-lookup-actor, .va-role-lookup-character, .va-role-lookup-person { width:100%; border:0; border-radius:999px; background:transparent; cursor:pointer; color:#555; text-align:left; padding:6px 9px; line-height:1.25; }
            .va-role-lookup-actor:hover, .va-role-lookup-actor:focus, .va-role-lookup-actor.is-active, .va-role-lookup-character:hover, .va-role-lookup-character:focus, .va-role-lookup-character.is-active, .va-role-lookup-person:hover, .va-role-lookup-person:focus, .va-role-lookup-person.is-active { background:rgba(255,128,160,.14); color:#c45; outline:none; }
            .va-role-lookup-production-left { display:flex; flex-direction:column; gap:10px; align-content:start; }
            .va-role-lookup-production-group { min-width:0; display:flex; flex-direction:column; gap:4px; }
            .va-role-lookup-production-title { display:block; color:#555; font-weight:700; padding:0 9px 2px; }
            .va-role-lookup-production-empty { color:#aaa; padding:5px 9px; }
            .va-role-lookup-right { min-width:0; max-height:360px; overflow:auto; padding-left:6px; box-sizing:border-box; }
            .va-role-lookup-hint, .va-role-lookup-empty, .va-role-lookup-loading, .va-role-lookup-error { min-height:88px; display:flex; align-items:center; justify-content:center; color:#888; text-align:center; }
            .va-role-lookup-error { flex-direction:column; gap:8px; }
            .va-role-lookup-error p { margin:0; }
            .va-role-lookup-error button { cursor:pointer; padding:4px 12px; border-radius:999px; }
            .va-role-lookup-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(82px, 1fr)); gap:10px 8px; }
            .va-role-lookup-result-section { margin-bottom:14px; }
            .va-role-lookup-result-section:last-child { margin-bottom:0; }
            .va-role-lookup-result-title { margin:0 0 8px; padding-bottom:4px; border-bottom:1px solid rgba(127,127,127,.24); color:#555; font-size:13px; line-height:1.3; }
            .va-role-lookup-actor-title { position:sticky; top:0; z-index:2; display:block; box-sizing:border-box; padding:6px 0 8px; border:0; background:rgba(255,255,255,.96); color:#c45; font-weight:700; overflow:hidden; white-space:nowrap; }
            .va-role-lookup-actor-link { display:block; width:max-content; max-width:100%; box-sizing:border-box; padding:6px 12px; border-radius:999px; background:rgba(255,128,160,.9); color:inherit; font-size:13px; line-height:1.3; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .va-role-lookup-actor-link:hover, .va-role-lookup-actor-link:focus { background:rgba(255,128,160,1); color:#fff; outline:none; }
            .va-role-lookup-role-group { margin:0 0 12px; }
            .va-role-lookup-role-group:last-child { margin-bottom:0; }
            .va-role-lookup-role-group-title { margin:0 0 8px; color:#666; font-size:12px; font-weight:700; line-height:1.3; cursor:default; }
            .va-role-lookup-role-details > .va-role-lookup-role-group-title { cursor:pointer; }
            .va-role-lookup-role-group-body { min-width:0; }
            .va-role-lookup-small-empty { min-height:40px; justify-content:flex-start; }
            .va-role-lookup-card { position:relative; display:flex; flex-direction:column; gap:4px; min-width:0; text-decoration:none; color:inherit; }
            .va-role-lookup-card:hover .va-role-lookup-role-name { color:#c45; }
            .va-role-lookup-important-toggle { position:absolute; top:0; right:0; width:28px; height:28px; border:1px solid rgba(0,0,0,.2); border-radius:999px; background:rgba(255,255,255,.94); cursor:pointer; font-size:21px; line-height:24px; font-weight:700; padding:0; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,.2); }
            .va-role-lookup-important-toggle[data-action="add"] { color:#d64a76; border-color:rgba(214,74,118,.55); }
            .va-role-lookup-important-toggle[data-action="remove"] { color:#3478d4; border-color:rgba(52,120,212,.55); }
            .va-role-lookup-important-toggle:hover { background:#fff; }
            .va-role-lookup-avatar { display:block; width:72px; height:96px; margin:0 auto; border-radius:3px; box-shadow:0 1px 3px rgba(0,0,0,.16); image-rendering:auto !important; }
            .va-role-lookup-role-name { display:block; min-height:2.4em; color:#555; font-size:12px; line-height:1.2; text-align:center; word-break:break-word; overflow:hidden; }
            html[data-theme=dark] .va-role-lookup-toggle { background:#333; color:#ddd; border-color:#555; }
            html[data-theme=dark] .va-role-lookup-panel { background:rgba(42,42,42,.82); border-color:#555; }
            html[data-theme=dark] .va-role-lookup-left { border-right-color:#555; }
            html[data-theme=dark] .va-role-lookup-actor, html[data-theme=dark] .va-role-lookup-character, html[data-theme=dark] .va-role-lookup-person, html[data-theme=dark] .va-role-lookup-production-title, html[data-theme=dark] .va-role-lookup-result-title, html[data-theme=dark] .va-role-lookup-role-group-title { color:#ddd; }
            html[data-theme=dark] .va-role-lookup-actor-title { background:rgba(42,42,42,.96); color:#ff9ab3; }
            html[data-theme=dark] .va-role-lookup-actor-link { background:rgba(255,128,160,.18); }
            html[data-theme=dark] .va-role-lookup-actor-link:hover, html[data-theme=dark] .va-role-lookup-actor-link:focus { background:rgba(255,128,160,.32); color:#fff; }
            html[data-theme=dark] .va-role-lookup-role-name { color:#ddd; }
            html[data-theme=dark] .va-role-lookup-important-toggle { background:rgba(42,42,42,.92); border-color:#666; }
            html[data-theme=dark] .va-role-lookup-important-toggle[data-action="add"] { color:#ff9ab3; }
            html[data-theme=dark] .va-role-lookup-important-toggle[data-action="remove"] { color:#7eb0ff; }
            @media (max-width: 640px) {
                .va-role-lookup-panel { grid-template-columns:1fr; }
                .va-role-lookup-panel.is-production-mode { grid-template-columns:1fr; }
                .va-role-lookup-left { max-height:140px; border-right:0; border-bottom:1px solid #e5e5e5; padding-right:0; padding-bottom:8px; }
                .va-role-lookup-production-left { display:flex; flex-direction:column; }
                .va-role-lookup-right { max-height:420px; padding-left:0; }
                .va-role-lookup-grid { grid-template-columns:repeat(auto-fill, minmax(82px, 1fr)); }
            }
        `
        document.head.append(style)
    }

    function install_panel(section, characters) {
        if (section.dataset.vaRoleLookupInstalled === '1') return
        section.dataset.vaRoleLookupInstalled = '1'
        const has_voice_mode = !!characters.length && state.subject_type !== 1

        const host = create_element('<div class="va-role-lookup-host"></div>')
        const toolbar = create_element(`
            <div class="va-role-lookup-toolbar">
                ${has_voice_mode ? '<button type="button" class="va-role-lookup-toggle va-role-lookup-mode" data-mode="voice" aria-expanded="false">角色替身</button>' : ''}
                <button type="button" class="va-role-lookup-toggle va-role-lookup-mode" data-mode="production" aria-expanded="false">制作替身</button>
                <span class="va-role-lookup-status"></span>
            </div>
        `)
        const panel = create_element(`
            <div class="va-role-lookup-panel" aria-label="角色替身面板">
                <div class="va-role-lookup-left"></div>
                <div class="va-role-lookup-right">
                    <div class="va-role-lookup-result"><div class="va-role-lookup-hint">点击左侧角色后开始加载。</div></div>
                </div>
            </div>
        `)

        if (has_voice_mode) render_voice_left(panel, characters)
        state.current_panel = panel

        toolbar.querySelectorAll('.va-role-lookup-mode').forEach(button => {
            button.addEventListener('click', event => {
                const next_mode = event.currentTarget.dataset.mode
                const switching_mode = state.mode !== next_mode
                const open = switching_mode || !panel.classList.contains('is-open')
                panel.classList.toggle('is-open', open)
                toolbar.querySelectorAll('.va-role-lookup-mode').forEach(mode_button => {
                    mode_button.setAttribute('aria-expanded', String(open && mode_button === event.currentTarget))
                    if (!open) mode_button.classList.remove('is-active')
                })
                if (open) set_mode(panel, characters, next_mode)
            })
        })
        const more = section.querySelector(':scope > a.more')
        host.append(toolbar, panel)
        if (more) more.before(host)
        else if (section === document.body) document.body.prepend(host)
        else section.append(host)
        set_status(state.status_text)
    }

    async function init() {
        try {
            const subject = await get_subject(state.subject_id)
            state.subject_type = Number(subject.type)
        } catch (error) {
            state.subject_type = 0
        }
        const character_section = find_character_section()
        const section = character_section || find_subject_panel_host()
        if (!section) return
        const { actors, characters, current_character_actors } = await read_subject_characters(character_section)
        if (state.subject_type === 1) {
            actors.length = 0
            characters.length = 0
        }
        if (!characters.length && ![1, 4].includes(state.subject_type)) return
        for (const actor of actors) state.actor_by_id.set(actor.id, actor)
        state.current_character_actors = current_character_actors
        seed_current_character_actor_names(current_character_actors)
        install_styles()
        install_panel(section, characters)
        register_settings()
    }

    init().catch(error => {
        console.error('[角色替身] 初始化失败', error)
    })
})()
