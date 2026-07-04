// ==UserScript==
// @name         Musubi♾️话题推荐
// @version      2.0.0
// @author       Wataame
// @match        https://bgm.tv/group/topic/*
// @match        https://bangumi.tv/group/topic/*
// @match        https://chii.in/group/topic/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ── 1. CONFIG ────────────────────────────────────────────
    const CONFIG = {
        API_BASE: 'https://bgm.ry.mk',
        PAGE_SIZE: 5,
    };

    // ── 2. STATE ─────────────────────────────────────────────
    const state = {
        currentTab: 'recommendations',
        currentOffset: 0,
        cache: {
            recommendations: [],
            trending: [],
        },
    };

    // ── 3. API ───────────────────────────────────────────────
    const api = {
        async _fetch(url) {
            const res = await fetch(url);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`服务器错误 (${res.status})`);
            return res.json();
        },

        async recommendations(topicId, offset = 0) {
            const data = await this._fetch(
                `${CONFIG.API_BASE}/recommend/topics/${topicId}?limit=${CONFIG.PAGE_SIZE}&offset=${offset}`
            );
            return data?.recommendations ?? [];
        },

        async trending(offset = 0) {
            const data = await this._fetch(
                `${CONFIG.API_BASE}/recommend/trending?limit=${CONFIG.PAGE_SIZE}&offset=${offset}`
            );
            return data?.trends ?? [];
        },
    };

    // ── 4. UTILS ─────────────────────────────────────────────
    const utils = {
        getTopicId() {
            const m = location.pathname.match(/\/group\/topic\/(\d+)/);
            return m ? parseInt(m[1]) : null;
        },

        escapeHtml(text = '') {
            return text.replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
            })[c]);
        },

        formatDate(iso) {
            return new Date(iso).toISOString().split('T')[0];
        },

        filterIgnored(items, type) {
            const isEnabled = chiiApp?.cloud_settings?.get('musubi_filter_ignored_users') === 'on';
            if (!isEnabled) return items;

            const ignoredUsers = data_ignore_users;
            if (!ignoredUsers.length) return items;

            return items.filter(item => {
                const topic = type === 'trending' ? item.topic : item;
                return !ignoredUsers.includes(topic.user_username) &&
                       !ignoredUsers.includes(topic.user_nickname);
            });
        }
    };

    // ── 5. RENDER ────────────────────────────────────────────
    const render = {
        getSkeletonHtml() {
            const items = Array.from({ length: 5 }).map(() => `
                <li class="bgm-rec-item bgm-rec-skeleton-item">
                    <div class="avatar-link"><span class="avatarNeue avatarSize32 bgm-rec-skeleton-avatar"></span></div>
                    <div class="info">
                        <div class="bgm-rec-skeleton-text bgm-rec-skeleton-title"></div>
                        <div class="bgm-rec-skeleton-text bgm-rec-skeleton-meta"></div>
                    </div>
                </li>
            `).join('');

            return `
                <ul class="bgm-rec-items">
                    ${items}
                </ul>
            `;
        },

        loading() {
            document.getElementById('bgm-rec-list').innerHTML = this.getSkeletonHtml();
        },

        error(msg) {
            document.getElementById('bgm-rec-list').innerHTML =
                `<div class="bgm-rec-error" title="${utils.escapeHtml(msg)}">加载失败</div>`;
        },

        empty() {
            document.getElementById('bgm-rec-list').innerHTML =
                `<div class="bgm-rec-empty">暂无数据</div>`;
        },

        items(items, type) {
            const container = document.getElementById('bgm-rec-list');

            if (!items.length) return this.empty();

            const list = document.createElement('ul');
            list.className = 'bgm-rec-items';

            items.forEach((item, i) => {
                const topic = type === 'trending' ? item.topic : item;
                const li = document.createElement('li');
                li.className = 'bgm-rec-item';
                li.style.animationDelay = `${i * 50}ms`;
                li.innerHTML = `
                    <a href="${topic.url}" class="avatar-link" title="${utils.escapeHtml(topic.user_nickname)}">
                        <span class="avatarNeue avatarSize32"
                              style="background-image:url('${topic.user_avatar || '/img/no_icon_subject.png'}')">
                        </span>
                    </a>
                    <div class="info">
                        <div class="title-row">
                            <a href="${topic.url}" class="title"
                               title="${utils.escapeHtml(topic.title)}">${utils.escapeHtml(topic.title)}</a><span class="reply-count">(+${topic.reply_count})</span>
                        </div>
                        <div class="meta">
                            <span class="author">${utils.escapeHtml(topic.user_nickname)}</span> · <span class="date">${utils.formatDate(topic.created_at)}</span>
                        </div>
                    </div>`;
                list.appendChild(li);
            });

            container.innerHTML = '';
            container.appendChild(list);
        },
    };

    // ── 6. ACTIONS ───────────────────────────────────────────
    const actions = {
        async loadTab(tab) {
            if (state.currentTab !== tab) {
                state.currentTab = tab;
            }

            // Update tab ui
            document.querySelectorAll('.bgm-rec-tab')
                .forEach(el => el.classList.toggle('active', el.id === `tab-${tab}`));

            // Use cache if available
            if (state.cache[tab].length) {
                return render.items(state.cache[tab], tab);
            }

            render.loading();

            try {
                let items = tab === 'trending'
                    ? await api.trending(0)
                    : await api.recommendations(utils.getTopicId(), 0);

                items = utils.filterIgnored(items, tab);

                state.cache[tab] = items;
                if (state.currentTab === tab) render.items(items, tab);
            } catch (err) {
                if (state.currentTab === tab) render.error(err.message);
            }
        },

        async refresh() {
            const container = document.getElementById('bgm-rec-list');
            const btn = document.getElementById('bgm-rec-refresh-btn');
            container.style.opacity = '0.5';
            btn.classList.add('refreshing');

            state.currentOffset += CONFIG.PAGE_SIZE;
            const topicId = utils.getTopicId();
            const tab = state.currentTab;

            try {
                let items = tab === 'trending'
                    ? await api.trending(state.currentOffset)
                    : await api.recommendations(topicId, state.currentOffset);

                items = utils.filterIgnored(items, tab);

                if (!items.length) {
                    state.currentOffset = 0;
                    items = tab === 'trending'
                        ? await api.trending(0)
                        : await api.recommendations(topicId, 0);
                    items = utils.filterIgnored(items, tab);
                }

                state.cache[tab] = items;
                render.items(items, tab);
            } catch (err) {
                console.error('[Bangumi Recommendation]', err);
                render.error(err.message);
                state.currentOffset -= CONFIG.PAGE_SIZE;
            } finally {
                container.style.opacity = '1';
                btn.classList.remove('refreshing');
            }
        },
    };

    /* =========================================================
     * 7. DOM / STYLES
     * ========================================================= */
    function buildPanel() {
        const panel = document.createElement('div');
        panel.id = 'bgm-rec-module';
        panel.className = 'menu_inner';
        panel.innerHTML = `
            <div class="bgm-rec-header">
                <div class="bgm-rec-tabs">
                    <span id="tab-recommendations" class="bgm-rec-tab active">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2.5"
                             stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M9.183 6.117a6 6 0 1 0 4.511 3.986"/>
                            <path d="M14.813 17.883a6 6 0 1 0 -4.496 -3.954"/>
                        </svg>
                        相关
                    </span>
                    <span class="bgm-rec-tab-divider">|</span>
                    <span id="tab-trending" class="bgm-rec-tab">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2.5"
                             stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M12 10.941c2.333-3.308.167-7.823-1-8.941c0 3.395-2.235 5.299-3.667 6.706
                                     c-1.43 1.408-2.333 3.294-2.333 5.588c0 3.704 3.134 6.706 7 6.706
                                     c3.866 0 7-3.002 7-6.706c0-1.712-1.232-4.403-2.333-5.588
                                     c-2.084 3.353-3.257 3.353-4.667 2.235"/>
                        </svg>
                        趋势
                    </span>
                </div>
                <div class="bgm-rec-collapse-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6l6 -6"></path></svg>
                </div>
            </div>
            <div class="bgm-rec-collapse-wrapper">
                <div class="bgm-rec-collapse-inner">
                    <div id="bgm-rec-list" class="bgm-rec-content">
                        ${render.getSkeletonHtml()}
                    </div>
                    <div class="bgm-rec-footer">
                        <span id="bgm-rec-refresh-btn" class="bgm-rec-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor" stroke-width="2"
                                 stroke-linecap="round" stroke-linejoin="round"
                                 class="icon icon-tabler icons-tabler-outline icon-tabler-reload">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M19.933 13.041a8 8 0 1 1 -9.925 -8.788c3.899 -1 7.935 1.007 9.425 4.747" />
                                <path d="M20 4v5h-5" />
                            </svg>
                            换一批
                        </span>
                    </div>
                </div>
            </div>`;
        return panel;
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            :root { --rec-text: #333; --rec-text-sub: #aaa; --rec-border: rgba(0,0,0,.05) }
            html[data-theme='dark'] { --rec-text: #F0F0F0; --rec-text-sub: #AAAAAA; --rec-border: rgba(255,255,255,.1) }

            .bgm-rec-collapse-wrapper { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 0.3s ease-out; }
            .bgm-rec-collapse-inner { overflow: hidden; padding: 6px; margin: -6px; transition: opacity 0.3s ease-out, visibility 0s; }
            #bgm-rec-module.collapsed .bgm-rec-collapse-wrapper { grid-template-rows: 0fr; }
            #bgm-rec-module.collapsed .bgm-rec-collapse-inner { opacity: 0; visibility: hidden; transition: opacity 0.3s ease-out, visibility 0s 0.3s; }

            #bgm-rec-module.collapsed .bgm-rec-header { border-bottom-color: transparent; margin-bottom: 0; padding-bottom: 0; }
            .bgm-rec-header  { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; margin-bottom: 5px; border-bottom: 1px solid var(--rec-border); user-select: none; transition: all 0.3s ease-out; }
            #bgm-rec-module.collapsible .bgm-rec-header { cursor: pointer; }
            .bgm-rec-collapse-icon { color: var(--rec-text-sub); display: none; align-items: center; transition: transform 0.3s ease-out; transform: rotate(180deg); }
            #bgm-rec-module.collapsible .bgm-rec-collapse-icon { display: flex; }
            #bgm-rec-module.collapsed .bgm-rec-collapse-icon { transform: rotate(0deg); }
            
            .bgm-rec-tabs    { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: bold }
            .bgm-rec-tab     { display: flex; align-items: center; gap: 4px; color: var(--rec-text-sub); cursor: pointer; transition: color .2s }
            .bgm-rec-tab:hover     { color: var(--rec-text) }
            .bgm-rec-tab.active    { color: var(--primary-color) }
            .bgm-rec-tab-divider   { color: var(--rec-border); font-weight: normal }

            .bgm-rec-content { font-size: 12px; min-height: 50px }
            .bgm-rec-items   { list-style: none; padding: 0; margin: 0 }

            .bgm-rec-item              { display: flex; align-items: flex-start; padding: 8px 0; border-bottom: 1px dashed var(--rec-border); gap: 10px; animation: bgm-rec-fade-in .3s ease-out backwards }
            .bgm-rec-item:last-child   { border-bottom: none; padding-bottom: 0 }
            .bgm-rec-item .avatar-link { flex-shrink: 0; margin-top: 2px }
            .bgm-rec-item .info        { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 2px }
            .bgm-rec-item .title-row   { overflow: hidden; line-height: 1.4; word-break: break-all; }
            .bgm-rec-item .title       { color: var(--rec-text); text-decoration: none; font-size: 12px; transition: color .2s }
            .bgm-rec-item .title:hover { color: var(--primary-color); text-decoration: underline }
            .bgm-rec-item .reply-count { color: var(--rec-text-sub); font-size: 10px; white-space: nowrap; margin-left: 2px; }
            .bgm-rec-item .meta        { color: var(--rec-text-sub); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
            .bgm-rec-item .author      { max-width: 45%; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; display: inline-block }

            .bgm-rec-loading { padding: 15px 0; text-align: center; color: var(--rec-text-sub); display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px }
            
            /* Skeleton Loading */
            @keyframes bgm-rec-skeleton-pulse {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            .bgm-rec-skeleton-item { pointer-events: none; border-bottom: 1px dashed var(--rec-border); }
            html[data-theme='dark'] .bgm-rec-skeleton-item .bgm-rec-skeleton-avatar,
            html[data-theme='dark'] .bgm-rec-skeleton-item .bgm-rec-skeleton-text {
                background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
                background-size: 200% 100%;
            }
            .bgm-rec-skeleton-avatar, .bgm-rec-skeleton-text {
                background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
                background-size: 200% 100%;
                animation: bgm-rec-skeleton-pulse 1.5s infinite linear;
            }
            .bgm-rec-skeleton-text { border-radius: 4px; }
            .bgm-rec-skeleton-avatar { display: inline-block; margin-top: 2px; }
            .bgm-rec-skeleton-text { height: 12px; margin-bottom: 6px; }
            .bgm-rec-skeleton-title { width: 85%; }
            .bgm-rec-skeleton-meta { width: 40%; height: 10px; margin-top: 4px; margin-bottom: 0; }

            .bgm-rec-footer  { display: flex; justify-content: flex-end; padding-top: 6px; font-size: 10px }
            .bgm-rec-btn     { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 6px; margin: -4px; color: var(--rec-text-sub); cursor: pointer; transition: all .2s; user-select: none }
            .bgm-rec-btn:hover { color: var(--primary-color); background-color: var(--rec-border) }
            @keyframes bgm-rec-spin { 100% { transform: rotate(360deg) } }
            .bgm-rec-btn.refreshing svg { animation: bgm-rec-spin 1s linear infinite }

            .bgm-rec-empty, .bgm-rec-error { padding: 10px 0; text-align: center; color: var(--rec-text-sub); font-size: 12px }
            .bgm-rec-error { color: #E74C3C; cursor: pointer }

            @keyframes bgm-rec-fade-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        `;
        document.head.appendChild(style);
    }

    /* =========================================================
     * 8. INIT
     * ========================================================= */
    function init() {
        const topicId = utils.getTopicId();
        const sidebar = document.getElementById('columnInSubjectB') || document.getElementById('columnB');
        if (!sidebar || !topicId) return;

        addStyles();

        const panel = buildPanel();

        const isCollapsible = chiiApp?.cloud_settings?.get('musubi_collapse_recommendations') === 'on';
        if (isCollapsible) {
            panel.classList.add('collapsible', 'collapsed');
        }

        const lastMenu = [...sidebar.querySelectorAll('.menu_inner')].at(-1);
        lastMenu
            ? lastMenu.after(panel)
            : sidebar.appendChild(panel);

        document.getElementById('tab-recommendations').addEventListener('click', () => actions.loadTab('recommendations'));
        document.getElementById('tab-trending').addEventListener('click', () => actions.loadTab('trending'));
        document.getElementById('bgm-rec-refresh-btn').addEventListener('click', () => actions.refresh());

        if (isCollapsible) {
            panel.querySelector('.bgm-rec-header').addEventListener('click', (e) => {
                if (panel.classList.contains('collapsed')) {
                    panel.classList.remove('collapsed');
                    actions.loadTab(state.currentTab);
                } else if (!e.target.closest('.bgm-rec-tab')) {
                    panel.classList.add('collapsed');
                }
            });
        }

        if (!isCollapsible) {
            actions.loadTab('recommendations');
        }
    }

    function registerSettings() {
        const createOption = (title, name) => ({
            title,
            name,
            type: 'radio',
            defaultValue: 'off',
            getCurrentValue: () => chiiApp?.cloud_settings?.get(name) || 'off',
            onChange: (value) => {
                if (chiiApp?.cloud_settings) {
                    chiiApp.cloud_settings.update({ [name]: value });
                    chiiApp.cloud_settings.save();
                }
            },
            options: [
                { value: 'on', label: '开启' },
                { value: 'off', label: '关闭' }
            ]
        });

        let attempts = 0;
        const tryRegister = () => {
            if (chiiLib?.ukagaka?.addPanelTab) {
                chiiLib.ukagaka.addPanelTab({
                    tab: 'musubi',
                    label: 'Musubi',
                    type: 'options',
                    config: [
                        createOption('屏蔽绝交用户', 'musubi_filter_ignored_users'),
                        createOption('默认折叠推荐', 'musubi_collapse_recommendations')
                    ]
                });
            } else if (attempts < 10) {
                attempts++;
                setTimeout(tryRegister, 500);
            }
        };
        tryRegister();
    }

    registerSettings();
    init();

})();