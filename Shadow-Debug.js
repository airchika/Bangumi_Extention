// ==UserScript==
// @name         Shadow Environment Debug
// @namespace    https://bangumi.tv/dev/app/5445
// @version      1.0.0
// @description  检测 Shadow 在油猴与 Bangumi 官方组件环境中的初始化差异
// @author       https://bangumi.tv/user/air_chika
// @include      https://bgm.tv/*
// @include      https://bangumi.tv/*
// @include      https://chii.in/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict'

    const PREFIX = '[Shadow Debug]'
    const started_at = Date.now()
    const records = []
    let settings_registered = false
    let settings_attempts = 0
    let panel = null
    let report_output = null

    function bare_chii_app() {
        return typeof chiiApp === 'undefined' ? undefined : chiiApp
    }

    function bare_chii_lib() {
        return typeof chiiLib === 'undefined' ? undefined : chiiLib
    }

    function bare_gm_info() {
        return typeof GM_info === 'undefined' ? undefined : GM_info
    }

    function bare_unsafe_window() {
        return typeof unsafeWindow === 'undefined' ? undefined : unsafeWindow
    }

    function safe_value(label, getter) {
        try {
            const value = getter()
            return {
                label,
                ok: true,
                type: value === null ? 'null' : typeof value,
                value: typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                    ? value
                    : value == null ? null : '[存在]',
            }
        } catch (error) {
            return {
                label,
                ok: false,
                error: `${error && error.name ? error.name : 'Error'}: ${error && error.message ? error.message : String(error)}`,
            }
        }
    }

    function inspect_environment(stage) {
        const floor_selector = 'div[id^="post_"], .postTopic, .sub_reply_bg'
        const floors = document.querySelectorAll(floor_selector)
        const snapshot = {
            stage,
            elapsedMs: Date.now() - started_at,
            readyState: document.readyState,
            url: location.origin + location.pathname,
            queryKeys: [...new Set(new URLSearchParams(location.search).keys())],
            globals: [
                safe_value('bare chiiApp', () => bare_chii_app()),
                safe_value('bare chiiApp.cloud_settings', () => bare_chii_app() && bare_chii_app().cloud_settings),
                safe_value('bare cloud_settings.get', () => bare_chii_app() && bare_chii_app().cloud_settings && bare_chii_app().cloud_settings.get),
                safe_value('bare cloud_settings.update', () => bare_chii_app() && bare_chii_app().cloud_settings && bare_chii_app().cloud_settings.update),
                safe_value('bare cloud_settings.save', () => bare_chii_app() && bare_chii_app().cloud_settings && bare_chii_app().cloud_settings.save),
                safe_value('bare chiiLib', () => bare_chii_lib()),
                safe_value('bare chiiLib.ukagaka', () => bare_chii_lib() && bare_chii_lib().ukagaka),
                safe_value('bare ukagaka.addPanelTab', () => bare_chii_lib() && bare_chii_lib().ukagaka && bare_chii_lib().ukagaka.addPanelTab),
                safe_value('globalThis.chiiApp', () => globalThis.chiiApp),
                safe_value('chiiApp.cloud_settings', () => globalThis.chiiApp && globalThis.chiiApp.cloud_settings),
                safe_value('cloud_settings.get', () => globalThis.chiiApp && globalThis.chiiApp.cloud_settings && globalThis.chiiApp.cloud_settings.get),
                safe_value('cloud_settings.update', () => globalThis.chiiApp && globalThis.chiiApp.cloud_settings && globalThis.chiiApp.cloud_settings.update),
                safe_value('cloud_settings.save', () => globalThis.chiiApp && globalThis.chiiApp.cloud_settings && globalThis.chiiApp.cloud_settings.save),
                safe_value('globalThis.chiiLib', () => globalThis.chiiLib),
                safe_value('chiiLib.ukagaka', () => globalThis.chiiLib && globalThis.chiiLib.ukagaka),
                safe_value('ukagaka.addPanelTab', () => globalThis.chiiLib && globalThis.chiiLib.ukagaka && globalThis.chiiLib.ukagaka.addPanelTab),
                safe_value('bare GM_info', () => bare_gm_info()),
                safe_value('globalThis.GM_info', () => globalThis.GM_info),
                safe_value('bare unsafeWindow', () => bare_unsafe_window()),
                safe_value('globalThis.unsafeWindow', () => globalThis.unsafeWindow),
            ],
            dom: {
                body: !!document.body,
                navTabs: !!document.querySelector('.navTabs'),
                panelInterestWrapper: !!document.getElementById('panelInterestWrapper'),
                floorCount: floors.length,
                floorWithActionsCount: Array.from(floors).filter(floor => !!floor.querySelector('.post_actions.re_info, .post_actions, .re_info')).length,
            },
            settings: {
                registered: settings_registered,
                attempts: settings_attempts,
            },
        }
        records.push(snapshot)
        console.log(PREFIX, snapshot)
        refresh_report()
    }

    function try_register_settings(stage) {
        if (settings_registered) return
        settings_attempts++
        const attempt = {
            stage: `addPanelTab:${stage}`,
            elapsedMs: Date.now() - started_at,
            available: false,
            result: '',
        }
        try {
            const library = bare_chii_lib() || globalThis.chiiLib
            const add_panel_tab = library && library.ukagaka && library.ukagaka.addPanelTab
            attempt.available = typeof add_panel_tab === 'function'
            if (!attempt.available) {
                attempt.result = 'API 不存在'
            } else {
                const result = add_panel_tab.call(library.ukagaka, {
                    tab: 'shadow-debug',
                    label: 'Shadow Debug',
                    type: 'options',
                    config: [{
                        title: 'Shadow 调试设置注册成功',
                        name: 'shadow_debug_probe',
                        type: 'radio',
                        defaultValue: 'on',
                        getCurrentValue: () => 'on',
                        onChange: () => {},
                        options: [{ value: 'on', label: '已注册' }, { value: 'off', label: '占位选项' }],
                    }],
                })
                settings_registered = true
                attempt.result = `调用成功，返回类型：${result === null ? 'null' : typeof result}`
            }
        } catch (error) {
            attempt.result = `${error && error.name ? error.name : 'Error'}: ${error && error.message ? error.message : String(error)}`
        }
        records.push(attempt)
        console.log(PREFIX, attempt)
        refresh_report()
    }

    function build_report() {
        return JSON.stringify({
            reportVersion: 1,
            userAgent: navigator.userAgent,
            generatedAt: new Date().toISOString(),
            records,
        }, null, 2)
    }

    function refresh_report() {
        if (report_output) report_output.value = build_report()
    }

    async function copy_report(button) {
        const report = build_report()
        try {
            await navigator.clipboard.writeText(report)
            button.textContent = '已复制'
        } catch (error) {
            report_output.focus()
            report_output.select()
            const copied = document.execCommand('copy')
            button.textContent = copied ? '已复制' : '请手动复制'
        }
        setTimeout(() => { button.textContent = '复制报告' }, 1600)
    }

    function create_debug_ui() {
        if (!document.body || document.getElementById('shadow-debug-toggle')) return
        const style = document.createElement('style')
        style.textContent = `
            #shadow-debug-toggle { position:fixed;right:12px;bottom:12px;z-index:100000;padding:7px 10px;border:1px solid #d49b00;border-radius:5px;color:#6f4f00;background:#fff3bd;cursor:pointer;font:12px/1.4 sans-serif; }
            #shadow-debug-panel { position:fixed;right:12px;bottom:52px;z-index:100000;display:none;width:min(680px,calc(100vw - 24px));height:min(70vh,620px);padding:12px;border:1px solid #888;border-radius:8px;color:#222;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.3);font:13px/1.4 sans-serif; }
            #shadow-debug-panel.is-open { display:flex;flex-direction:column;gap:8px; }
            #shadow-debug-panel header { display:flex;align-items:center;gap:8px; }
            #shadow-debug-panel header strong { margin-right:auto; }
            #shadow-debug-panel button { padding:4px 8px;cursor:pointer; }
            #shadow-debug-report { flex:1;width:100%;min-height:240px;padding:8px;resize:none;color:#ddd;background:#222;font:11px/1.35 Consolas,monospace; }
            html[data-theme=dark] #shadow-debug-toggle { color:#f1c94b;background:#4a3a00; }
            html[data-theme=dark] #shadow-debug-panel { color:#ddd;background:#292929; }
        `
        document.head.append(style)

        const toggle = document.createElement('button')
        toggle.id = 'shadow-debug-toggle'
        toggle.type = 'button'
        toggle.textContent = 'Shadow Debug'

        panel = document.createElement('section')
        panel.id = 'shadow-debug-panel'
        panel.innerHTML = `
            <header>
                <strong>Shadow 环境检测</strong>
                <button type="button" data-debug-action="refresh">重新检测</button>
                <button type="button" data-debug-action="copy">复制报告</button>
                <button type="button" data-debug-action="close">关闭</button>
            </header>
            <div>请分别在本地油猴版和 Bangumi 官方组件版中复制报告。报告不包含 Cookie、Token 或云端数据。</div>
            <textarea id="shadow-debug-report" readonly spellcheck="false"></textarea>
        `
        document.body.append(panel, toggle)
        report_output = panel.querySelector('#shadow-debug-report')
        refresh_report()

        toggle.addEventListener('click', () => {
            panel.classList.toggle('is-open')
            refresh_report()
        })
        panel.addEventListener('click', event => {
            const action = event.target.dataset.debugAction
            if (action === 'close') panel.classList.remove('is-open')
            if (action === 'refresh') {
                try_register_settings('manual')
                inspect_environment('manual')
            }
            if (action === 'copy') copy_report(event.target)
        })
    }

    function run_checkpoint(stage) {
        create_debug_ui()
        try_register_settings(stage)
        inspect_environment(stage)
    }

    console.log(`${PREFIX} 脚本已开始执行`)
    run_checkpoint('immediate')
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => run_checkpoint('DOMContentLoaded'), { once: true })
    }
    ;[250, 1000, 3000, 5000].forEach(delay => {
        setTimeout(() => run_checkpoint(`${delay}ms`), delay)
    })
})()
