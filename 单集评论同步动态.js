// ==UserScript==
// @name         单集评论同步动态
// @namespace    air.bgm.episode.comment.timeline
// @version      0.1.4
// @description  在单集吐槽时，可选择将内容及条目、集数来源同步到个人动态。
// @match        https://bgm.tv/ep/*
// @match        https://bgm.tv/subject/ep/*
// @match        https://bangumi.tv/ep/*
// @match        https://bangumi.tv/subject/ep/*
// @match        https://chii.in/ep/*
// @match        https://chii.in/subject/ep/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict'

    const FORM_SELECTOR = '#ReplyForm'
    const CONTENT_SELECTOR = 'textarea[name="content"]'
    const FORMHASH_SELECTOR = 'input[name="formhash"]'
    const CONTROL_ID = 'ep-comment-timeline-sync'
    const FLASH_KEY = 'ep-comment-timeline-sync-flash'
    const FLASH_TTL = 5 * 60 * 1000
    const TIMELINE_MAX_LENGTH = 380

    function get_episode_id() {
        return location.pathname.match(/^\/(?:subject\/)?ep\/(\d+)\/?$/)?.[1] || ''
    }

    function normalize_source_text(value) {
        return value.trim().replace(/\s+/g, ' ')
    }

    function get_source_info(episode_id) {
        const subject_link = document.querySelector('h1.nameSingle > a[href^="/subject/"]')
        if (!subject_link) return null

        const episode_link = document.querySelector(`
            .cur a[href="/ep/${episode_id}"],
            .cur a[href="/subject/ep/${episode_id}"]
        `)
        const episode_heading = document.querySelector('h2.title')
        const heading_text = Array.from(episode_heading?.childNodes || [])
            .find(node => node.nodeType === 3 && node.textContent.trim())?.textContent.trim()

        const subject_title = subject_link.getAttribute('title')?.trim() || subject_link.textContent
        const episode_text = normalize_source_text(episode_link?.textContent || heading_text || '')
        const episode_number = episode_text.match(/^\S+/)?.[0] || ''
        if (!episode_number) return null

        return {
            subject_title: normalize_source_text(subject_title),
            episode_number
        }
    }

    function build_timeline_content(content, source_info) {
        return `${content}\n（同步自「${source_info.subject_title}」${source_info.episode_number}）`
    }

    function add_style() {
        const style = document.createElement('style')
        style.textContent = `
            #${CONTROL_ID} {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin-left: 10px;
                vertical-align: middle;
                color: #666;
                font-size: 12px;
            }
            #${CONTROL_ID} label {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                white-space: nowrap;
            }
            #${CONTROL_ID} input {
                margin: 0;
            }
            #${CONTROL_ID}-status {
                color: #888;
            }
            #${CONTROL_ID}-status.is-error {
                color: #c0392b;
            }
            html[data-theme="dark"] #${CONTROL_ID} {
                color: #aaa;
            }
            html[data-theme="dark"] #${CONTROL_ID}-status.is-error {
                color: #ff8f86;
            }
        `
        document.head.appendChild(style)
    }

    function create_control(submit_button) {
        const control = document.createElement('span')
        control.id = CONTROL_ID

        const label = document.createElement('label')
        label.title = `勾选后，单集评论发表成功才会继续发布同文动态；动态最多 ${TIMELINE_MAX_LENGTH} 字`

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.id = `${CONTROL_ID}-checkbox`

        const label_text = document.createElement('span')
        label_text.textContent = '同时发布为动态'

        const status = document.createElement('span')
        status.id = `${CONTROL_ID}-status`
        status.setAttribute('role', 'status')
        status.setAttribute('aria-live', 'polite')

        label.append(checkbox, label_text)
        control.append(label, status)
        submit_button.insertAdjacentElement('afterend', control)

        return { control, checkbox, status }
    }

    function set_status(status, message, is_error = false) {
        status.textContent = message
        status.classList.toggle('is-error', is_error)
    }

    function set_busy({ checkbox, status, submit_button, textarea }, busy) {
        checkbox.disabled = busy
        submit_button.disabled = busy
        textarea.readOnly = busy
        submit_button.value = busy ? '发布中...' : submit_button.dataset.originalValue
        if (!busy) set_status(status, '')
    }

    function update_length_status(checkbox, status, textarea, source_info) {
        if (!checkbox.checked) {
            set_status(status, '')
            return
        }
        const timeline_content = build_timeline_content(textarea.value, source_info)
        const remaining = TIMELINE_MAX_LENGTH - timeline_content.length
        if (remaining >= 0) {
            set_status(status, `动态还可输入 ${remaining} 字`)
        } else {
            set_status(status, `超过动态上限 ${-remaining} 字`, true)
        }
    }

    function form_to_url_search_params(form, submitter) {
        const params = new URLSearchParams()
        for (const [name, value] of new FormData(form).entries()) {
            if (typeof value === 'string') params.append(name, value)
        }
        if (submitter?.name && !params.has(submitter.name)) {
            params.append(submitter.name, submitter.value)
        }
        if (!params.has('related_photo')) params.set('related_photo', '0')
        params.set('submit', 'submit')
        return params
    }

    async function submit_comment(form, submitter) {
        const action_url = new URL(form.action, location.href)
        if (action_url.origin !== location.origin) {
            throw new Error('评论提交地址不是当前 Bangumi 域名')
        }
        action_url.searchParams.set('ajax', '1')

        const response = await fetch(action_url, {
            method: 'POST',
            credentials: 'same-origin',
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: form_to_url_search_params(form, submitter)
        })

        if (!response.ok) {
            throw new Error(`评论请求失败（HTTP ${response.status}）`)
        }

        let result = null
        try {
            result = await response.json()
        } catch (error) {
            throw new Error('Bangumi 没有返回评论发表成功的数据')
        }
        if (!result || !result.timestamp) {
            throw new Error('Bangumi 没有确认评论发表成功')
        }
    }

    async function publish_timeline(content, formhash) {
        const timeline_url = new URL('/update/user/say', location.origin)
        timeline_url.searchParams.set('ajax', '1')
        const response = await fetch(timeline_url, {
            method: 'POST',
            credentials: 'same-origin',
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: new URLSearchParams({
                formhash,
                say_input: content,
                submit: 'submit'
            })
        })

        if (!response.ok) {
            throw new Error(`动态请求失败（HTTP ${response.status}）`)
        }
    }

    function save_flash(message) {
        try {
            sessionStorage.setItem(FLASH_KEY, JSON.stringify({
                message,
                created_at: Date.now()
            }))
        } catch (error) {
            console.warn('单集评论同步动态：无法保存提示信息', error)
        }
    }

    function restore_flash(status) {
        let flash = null
        try {
            flash = JSON.parse(sessionStorage.getItem(FLASH_KEY) || 'null')
            sessionStorage.removeItem(FLASH_KEY)
        } catch (error) {
            sessionStorage.removeItem(FLASH_KEY)
        }
        if (!flash || Date.now() - flash.created_at > FLASH_TTL) return
        set_status(status, flash.message, true)
    }

    function init() {
        const episode_id = get_episode_id()
        const form = document.querySelector(FORM_SELECTOR)
        const textarea = form?.querySelector(CONTENT_SELECTOR)
        const formhash_input = form?.querySelector(FORMHASH_SELECTOR)
        let submit_button = form?.querySelector('input[type="submit"], button[type="submit"]')
        const source_info = episode_id ? get_source_info(episode_id) : null
        if (!episode_id || !form || !textarea || !formhash_input || !submit_button || !source_info) return
        if (document.getElementById(CONTROL_ID)) return

        add_style()
        submit_button.dataset.originalValue = submit_button.value || submit_button.textContent
        const { control, checkbox, status } = create_control(submit_button)
        const submit_container = submit_button.parentElement
        const submit_observer = new MutationObserver(() => {
            if (control.isConnected) return
            const replacement = form.querySelector('input[type="submit"], button[type="submit"]')
            if (!replacement) return
            submit_button = replacement
            submit_button.dataset.originalValue = submit_button.value || submit_button.textContent
            submit_button.insertAdjacentElement('afterend', control)
        })
        submit_observer.observe(submit_container, { childList: true })
        restore_flash(status)
        checkbox.addEventListener('change', () => update_length_status(checkbox, status, textarea, source_info))
        textarea.addEventListener('input', () => {
            if (checkbox.checked) update_length_status(checkbox, status, textarea, source_info)
        })

        let submitting = false
        form.addEventListener('submit', async event => {
            if (!checkbox.checked || submitting) return

            const content = textarea.value
            if (!content.trim()) return
            const timeline_content = build_timeline_content(content, source_info)
            if (timeline_content.length > TIMELINE_MAX_LENGTH) {
                event.preventDefault()
                event.stopImmediatePropagation()
                update_length_status(checkbox, status, textarea, source_info)
                return
            }

            event.preventDefault()
            event.stopImmediatePropagation()
            submitting = true
            set_busy({ checkbox, status, submit_button, textarea }, true)
            set_status(status, '正在发表单集评论…')

            try {
                await submit_comment(form, event.submitter)
            } catch (error) {
                console.error('单集评论同步动态：评论发表失败', error)
                set_busy({ checkbox, status, submit_button, textarea }, false)
                set_status(status, `评论未确认发表，动态未发送：${error.message}`, true)
                submitting = false
                return
            }

            try {
                set_status(status, '评论已发表，正在同步动态…')
                await publish_timeline(timeline_content, formhash_input.value)
            } catch (error) {
                console.error('单集评论同步动态：动态发布失败', error)
                save_flash(`单集评论已发表，但动态同步失败：${error.message}`)
            }

            location.reload()
        }, true)
    }

    init()
})()
