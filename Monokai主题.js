// ==UserScript==
// @name         Bangumi Monokai 主题
// @namespace    air.bgm.theme.monokai
// @version      0.1.0
// @description  为 Bangumi 提供 Monokai 配色，并将开关加入“个性化 > 主题色”。
// @author       Air + ChatGPT
// @match        https://bgm.tv/*
// @match        https://bangumi.tv/*
// @match        https://chii.in/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict'

    if (window.__bgm_monokai_theme_installed) return
    window.__bgm_monokai_theme_installed = true

    const STORAGE_KEY = 'bgm_monokai_theme_enabled'
    const ROOT_ATTRIBUTE = 'data-bgm-monokai'
    const STYLE_ID = 'bgm-monokai-theme-style'
    const OPTION_ID = 'bgm-monokai-theme-option'
    const INPUT_ID = 'bgm-monokai-theme-input'
    const INJECT_DELAYS = [0, 50, 150, 400, 800, 1600]

    let theme_enabled = read_setting()

    function read_setting() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'on'
        } catch (error) {
            console.warn('[Bangumi Monokai] 本地设置读取失败：', error)
            return false
        }
    }

    function save_setting(enabled) {
        try {
            localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
        } catch (error) {
            console.warn('[Bangumi Monokai] 本地设置保存失败：', error)
        }
    }

    function add_style() {
        if (document.getElementById(STYLE_ID)) return

        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = `
            html[${ROOT_ATTRIBUTE}="on"] {
                color-scheme: dark !important;
                --primary-color: #f92672 !important;
                --background: 39, 40, 34 !important;
                --bgm-bg-content: #272822 !important;
                --bgm-card-bg: #34352f !important;
                --bgm-bg-modal: rgba(15, 15, 13, .72) !important;
                --bgm-border: #4c4d43 !important;
                --bgm-text-main: #f8f8f2 !important;
                --bgm-text-sub: #a8a897 !important;
                --dollars-icon-color: #a8a897 !important;
                background-color: #272822 !important;
                scrollbar-color: #75715e #272822;
            }

            html[${ROOT_ATTRIBUTE}="on"] body,
            html[${ROOT_ATTRIBUTE}="on"] #wrapperNeue,
            html[${ROOT_ATTRIBUTE}="on"] #main {
                background-color: #272822 !important;
                color: #f8f8f2 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] #headerNeue2,
            html[${ROOT_ATTRIBUTE}="on"] #headerNeue2 .headerNeueInner,
            html[${ROOT_ATTRIBUTE}="on"] #dock,
            html[${ROOT_ATTRIBUTE}="on"] #robot,
            html[${ROOT_ATTRIBUTE}="on"] .navSubTabs,
            html[${ROOT_ATTRIBUTE}="on"] .popup,
            html[${ROOT_ATTRIBUTE}="on"] .dropdown,
            html[${ROOT_ATTRIBUTE}="on"] .menu_inner {
                background-color: #1f201c !important;
                border-color: #4c4d43 !important;
                color: #f8f8f2 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] .box,
            html[${ROOT_ATTRIBUTE}="on"] .content_inner,
            html[${ROOT_ATTRIBUTE}="on"] .sideInner,
            html[${ROOT_ATTRIBUTE}="on"] .sidePanel,
            html[${ROOT_ATTRIBUTE}="on"] .postTopic,
            html[${ROOT_ATTRIBUTE}="on"] .reply,
            html[${ROOT_ATTRIBUTE}="on"] .message,
            html[${ROOT_ATTRIBUTE}="on"] .tmlContent,
            html[${ROOT_ATTRIBUTE}="on"] #comment_box,
            html[${ROOT_ATTRIBUTE}="on"] #browserItemList > li,
            html[${ROOT_ATTRIBUTE}="on"] .browserList > li,
            html[${ROOT_ATTRIBUTE}="on"] .item {
                border-color: #4c4d43 !important;
                color: #f8f8f2 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] .light_odd,
            html[${ROOT_ATTRIBUTE}="on"] .odd,
            html[${ROOT_ATTRIBUTE}="on"] tr:nth-child(odd) {
                background-color: #2c2d27 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] .light_even,
            html[${ROOT_ATTRIBUTE}="on"] .even,
            html[${ROOT_ATTRIBUTE}="on"] tr:nth-child(even) {
                background-color: #34352f !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] hr,
            html[${ROOT_ATTRIBUTE}="on"] table,
            html[${ROOT_ATTRIBUTE}="on"] th,
            html[${ROOT_ATTRIBUTE}="on"] td,
            html[${ROOT_ATTRIBUTE}="on"] fieldset {
                border-color: #4c4d43 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] h1,
            html[${ROOT_ATTRIBUTE}="on"] h2,
            html[${ROOT_ATTRIBUTE}="on"] h3,
            html[${ROOT_ATTRIBUTE}="on"] h4,
            html[${ROOT_ATTRIBUTE}="on"] h5,
            html[${ROOT_ATTRIBUTE}="on"] h6,
            html[${ROOT_ATTRIBUTE}="on"] strong,
            html[${ROOT_ATTRIBUTE}="on"] .title,
            html[${ROOT_ATTRIBUTE}="on"] .subtitle {
                color: #f8f8f2 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] .grey,
            html[${ROOT_ATTRIBUTE}="on"] .tip,
            html[${ROOT_ATTRIBUTE}="on"] .info,
            html[${ROOT_ATTRIBUTE}="on"] .time,
            html[${ROOT_ATTRIBUTE}="on"] .subtitle,
            html[${ROOT_ATTRIBUTE}="on"] small {
                color: #a8a897 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] a,
            html[${ROOT_ATTRIBUTE}="on"] a:link,
            html[${ROOT_ATTRIBUTE}="on"] a:visited {
                color: #66d9ef;
            }

            html[${ROOT_ATTRIBUTE}="on"] a:hover,
            html[${ROOT_ATTRIBUTE}="on"] a:focus-visible {
                color: #a6e22e !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] input:not([type="checkbox"]):not([type="radio"]),
            html[${ROOT_ATTRIBUTE}="on"] textarea,
            html[${ROOT_ATTRIBUTE}="on"] select,
            html[${ROOT_ATTRIBUTE}="on"] button {
                background-color: #34352f !important;
                border-color: #57584e !important;
                color: #f8f8f2 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] input::placeholder,
            html[${ROOT_ATTRIBUTE}="on"] textarea::placeholder {
                color: #75715e !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] input:focus,
            html[${ROOT_ATTRIBUTE}="on"] textarea:focus,
            html[${ROOT_ATTRIBUTE}="on"] select:focus,
            html[${ROOT_ATTRIBUTE}="on"] button:focus-visible,
            html[${ROOT_ATTRIBUTE}="on"] a:focus-visible {
                border-color: #a6e22e !important;
                outline-color: #a6e22e !important;
                box-shadow: 0 0 0 2px rgba(166, 226, 46, .22) !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] input[type="submit"],
            html[${ROOT_ATTRIBUTE}="on"] input[type="button"],
            html[${ROOT_ATTRIBUTE}="on"] .btnPink,
            html[${ROOT_ATTRIBUTE}="on"] .chiiBtn,
            html[${ROOT_ATTRIBUTE}="on"] .button {
                background-color: #f92672 !important;
                border-color: #f92672 !important;
                color: #f8f8f2 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] input[type="submit"]:hover,
            html[${ROOT_ATTRIBUTE}="on"] input[type="button"]:hover,
            html[${ROOT_ATTRIBUTE}="on"] .btnPink:hover,
            html[${ROOT_ATTRIBUTE}="on"] .chiiBtn:hover,
            html[${ROOT_ATTRIBUTE}="on"] .button:hover {
                background-color: #a6e22e !important;
                border-color: #a6e22e !important;
                color: #272822 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] .focus,
            html[${ROOT_ATTRIBUTE}="on"] .selected,
            html[${ROOT_ATTRIBUTE}="on"] .active,
            html[${ROOT_ATTRIBUTE}="on"] .current {
                border-color: #f92672 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] .global_score,
            html[${ROOT_ATTRIBUTE}="on"] .rating .current,
            html[${ROOT_ATTRIBUTE}="on"] .starsinfo,
            html[${ROOT_ATTRIBUTE}="on"] .starstop {
                color: #e6db74 !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] .error,
            html[${ROOT_ATTRIBUTE}="on"] .warning {
                color: #fd971f !important;
            }

            html[${ROOT_ATTRIBUTE}="on"] ::selection {
                background: #49483e;
                color: #f8f8f2;
            }

            #${OPTION_ID} .bgm-monokai-color-preview {
                background: conic-gradient(
                    from -45deg,
                    #f92672 0 25%,
                    #fd971f 0 50%,
                    #a6e22e 0 75%,
                    #66d9ef 0 100%
                ) !important;
            }

            #${OPTION_ID} input:checked + label .bgm-monokai-color-preview {
                box-shadow: 0 0 0 2px #f8f8f2, 0 0 0 4px #f92672 !important;
            }
        `

        ;(document.head || document.documentElement).appendChild(style)
    }

    function sync_option_state() {
        const input = document.getElementById(INPUT_ID)
        if (!input) return

        input.checked = theme_enabled
        if (!theme_enabled) return

        const container = input.closest('.color-options')
        for (const native_input of container?.querySelectorAll('input[name="themeColor"]') || []) {
            native_input.checked = false
        }
    }

    function apply_theme(enabled, persist = true) {
        theme_enabled = Boolean(enabled)
        document.documentElement.toggleAttribute(ROOT_ATTRIBUTE, theme_enabled)
        if (theme_enabled) document.documentElement.setAttribute(ROOT_ATTRIBUTE, 'on')
        if (persist) save_setting(theme_enabled)
        sync_option_state()
    }

    function handle_theme_change(event) {
        const input = event.target
        if (!(input instanceof HTMLInputElement) || !input.checked) return

        if (input.id === INPUT_ID) {
            event.stopPropagation()
            apply_theme(true)
            return
        }

        if (input.name === 'themeColor') apply_theme(false)
    }

    function inject_theme_option() {
        const container = document.querySelector('#section-themeColor > .color-options')
        if (!container) return false

        let option = document.getElementById(OPTION_ID)
        if (!option) {
            option = document.createElement('div')
            option.id = OPTION_ID
            option.className = 'color-option-item'

            const input = document.createElement('input')
            input.type = 'radio'
            input.id = INPUT_ID
            input.name = 'bgmMonokaiTheme'
            input.value = 'on'

            const label = document.createElement('label')
            label.htmlFor = INPUT_ID
            label.title = 'Monokai：深灰背景、粉色主调、青绿点缀'

            const preview = document.createElement('span')
            preview.className = 'color-preview bgm-monokai-color-preview'

            const label_text = document.createElement('span')
            label_text.className = 'color-label'
            label_text.textContent = 'Monokai'

            label.append(preview, label_text)
            option.append(input, label)
            container.appendChild(option)
        }

        if (container.dataset.bgmMonokaiBound !== 'true') {
            container.dataset.bgmMonokaiBound = 'true'
            container.addEventListener('change', handle_theme_change, true)
        }

        sync_option_state()
        return true
    }

    function schedule_theme_option_injection() {
        for (const delay of INJECT_DELAYS) {
            setTimeout(inject_theme_option, delay)
        }
    }

    add_style()
    apply_theme(theme_enabled, false)

    document.addEventListener('click', event => {
        if (event.target.closest?.('.toggle-customize')) {
            schedule_theme_option_injection()
        }
    }, true)

    window.addEventListener('storage', event => {
        if (event.key === STORAGE_KEY) apply_theme(event.newValue === 'on', false)
    })

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', schedule_theme_option_injection, { once: true })
    } else {
        schedule_theme_option_injection()
    }
})()
