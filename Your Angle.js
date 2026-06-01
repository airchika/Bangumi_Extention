// ==UserScript==
// @homepage     https://bangumi.tv/dev/app/5445
// @author       https://bangumi.tv/user/air_chika
// @match        *://bgm.tv/user/*
// @match        *://bangumi.tv/user/*
// @match        *://chii.in/user/*
// ==/UserScript==
(function () {

    const 开发中 = true
    const 好友可选 = true

    const type_user = {
        "avatar": {
            "large": "https://lain.bgm.tv/pic/user/l/001/06/36/1063632_1F333.jpg?r=1767075045&hd=1",
            "medium": "https://lain.bgm.tv/r/200/pic/user/l/001/06/36/1063632_1F333.jpg?r=1767075045&hd=1",
            "small": "https://lain.bgm.tv/r/100/pic/user/l/001/06/36/1063632_1F333.jpg?r=1767075045&hd=1"
        },
        "sign": "にがさん‼",
        "url": "https://bgm.tv/user/air_chika",
        "username": "air_chika",
        "nickname": "AIR-chika",
        "id": 1063632,
        "user_group": 10
    }
    /** @typedef {typeof type_user} User */


    const subject_config = {
        1: { name: "书籍", id: 1 },
        2: { name: "动画", id: 2 },
        3: { name: "音乐", id: 3 },
        4: { name: "游戏", id: 4 },
        6: { name: "三次元", id: 6 },
    };


    const analyze_config = {
        cur_subject: subject_config[2].name,
        cur_subject_id: 2,
        low_mean: 0,
        mid_mean: 0.5,
        high_mean: 1,
        low_max: 0.3,
        high_min: 0.7,
        filter_CollType: {
            1: false,  // 想看
            2: false,  // 看过
            3: false,  // 在看
            4: false,  // 搁置
            5: false  // 抛弃
        },
        my_threshold_low: 4,
        my_threshold_high: 7,
        his_threshold_low: 4,
        his_threshold_high: 7,
        settingsPanelOpen: false,
        cachePanelOpen: false,
    }
    const collTypeMap = {
        '1': '想看',
        '2': '看过',
        '3': '在看',
        '4': '搁置',
        '5': '抛弃'
    }

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

    function getSubjectCover(subject) {
        return subject?.images?.small || subject?.images?.grid || subject?.images?.common || ''
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

    /**
     * @typedef {Object} EmoItem
     * @property {number} lv - 表情等级
     * @property {string} descript - 描述文本
     * @property {string} html - HTML 内容
     */
    /** @type {{[key: string]: EmoItem}} */
    const emoMap = {
        colastar:   { lv: 0,  descript: '',               code: '(bmoCAIAsgIgB)' }
        , coladouble: { lv: 0,  descript: '',               code: '(bmoCAIAlgIgB)' }
        , food_hanbao:  { lv: 0,  descript: '',               code: '(bmoCAIAfgIQB)' }
        , food_fantuan: { lv: 0,  descript: '',               code: '(bmoCAIAfgIcB)' }
        , food_shousi:  { lv: 0,  descript: '',               code: '(bmoCAIAfgIYB)' }
        , food_shutiao: { lv: 0,  descript: '',               code: '(bmoCAIAfgIUB)' }
        , freeze:     { lv: 0,  descript: '霜之哀伤',         html: `<img src="/img/smiles/tv_500/bgm_518.gif" class="smile" smileid="518" alt="(bgm518)">` }
        , killed:     { lv: 1,  descript: '幻想杀手',         html: `<img src="/img/smiles/tv/89.gif" smileid="128" class="smile" alt="(bgm112)">` }
        , ques:       { lv: 2,  descript: '',               html: `<img src="/img/smiles/tv_500/bgm_502.png" class="smile" smileid="502" alt="(bgm502)">` }
        , silence:    { lv: 3,  descript: '一方通行',         html: `<img src="/img/smiles/tv_500/bgm_524.png" class="smile" smileid="524" alt="(bgm524)">` }
        , nosense:    { lv: 4,  descript: 'A.T.Field 100%',   html: `<img src="/img/smiles/tv/60.gif" smileid="99" class="smile" alt="(bgm83)">` }
        , mildnosense:{ lv: 5,  descript: '= =',            html: `<img src="/img/smiles/tv/49.gif" smileid="88" class="smile" alt="(bgm72)">` }
        , mildgood:   { lv: 6,  descript: '无口',           html: `<img src="/img/smiles/tv/44.gif" smileid="83" class="smile" alt="(bgm67)">` }
        , mildnice:   { lv: 7,  descript: '玩乐关系',         code: '(bmoCAIASgCWAiwE)' }
        , good:       { lv: 8,  descript: '愉悦',           html: `<img src="/img/smiles/tv/83.gif" smileid="122" class="smile" alt="(bgm106)">` }
        , nice:       { lv: 9,  descript: 'KIRA★KIRA',      code: '(bmoCAIAsgIgB)' }
        , best:       { lv: 10, descript: '',               code: '(bmoCAIASgF6AiwE)' }
        , ultra:      { lv: 11, descript: '君は薔薇より美しい', code: '(bmoCAIAKgCyAiwE)' }
        , starrose:   { lv: 12, descript: '',               code: '(bmoCAIAsgDs)' }
        , loverose:   { lv: 13, descript: '心之壁瓦解',       html: `<img src="/img/smiles/tv_500/bgm_503.png" class="smile" smileid="503" alt="(bgm503)">` }
        , blindrose:  { lv: 14, descript: '',               code: '(bmoCAIAggDs)' }
        , blindheart: { lv: 15, descript: '',               html: `<img src="/img/smiles/tv_vs/bgm_201.png" class="smile" smileid="201" alt="(bgm201)">` }
        , gquuuuuux:  { lv: 16, descript: '',               code: '(bmoCAIAggEGARA)' }
    }

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
    const loveLevel = {
        emoValueSpc: {
            0: "freeze",
            1: "killed",
            2: "ques",
            3: "silence",
            4: "nosense",
            5: "mildnosense",
            6: "mildgood",
            7: "mildnice",
            8: "good",
            9: "nice",
            10: "best",
            11: "ultra",
            12: "starrose",
            13: "loverose",
            14: "blindrose",
            15: "blindheart",
            16: "gquuuuuux",
        },
        //共同的
        collRateSpc: {
            '0.000': 'freeze',
            '0.018': 'killed',
            '0.036': 'ques',
            '0.055': 'silence',
            '0.073': 'nosense',
            '0.091': 'mildnosense',
            '0.109': 'mildgood',
            '0.127': 'mildnice',
            '0.145': 'good',
            '0.164': 'nice',
            '0.182': 'best',
            '0.200': 'ultra',
            '0.360': 'starrose',
            '0.520': 'loverose',
            '0.680': 'blindrose',
            '0.840': 'blindheart',
            '1.000': 'gquuuuuux'
        },
        oneCollRateSpc: {
            '0.000': 'freeze',
            '0.036': 'killed',
            '0.073': 'ques',
            '0.109': 'silence',
            '0.145': 'nosense',
            '0.182': 'mildnosense',
            '0.218': 'mildgood',
            '0.255': 'mildnice',
            '0.291': 'good',
            '0.327': 'nice',
            '0.364': 'best',
            '0.400': 'ultra',
            '0.520': 'starrose',
            '0.640': 'loverose',
            '0.760': 'blindrose',
            '0.880': 'blindheart',
            '1.000': 'gquuuuuux'
        },
        collNumSpc: {
            "0": "freeze",
            "10": "killed",
            "25": "ques",
            "50": "silence",
            "75": "nosense",
            "100": "mildnosense",
            "150": "mildgood",
            "200": "mildnice",
            "300": "good",
            "400": "nice",
            "500": "best",
            "600": "ultra",
            "700": "starrose",
            "800": "loverose",
            "1000": "blindrose",
            "1500": "blindheart",
            "2000": "gquuuuuux",
        },
        rateSpc: {
            "0": "freeze",
            "0.1": "killed",
            "0.15": "ques",
            "0.2": "silence",
            "0.25": "nosense",
            "0.3": "mildnosense",
            "0.35": "mildgood",
            "0.4": "mildnice",
            "0.45": "good",
            "0.5": "nice",
            "0.6": "best",
            "0.7": "ultra",
            "0.75": "starrose",
            "0.8": "loverose",
            "0.85": "blindrose",
            "0.9": "blindheart",
            "1": "gquuuuuux",
        },
        disSpc: {
            '0.000': 'freeze',
            '0.064': 'killed',
            '0.127': 'ques',
            '0.191': 'silence',
            '0.255': 'nosense',
            '0.318': 'mildnosense',
            '0.382': 'mildgood',
            '0.445': 'mildnice',
            '0.509': 'good',
            '0.573': 'nice',
            '0.636': 'best',
            '0.700': 'ultra',
            '0.760': 'starrose',
            '0.820': 'loverose',
            '0.880': 'blindrose',
            '0.940': 'blindheart',
            '1.000': 'gquuuuuux'
        },

    }
    const emoManager = (() => {
        let lastWei = 0
        let lastScore = 0

        function searchEmo_wei(loveSpace, inputRate, weight) {

            function findEmoKey(loveSpace, inputRate) {
                const keys = Object.keys(loveSpace).map(key => key).sort((a, b) => a - b)

                if (isNaN(inputRate)) return loveSpace[keys[0]]
                if (inputRate <= keys[0]) return loveSpace[keys[0]]
                if (inputRate >= keys[keys.length - 1]) return loveSpace[keys[keys.length - 1]]

                // 二分查找
                let left = 0
                let right = keys.length - 1

                while (left <= right) {
                    const mid = Math.floor((left + right) / 2)

                    if (keys[mid] === inputRate) {
                        const res = loveSpace[inputRate.toString()]
                        return res
                    } else if (keys[mid] < inputRate) {
                        left = mid + 1
                    } else {
                        right = mid - 1
                    }
                }
                // 找到最接近的两个值
                const leftKey = keys[right]
                const rightKey = keys[left]
                const leftDiff = Math.abs(inputRate - leftKey)
                const rightDiff = Math.abs(inputRate - rightKey)

                // 返回差值较小的那个
                const res = leftDiff <= rightDiff
                    ? loveSpace[leftKey.toString()]
                    : loveSpace[rightKey.toString()]
                return res
            }
            const reskey = findEmoKey(loveSpace, inputRate)
            const res = emoMap[reskey]
            lastWei += weight
            lastScore += (res.lv === 'max' ? 16 : res.lv) * weight
            return res
        }

        function getLastEmo() {
            const result =
                console.log('综合等级', { 最终权重分: lastScore, 最终权重: lastWei, 综合等级: lastScore / lastWei })
            const res = searchEmo_wei(loveLevel.emoValueSpc, lastScore / lastWei, 0)
            lastScore = lastWei = 0
            return res
        }

        function getAllEmo() {
            let res = ''
            for (const k in emoMap) {
                res = res + `Lv${emoMap[k].lv} ` + k + ' ' + getEmoHtml(emoMap[k]) + '<br>'
            }
            return res
        }

        return { getLastEmo, searchEmo_wei, getAllEmo }
    })()



    // dev
    const type_collection = {
        updated_at: '2025-09-27T16:01:31+08:00',
        comment: '',
        tags: [],
        subject: {
            date: '2025-07-04',
            images: {
                small: 'https://lain.bgm.tv/r/200/pic/cover/l/15/5f/484623_6EWej.jpg',
                grid: 'https://lain.bgm.tv/r/100/pic/cover/l/15/5f/484623_6EWej.jpg',
                large: 'https://lain.bgm.tv/pic/cover/l/15/5f/484623_6EWej.jpg',
                medium: 'https://lain.bgm.tv/r/800/pic/cover/l/15/5f/484623_6EWej.jpg',
                common: 'https://lain.bgm.tv/r/400/pic/cover/l/15/5f/484623_6EWej.jpg',
            },
            name: 'よふかしのうた Season 2',
            name_cn: '彻夜之歌 第二季',
            short_summary:
                '"夜はまだ終わらない"\r\n\r\n吸血鬼になることへの戸惑いを乗り越え、\r\nナズナを“好き”になることを決めたコウと、コウに“惚れさせる”決意をしたナズナ。\r\n「恋」が一体なんなのか、わからないまま二人の夜は加速していく。\r\n\r\n吸血鬼を殺そう',
            tags: [
                { name: '恋爱', count: 825, total_cont: 0 },
                { name: '2025年7月', count: 772, total_cont: 0 },
                { name: '漫画改', count: 713, total_cont: 0 },
                { name: '奇幻', count: 678, total_cont: 0 },
                { name: 'TV', count: 591, total_cont: 0 },
                { name: 'LIDENFILMS', count: 477, total_cont: 0 },
                { name: '2025', count: 341, total_cont: 0 },
                { name: '漫改', count: 282, total_cont: 0 },
                { name: '日本', count: 266, total_cont: 0 },
                { name: '彻夜之歌', count: 244, total_cont: 0 },
            ],
            score: 7.8,
            type: 2,
            id: 484623,
            eps: 12,
            volumes: 0,
            collection_total: 11615,
            rank: 470,
        },
        subject_id: 484623,
        vol_status: 0,
        ep_status: 12,
        subject_type: 2,
        type: 2,
        rate: 9,
        private: false,
    }

    /** @typedef {typeof type_collection} Collection */
    /** @typedef {{ subject: Collection['subject'] my_review: { rate: number comment: string date: Date } his_review: { rate: number comment: string date: Date } }} Review */



    // util
    /** @return {HTMLElement} */
    function create_element(html) {
        const temp = document.createElement('temp')
        temp.innerHTML = html
        return temp.firstElementChild
    }


    const api_cache = (() => {
        /**
         * promisify_request
         * @template Req
         * @param {Req} req
         * @returns {Promise<Req['result']>}
         */
        function pr(req) {
            return new Promise((resolve, reject) => {
                req.onsuccess = () => {
                    resolve(req.result)
                }
                req.onerror = () => {
                    reject(req.error)
                }
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

            /** @param {IDBDatabase} db */
            function create(db) {
                db.createObjectStore(STORE)
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

                    request.onsuccess = () => {
                        db.close()
                        resolve()
                    }

                    request.onerror = (event) => {
                        db.close()
                        reject(event.target.error)
                    }
                })
            }


            async function deleteByKey(key) {
                const db = await open_db()
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(STORE, 'readwrite')
                    const store = transaction.objectStore(STORE)
                    const request = store.delete(key)

                    request.onsuccess = () => {
                        db.close()
                        resolve()
                    }

                    request.onerror = (event) => {
                        db.close()
                        reject(event.target.error)
                    }
                })
            }

            async function deleteUser(user) {
                try {
                    for (const i in subject_config)
                        await deleteByKey(transCollKey(user.username, i));
                    await deleteByKey(transUserKey(user.username))
                } catch (e) {
                    alert(`清空缓存失败: ${e.message}`);
                }
            }

            async function updateUser(username, subject_id) {
                try {
                    for (const i in subject_config)
                        await deleteByKey(transCollKey(username, i));
                    await deleteByKey(transUserKey(username))
                } catch (e) {
                    // ignore delete errors
                }
            }

            async function clear(key) {
                const db = await open_db()
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(STORE, 'readwrite')
                    const store = transaction.objectStore(STORE)
                    const request = store.clear()

                    request.onsuccess = () => {
                        db.close()
                        resolve()
                    }

                    request.onerror = (event) => {
                        db.close()
                        reject(event.target.error)
                    }
                })
            }




            async function clearAll(user) {
                try {
                    if (!confirm(`确定删除全部缓存吗？（然后会重新加载）`)) return
                    await clear()
                } catch (e) {
                    alert(`清空缓存失败: ${e.message}`);
                }
            }


            async function getAllUser() {
                const db = await open_db();
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(STORE, 'readonly');
                    const objectStore = transaction.objectStore(STORE);
                    const request = objectStore.openCursor();
                    const users = [];

                    request.onsuccess = function (event) {
                        const cursor = event.target.result;
                        if (cursor) {
                            const key = cursor.key;
                            // 检查键是否符合用户API的格式，且不是收藏数据
                            if (typeof key === 'string' &&
                                key.startsWith('https://api.bgm.tv/v0/users/') &&
                                !key.includes('?subject_type=') &&
                                isValidUserPayload(cursor.value)) {
                                users.push({
                                    username: key.replace('https://api.bgm.tv/v0/users/', ''),
                                    data: cursor.value
                                });
                            }
                            cursor.continue();
                        } else {
                            db.close();
                            resolve(users);
                        }
                    };

                    request.onerror = function (event) {
                        db.close();
                        reject(event.target.error);
                    };
                });
            }

            function transCollKey(user_id, subject_type) {
                return `https://api.bgm.tv/v0/users/${user_id}/collections?subject_type=${subject_type}`
            }

            function transUserKey(username) {
                return `https://api.bgm.tv/v0/users/${username}`
            }
            return { create, get, set, deleteUser, updateUser, transCollKey, transUserKey, getAllUser, clearAll }

        })()

        return store
    })()

    const load_manager_async = (() => {

        // api
        /** @returns {Collection[]} */
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


        async function get_coll(username) {
            const cache_key = api_cache.transCollKey(username, analyze_config.cur_subject_id);
            let _my_collections = await api_cache.get(cache_key);

            if (!_my_collections) {
                try {
                    _my_collections = await fetch_all_collections(username, analyze_config.cur_subject_id);
                    await api_cache.set(cache_key, _my_collections);
                } catch (e) {
                    throw `自动获取${username}的${analyze_config.cur_subject}缓存失败: ${e.message}`;
                }
            }
            return _my_collections
        }

        /**@returns {User} */
        async function fetch_user(username) {
            if (!isValidUsernameInput(username)) throw new Error('用户名格式无效')
            const api = `https://api.bgm.tv/v0/users/${username}`
            let res = await fetchWithTimeout(api, {}, 5000)
            const user = await res.json()
            if (!res.ok) throw new Error(user.description || user.message || `HTTP ${res.status}`)
            if (!isValidUserPayload(user)) throw new Error('用户数据格式无效')
            return user
        }

        async function get_user(username) {
            const cache_key = api_cache.transUserKey(username)
            let user = await api_cache.get(cache_key);

            if (user && !isValidUserPayload(user)) {
                await api_cache.deleteUser({ username })
                user = null
            }

            if (!user) {
                try {
                    user = await fetch_user(username);
                    await api_cache.set(cache_key, user);
                } catch (e) {
                    throw `自动获取${username}的缓存失败: ${e.message}`;
                }
            }
            return user
        }



        return { get_coll, get_user }

    })()


    // main
    const analyze = (() => {

        //rate_count_map不包含0的计数
        //refract_map:分数对应好、中、坏的映射
        //std_frac_map:分数对应标准分数的映射
        /** @param {Collection[]} collections */
        function calc_refract_map(collections, low_threshold = 3, high_threshold = 7) {
            const rate_count_map = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }
            for (const collection of collections) {
                if (collection.rate !== 0) {
                    rate_count_map[collection.rate] += 1
                }
            }
            const total = Object.values(rate_count_map).reduce((sum, v) => sum + v, 0)

            //std_frac_map 和 refract_map 都含0
            const std_frac_map = { 0: 0 }
            const mid_frac_map = { 0: 0 }
            const right_frac_map = { 0: 0 }
            const left_frac_map = { 0: 0 }
            let curNum = 0
            for (let i = 1; i < 11; i++) {
                left_frac_map[i] = (curNum + rate_count_map[i]) / total
                mid_frac_map[i] = (curNum + rate_count_map[i] / 2) / total
                right_frac_map[i] = curNum / total
                std_frac_map[i] = mid_frac_map[i] - 0.5
                curNum += rate_count_map[i]
            }

            const refract_map = { 0: 'unrate' }
            for (let i = 1; i < 11; i++) {
                if (i <= low_threshold) {
                    refract_map[i] = 'low'
                } else if (i <= high_threshold) {
                    refract_map[i] = 'medium'
                } else {
                    refract_map[i] = 'high'
                }
            }


            return [refract_map, std_frac_map, rate_count_map, left_frac_map, right_frac_map]
        }

        //原版的rate3是指好中差，这里的rate3是标准化分数
        /** @param {Collection[]} collections */
        function calc_id_rate3_map(collections, low_threshold = 3, high_threshold = 7) {

            const [refract_map, std_frac_map, rate_count_map, left_frac_map, right_frac_map] = calc_refract_map(collections, low_threshold, high_threshold)

            const id_rate3_map = {}
            //const id_rate_map = {}
            for (const collection of collections) {
                id_rate3_map[collection.subject_id] = refract_map[collection.rate]
                //id_rate_map[collection.subject_id] = collection.rate
            }

            return [id_rate3_map, rate_count_map, refract_map, std_frac_map, left_frac_map, right_frac_map]
        }

        /** @param {Collection[]} collections */
        function get_muzimi_collections(collections) {
            const res = []
            collections.forEach(c => {
                const cur = { ...c }
                let com = c.subject.name_cn
                if (com.length == 0) com = c.subject.name
                cur.comment = `我从来没觉得看 <b>“${com}”</b> 开心过……`
                cur.rate = Math.round(c.subject.score)
                res.push(cur)
            })
            return res
        }

        /**
         * 
         * @param {Collection[]} col1 
         * @param {Collection[]} col2
         * @returns {[Collection[],Collection[]]} 
         */
        function get_intersections(col1, col2) {
            const map = new Map(col2.map(o => [o.subject_id, o]))
            int1 = [], int2 = []
            for (const c of col1) {
                if (map.has(c.subject_id)) {
                    int1.push(c)
                    int2.push(map.get(c.subject_id))
                }
            }
            return [int1, int2]
        }


        /**
         * 
         * @param {Collection[]} col1 
         * @param {Collection[]} col2
         * @returns {[Number]} 
         */
        function get_Rate2Simi(col1, col2) {
            const [my_collections, his_collections] = get_intersections(col1, col2)
            const my_collection_map = Object.fromEntries(my_collections.map((o) => [o.subject_id, o]))
            const [my_id_rate3_map, my_rate_count_map, my_refract_map, my_std_frac_map, my_left_frac_map, my_right_frac_map] = calc_id_rate3_map(my_collections)
            const his_collection_map = Object.fromEntries(his_collections.map((o) => [o.subject_id, o]))
            const [his_id_rate3_map, his_rate_count_map, his_refract_map, his_std_frac_map, his_left_frac_map, his_right_frac_map] = calc_id_rate3_map(his_collections)

            let rateDot = 0, rateMysum = 0, rateHissum = 0

            for (const subject_id of Object.keys(my_collection_map)) {
                const my_rate3 = my_id_rate3_map[subject_id]
                const his_rate3 = his_id_rate3_map[subject_id]

                const my_collection = my_collection_map[subject_id]
                const his_collection = his_collection_map[subject_id]

                let my_rrate = my_std_frac_map[my_collection.rate] ?? 0
                let his_rrate = his_std_frac_map[his_collection?.rate] ?? 0

                const mh = my_rrate * his_rrate,
                    mm = my_rrate * my_rrate,
                    hh = his_rrate * his_rrate


                if (my_rate3 !== 'unrate' && his_rate3 !== 'unrate') {
                    rateDot += mh
                    rateMysum += mm
                    rateHissum += hh
                }
            }

            const rateSimi = rateDot === 0 ? 0 : rateDot / (Math.sqrt(rateMysum * rateHissum))
            return rateSimi
        }

        async function analyze(his_id, my_id, my_threshold_low = 3, my_threshold_high = 7, his_threshold_low = 3, his_threshold_high = 7) {
            /** @param {Collection} collection */
            function collection_filter(collection) {
                return !analyze_config.filter_CollType[collection.type]
            }

            const [_my_collections_raw, _his_collections_raw] = await Promise.all([
                load_manager_async.get_coll(my_id),
                his_id === my_id ? null : load_manager_async.get_coll(his_id)
            ])
            const _my_collections = _my_collections_raw
            const _his_collections = his_id === my_id ? get_muzimi_collections(_my_collections) : _his_collections_raw

            const my_collections = _my_collections.filter(collection_filter)
            const my_collection_map = Object.fromEntries(my_collections.map((o) => [o.subject_id, o]))
            const [my_id_rate3_map, my_rate_count_map, my_refract_map, my_std_frac_map, my_left_frac_map, my_right_frac_map] = calc_id_rate3_map(my_collections, my_threshold_low, my_threshold_high)

            const his_collections = _his_collections.filter(collection_filter)
            const his_collection_map = Object.fromEntries(his_collections.map((o) => [o.subject_id, o]))
            const [his_id_rate3_map, his_rate_count_map, his_refract_map, his_std_frac_map, his_left_frac_map, his_right_frac_map] = calc_id_rate3_map(his_collections, his_threshold_low, his_threshold_high)

            const rateSimi2 = get_Rate2Simi(my_collections, his_collections)

            const result = {
                high: { high: [], medium: [], low: [], unrate: [], null: [] },
                medium: { high: [], medium: [], low: [], unrate: [], null: [] },
                low: { high: [], medium: [], low: [], unrate: [], null: [] },
                unrate: { high: [], medium: [], low: [], unrate: [], null: [] },
                null: { high: [], medium: [], low: [], unrate: [], null: [] },
            }

            const all_items = []

            //共同打分，共同收藏，仅自己收藏，仅对方收藏
            let scoredCollSyncNum = 0, collSyncNum = 0, myonlyCollNum = 0, hisonlyCollNum = 0

            //余弦相似度
            let rateDot = 0, rateMysum = 0, rateHissum = 0

            //欧几里得距离 只存在于：评分空间
            //eallsum最终是极限长度的一半
            let disSum = 0, disHalfallSum = 0

            // function getStdAve(rcmap, rrmap) {
            //     let sum = 0
            //     const total = Object.values(rcmap).reduce((sum, v) => sum + v, 0)
            //     for (let ii = 1; ii < 11; ii++)
            //         sum += rcmap[ii] * rrmap[ii]
            //     return sum / total
            // }
            // const my_ave = getStdAve(my_rate_count_map, my_std_frac_map)
            // const his_ave = getStdAve(his_rate_count_map, his_std_frac_map)
            // console.log({my_ave, his_ave})
            // 2.5273369666263725e-17 4.239033366750598e-17
            // 皮尔逊系数，非常小，没有意义



            for (const subject_id of Object.keys(my_collection_map)) {
                const my_rate3 = my_id_rate3_map[subject_id]
                const his_rate3 = his_id_rate3_map[subject_id]

                const my_collection = my_collection_map[subject_id]
                const his_collection = his_collection_map[subject_id]
                delete his_collection_map[subject_id]

                let my_rrate = my_std_frac_map[my_collection.rate] ?? 0
                let his_rrate = his_std_frac_map[his_collection?.rate] ?? 0

                const mh = my_rrate * his_rrate,
                    mm = my_rrate * my_rrate,
                    hh = his_rrate * his_rrate

                if (his_rate3) {

                    if (my_rate3 !== 'unrate' && his_rate3 !== 'unrate') {
                        rateDot += mh
                        rateMysum += mm
                        rateHissum += hh
                        disSum += (my_rrate - his_rrate) ** 2
                        disHalfallSum += 0.25

                        scoredCollSyncNum++
                    }
                    collSyncNum++

                    const reg = {
                        subject: his_collection.subject,
                        my_review: {
                            rate: my_collection.rate,
                            comment: my_collection.comment,
                            date: new Date(my_collection.updated_at),
                            type: my_collection.type,
                            std_frac: my_rrate
                        },
                        his_review: {
                            rate: his_collection.rate,
                            comment: his_collection.comment,
                            date: new Date(his_collection.updated_at),
                            type: his_collection.type,
                            std_frac: his_rrate
                        },
                    }
                    result[my_rate3][his_rate3].push(reg)
                    result[null][null].push(reg)
                    all_items.push({ type: 'shared', review: reg, my_rate: my_collection.rate, his_rate: his_collection.rate })

                } else {
                    myonlyCollNum++
                    const my_collection = my_collection_map[subject_id]

                    const myOnlyReview = {
                        subject: my_collection.subject,
                        my_review: {
                            rate: my_collection.rate,
                            comment: my_collection.comment,
                            date: new Date(my_collection.updated_at),
                            type: my_collection.type,
                            std_frac: my_rrate
                        },
                    }
                    result[my_rate3].null.push(myOnlyReview)
                    all_items.push({ type: 'my_only', review: myOnlyReview, my_rate: my_collection.rate })
                }
            }

            for (const subject_id of Object.keys(his_collection_map)) {
                const his_rate3 = his_id_rate3_map[subject_id]
                const his_collection = his_collection_map[subject_id]

                hisonlyCollNum++

                const hisOnlyReview = {
                    subject: his_collection.subject,
                    his_review: {
                        rate: his_collection.rate,
                        comment: his_collection.comment,
                        date: new Date(his_collection.updated_at),
                        type: his_collection.type,
                        std_frac: his_std_frac_map[his_collection.rate]
                    },
                }
                result.null[his_rate3].push(hisOnlyReview)
                all_items.push({ type: 'his_only', review: hisOnlyReview, his_rate: his_collection.rate })
            }

            const scoreRate = scoredCollSyncNum === 0 ? 0 : scoredCollSyncNum / (collSyncNum + myonlyCollNum + hisonlyCollNum)
            const collRate = collSyncNum === 0 ? 0 : collSyncNum / (collSyncNum + myonlyCollNum + hisonlyCollNum)
            const myCollRate = collSyncNum === 0 ? 0 : collSyncNum / (collSyncNum + myonlyCollNum)
            const hisCollRate = collSyncNum === 0 ? 0 : collSyncNum / (collSyncNum + hisonlyCollNum)

            let syncCollnums = { scoredCollSyncNum, collSyncNum, myonlyCollNum, hisonlyCollNum }
            let syncCollrates = { scoreRate, collRate, myCollRate, hisCollRate }

            let rateSimi, disSimiArr


            if (scoredCollSyncNum === 0) {
                rateSimi = 0

                const dis = (myonlyCollNum + hisonlyCollNum) ** 0.5
                const alldis = (collSyncNum + myonlyCollNum + hisonlyCollNum) ** 0.5
                const stdDis = ((1 - collRate) * 100).toFixed(0)
                const disSimi = (1 - stdDis / 100) ** 2

                disSimiArr = { disSimi, dis, alldis, stdDis }
            }
            else {

                rateSimi = rateDot / (Math.sqrt(rateMysum * rateHissum))
                disSum **= 1 / 2
                disHalfallSum **= 1 / 2
                const disSimi = disHalfallSum === 0 ? 0 : -(disSum - disHalfallSum) / disHalfallSum
                const stdDis = disHalfallSum === 0 ? 100 : (disSum / disHalfallSum * 100).toFixed(0)

                disSimiArr = { disSimi, disSum, disHalfallSum, stdDis }
            }


            // console.log({ my_rate_count_map, his_rate_count_map, my_refract_map, his_refract_map, my_std_frac_map, his_std_frac_map })
            // console.log({ 收藏数统计: syncCollnums, 收藏同步率统计: syncCollrates, 同步率: [rateSimi, rateSimi2], 距离统计: disSimiArr })

            syncCollnums = Object.values(syncCollnums)
            syncCollrates = Object.values(syncCollrates)
            disSimiArr = Object.values(disSimiArr)

            console.log('同步率：', { 一般同步率: rateSimi, 交集同步率: rateSimi2, 距离: disSimiArr })

            // Reclassify with current thresholds (user may have changed them during loading)
            const cur_my_low = analyze_config.my_threshold_low
            const cur_my_high = analyze_config.my_threshold_high
            const cur_his_low = analyze_config.his_threshold_low
            const cur_his_high = analyze_config.his_threshold_high
            if (cur_my_low !== my_threshold_low || cur_my_high !== my_threshold_high ||
                cur_his_low !== his_threshold_low || cur_his_high !== his_threshold_high) {
                const [final_my_refract] = calc_refract_map(my_collections, cur_my_low, cur_my_high)
                const [final_his_refract] = calc_refract_map(his_collections, cur_his_low, cur_his_high)
                my_refract_map = final_my_refract
                his_refract_map = final_his_refract
                // Rebuild result matrix with current thresholds
                const final_result = {
                    high: { high: [], medium: [], low: [], unrate: [], null: [] },
                    medium: { high: [], medium: [], low: [], unrate: [], null: [] },
                    low: { high: [], medium: [], low: [], unrate: [], null: [] },
                    unrate: { high: [], medium: [], low: [], unrate: [], null: [] },
                    null: { high: [], medium: [], low: [], unrate: [], null: [] },
                }
                for (const item of all_items) {
                    if (item.type === 'shared') {
                        final_result[my_refract_map[item.my_rate]][his_refract_map[item.his_rate]].push(item.review)
                        final_result[null][null].push(item.review)
                    } else if (item.type === 'my_only') {
                        final_result[my_refract_map[item.my_rate]].null.push(item.review)
                    } else {
                        final_result.null[his_refract_map[item.his_rate]].push(item.review)
                    }
                }
                result = final_result
            }

            res = [
                result, my_rate_count_map, my_refract_map, his_rate_count_map, his_refract_map, my_left_frac_map, his_left_frac_map, my_right_frac_map, his_right_frac_map,
                syncCollnums, syncCollrates, [rateSimi, rateSimi2], disSimiArr,
                my_collections, his_collections, all_items, _my_collections, _his_collections,
            ]

            return res

        }

        return { analyze, calc_refract_map }
    })()

    let isFirstLoad = true
    let chosingEmo = ''

    /**@type {User} */
    let cur_user1
    /**@type {User} */
    let cur_user2
    let self_username = CHOBITS_USERNAME
    let visited_username = ''
    let restoreAnalyzeScroll = null

    async function onlyfirst_load() {
        if (isFirstLoad) {
            const $page = document.querySelector('.columns')
            isFirstLoad = false
            if (!$page.querySelector('.analyze_page')) $page.innerHTML = `loading...`
            visited_username = document.querySelector('#headerProfile .name small').textContent.slice(1)
            self_username = CHOBITS_USERNAME
            cur_user1 = await load_manager_async.get_user(visited_username)
            cur_user2 = await load_manager_async.get_user(self_username)
        }
    }

    async function inject_analyze_page() {
        const $page = document.querySelector('.columns')
        await onlyfirst_load()

        try {
            his_id = cur_user1.username
            my_id = cur_user2.username
            const my_avatar_url = cur_user2.avatar.medium
            const his_avatar_url = his_id === my_id ?
                `https://lsky.ry.mk/i/2026/01/27/05e25f414d1ef.webp`
                : cur_user1.avatar.medium

            let nav, article, artRender
            let result, my_rate_count_map, his_rate_count_map
            let my_refract_map, his_refract_map
            let my_left_frac_map, his_left_frac_map, my_right_frac_map, his_right_frac_map
            let syncCollnums, syncCollrates, rateSimis, disSimiArr
            let cached_my_collections, cached_his_collections, raw_my_collections, raw_his_collections, all_items
            let updatePercentBar = () => { }

            let [full_result, full_my_rate_count_map, full_my_refract_map, full_his_rate_count_map, full_his_refract_map,
                full_my_left_frac_map, full_his_left_frac_map, full_my_right_frac_map, full_his_right_frac_map, full_syncCollnums, full_syncCollrates, full_rateSimis, full_disSimiArr,
                full_cached_my_collections, full_cached_his_collections, full_all_items, full_raw_my_collections, full_raw_his_collections]
                = await analyze.analyze(
                    his_id,
                    my_id,
                    analyze_config.my_threshold_low,
                    analyze_config.my_threshold_high,
                    analyze_config.his_threshold_low,
                    analyze_config.his_threshold_high
                )

            // Update all data with full results
            result = full_result
            my_rate_count_map = full_my_rate_count_map
            my_refract_map = full_my_refract_map
            his_rate_count_map = full_his_rate_count_map
            his_refract_map = full_his_refract_map
            my_left_frac_map = full_my_left_frac_map
            his_left_frac_map = full_his_left_frac_map
            my_right_frac_map = full_my_right_frac_map
            his_right_frac_map = full_his_right_frac_map
            syncCollnums = full_syncCollnums
            syncCollrates = full_syncCollrates
            rateSimis = full_rateSimis
            disSimiArr = full_disSimiArr
            cached_my_collections = full_cached_my_collections
            cached_his_collections = full_cached_his_collections
            raw_my_collections = full_raw_my_collections
            raw_his_collections = full_raw_his_collections
            all_items = full_all_items

            // 自动均衡分配好中差区间
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
            const autoMy = autoBalanceThresholds(my_rate_count_map)
            const autoHis = autoBalanceThresholds(his_rate_count_map)
            analyze_config.my_threshold_low = autoMy.low
            analyze_config.my_threshold_high = autoMy.high
            analyze_config.his_threshold_low = autoHis.low
            analyze_config.his_threshold_high = autoHis.high

            function collection_filter(collection) {
                return !analyze_config.filter_CollType[collection.type]
            }

            function rebuildAllItems(myCollections, hisCollections) {
                const myCollectionMap = Object.fromEntries(myCollections.map((o) => [o.subject_id, o]))
                const hisCollectionMap = Object.fromEntries(hisCollections.map((o) => [o.subject_id, o]))
                const items = []

                for (const subjectId of Object.keys(myCollectionMap)) {
                    const myCollection = myCollectionMap[subjectId]
                    const hisCollection = hisCollectionMap[subjectId]
                    delete hisCollectionMap[subjectId]

                    if (hisCollection) {
                        items.push({
                            type: 'shared',
                            my_rate: myCollection.rate,
                            his_rate: hisCollection.rate,
                            review: {
                                subject: hisCollection.subject,
                                my_review: {
                                    rate: myCollection.rate,
                                    comment: myCollection.comment,
                                    date: new Date(myCollection.updated_at),
                                    type: myCollection.type,
                                },
                                his_review: {
                                    rate: hisCollection.rate,
                                    comment: hisCollection.comment,
                                    date: new Date(hisCollection.updated_at),
                                    type: hisCollection.type,
                                },
                            },
                        })
                    } else {
                        items.push({
                            type: 'my_only',
                            my_rate: myCollection.rate,
                            review: {
                                subject: myCollection.subject,
                                my_review: {
                                    rate: myCollection.rate,
                                    comment: myCollection.comment,
                                    date: new Date(myCollection.updated_at),
                                    type: myCollection.type,
                                },
                            },
                        })
                    }
                }

                for (const subjectId of Object.keys(hisCollectionMap)) {
                    const hisCollection = hisCollectionMap[subjectId]
                    items.push({
                        type: 'his_only',
                        his_rate: hisCollection.rate,
                        review: {
                            subject: hisCollection.subject,
                            his_review: {
                                rate: hisCollection.rate,
                                comment: hisCollection.comment,
                                date: new Date(hisCollection.updated_at),
                                type: hisCollection.type,
                            },
                        },
                    })
                }

                return items
            }

            function applyItemsWithThresholds(items, myCollections, hisCollections, my_low, my_high, his_low, his_high) {
                const [new_my_refract, newMyStdFracMap, newMyRateCountMap, newMyLeftFracMap, newMyRightFracMap] = analyze.calc_refract_map(myCollections, my_low, my_high)
                const [new_his_refract, newHisStdFracMap, newHisRateCountMap, newHisLeftFracMap, newHisRightFracMap] = analyze.calc_refract_map(hisCollections, his_low, his_high)

                const new_result = {
                    high: { high: [], medium: [], low: [], unrate: [], null: [] },
                    medium: { high: [], medium: [], low: [], unrate: [], null: [] },
                    low: { high: [], medium: [], low: [], unrate: [], null: [] },
                    unrate: { high: [], medium: [], low: [], unrate: [], null: [] },
                    null: { high: [], medium: [], low: [], unrate: [], null: [] },
                }

                for (const item of items) {
                    if (item.type === 'shared') {
                        const m = new_my_refract[item.my_rate]
                        const h = new_his_refract[item.his_rate]
                        item.review.my_review.std_frac = newMyStdFracMap[item.my_rate] ?? 0
                        item.review.his_review.std_frac = newHisStdFracMap[item.his_rate] ?? 0
                        new_result[m][h].push(item.review)
                        new_result[null][null].push(item.review)
                    } else if (item.type === 'my_only') {
                        const m = new_my_refract[item.my_rate]
                        item.review.my_review.std_frac = newMyStdFracMap[item.my_rate] ?? 0
                        new_result[m].null.push(item.review)
                    } else {
                        const h = new_his_refract[item.his_rate]
                        item.review.his_review.std_frac = newHisStdFracMap[item.his_rate] ?? 0
                        new_result.null[h].push(item.review)
                    }
                }

                result = new_result
                my_rate_count_map = newMyRateCountMap
                his_rate_count_map = newHisRateCountMap
                my_refract_map = new_my_refract
                his_refract_map = new_his_refract
                my_left_frac_map = newMyLeftFracMap
                his_left_frac_map = newHisLeftFracMap
                my_right_frac_map = newMyRightFracMap
                his_right_frac_map = newHisRightFracMap

                nav.update(new_result)
                article.updateCharts(new_my_refract, new_his_refract)
                updatePercentBar('my')
                updatePercentBar('his')
                artRender()
            }

            // reclassifyWithThresholds: update classification without re-fetching data
            function reclassifyWithThresholds(my_low, my_high, his_low, his_high) {
                applyItemsWithThresholds(all_items, cached_my_collections, cached_his_collections, my_low, my_high, his_low, his_high)
            }

            function refreshFilteredAnalysis() {
                const myCollections = raw_my_collections.filter(collection_filter)
                const hisCollections = raw_his_collections.filter(collection_filter)
                cached_my_collections = myCollections
                cached_his_collections = hisCollections
                all_items = rebuildAllItems(myCollections, hisCollections)
                applyItemsWithThresholds(
                    all_items,
                    myCollections,
                    hisCollections,
                    analyze_config.my_threshold_low,
                    analyze_config.my_threshold_high,
                    analyze_config.his_threshold_low,
                    analyze_config.his_threshold_high
                )
            }

            // Build the full UI
        const score = `<section id="score-placeholder" style="display: flex; align-items: center; justify-content: center; padding: 20px; font-size: 1.2em; color: #888;">加载中...</section>`

            // Score is computed after await and replaced in post-await section
            const regemo = [emoMap.best, emoMap.food_fantuan, emoMap.food_hanbao, emoMap.food_shousi, emoMap.food_shutiao];
            function getRandEmo() {
                const randomIndex1 = Math.floor(Math.random() * regemo.length)
                return regemo[randomIndex1]
            }
            let randomEmo = getRandEmo()
            while (chosingEmo === randomEmo) {
                randomEmo = getRandEmo()
            }
            chosingEmo = randomEmo

            // 计算最大昵称宽度用于对齐
            const _tmpCanvas = document.createElement('canvas').getContext('2d')
            _tmpCanvas.font = '16px sans-serif'
            const _nick1 = cur_user2.nickname || cur_user2.username
            const _nick2 = cur_user1.nickname || cur_user1.username
            const _maxNickWidth = Math.ceil(Math.max(_tmpCanvas.measureText(_nick1).width, _tmpCanvas.measureText(_nick2).width)) + 'px'
            const collectionRelationBar = `
              <div class="collection-relation-bar" style="display: grid; grid-template-columns: repeat(3, 1fr); width: 320px; height: 42px; border-radius: 4px; overflow: hidden; color: #fff; font-size: 0.85em; font-weight: bold; text-shadow: 0 0 2px #000;">
                <div style="background:#04f; display:grid; place-items:center;">A 收藏 ${syncCollnums[2]}</div>
                <div style="background:#7a3; display:grid; place-items:center; line-height:1.2;"><span>共同 ${syncCollnums[1]}</span><span>共同打分 ${syncCollnums[0]}</span></div>
                <div style="background:#f40; display:grid; place-items:center;">B 收藏 ${syncCollnums[3]}</div>
              </div>
            `
            // 类别按钮和缓存按钮
            const categoryAndCacheButtons = `
<!-- BGMer管理 和 设置 并排 -->
<div style="display: flex; gap: 10px; margin-top: 10px; margin-bottom: 10px; align-items: flex-start;">
  <!-- 设置菜单 -->
  <div class="settings-section" style="flex: 1; margin: 0;">
    <button class="settings-toggle" id="settings-toggle">设置</button>
    <div class="settings-panel ${analyze_config.settingsPanelOpen ? 'open' : ''}" id="settings-panel">
      <!-- 条目类型 -->
      <div style="display: flex; flex-wrap: wrap; gap: 10px; padding: 0px; border-radius: 4px;">
        <button class="subject-btn" data-subject-id="2" style="padding: 8px 15px; cursor: pointer;">
          ${analyze_config.cur_subject_id === 2 ? getEmoHtml(randomEmo) : ''} <span>动画</span></button>
        <button class="subject-btn" data-subject-id="1" style="padding: 8px 15px; cursor: pointer;">
          ${analyze_config.cur_subject_id === 1 ? getEmoHtml(randomEmo) : ''} <span>书籍</span></button>
        <button class="subject-btn" data-subject-id="4" style="padding: 8px 15px; cursor: pointer;">
          ${analyze_config.cur_subject_id === 4 ? getEmoHtml(randomEmo) : ''} <span>游戏</span></button>
        <button class="subject-btn" data-subject-id="3" style="padding: 8px 15px; cursor: pointer;">
          ${analyze_config.cur_subject_id === 3 ? getEmoHtml(randomEmo) : ''} <span>音乐</span></button>
        <button class="subject-btn" data-subject-id="6" style="padding: 8px 15px; cursor: pointer;">
          ${analyze_config.cur_subject_id === 6 ? getEmoHtml(randomEmo) : ''} <span>三次元</span></button>
      </div>
      <!-- 收藏状态过滤 -->
      <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; padding: 0px; border-radius: 4px;">
        <button class="filter-btn" data-filter="1" style="padding: 8px 15px; cursor: pointer;">
          ${getEmoHtml(emoMap.colastar)} 想看</button>
        <button class="filter-btn" data-filter="2" style="padding: 8px 15px; cursor: pointer;">看过</button>
        <button class="filter-btn" data-filter="3" style="padding: 8px 15px; cursor: pointer;">在看</button>
        <button class="filter-btn" data-filter="4" style="padding: 8px 15px; cursor: pointer;">搁置</button>
        <button class="filter-btn" data-filter="5" style="padding: 8px 15px; cursor: pointer;">抛弃</button>
      </div>
    </div>
  </div>

  <!-- BGMer管理 -->
  <div class="cache-section" style="flex: 1; margin: 0;">
    <button class="settings-toggle" id="cache-toggle">BGMer管理</button>
    <div class="cache-panel ${analyze_config.cachePanelOpen ? 'open' : ''}" id="cache-panel">
      <div id="cache-user-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
      <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;">
        <input type="text" id="cache-add-input" placeholder="输入用户名..." style="padding: 6px 10px; font-size: 1em; border-radius: 4px; border: 1px solid #ccc; width: 180px;" />
        <button id="cache-add-btn" style="padding: 6px 15px; cursor: pointer; font-size: 1em;">添加</button>
      </div>
    </div>
  </div>
</div>

<!-- 滑块 -->
<div class="threshold-sliders" style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px; margin-bottom: 10px; padding: 8px 0;">
  <div class="threshold-slider-row" style="display: grid; grid-template-columns: 24px ${_maxNickWidth} 200px max-content; align-items: center; column-gap: 10px; row-gap: 6px;">
    <img src="${my_avatar_url}" style="width: 24px; height: 24px; border-radius: 50%;" />
    <span style="font-size: 1em; white-space: nowrap;">${_nick1}</span>
    <div class="dual-range-container" style="position: relative; width: 200px; height: 24px;">
      <div class="slider-track" style="position: absolute; top: 50%; left: 0; right: 0; height: 4px; transform: translateY(-50%); border-radius: 2px; z-index: 1;"></div>
      <input type="range" class="range-handle range-low" data-user="my" min="0" max="10" step="1" value="${analyze_config.my_threshold_low}" />
      <input type="range" class="range-handle range-high" data-user="my" min="0" max="10" step="1" value="${analyze_config.my_threshold_high}" />
    </div>
    <span class="threshold-label" data-user="my" style="font-size: 0.9em; font-family: monospace;"></span>
    <div class="percent-bar" data-user="my" style="grid-column: 3; display: flex; width: 200px; height: 20px; border-radius: 3px; overflow: visible; font-size: 0.8em; position: relative;"></div>
  </div>
  <div class="threshold-slider-row" style="display: grid; grid-template-columns: 24px ${_maxNickWidth} 200px max-content; align-items: center; column-gap: 10px; row-gap: 6px;">
    <img src="${his_avatar_url}" style="width: 24px; height: 24px; border-radius: 50%;" />
    <span style="font-size: 1em; white-space: nowrap;">${_nick2}</span>
    <div class="dual-range-container" style="position: relative; width: 200px; height: 24px;">
      <div class="slider-track" style="position: absolute; top: 50%; left: 0; right: 0; height: 4px; transform: translateY(-50%); border-radius: 2px; z-index: 1;"></div>
      <input type="range" class="range-handle range-low" data-user="his" min="0" max="10" step="1" value="${analyze_config.his_threshold_low}" />
      <input type="range" class="range-handle range-high" data-user="his" min="0" max="10" step="1" value="${analyze_config.his_threshold_high}" />
    </div>
    <span class="threshold-label" data-user="his" style="font-size: 0.9em; font-family: monospace;"></span>
    <div class="percent-bar" data-user="his" style="grid-column: 3; display: flex; width: 200px; height: 20px; border-radius: 3px; overflow: visible; font-size: 0.8em; position: relative;"></div>
  </div>
</div>

${collectionRelationBar}

        <style>
    .subject-btn, .clear-cache-btn, .filter-btn {
        font-size: 1.1em;
    }
        .filter-btn.filtered {
  text-decoration: line-through 5px solid;
}
    .subject-btn, .filter-btn:hover {
    }
    .clear-cache-btn:hover {
    }
    .user-select {
  padding: 6px 25px 6px 10px;
  border-radius: 4px;
}
.user-select:hover {
  border-color: #888;
}
  .user-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}
.settings-toggle {
    padding: 8px 18px;
    cursor: pointer;
    font-size: 1.1em;
    font-weight: bold;
    border: 1px solid #ccc;
    border-radius: 4px;
}
.settings-panel, .cache-panel {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transform: translateY(-4px);
    transition: max-height 0.3s ease, opacity 0.2s ease, transform 0.2s ease;
}
.settings-panel.open, .cache-panel.open {
    max-height: 500px;
    opacity: 1;
    transform: translateY(0);
}
.cache-panel.open {
    min-height: 360px;
}
.settings-section, .cache-section {
    margin-top: 10px;
    margin-bottom: 10px;
}
.cache-user-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
}
.cache-user-row img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
}
.cache-user-row span {
    flex: 1;
    font-size: 1em;
}
.cache-user-row button {
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.9em;
}
.cache-user-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
}
#cache-user-list {
    min-height: 300px;
    max-height: 300px;
    overflow-y: auto;
}
.percent-bar {
    user-select: none;
}
.dual-range-container input[type="range"] {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    pointer-events: none;
    z-index: 2;
    margin: 0;
}
.dual-range-container input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 2px;
    background: #007bff;
    border: 2px solid #fff;
    box-shadow: 0 0 2px rgba(0,0,0,0.3);
    cursor: pointer;
    pointer-events: auto;
    margin-top: -5px;
}
.dual-range-container input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    background: #007bff;
    border: 2px solid #fff;
    box-shadow: 0 0 2px rgba(0,0,0,0.3);
    cursor: pointer;
    pointer-events: auto;
}
.dual-range-container input[type="range"]::-webkit-slider-runnable-track {
    height: 4px;
    background: transparent;
}
.dual-range-container input[type="range"]::-moz-range-track {
    height: 4px;
    background: transparent;
    border: none;
}
    </style>

    `

            nav = (() => {
                const $nav = (() => {
                    const v_l = ['high', 'medium', 'low', 'unrate', 'null']

                    const count = { both: [], my: [], his: [] }
                    for (const my_rate3 of v_l) {
                        for (const his_rate3 of v_l) {
                            if (my_rate3 === 'null' && his_rate3 === 'null') continue

                            const n = result[my_rate3][his_rate3].length

                            if (my_rate3 === 'null') {
                                count.his.push(n)
                            } else if (his_rate3 === 'null') {
                                count.my.push(n)
                            } else {
                                count.both.push(n)
                            }
                        }
                    }
                    const max_n_dict = {
                        both: Math.max(...count.both),
                        my: Math.max(...count.my),
                        his: Math.max(...count.his),
                    }

                    let nav_btn_html = ``
                    for (const my_rate3 of v_l) {
                        for (const his_rate3 of v_l) {
                            if (my_rate3 === 'null' && his_rate3 === 'null') {
                                nav_btn_html += `<div class="_btn" data-index='${JSON.stringify([
                                    "null",
                                    "null",
                                ])}' style="grid-area: nn; background-color: ${`rgb(0 0 0 / ${(100 * syncCollnums[1] / syncCollnums[2]).toFixed(2)}%)`}">新</div>`
                                continue;
                            }

                            let max_n
                            let is_both = false
                            if (my_rate3 === 'null') {
                                max_n = max_n_dict.his
                            } else if (his_rate3 === 'null') {
                                max_n = max_n_dict.my
                            } else {
                                max_n = max_n_dict.both
                                is_both = true
                            }

                            const n = result[my_rate3][his_rate3].length
                            const p = 10 + 90 * (n / max_n)
                            const bgc = `rgb(${is_both ? 255 : 0} 0 0 / ${p.toFixed(2)}%)`

                            nav_btn_html += `<div class="_btn" data-index='${JSON.stringify([
                                my_rate3,
                                his_rate3,
                            ])}' style="grid-area: ${my_rate3[0] + his_rate3[0]}; background-color: ${bgc}">${n}</div>`
                        }
                    }

                    return create_element(`
                    <nav    
                        style="
                            display: grid;
                            grid-template-areas:
                                '.  .  .  x1 x1 x1 . '
                                '.  .  h1 m1 l1 u1 n1'
                                '.  h2 hh mh lh uh nh'
                                'x2 m2 hm mm lm um nm'
                                'x2 l2 hl ml ll ul nl'
                                'x2 u2 hu mu lu uu nu'
                                '.  n2 hn mn ln un nn';
                            grid-template-columns: max-content repeat(6, 35px);
                            grid-template-rows: max-content repeat(6, 35px);
                            place-items: center;
                            gap: 2px;

                            margin-bottom: 27px;

                            user-select: none;
                        "
                    >
                        <img
                            src="${my_avatar_url}"
                            style="
                                grid-area: x1;

                                width: 40px;
                                height: 40px;
                            "
                        />
                        <img
                            src="${his_avatar_url}"
                            style="
                                grid-area: x2;

                                width: 40px;
                                height: 40px;
                            "
                        />

                        <div style="grid-area: h1">好</div>
                        <div style="grid-area: m1">中</div>
                        <div style="grid-area: l1">差</div>
                        <div style="grid-area: u1">空</div>
                        <div style="grid-area: n1">无</div>

                        <div style="grid-area: h2">好</div>
                        <div style="grid-area: m2">中</div>
                        <div style="grid-area: l2">差</div>
                        <div style="grid-area: u2">空</div>
                        <div style="grid-area: n2">无</div>

                        ${nav_btn_html}
                    </nav>
                    `)
                })()

                const style = `
                <style>
                    .analyze_page {
                        nav > div {
                            display: grid;
                            place-content: center;

                            width: 100%;
                            height: 100%;

                            font-size: 18px;

                            cursor: default;
                        }

                        nav > ._btn {
                            font-size: 16px;
                            color: #fff;
                            font-family: monospace;
                            font-weight: bold;
                            text-shadow: 0px 1px 1px #000, 0px -1px 1px #000, 1px 0px 1px #000, -1px 0px 1px #000;

                            cursor: pointer;
                        }
                        nav > ._btn:hover {
                            border: solid 1px #08f;
                            outline: solid 2px #08f;
                        }
                    }
                </style>
                `

                // event
                let notify
                function on_change(_notify) {
                    notify = _notify
                }
                {
                    /** @type {HTMLElement[]} */
                    const $btn_l = $nav.querySelectorAll('._btn')
                    for (const $btn of $btn_l) {
                        $btn.addEventListener('click', () => {
                            notify(...JSON.parse($btn.dataset.index))
                        })
                    }
                }

                function update(newResult) {
                    const v_l = ['high', 'medium', 'low', 'unrate', 'null']
                    const count = { both: [], my: [], his: [] }
                    for (const my_rate3 of v_l) {
                        for (const his_rate3 of v_l) {
                            if (my_rate3 === 'null' && his_rate3 === 'null') continue
                            const n = newResult[my_rate3][his_rate3].length
                            if (my_rate3 === 'null') {
                                count.his.push(n)
                            } else if (his_rate3 === 'null') {
                                count.my.push(n)
                            } else {
                                count.both.push(n)
                            }
                        }
                    }
                    const max_n_dict = {
                        both: Math.max(...count.both, 1),
                        my: Math.max(...count.my, 1),
                        his: Math.max(...count.his, 1),
                    }

                    const $btn_l = $nav.querySelectorAll('._btn')
                    for (const $btn of $btn_l) {
                        const [my_rate3, his_rate3] = JSON.parse($btn.dataset.index)
                        const n = newResult[my_rate3]?.[his_rate3]?.length ?? 0
                        $btn.textContent = my_rate3 === 'null' && his_rate3 === 'null' ? '新' : n

                        if (my_rate3 === 'null' && his_rate3 === 'null') {
                            $btn.style.backgroundColor = `rgb(0 0 0 / ${(100 * syncCollnums[1] / syncCollnums[2]).toFixed(2)}%)`
                            continue
                        }

                        let max_n
                        let is_both = false
                        if (my_rate3 === 'null') {
                            max_n = max_n_dict.his
                        } else if (his_rate3 === 'null') {
                            max_n = max_n_dict.my
                        } else {
                            max_n = max_n_dict.both
                            is_both = true
                        }

                        const p = 10 + 90 * (n / max_n)
                        $btn.style.backgroundColor = `rgb(${is_both ? 255 : 0} 0 0 / ${p.toFixed(2)}%)`
                    }
                }

                return { dom: $nav, style, on_change, update }
            })()

            article = (() => {
                const $article = create_element(
                    `<article style="display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); gap: 50px 10px"></article>`
                   )

                const style = `
                <style>
                    .analyze_page {
                        ._review {
                            display: grid;
                            grid-template-columns: 120px 1fr;

                            max-width: 650px;

                            h3 {
                                font-size: 16px;
                            }

                            > aside img {
                                max-width: 90%;
                                min-height: 100px;
                                max-height: 200px;

                                object-fit: contain;
                            }

                            ._collection_total {
                                padding: 5px 10px;

                                width: fit-content;

                                border-radius: 5px;

                                color: #fff;
                                font-weight: bold;
                                text-shadow: 0px 1px 1px #000, 0px -1px 1px #000, 1px 0px 1px #000, -1px 0px 1px #000;
                            }

                            ._comment {
                                display: grid;
                                grid-template-columns: max-content 1fr;
                                gap: 10px;

                                margin-top: 10px;

                                img {
                                    width: 40px;
                                    height: 40px;
                                }

                                div {
                                    white-space: pre-wrap;
                                }
                            }
                        }

                        ._distribution_chart {
                            display: flex;
                            align-items: center;
                            gap: 5px;

                            > div {
                                flex: auto;

                                display: flex;
                                gap: 3px;

                                max-width: 300px;
                                height: 1em;

                                > div {
                                    flex-shrink: 0;

                                    width: 1px;
                                }
                            }

                            > div {
                                > div {
                                    background-color: #aaa;
                                }
                                > div.__medium {
                                    background-color: #ddd;
                                }
                            }

                            &.__v1 > div > :nth-last-child(1) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v2 > div > :nth-last-child(2) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v3 > div > :nth-last-child(3) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v4 > div > :nth-last-child(4) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v5 > div > :nth-last-child(5) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v6 > div > :nth-last-child(6) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v7 > div > :nth-last-child(7) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v8 > div > :nth-last-child(8) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v9 > div > :nth-last-child(9) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                            &.__v10 > div > :nth-last-child(10) {
                                &.__high {
                                    background-color: #f40;
                                }
                                &.__medium {
                                    background-color: #fc0;
                                }
                                &.__low {
                                    background-color: #04f;
                                }
                            }
                        }

                        ._rank_chart {
                            display: flex;
                            align-items: center;
                            gap: 5px;

                            > div {
                                flex: auto;
                                max-width: 300px;
                                height: 1em;
                                background-color: #ddd;

                                > div {
                                    width: 10px;
                                    height: 100%;
                                    background-color: #f40;
                                }
                            }
                        }
                    }
                </style>
                `

                function creat_distribution_chart(rate_count_map, refract_map, left_frac_map, right_frac_map) {
                    let html = ``
                    for (let i = 10; i > 0; i--) {
                        html += `<div class="__${refract_map[i]}" style="flex-grow: ${rate_count_map[i]}"></div>`
                    }

                    function distribution_chart(rate) {
                        //return `<div class="_distribution_chart __v${rate}"><div>${html}</div><b>${rate}</b>(${(right_frac_map[rate] * 100).toFixed(0)}%~${(left_frac_map[rate] * 100).toFixed(0)}%)</div>`
                        return `<div class="_distribution_chart __v${rate}"><div>${html}</div><b>${rate}</b></div>`
                    }

                    return distribution_chart
                }
                let my_distribution_chart = creat_distribution_chart(my_rate_count_map, my_refract_map, my_left_frac_map, my_right_frac_map)
                let his_distribution_chart = creat_distribution_chart(his_rate_count_map, his_refract_map, his_left_frac_map, his_right_frac_map)

                function updateCharts(new_my_refract, new_his_refract) {
                    my_distribution_chart = creat_distribution_chart(my_rate_count_map, new_my_refract, my_left_frac_map, my_right_frac_map)
                    his_distribution_chart = creat_distribution_chart(his_rate_count_map, new_his_refract, his_left_frac_map, his_right_frac_map)
                }

                /** @param {Review[]} review_l */
                function render(review_l) {
                    const l = review_l.map((review) => {
                        return `
                        <div class="_review">
                            <aside>
                                <a href="/subject/${review.subject.id}" target="_blank">
                                    <img src="${review.subject.images.grid}" loading="lazy"/>
                                </a>
                                <h3>${review.subject.date}</h3>
                                <div class="_collection_total" style="background-color: rgb(255 0 0 / ${(
                                review.subject.collection_total / 500
                            ).toFixed(2)}%)">${review.subject.collection_total.toLocaleString()}</div>
                            </aside>
                            <section>
                                <h3>${review.subject.name_cn}</h3>
                                <h3>${review.subject.name}</h3>

                                <div>
                                    ${review.his_review ? his_distribution_chart(review.his_review.rate) : ''}
                                    <div class="_rank_chart">
                                        <div><div style="margin-left: ${(review.subject.rank / 99.99).toFixed(2)}%"></div></div>
                                        <b>${review.subject.score} ${review.subject.rank}</b>
                                    </div>
                                    ${review.my_review ? my_distribution_chart(review.my_review.rate) : ''}
                                </div>
                                ${review.his_review
                                ? `
                                <article class="_comment">
                                    <img src="${his_avatar_url}" />
                                    <section>
                                        <h3>${review.his_review.date.toLocaleDateString()} （${collTypeMap[review.his_review.type] || ''}）</h3>
                                        <div>${review.his_review.comment ?? ''}</div>
                                    </section>
                                </article>
                                `
                                : ''
                            }
                                ${review.my_review
                                ? `
                                <article class="_comment">
                                    <img src="${my_avatar_url}" />
                                    <section>
                                        <h3>${review.my_review.date.toLocaleDateString()} （${collTypeMap[review.my_review.type] || ''}）</h3>
                                        <div>${review.my_review.comment ?? ''}</div>
                                    </section>
                                </article>
                                `
                                : ''
                            }
                            </section>
                        </div>
                        `
                    })

                    $article.innerHTML = l.join('')
                }

                return { dom: $article, style, render, updateCharts }
            })()

            // init
            let searchFilter = ''
            artRender = (() => {
                function normal_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    if (a.my_review && b.my_review.date !== a.my_review.date)
                        return b.my_review.date - a.my_review.date
                    if (a.his_review && b.his_review.date !== a.his_review.date)
                        return b.his_review.date - a.his_review.date
                    return new Date(b.subject.date) - new Date(a.subject.date)
                    //弃用:
                    //     return b.subject.collection_total - a.subject.collection_total
                    // return a.subject.rank - b.subject.rank
                }

                function my_high_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    return b.my_review.std_frac - a.my_review.std_frac
                }
                function my_low_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    return a.my_review.std_frac - b.my_review.std_frac
                }
                function his_high_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    return b.his_review.std_frac - a.his_review.std_frac
                }
                function his_low_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    return a.his_review.std_frac - b.his_review.std_frac
                }
                function diff_high_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    const d1 = Math.abs(a.my_review.std_frac - a.his_review.std_frac)
                    const d2 = Math.abs(b.my_review.std_frac - b.his_review.std_frac)
                    return d2 - d1
                }
                function diff_low_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    const d1 = Math.abs(a.my_review.std_frac - a.his_review.std_frac)
                    const d2 = Math.abs(b.my_review.std_frac - b.his_review.std_frac)
                    return d1 - d2
                }
                function sum_high_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    const d1 = a.my_review.std_frac + a.his_review.std_frac
                    const d2 = b.my_review.std_frac + b.his_review.std_frac
                    return d2 - d1
                }
                function sum_low_sorter(/** @type {Review} */ a, /** @type {Review} */ b) {
                    const d1 = a.my_review.std_frac + a.his_review.std_frac
                    const d2 = b.my_review.std_frac + b.his_review.std_frac
                    return d1 - d2
                }

                const sorter_map = {
                    hh: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s1 = my_high_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = diff_low_sorter(a, b)
                        if (0 !== s2) return s2
                        const s0 = sum_high_sorter(a, b)
                        if (0 !== s0) return s0
                        return normal_sorter(a, b)
                    },
                    mm: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s1 = my_high_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = diff_low_sorter(a, b)
                        if (0 !== s2) return s2
                        const s0 = sum_high_sorter(a, b)
                        if (0 !== s0) return s0
                        return normal_sorter(a, b)
                    },

                    ll: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s1 = my_low_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = diff_low_sorter(a, b)
                        if (0 !== s2) return s2
                        const s0 = sum_low_sorter(a, b)
                        if (0 !== s0) return s0
                        return normal_sorter(a, b)
                    },
                    lh: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s0 = diff_high_sorter(a, b)
                        if (0 !== s0) return s0
                        const s1 = my_low_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = sum_high_sorter(a, b)
                        if (0 !== s2) return s2
                        return normal_sorter(a, b)
                    },

                    hl: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s0 = diff_high_sorter(a, b)
                        if (0 !== s0) return s0
                        const s1 = my_high_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = sum_low_sorter(a, b)
                        if (0 !== s2) return s2
                        return normal_sorter(a, b)
                    },

                    hm: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s0 = diff_high_sorter(a, b)
                        if (0 !== s0) return s0
                        const s1 = my_high_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = sum_low_sorter(a, b)
                        if (0 !== s2) return s2
                        return normal_sorter(a, b)
                    },
                    mh: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s0 = diff_high_sorter(a, b)
                        if (0 !== s0) return s0
                        const s1 = my_low_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = sum_high_sorter(a, b)
                        if (0 !== s2) return s2
                        return normal_sorter(a, b)
                    },

                    ml: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s0 = diff_high_sorter(a, b)
                        if (0 !== s0) return s0
                        const s1 = my_high_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = sum_low_sorter(a, b)
                        if (0 !== s2) return s2
                        return normal_sorter(a, b)
                    },
                    lm: (/** @type {Review} */ a, /** @type {Review} */ b) => {
                        const s0 = diff_high_sorter(a, b)
                        if (0 !== s0) return s0
                        const s1 = my_low_sorter(a, b)
                        if (0 !== s1) return s1
                        const s2 = sum_high_sorter(a, b)
                        if (0 !== s2) return s2
                        return normal_sorter(a, b)
                    },
                }

                nav.on_change((my_rate3, his_rate3) => {
                    cur_my_rate3 = my_rate3
                    cur_his_rate3 = his_rate3
                    articleRender()
                })
                function articleRender() {
                    let review_l
                    if (searchFilter) {
                        // When searching, collect items from ALL cells
                        review_l = result[null][null].filter(r => {
                            const name = (r.subject.name || '').toLowerCase()
                            const nameCn = (r.subject.name_cn || '').toLowerCase()
                            return name.includes(searchFilter) || nameCn.includes(searchFilter)
                        })
                    } else {
                        review_l = result[cur_my_rate3][cur_his_rate3]
                    }
                    const hash = cur_my_rate3[0] + cur_his_rate3[0]
                    let sorter = sorter_map[hash]
                    if (!sorter) {
                        sorter = normal_sorter
                    }
                    article.render(review_l.sort(sorter))
                }

                return articleRender
            })()



            // inject
            {
                const nextPage = create_element(`
                <div>
                <style>
                    .analyze_page {
                        line-height: 1.5;

                        font-size: 16px;

                        * {
                            box-sizing: border-box;
                        }
                    }
                </style>
    ${nav.style}
    ${article.style}
            
    <main class="analyze_page" style="width: 100%">
      ${categoryAndCacheButtons}
      ${score}
      <section class="_s2" style="display: grid; grid-template-columns: max-content 320px; align-items: end; gap: 50px"></section>
    </main>
    </div>
    `)

                const $main = nextPage.querySelector('main')
                $main.querySelector('._s2').append(nav.dom)
                $main.querySelector('._s2').append(create_element(`
                    <div style="align-self: end; padding-bottom: 30px;">
                        <input type="text" id="name-search-input" placeholder="搜索条目名称..." style="padding: 6px 10px; font-size: 1em; border-radius: 4px; border: 1px solid #ccc; width: 250px;" />
                    </div>
                `))
                $main.append(article.dom)

                $page.replaceChildren(...nextPage.childNodes)


                const btns = document.querySelectorAll('.subject-btn')
                btns.forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (analyzeLoading == true) return
                        analyzeLoading = true
                        btns.forEach(btn => btn.disabled = true)
                        analyze_config.cur_subject_id = parseInt(btn.dataset.subjectId);
                        analyze_config.cur_subject = subject_config[analyze_config.cur_subject_id].name;
                        await inject_analyze_page();
                        analyzeLoading = false
                    });
                });

                document.querySelectorAll('.filter-btn').forEach(btn => {
                    const curType = btn.dataset.filter;
                    const filtdic = analyze_config.filter_CollType

                    // 初始化按钮状态
                    if (filtdic[curType]) {
                        btn.classList.add('filtered');
                    }

                    btn.addEventListener('click', async () => {
                        if (analyzeLoading == true) return;

                        // 切换过滤状态
                        filtdic[curType] = !filtdic[curType]

                        // 更新按钮样式
                        if (filtdic[curType]) {
                            btn.classList.add('filtered');
                        } else {
                            btn.classList.remove('filtered');
                        }

                        analyzeLoading = true;
                        refreshFilteredAnalysis();
                        analyzeLoading = false;
                    });
                });

                // Threshold slider event handlers
                function updateSliderTrack(container, lowVal, highVal) {
                    const track = container.querySelector('.slider-track')
                    const lowPercent = (lowVal / 10 * 100).toFixed(1)
                    const highPercent = (highVal / 10 * 100).toFixed(1)
                    track.style.background = `linear-gradient(to right, ` +
                        `#04f 0%, #04f ${lowPercent}%, ` +
                        `#fc0 ${lowPercent}%, #fc0 ${highPercent}%, ` +
                        `#f40 ${highPercent}%, #f40 100%)`
                }

                function updateThresholdLabel(labelEl, lowVal, highVal) {
                    const lowPart = lowVal === 0 ? '无差' : `1-${lowVal}差`
                    const midPart = `${lowVal === 0 ? 1 : lowVal + 1}-${highVal === 10 ? 10 : highVal}中`
                    const highPart = highVal === 10 ? '无好' : `${highVal + 1}-10好`
                    labelEl.textContent = `${lowPart} ${midPart} ${highPart}`
                }

                function initPercentBar(userType) {
                    const barEl = document.querySelector(`.percent-bar[data-user="${userType}"]`)
                    if (!barEl) return
                    barEl.innerHTML = ''
                    updatePercentBar(userType)
                }

                updatePercentBar = function (userType) {
                    const barEl = document.querySelector(`.percent-bar[data-user="${userType}"]`)
                    if (!barEl) return
                    const rateMap = userType === 'my' ? my_rate_count_map : his_rate_count_map
                    const lowT = userType === 'my' ? analyze_config.my_threshold_low : analyze_config.his_threshold_low
                    const highT = userType === 'my' ? analyze_config.my_threshold_high : analyze_config.his_threshold_high

                    let total = 0
                    for (let i = 1; i <= 10; i++) total += rateMap[i]
                    if (total === 0) {
                        barEl.innerHTML = '<div style="width:100%;height:100%;background:#ccc;border-radius:3px;"></div>'
                        return
                    }

                    const lighten = { '#04f': 'rgba(60,130,255,0.5)', '#fc0': 'rgba(180,140,0,0.5)', '#f40': 'rgba(255, 123, 90, 0.5)' }
                    const getColor = (r) => r <= lowT ? '#04f' : r <= highT ? '#fc0' : '#f40'
                    const active = []
                    for (let i = 1; i <= 10; i++) if (rateMap[i] > 0) active.push({ score: i, count: rateMap[i], color: getColor(i) })
                    let html = ''
                    for (let j = 0; j < active.length; j++) {
                        const { count, color } = active[j]
                        const prev = j > 0 ? active[j - 1] : null
                        const next = j < active.length - 1 ? active[j + 1] : null
                        if (prev && prev.color !== color) {
                            html += `<div style="width:0;height:100%;border-left:2px solid #000;flex-shrink:0;"></div>`
                        }
                        const rL = (!prev || prev.color !== color) ? '2px' : '0'
                        const rR = (!next || next.color !== color) ? '2px' : '0'
                        const borderR = (next && next.color === color) ? `border-right:2px solid ${lighten[color]};` : ''
                        html += `<div style="flex:${count};background:${color};min-width:0;border-radius:${rL} ${rR} ${rR} ${rL};${borderR}"></div>`
                    }
                    barEl.innerHTML = html
                }

                // Make percent bar handles interactive (drag to set thresholds)
                document.querySelectorAll('.range-handle').forEach(input => {
                    const container = input.closest('.dual-range-container')
                    const user = input.dataset.user
                    const isLow = input.classList.contains('range-low')

                    function updateFromSliders() {
                        const lowInput = container.querySelector('.range-low')
                        const highInput = container.querySelector('.range-high')
                        let lowVal = parseInt(lowInput.value)
                        let highVal = parseInt(highInput.value)

                        // Enforce low < high
                        if (isLow && lowVal >= highVal) {
                            lowVal = highVal - 1
                            lowInput.value = lowVal
                        }
                        if (!isLow && highVal <= lowVal) {
                            highVal = lowVal + 1
                            highInput.value = highVal
                        }

                        // Update analyze_config
                        if (user === 'my') {
                            analyze_config.my_threshold_low = lowVal
                            analyze_config.my_threshold_high = highVal
                        } else {
                            analyze_config.his_threshold_low = lowVal
                            analyze_config.his_threshold_high = highVal
                        }

                        // Update visual track and label
                        updateSliderTrack(container, lowVal, highVal)
                        const label = container.closest('.threshold-slider-row').querySelector('.threshold-label')
                        updateThresholdLabel(label, lowVal, highVal)

                        // Reclassify and re-render (synchronous, fast)
                        reclassifyWithThresholds(
                            analyze_config.my_threshold_low,
                            analyze_config.my_threshold_high,
                            analyze_config.his_threshold_low,
                            analyze_config.his_threshold_high
                        )

                        updatePercentBar('my')
                        updatePercentBar('his')
                    }

                    input.addEventListener('input', updateFromSliders)

                    // Initialize track and label on first render
                    updateFromSliders()
                    initPercentBar('my')
                    initPercentBar('his')
                })

                // Settings toggle
                const settingsToggle = document.getElementById('settings-toggle')
                const settingsPanel = document.getElementById('settings-panel')
                const cacheToggle = document.getElementById('cache-toggle')
                const cachePanel = document.getElementById('cache-panel')

                if (settingsToggle && settingsPanel) {
                    settingsToggle.addEventListener('click', () => {
                        settingsPanel.classList.toggle('open')
                        analyze_config.settingsPanelOpen = settingsPanel.classList.contains('open')
                    })
                }

                // Cache panel toggle + user list
                if (cacheToggle && cachePanel) {
                    cacheToggle.addEventListener('click', () => {
                        cachePanel.classList.toggle('open')
                        analyze_config.cachePanelOpen = cachePanel.classList.contains('open')
                    })

                    // Render cache user list
                    async function renderCacheUserList() {
                        const restoreListScroll = restoreAnalyzeScroll?.cacheListScroll
                        const users = await api_cache.getAllUser()
                        const listEl = document.getElementById('cache-user-list')
                        if (!listEl) return

                        // Sort: current user first, then A/B users, then others by cache time
                        const myUsername = cur_user2?.username
                        const hisUsername = cur_user1?.username
                        users.sort((a, b) => {
                            const aIsSelf = a.username === self_username ? 0 : 1
                            const bIsSelf = b.username === self_username ? 0 : 1
                            if (aIsSelf !== bIsSelf) return aIsSelf - bIsSelf
                            const aIsAB = (a.username === myUsername || a.username === hisUsername || a.username === visited_username) ? 0 : 1
                            const bIsAB = (b.username === myUsername || b.username === hisUsername || b.username === visited_username) ? 0 : 1
                            if (aIsAB !== bIsAB) return aIsAB - bIsAB
                            // Others sorted by cache update time (latest first)
                            const aTime = a.data.updated_at || a.data.lastModified || 0
                            const bTime = b.data.updated_at || b.data.lastModified || 0
                            return bTime - aTime
                        })

                        listEl.innerHTML = users.map((u, index) => {
                            const markers = []
                            if (u.username === myUsername) markers.push('A')
                            if (u.username === hisUsername) markers.push('B')
                            if (u.username === self_username) markers.push('自己')
                            if (u.username === visited_username) markers.push('对方')
                            const nickname = escapeHtml(u.data.nickname || u.username)
                            return `
                            <div class="cache-user-row">
                                <img src="${escapeHtml(u.data.avatar?.medium || '')}" />
                                <span>${nickname}${markers.map(marker => `<b style="color:#007bff">[${marker}]</b>`).join('')}</span>
                                <div class="cache-user-actions">
                                    ${好友可选 ? `<button class="cache-set-user-btn" data-role="p2" data-user-index="${index}">设为 A</button>
                                    <button class="cache-set-user-btn" data-role="p1" data-user-index="${index}">设为 B</button>` : ''}
                                    <button class="cache-update-btn" data-user-index="${index}">更新</button>
                                    <button class="cache-delete-btn" data-user-index="${index}" data-nickname="${nickname}">删除</button>
                                </div>
                            </div>`
                        }).join('')

                        listEl.querySelectorAll('.cache-set-user-btn').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                if (analyzeLoading) return
                                analyzeLoading = true
                                btn.disabled = true
                                try {
                                    const cachedUser = users[Number(btn.dataset.userIndex)]
                                    const user = await load_manager_async.get_user(cachedUser.username)
                                    if (btn.dataset.role === 'p1') cur_user1 = user
                                    else cur_user2 = user
                                    btn.textContent = '切换中...'
                                    restoreAnalyzeScroll = {
                                        pageY: window.scrollY,
                                        cacheListScroll: listEl.scrollTop,
                                    }
                                    await inject_analyze_page()
                                } catch (e) {
                                    alert(`设置用户失败: ${e.message}`)
                                } finally {
                                    analyzeLoading = false
                                }
                            })
                        })

                        listEl.querySelectorAll('.cache-update-btn').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                if (analyzeLoading) return
                                analyzeLoading = true
                                btn.textContent = '更新中...'
                                btn.disabled = true
                                const cachedUser = users[Number(btn.dataset.userIndex)]
                                try {
                                    await api_cache.updateUser(cachedUser.username, analyze_config.cur_subject_id)
                                    await load_manager_async.get_user(cachedUser.username)
                                    await load_manager_async.get_coll(cachedUser.username)
                                    btn.textContent = '完成'
                                    btn.disabled = false
                                } catch (e) {
                                    await api_cache.deleteUser({ username: cachedUser.username })
                                    await renderCacheUserList()
                                    btn.textContent = '失败'
                                    alert(`更新失败，已移除无效缓存。请确认用户名后重新添加: ${e.message}`)
                                }
                                analyzeLoading = false
                            })
                        })

                        listEl.querySelectorAll('.cache-delete-btn').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                if (analyzeLoading) return
                                const nickname = btn.dataset.nickname
                                const cachedUser = users[Number(btn.dataset.userIndex)]
                                analyzeLoading = true
                                try {
                                    await api_cache.deleteUser({ username: cachedUser.username, nickname })
                                    await renderCacheUserList()
                                } catch (e) {
                                    alert(`删除失败: ${e.message}`)
                                }
                                analyzeLoading = false
                            })
                        })
                        if (restoreListScroll != null) {
                            listEl.scrollTop = restoreListScroll
                        }
                    }
                    renderCacheUserList()
                    if (restoreAnalyzeScroll?.pageY != null) {
                        requestAnimationFrame(() => {
                            window.scrollTo(0, restoreAnalyzeScroll.pageY)
                            restoreAnalyzeScroll = null
                        })
                    }

                    // Add user button
                    const cacheAddBtn = document.getElementById('cache-add-btn')
                    const cacheAddInput = document.getElementById('cache-add-input')
                    if (cacheAddBtn && cacheAddInput) {
                        cacheAddBtn.addEventListener('click', async () => {
                            const username = cacheAddInput.value.trim()
                            if (!username) return
                            if (!isValidUsernameInput(username)) {
                                alert(`添加 ${username} 失败: 用户名格式无效`)
                                cacheAddInput.focus()
                                return
                            }
                            if (analyzeLoading) return
                            analyzeLoading = true
                            cacheAddBtn.textContent = '添加中...'
                            cacheAddBtn.disabled = true
                            try {
                                await load_manager_async.get_user(username)
                                cacheAddInput.value = ''
                                await renderCacheUserList()
                            } catch (e) {
                                alert(`添加 ${username} 失败: ${e.message}`)
                                cacheAddInput.focus()
                            }
                            cacheAddBtn.textContent = '添加'
                            cacheAddBtn.disabled = false
                            analyzeLoading = false
                        })
                    }
                }

                // Name search filter
                let searchDebounce = null
                const searchInput = document.getElementById('name-search-input')
                if (searchInput) {
                    searchInput.addEventListener('input', () => {
                        clearTimeout(searchDebounce)
                        searchDebounce = setTimeout(() => {
                            searchFilter = searchInput.value.trim().toLowerCase()
                            artRender()
                        }, 200)
                    })
                }

                } // end inject block

            // Post-await: compute score with full data and update UI
            async function getMzmRatesim(id) {
                const [, , , , , , , , , , , rateSimis,] =
                    await analyze.analyze(id, id,
                        analyze_config.my_threshold_low,
                        analyze_config.my_threshold_high,
                        analyze_config.his_threshold_low,
                        analyze_config.his_threshold_high
                    )
                console.log(`用户${id}的自我相似度:`, rateSimis[0])
                return rateSimis[0]
            }

            const my_mzmsim = await getMzmRatesim(my_id)
            const his_mzmsim = await getMzmRatesim(his_id)

            // Compute and inject real score
            const realScore = (() => {
                const rateSimiStr = ((rateSimis[0] + rateSimis[1]) / 2 * 100).toFixed(2)
                const 评分相似 = (rateSimis[0] * 100).toFixed(2)
                const 交集相似 = (rateSimis[1] * 100).toFixed(2)
                const mzmMySimStr = (my_mzmsim * 100).toFixed(2)
                const mzmHisSimStr = (his_mzmsim * 100).toFixed(2)
                const dis_m_Str = disSimiArr[3] + 'm'

                function combEmo(emo) {
                    return getEmoHtml(emo)
                }
                let useRateSpace = true, useMuzimi = false
                if (syncCollnums[0] === 0) useRateSpace = false
                if (my_id === his_id) useMuzimi = true

                if (useRateSpace) console.log("进入评分空间")
                const ll = loveLevel
                let emoWeis = [0, 0, 0, 0, 1, 1, 0]
                let emoSpace = [ll.collRateSpc, ll.collRateSpc, ll.oneCollRateSpc, ll.oneCollRateSpc,
                    ll.rateSpc, ll.rateSpc, ll.disSpc]
                if (!useRateSpace) {
                    console.log("进入无评分空间")
                    emoWeis = [0, 1, 1, 1, 0, 0, 0]
                }
                if (useMuzimi) {
                    console.log("进入若叶睦空间")
                    emoWeis = [0, 0, 0, 0, 1, 0, 0]
                    if (!useRateSpace) emoWeis = [0, 0, 0, 0, 0, 0, 0]
                }

                let top = 0
                const collEmo0 = emoManager.searchEmo_wei(emoSpace[top], syncCollrates[0], emoWeis[top++])
                const collEmo1 = emoManager.searchEmo_wei(emoSpace[top], syncCollrates[1], emoWeis[top++])
                const collEmo2 = emoManager.searchEmo_wei(emoSpace[top], syncCollrates[2], emoWeis[top++])
                const collEmo3 = emoManager.searchEmo_wei(emoSpace[top], syncCollrates[3], emoWeis[top++])
                const rate1Emo = emoManager.searchEmo_wei(emoSpace[top], rateSimis[0], emoWeis[top++])
                const rate2Emo = emoManager.searchEmo_wei(emoSpace[top], rateSimis[1], emoWeis[top++])
                const lastEmo = emoManager.getLastEmo()
                return `
                <section style="display: grid; margin-bottom:10px;grid-template-columns: repeat(3, 1fr); gap: 0px 0px; max-width: 700px;">
    <div style="display: flex; align-items: center; gap: 5px;">
        <span style="font-size: 1.2em">A公评相似</span>
        <span style="font-size: 1.5em">${mzmMySimStr}%</span>
    </div>
    <div style="display: flex; align-items: center; gap: 5px;">
        <span style="font-size: 1.2em">B公评相似</span>
        <span style="font-size: 1.5em">${mzmHisSimStr}%</span>
    </div>
    ${Math.abs(rateSimis[0] - rateSimis[1]) >= 0.05 ? `
    <div style="display: flex; align-items: center; gap: 5px;">
        <span style="font-size: 1.2em">交评相似</span>
        <span style="font-size: 1.5em">${交集相似}%</span>
    </div>` : ''}
    <div style="display: flex; align-items: center; gap: 5px;">
        <span style="font-size: 1.2em">评分相似</span>
        <span style="font-size: 1.5em">${评分相似}%</span>
    </div>
    <div style="display: flex; align-items: center; gap: 5px; ">
        <span style="font-size: 1.2em">综合等级</span>
        <span style="font-size: 1.5em; font-weight: 600;">Lv.${lastEmo.lv}</span>
        ${getEmoHtml(lastEmo)}
    </div>
</section>
                   `
            })()

            // Replace loading placeholder with real score
            const scorePlaceholder = document.getElementById('score-placeholder')
            if (scorePlaceholder) {
                scorePlaceholder.outerHTML = realScore
            }

            // Update nav and article with full data
            nav.update(result)
            article.updateCharts(my_refract_map, his_refract_map)
            artRender()
            renderBmoji()

        } catch (e) {
            alert(e)
            $page.innerHTML = e
            throw e
        }
    }

    let analyzeLoading = false
    let cur_my_rate3 = "high", cur_his_rate3 = "high"


    // ui
    {
        const $navTabs = document.querySelector('.navTabs')
        let tabName = 'Your Angle'
        if (开发中) tabName += '(开发中)'
        const $btn = create_element(`<li><a href="javascript:">${tabName}</a></li>`)

        $btn.addEventListener(
            'click',
            () => {
                for (const $focus of $navTabs.querySelectorAll('.focus')) {
                    $focus.classList.remove('focus')
                }
                $btn.querySelector('a').classList.add('focus')

                inject_analyze_page()
            },
            // { once: true }
        )

        $navTabs.append($btn)
    }
})();