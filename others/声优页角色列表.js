// ==UserScript==
// @homepage     https://bangumi.tv/dev/app/4165
// @author       https://bangumi.tv/user/437757
// @match        *://bangumi.tv/person/*/works/voice*
// @match        *://bgm.tv/person/*/works/voice*
// @match        *://chii.in/person/*/works/voice*
// ==/UserScript==

async function fetch_api() {
    // console.log('fetch_api')
    async function fetch_all_collections(username) {
        const limit = 100
        const api = `https://api.bgm.tv/v0/users/${username}/collections?subject_type=2&type=2&limit=${limit}&offset=`

        const res = await fetch(api + 0)
        const page = await res.json()
        const l = page.data

        const p_l = []
        for (let i = limit; i < page.total; i += limit) {
            const p = fetch(api + i).then(async (res) => {
                const page = await res.json()
                return page.data
            })

            p_l.push(p)
        }

        const ll = await Promise.all(p_l)
        return l.concat(...ll)
    }

    const all_collections = await fetch_all_collections(CHOBITS_USERNAME)

    const map = {}
    for (const collection of all_collections) {
        map[collection.subject_id] = collection.rate
    }

    return map
}

// util
/** @return {HTMLElement} */
function create_element(html) {
    const $temp = document.createElement('temp')
    $temp.innerHTML = html
    return $temp.firstElementChild
}

// main
/** @typedef {null | 'asc' | 'desc'} Order */
/** @typedef {null | 'fade' | 'hide'} Unwatch */

const { sort, filter } = (() => {
    const Role_l = (() => {
        /** @type {ReturnType<typeof init>} */
        let cache
        function with_cache() {
            if (!cache) cache = init()

            return cache
        }

        function init() {
            // console.log('init Role_l')
            const $ul = document.querySelector('.browserList')
            const l = [...$ul.children].map(($li) => {
                const $a_l = $li.querySelectorAll('.innerRightList .inner a')
                const subject_id_l = [...$a_l].map(($a) => $a.getAttribute('href').slice(9))

                const $job = $li.querySelector('.innerRightList .badge_job')

                return {
                    dom: $li,
                    subject_id_l,
                    subject_id_max: Math.max(...subject_id_l),
                    subject_id_min: Math.min(...subject_id_l),
                    job: $job.innerHTML,
                }
            })
            return l
        }

        return with_cache
    })()

    const Role_l_with_rate = (() => {
        /** @type {ReturnType<typeof init>} */
        let cache_p
        async function with_cache() {
            if (!cache_p) cache_p = init() // BUGFIX: 不可以在这里 await，cache 在 await 时值依旧是空，并行执行导致多次 init

            return await cache_p
        }

        async function init() {
            // console.log('init Role_l_with_rate')
            let id_rate_map
            if (localStorage.getItem('id_rate_map')) {
                id_rate_map = JSON.parse(localStorage.getItem('id_rate_map'))
            } else {
                id_rate_map = await fetch_api()
            }

            const role_l = Role_l()

            for (const role of role_l) {
                let rate = null
                role.subject_id_l.forEach((id) => {
                    const _rate = id_rate_map[id]
                    if (_rate == null) return

                    if (rate == null || _rate > rate) {
                        rate = _rate
                    }
                })

                role.rate = rate
            }

            // 纯纯ts体操
            /** @typedef {(typeof role_l)[number]} Role*/
            /** @type {(Role & { rate: number })[]} */
            const role_l_with_rate = role_l

            return role_l_with_rate
        }

        return with_cache
    })()

    const sort = (() => {
        let _sort

        /** @param {Order} order */
        function sort(order, rate_order) {
            if (!_sort) _sort = init()

            _sort(order, rate_order)
        }

        function init() {
            // console.log('init sort')
            // 高亮主役
            {
                const role_l = Role_l()

                for (const role of role_l) {
                    role.dom.classList.remove('odd', 'even')

                    if (role.job === '主角') {
                        role.dom.classList.add('main_character')
                    }
                }

                document.body.insertAdjacentHTML(
                    'beforeend',
                    `
                    <style>
                        li.main_character {
                            background-color: #ff02;
                        }
                    </style>
                    `
                )
            }

            const $ul = document.querySelector('.browserList')

            /** @param {Order} order */
            function sort_1(order) {
                if (!order) return

                const role_l = Role_l()

                if (order === 'asc') {
                    role_l.sort((a, b) => a.subject_id_min - b.subject_id_min)
                    //
                } else if (order === 'desc') {
                    role_l.sort((a, b) => b.subject_id_max - a.subject_id_max)
                    //
                }

                for (const role of role_l) {
                    $ul.append(role.dom)
                }
            }

            /** @param {Order} order */
            async function sort_2(order) {
                const role_l = await Role_l_with_rate()

                if (order === null) {
                    role_l.sort(compare_rate)
                    //
                } else if (order === 'asc') {
                    role_l.sort((a, b) => {
                        const r = compare_rate(a, b)
                        if (r !== 0) return r

                        return a.subject_id_min - b.subject_id_min
                    })
                    //
                } else if (order === 'desc') {
                    role_l.sort((a, b) => {
                        const r = compare_rate(a, b)
                        if (r !== 0) return r

                        return b.subject_id_max - a.subject_id_max
                    })
                    //
                }

                function compare_rate(a, b) {
                    return rate2v(b.rate) - rate2v(a.rate)
                }

                function rate2v(n) {
                    if (n == null) {
                        return -1
                    } else {
                        return n
                    }
                }

                for (const role of role_l) {
                    $ul.append(role.dom)
                }
            }

            return (order, rate_order) => {
                if (rate_order) {
                    sort_2(order)
                } else {
                    sort_1(order)
                }
            }
        }

        return sort
    })()

    const filter = (() => {
        let cache_p

        /** @param {Unwatch} type */
        async function filter(type) {
            if (!cache_p) cache_p = init()

            const _filter = await cache_p
            _filter(type)
        }

        async function init() {
            // console.log('init filter')
            const role_l = await Role_l_with_rate()

            for (const role of role_l) {
                if (role.rate == null) {
                    role.dom.classList.add('unwatch')
                }
            }

            document.body.insertAdjacentHTML(
                'beforeend',
                `
                <style>
                    .browserList.fade_unwatch li.unwatch {
                        opacity: 0.4;
                    }
                    .browserList.hide_unwatch li.unwatch {
                        display: none;
                    }
                </style>
                `
            )

            const $ul = document.querySelector('.browserList')

            return (/** @type {Unwatch} */ type) => {
                $ul.classList.remove('fade_unwatch', 'hide_unwatch')
                if (type) {
                    $ul.classList.add(type + '_unwatch')
                }
            }
        }

        return filter
    })()

    return { sort, filter }
})()

{
    /** @type {{order: Order, unwatch: Unwatch, rate_order: boolean}} */
    const store = (() => {
        const KEY = '声优页增强'

        if (!localStorage.getItem(KEY)) {
            localStorage.setItem(KEY, JSON.stringify({ order: null, unwatch: null, rate_order: false }))
        }

        const _store = JSON.parse(localStorage.getItem(KEY))

        const store = new Proxy(_store, {
            set(...args) {
                const r = Reflect.set(...args)
                localStorage.setItem(KEY, JSON.stringify(args[0]))
                return r
            },
        })

        return store
    })()

    // ui
    const order_control = (() => {
        const $ul = create_element(`
            <ul class="grouped clearit" style="text-align: center">
                <li class="title" style="width: 4em"><span>ID 序</span></li>
                <li><a href="" class="l" style="width: 2em"><span>默认</span></a></li>
                <li><a href="javascript:" class="l" style="width: 2em"><span>升序</span></a></li>
                <li><a href="javascript:" class="l" style="width: 2em"><span>降序</span></a></li>
            </ul>
        `)

        const $btn_null = $ul.children[1]
        const $btn_asc = $ul.children[2]
        const $btn_desc = $ul.children[3]

        $btn_null.addEventListener('click', () => {
            // 利用页面刷新，重置顺序
            store.order = null
        })
        $btn_asc.addEventListener('click', () => set_state('asc'))
        $btn_desc.addEventListener('click', () => set_state('desc'))

        function set_state(_order) {
            store.order = _order
            const { order, rate_order } = store
            sort(order, rate_order)
            render(order)
        }

        /** @param {Order} order */
        function render(order) {
            $btn_null.querySelector('a').classList.remove('focus')
            $btn_asc.querySelector('a').classList.remove('focus')
            $btn_desc.querySelector('a').classList.remove('focus')

            if (order === null) {
                $btn_null.querySelector('a').classList.add('focus')
            } else if (order === 'asc') {
                $btn_asc.querySelector('a').classList.add('focus')
            } else if (order === 'desc') {
                $btn_desc.querySelector('a').classList.add('focus')
            }
        }

        // init
        render(store.order)

        return { dom: $ul }
    })()

    const rate_order_control = (() => {
        const $ul = create_element(`
            <ul class="grouped clearit" style="text-align: center">
                <li class="title" style="width: 4em"><span>评分序</span></li>
                <li><a href="" class="l" style="width: 2em"><span>关</span></a></li>
                <li><a href="javascript:" class="l" style="width: 2em"><span>开</span></a></li>
            </ul>
        `)

        const $btn_off = $ul.children[1]
        const $btn_on = $ul.children[2]

        $btn_off.addEventListener('click', (e) => {
            if (store.order === null) {
                // 利用页面刷新，重置顺序
                store.rate_order = false
            } else {
                e.preventDefault()
                set_state(false)
            }
        })
        $btn_on.addEventListener('click', () => set_state(true))

        function set_state(_rate_order) {
            store.rate_order = _rate_order
            const { order, rate_order } = store
            sort(order, rate_order)
            render(rate_order)
        }

        function render(rate_order) {
            $btn_off.querySelector('a').classList.remove('focus')
            $btn_on.querySelector('a').classList.remove('focus')

            if (rate_order) {
                $btn_on.querySelector('a').classList.add('focus')
            } else {
                $btn_off.querySelector('a').classList.add('focus')
            }
        }

        // init
        render(store.rate_order)

        return { dom: $ul }
    })()

    const unwatch_control = (() => {
        const $ul = create_element(`
            <ul class="grouped clearit" style="text-align: center">
                <li class="title" style="width: 4em"><span>未看过</span></li>
                <li><a href="javascript:" class="l" style="width: 2em"><span>显示</span></a></li>
                <li><a href="javascript:" class="l" style="width: 2em"><span>淡化</span></a></li>
                <li><a href="javascript:" class="l" style="width: 2em"><span>隐藏</span></a></li>
            </ul>
        `)

        const $btn_null = $ul.children[1]
        const $btn_fade = $ul.children[2]
        const $btn_hide = $ul.children[3]

        $btn_null.addEventListener('click', () => set_state(null))
        $btn_fade.addEventListener('click', () => set_state('fade'))
        $btn_hide.addEventListener('click', () => set_state('hide'))

        function set_state(type) {
            store.unwatch = type
            filter(type)
            render(type)
        }

        /** @param {Unwatch} type */
        function render(type) {
            $btn_null.querySelector('a').classList.remove('focus')
            $btn_fade.querySelector('a').classList.remove('focus')
            $btn_hide.querySelector('a').classList.remove('focus')

            if (type === null) {
                $btn_null.querySelector('a').classList.add('focus')
            } else if (type === 'fade') {
                $btn_fade.querySelector('a').classList.add('focus')
            } else if (type === 'hide') {
                $btn_hide.querySelector('a').classList.add('focus')
            }
        }

        // init
        render(store.unwatch)

        return { dom: $ul }
    })()

    {
        // inject
        document.querySelector('.subjectFilter').append(rate_order_control.dom, order_control.dom, unwatch_control.dom)

        // init
        const { order, rate_order, unwatch } = store
        if (unwatch) filter(unwatch)
        if (order || rate_order) sort(order, rate_order)
    }
}