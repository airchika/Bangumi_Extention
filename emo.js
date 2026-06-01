// ==UserScript==
// @name         BMO 快速拼装面板
// @match        *://bgm.tv/*
// @match        *://chii.in/*
// @match        *://bangumi.tv/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // --- 配置项 ---
    const siteVersion = window.CHOBITS_VER;
    const BMO_JS_URL = `/js/lib/bmo/bmo.js?${siteVersion}`;
    const MANIFEST_URL = `/js/lib/bmo/assets/manifest.local.json?${siteVersion}`;
    const FAVORITES_CLOUD_KEY = 'chii_saved_bmo';
    const FAVORITES_CLOUD_TIMESTAMP_KEY = 'chii_saved_bmo_cloud_updated';
    const HISTORY_CLOUD_KEY = 'bmo_quick_panel_history';
    const HISTORY_MAX_ITEMS = 50;

    // --- 状态变量 ---
    let assets = null;
    let selectedItems = {};
    let selectedElements = {};  // [优化] 直接追踪已选 DOM 元素，避免 querySelectorAll 扫描
    let bmoApi = null;
    let lastSelectedItemKey = null;
    let dom = {};
    let externalTargetTextarea = null;
    let cachedFavorites = null;  // [优化] 收藏内存缓存，避免反复触发云同步

    const css = `
        #bmo-quick-panel-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,.3);z-index:10000;display:none;align-items:center;justify-content:center}
        #bmo-quick-panel.modal-panel{display:none;flex-direction:column;width:90vw;max-width:800px;height:85vh;max-height:600px}
        #bmo-quick-panel .content { height: 100%; max-height: none; padding: 10px; }
        .bmo-panel-layout{display:grid;grid-template-columns:120px 1fr 150px;gap:10px;height:100%;overflow:hidden}
        #bmo-main-tab-list { list-style-type: none; margin: 0; padding: 5px 0 5px 5px; display: flex; flex-direction: column; gap: 8px; }
        .bmo-main-tab{padding:12px 10px;text-align:center;font-weight:600;border-radius:50px;cursor:pointer;transition:all .2s ease;background:rgba(255,255,255,.5);border:1px solid rgba(0,0,0,.1);color:#666}html[data-theme=dark] .bmo-main-tab{background:rgba(80,80,80,.5);border:1px solid rgba(255,255,255,.1);color:#bbb}.bmo-main-tab:hover{border-color:var(--primary-color);color:var(--primary-color)}.bmo-main-tab.active{background:var(--primary-color);border-color:var(--primary-color);color:#fff;transform:scale(1.03);font-weight:700}html[data-theme=dark] .bmo-main-tab.active{background:var(--primary-color);border-color:var(--primary-color);color:#fff}
        html[data-theme=dark] .bmo-main-tab:hover { border-color:  var(--primary-color); color:  #fff; }
        #bmo-main-tab-content { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
        .bmo-main-tab-pane { display: none; flex-direction: column; height: 100%; overflow: hidden; }
        .bmo-main-tab-pane.active { display: flex; }
        #bmo-main-tab-content .panel-tabs { margin-bottom: 10px; }
        #bmo-sub-tab-content, #bmo-favorites-pane, #bmo-history-pane { overflow-y: auto; scrollbar-width: none; padding: 5px; height: 100%; }
        #bmo-favorites-pane::-webkit-scrollbar,#bmo-history-pane::-webkit-scrollbar,#bmo-sub-tab-content::-webkit-scrollbar{display:none}
        #bmo-sub-tab-content { background-color: rgba(255,255,255,0.6); border-radius: 15px; border: 1px solid rgba(0,0,0,0.05); padding: 10px; margin: 5px 5px 0 5px;}
        html[data-theme=dark] #bmo-sub-tab-content { background-color: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.1); }
        .bmo-sub-tab-pane { display: none; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px; }
        .bmo-sub-tab-pane.active { display: grid; }
        .bmo-generic-item{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.7);padding:8px 10px;border-radius:15px;border:1px solid rgba(0,0,0,.08);margin-bottom:0;cursor:pointer;transition:background-color .2s ease;min-width:0}
        html[data-theme=dark] .bmo-generic-item { background: rgba(80,80,80,0.5); border-color: rgba(255,255,255,0.1); }
        .bmo-generic-item:hover { background-color: color-mix(in srgb,  var(--primary-color) 10%, transparent); }
        .bmo-generic-preview { width: 50px; height: 50px; flex-shrink: 0; border: 1px dashed  var(--primary-color); border-radius: 5px; }
        .bmo-generic-preview canvas, .bmo-generic-preview img { width: 100%!important; height: 100%!important; image-rendering: pixelated; }
        .bmo-generic-info { flex-grow: 1; overflow: hidden; white-space: nowrap; }
        .bmo-generic-actions{display:flex;flex-direction:column;gap:5px;align-items:stretch;margin-left:auto;flex-shrink:0}
        .bmo-generic-info strong { display: block; font-size: 14px; text-overflow: ellipsis; overflow: hidden; }
        html[data-theme=light] .bmo-generic-info strong { color: #333; }
        .bmo-generic-item a[class*="btn"] { flex-shrink: 0;}
        .bmo-generic-item a.btnPinkSmall {background-color:var(--primary-color)}
        .bmo-generic-item a.btnPinkSmall:hover {background-color:#369cf8}
        .bmo-item{width:100%;aspect-ratio:1;border:2px solid rgba(0,0,0,.1);border-radius:8px;cursor:pointer;transition:all .2s ease;padding:5px;box-sizing:border-box}
        html[data-theme=dark] .bmo-item { border-color: rgba(255,255,255,0.1); background: rgba(80,80,80,.5);}
        .bmo-item:hover { border-color:  var(--primary-color); transform: scale(1.05); }
        .bmo-item.selected{border-color:var(--primary-color);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary-color) 50%,transparent);background-color:color-mix(in srgb,var(--primary-color) 15%,transparent)}
        .bmo-item img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
        #bmo-preview-column{display:flex;flex-direction:column;align-items:center;gap:10px;padding:15px 10px;justify-content:center;position:relative}
        #bmo-preview-column::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;z-index:-1;background-color:rgba(255,255,255,.5);border-radius:15px;border:1px solid rgba(0,0,0,.05)}
        html[data-theme=dark] #bmo-preview-column::before{background-color:rgba(0,0,0,.2);border-color:rgba(255,255,255,.1)}#bmo-preview-canvas{width:100%;max-width:126px;aspect-ratio:1;border:3px dashed var(--primary-color);border-radius:15px;overflow:hidden;margin-bottom:5px}#bmo-preview-canvas canvas, #bmo-preview-canvas img {display:block;width:100%!important;height:100%!important;image-rendering:pixelated}
        #bmo-preview-actions { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        #bmo-preview-actions .btn{width:100%;text-align:center}
        .btn.disabled{opacity:.5;cursor:not-allowed;transform:none!important;-webkit-transform:none!important;pointer-events:none}
        #bmo-quick-panel .header .close, #bmo-adjust-panel .header .close { border: none; outline: none; }
        #bmo-adjust-panel.modal-panel{display:none;position:fixed;z-index:10001;width:280px;max-width:280px;max-height:none}
        #bmo-adjust-panel .content { padding: 10px 15px; max-height: none; }
        .bmo-adjust-header h5 { margin: 0; font-size: 16px; }
        .bmo-adjust-section { margin-bottom: 15px; }
        .bmo-adjust-section h6 { font-size: 13px; margin: 0 0 8px; color: #888; }
        .bmo-slider-group { display: grid; grid-template-columns: 40px 1fr 55px; align-items: center; gap: 8px; margin-bottom: 10px; }
        .bmo-slider-group label { font-size: 12px; color: #666; grid-column: 1 / 2; }
        html[data-theme=dark] .bmo-slider-group label { color: #bbb; }
        .bmo-slider-group input[type="range"] { width: 100%; grid-column: 2 / 3; margin: 0; }
        .bmo-slider-group input[type="number"] { width: 100%; grid-column: 3 / 4; padding: 3px 5px; border-radius: 4px; border: 1px solid #ccc; text-align: center; -moz-appearance: textfield; background-color: #fff; }
        .bmo-slider-group input[type="number"]::-webkit-outer-spin-button, .bmo-slider-group input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        html[data-theme=dark] .bmo-slider-group input[type="number"] { background-color: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.2); color: #ddd; }
        .bmo-button-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bmo-button-group a.btnGraySmall { text-align: center; }
        #bmo-adjust-parts{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
        .bmo-adjust-part{width:36px;height:36px;border:2px solid rgba(0,0,0,.15);border-radius:6px;cursor:pointer;padding:2px;box-sizing:border-box;transition:all .15s ease;background:#fff}
        html[data-theme=dark] .bmo-adjust-part{border-color:rgba(255,255,255,.15);background:rgba(80,80,80,.5)}
        .bmo-adjust-part:hover{border-color:var(--primary-color)}
        .bmo-adjust-part.active{border-color:var(--primary-color);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary-color) 40%,transparent)}
        .bmo-adjust-part img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
        #bmo-favorites-pane.active,#bmo-history-pane.active{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;align-content:start}
        #bmo-code-box-container{margin:5px 5px 0 5px;padding:5px 12px;display:flex;align-items:center;background:rgba(255,255,255,.6);border-radius:12px;border:1px solid rgba(0,0,0,.05)}
        html[data-theme=dark] #bmo-code-box-container{background:rgba(0,0,0,.2);border-color:rgba(255,255,255,.1)}
        #bmo-code-textarea{flex-grow:1;border:none;outline:none;background:transparent;font-size:13px;font-family:monospace;resize:none;height:18px;line-height:18px;opacity:.45;white-space:nowrap;overflow:hidden;color:inherit;box-shadow:none;-webkit-box-shadow:none;-moz-box-shadow:none;transition:none;-webkit-transition:none;-moz-transition:none}

        #bmo-code-textarea:focus{opacity:1}
        @media (max-width:768px){#bmo-quick-panel.modal-panel{width:95vw;height:90vh;max-width:none}.bmo-panel-layout{grid-template-columns:80px 1fr;grid-template-rows:auto 1fr}#bmo-main-tab-list{grid-column:1/2;grid-row:1/3;padding:5px}.bmo-main-tab{padding:10px 5px;font-size:14px}#bmo-preview-column{grid-column:2/3;grid-row:1/2;flex-direction:row;justify-content:space-around;height:auto;padding:10px}#bmo-preview-actions{gap:10px}#bmo-preview-actions .btn{width:auto}#bmo-preview-canvas{margin-bottom:0}#bmo-main-tab-content{grid-column:2/3;grid-row:2/3}.bmo-button-group{grid-template-columns:1fr}#bmo-favorites-pane.active,#bmo-history-pane.active{grid-template-columns:1fr}#bmo-adjust-panel.modal-panel{top:auto;bottom:50px;left:50%;transform:translateX(-50%);width:90vw}}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- 格子图案（绘制在 canvas 上，与表情共享像素网格，避免 CSS 背景与 canvas 内容错位） ---
    function createCheckerPattern(color) {
        const c = document.createElement('canvas');
        c.width = 6; c.height = 6;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 6, 6);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 3, 3);
        ctx.fillRect(3, 3, 3, 3);
        return c;
    }
    const checkerLight = createCheckerPattern('#e0e0e0');
    const checkerDark  = createCheckerPattern('#555');

    function drawCheckerOnCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const src = document.documentElement.getAttribute('data-theme') === 'dark' ? checkerDark : checkerLight;
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = ctx.createPattern(src, 'repeat');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
    }

    // --- 核心功能函数 ---

    function getCloudData(key) {
        try {
            if (typeof chiiApp?.cloud_settings === 'undefined') throw new Error('Bangumi cloud API not available.');
            const data = chiiApp.cloud_settings.get(key);
            if (key.includes('timestamp') || key.includes('updated')) return data || 0;
            const parsed = (typeof data === 'string' && data) ? JSON.parse(data) : (data || []);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn(`BMO Panel: Could not load data for key "${key}".`, error.message);
            return key.includes('timestamp') || key.includes('updated') ? 0 : [];
        }
    }

    function saveCloudData(key, data) {
        try {
            chiiApp.cloud_settings.update({ [key]: JSON.stringify(data) });
            chiiApp.cloud_settings.save();
            return true;
        } catch (error) {
            console.error(`BMO Panel: Failed to save data for key "${key}".`, error);
            return false;
        }
    }

    // [优化] 同步完成后写入内存缓存
    async function synchronizeFavorites() {
        const localDataString = localStorage.getItem(FAVORITES_CLOUD_KEY);
        const localData = localDataString ? JSON.parse(localDataString) : [];
        const localTimestamp = Number(localStorage.getItem('chii_saved_bmo_updated') || 0);
        const cloudData = getCloudData(FAVORITES_CLOUD_KEY);
        const cloudTimestamp = Number(getCloudData(FAVORITES_CLOUD_TIMESTAMP_KEY));

        if (localTimestamp === cloudTimestamp && JSON.stringify(localData) === JSON.stringify(cloudData)) {
            cachedFavorites = localData;
            return localData;
        }

        const mergedMap = new Map();
        for (const item of localData) {
            if (item.code) mergedMap.set(item.code, item);
        }
        for (const item of cloudData) {
            if (!item.code) continue;
            const existing = mergedMap.get(item.code);
            if (!existing || item.updatedAt > existing.updatedAt) {
                mergedMap.set(item.code, item);
            }
        }

        const finalMergedData = Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
        const now = Date.now();
        try {
            localStorage.setItem(FAVORITES_CLOUD_KEY, JSON.stringify(finalMergedData));
            localStorage.setItem('chii_saved_bmo_updated', now.toString());
            chiiApp.cloud_settings.update({
                [FAVORITES_CLOUD_KEY]: JSON.stringify(finalMergedData),
                [FAVORITES_CLOUD_TIMESTAMP_KEY]: now.toString()
            });
            await chiiApp.cloud_settings.save();
        } catch (error) {
            console.error('BMO Panel: Failed to save synchronized favorites.', error);
        }

        cachedFavorites = finalMergedData;
        return finalMergedData;
    }

    function injectScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function loadAssets(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const manifest = await response.json();
            for (const category in manifest) {
                manifest[category].items.forEach(item => {
                    item.fullSrc = '/js/lib/bmo/assets/' + item.src.split('/').pop();
                });
            }
            return manifest;
        } catch (error) {
            console.error('BMO Panel: Failed to load assets manifest.', error);
            return null;
        }
    }

    function waitForBmoji() {
        return new Promise(resolve => {
            if (window.Bmoji) return resolve(window.Bmoji);
            const interval = setInterval(() => {
                if (window.Bmoji) { clearInterval(interval); resolve(window.Bmoji); }
            }, 100);
        });
    }

    function createAndCacheDom() {
        const backdrop = document.createElement('div');
        backdrop.id = 'bmo-quick-panel-backdrop';

        const mainTabConfig = [{ key: 'composer', title: '合成' }, { key: 'favorites', title: '收藏' }, { key: 'history', title: '历史' }];
        const subTabConfig = [{ key: 'face', title: '面部' }, { key: 'eyes', title: '眼部' }, { key: 'mouth', title: '嘴部' }, { key: 'accessories', title: '配饰' }, { key: 'others', title: '其他' }];

        backdrop.innerHTML = `
            <div id="bmo-quick-panel" class="modal-panel">
                <div class="header"><h4>BMO 快速拼装</h4><button class="close"></button></div>
                <div class="content">
                    <div class="bmo-panel-layout">
                        <ul id="bmo-main-tab-list">${mainTabConfig.map(t => `<li class="bmo-main-tab" data-tab-key="${t.key}">${t.title}</li>`).join('')}</ul>
                        <div id="bmo-main-tab-content">
                            <div class="bmo-main-tab-pane" data-tab-key="composer">
                                <div class="panel-tabs"><div class="horizontalOptions segment"><ul id="bmo-sub-tab-list">${subTabConfig.map(t => `<li><a href="#" class="tab-item" data-tab-key="${t.key}">${t.title}</a></li>`).join('')}</ul></div></div>
                                <div id="bmo-sub-tab-content">${subTabConfig.map(t => `<div class="bmo-sub-tab-pane" data-tab-key="${t.key}"></div>`).join('')}</div>
                                <div id="bmo-code-box-container">
                                    <textarea id="bmo-code-textarea" placeholder="在这里粘贴 BMO 代码继续编辑" rows="2"></textarea>
                                </div>
                            </div>
                            <div class="bmo-main-tab-pane" id="bmo-favorites-pane" data-tab-key="favorites"></div>
                            <div class="bmo-main-tab-pane" id="bmo-history-pane" data-tab-key="history"></div>
                        </div>
                        <div id="bmo-preview-column">
                            <div id="bmo-preview-canvas"></div>
                            <div id="bmo-preview-actions">
                                <a href="javascript:void(0);" id="bmo-adjust-btn" class="btn btn-lg primary">调整</a>
                                <a href="javascript:void(0);" id="bmo-favorite-btn" class="btn btn-lg primary">收藏</a>
                                <a href="javascript:void(0);" id="bmo-insert-btn" class="btn btn-lg primary">合成</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="bmo-adjust-panel" class="modal-panel">
                <div class="header"><h4>调整部件</h4><button class="close" id="bmo-adjust-close-btn"></button></div>
                <div class="content">
                    <div id="bmo-adjust-parts"></div>
                    <div class="bmo-adjust-section">
                        <h6>颜色</h6>
                        <div class="bmo-slider-group"><label>色相</label><input type="range" id="bmo-hue-slider" min="0" max="360" value="0"><input type="number" id="bmo-hue-input" min="0" max="360" value="0"></div>
                        <div class="bmo-slider-group"><label>明度</label><input type="range" id="bmo-lightness-slider" min="-100" max="100" value="0"><input type="number" id="bmo-lightness-input" min="-100" max="100" value="0"></div>
                        <div class="bmo-slider-group"><label>饱和度</label><input type="range" id="bmo-saturation-slider" min="-100" max="100" value="0"><input type="number" id="bmo-saturation-input" min="-100" max="100" value="0"></div>
                    </div>
                    <div class="bmo-adjust-section">
                        <h6>变换</h6>
                        <div class="bmo-button-group">
                            <a href="javascript:void(0);" id="bmo-flip-h-btn" class="btnGraySmall">水平翻转</a><a href="javascript:void(0);" id="bmo-flip-v-btn" class="btnGraySmall">垂直翻转</a>
                            <a href="javascript:void(0);" id="bmo-rotate-l-btn" class="btnGraySmall">左转90°</a><a href="javascript:void(0);" id="bmo-rotate-r-btn" class="btnGraySmall">右转90°</a>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(backdrop);

        // [优化] 同时缓存面板节点列表，switchMainTab/switchSubTab 无需再查询 DOM
        dom = {
            backdrop,
            panel: backdrop.querySelector('#bmo-quick-panel'),
            adjustPanel: backdrop.querySelector('#bmo-adjust-panel'),
            mainTabList: backdrop.querySelector('#bmo-main-tab-list'),
            subTabList: backdrop.querySelector('#bmo-sub-tab-list'),
            previewCanvas: backdrop.querySelector('#bmo-preview-canvas'),
            previewColumn: backdrop.querySelector('#bmo-preview-column'),
            favoritesPane: backdrop.querySelector('#bmo-favorites-pane'),
            historyPane: backdrop.querySelector('#bmo-history-pane'),
            hueSlider: backdrop.querySelector('#bmo-hue-slider'),
            lightnessSlider: backdrop.querySelector('#bmo-lightness-slider'),
            saturationSlider: backdrop.querySelector('#bmo-saturation-slider'),
            hueInput: backdrop.querySelector('#bmo-hue-input'),
            lightnessInput: backdrop.querySelector('#bmo-lightness-input'),
            saturationInput: backdrop.querySelector('#bmo-saturation-input'),
            closeBtn: backdrop.querySelector('#bmo-quick-panel .close'),
            adjustCloseBtn: backdrop.querySelector('#bmo-adjust-close-btn'),
            insertBtn: backdrop.querySelector('#bmo-insert-btn'),
            favoriteBtn: backdrop.querySelector('#bmo-favorite-btn'),
            adjustParts: backdrop.querySelector('#bmo-adjust-parts'),
            adjustBtn: backdrop.querySelector('#bmo-adjust-btn'),
            flipHBtn: backdrop.querySelector('#bmo-flip-h-btn'),
            flipVBtn: backdrop.querySelector('#bmo-flip-v-btn'),
            rotateLBtn: backdrop.querySelector('#bmo-rotate-l-btn'),
            rotateRBtn: backdrop.querySelector('#bmo-rotate-r-btn'),
            codeTextarea: backdrop.querySelector('#bmo-code-textarea'),
            // [优化] 缓存所有面板节点，避免 switchMainTab/switchSubTab 重复查询
            mainTabNodes: backdrop.querySelectorAll('.bmo-main-tab'),
            mainTabPanes: backdrop.querySelectorAll('.bmo-main-tab-pane'),
            subTabNodes: backdrop.querySelectorAll('#bmo-sub-tab-list .tab-item'),
            subTabPanes: backdrop.querySelectorAll('.bmo-sub-tab-pane'),
        };
    }

    function bindEvents() {
        dom.closeBtn.addEventListener('click', hidePanel);
        let backdropMouseDownTarget = null;
        dom.backdrop.addEventListener('mousedown', e => { backdropMouseDownTarget = e.target; });
        dom.backdrop.addEventListener('click', e => {
            if (e.target === dom.backdrop && backdropMouseDownTarget === dom.backdrop) hidePanel();
            backdropMouseDownTarget = null;
        });

        dom.insertBtn.addEventListener('click', () => insertBmoCode(dom.insertBtn));
        dom.favoriteBtn.addEventListener('click', e => addBmoToFavorites(e.currentTarget.dataset.code));

        dom.adjustBtn.addEventListener('click', showAdjustPanel);
        dom.adjustCloseBtn.addEventListener('click', closeAdjustPanel);

        // 滑块与输入框双向同步
        for (const key of ['hue', 'lightness', 'saturation']) {
            const slider = dom[key + 'Slider'], input = dom[key + 'Input'];
            slider.addEventListener('input', applyAdjustments);
            input.addEventListener('input', () => { slider.value = input.value; applyAdjustments(); });
        }

        for (const [btn, fn, arg] of [[dom.flipHBtn, flipItem, 'h'], [dom.flipVBtn, flipItem, 'v'], [dom.rotateLBtn, rotateItem, 'l'], [dom.rotateRBtn, rotateItem, 'r']]) {
            btn.addEventListener('click', e => { e.preventDefault(); fn(arg); });
        }

        dom.mainTabList.addEventListener('click', e => {
            const tab = e.target.closest('.bmo-main-tab');
            if (tab) switchMainTab(tab.dataset.tabKey);
        });
        dom.subTabList.addEventListener('click', e => {
            e.preventDefault();
            const tab = e.target.closest('.tab-item');
            if (tab) switchSubTab(tab.dataset.tabKey);
        });
        let isPasting = false;
        dom.codeTextarea.addEventListener('paste', () => { isPasting = true; });
        dom.codeTextarea.addEventListener('input', e => {
            if (!isPasting) return;
            isPasting = false;
            const code = e.target.value.trim();
            if (code) editBmoFromCode(code);
        });
    }

    function showAdjustPanel() {
        const keys = Object.keys(selectedItems);
        if (keys.length === 0) return;
        if (!lastSelectedItemKey || !selectedItems[lastSelectedItemKey]) lastSelectedItemKey = keys[keys.length - 1];
        populateAdjustParts();
        loadAdjustValues(selectedItems[lastSelectedItemKey]);
        dom.adjustPanel.style.display = 'block';
    }

    function populateAdjustParts() {
        const subTabNames = { face: '面部', eyes: '眼部', mouth: '嘴部', accessories: '配饰', others: '其他' };
        dom.adjustParts.innerHTML = '';
        for (const key of Object.keys(selectedItems)) {
            const item = selectedItems[key];
            const chip = document.createElement('div');
            chip.className = 'bmo-adjust-part' + (key === lastSelectedItemKey ? ' active' : '');
            chip.title = (subTabNames[item.category] || item.category) + ' - ' + item.id;
            chip.innerHTML = `<img src="${item.fullSrc}" alt="${item.id}">`;
            chip.addEventListener('click', () => switchAdjustTarget(key));
            dom.adjustParts.appendChild(chip);
        }
    }

    function switchAdjustTarget(key) {
        if (!selectedItems[key]) return;
        lastSelectedItemKey = key;
        populateAdjustParts();
        loadAdjustValues(selectedItems[key]);
    }

    function loadAdjustValues(item) {
        dom.hueSlider.value = dom.hueInput.value = item.hue;
        dom.lightnessSlider.value = dom.lightnessInput.value = item.lightness;
        dom.saturationSlider.value = dom.saturationInput.value = item.saturation;
    }

    function closeAdjustPanel() { dom.adjustPanel.style.display = 'none'; }

    function getActiveItem() {
        return lastSelectedItemKey && selectedItems[lastSelectedItemKey] || null;
    }

    function applyAdjustments() {
        const item = getActiveItem();
        if (!item) return;
        const hue = parseInt(dom.hueSlider.value, 10);
        const lightness = parseInt(dom.lightnessSlider.value, 10);
        const saturation = parseInt(dom.saturationSlider.value, 10);
        item.hue = hue;
        item.lightness = lightness;
        item.saturation = saturation;
        dom.hueInput.value = hue;
        dom.lightnessInput.value = lightness;
        dom.saturationInput.value = saturation;
        updatePreviewAndCode();
    }

    function flipItem(axis) {
        const item = getActiveItem();
        if (!item) return;
        const key = axis === 'h' ? 'flipH' : 'flipV';
        item[key] = !item[key];
        updatePreviewAndCode();
    }

    function rotateItem(direction) {
        const item = getActiveItem();
        if (!item) return;
        item.rotation = (item.rotation + (direction === 'r' ? 90 : -90) + 360) % 360;
        updatePreviewAndCode();
    }

    function buildBmojiModifiers(itemData) {
        const modifiers = {};
        if (itemData.hue !== 0) modifiers.h = itemData.hue;
        if (itemData.lightness !== 0) modifiers.l = itemData.lightness;
        if (itemData.saturation !== 0) modifiers.s = itemData.saturation;
        if (itemData.flipH) modifiers.flipH = true;
        if (itemData.flipV) modifiers.flipV = true;
        if (itemData.rotation !== 0) modifiers.rotate = itemData.rotation;
        return modifiers;
    }

    // [优化] 使用缓存的节点列表，避免重复 querySelectorAll
    function switchMainTab(tabKey) {
        dom.mainTabNodes.forEach(tab => tab.classList.toggle('active', tab.dataset.tabKey === tabKey));
        dom.mainTabPanes.forEach(pane => pane.classList.toggle('active', pane.dataset.tabKey === tabKey));
        dom.previewColumn.style.display = tabKey === 'composer' ? 'flex' : 'none';
        if (tabKey === 'favorites') populateFavoritesPane();
        if (tabKey === 'history') populateHistoryPane();
    }

    function switchSubTab(tabKey) {
        dom.subTabNodes.forEach(tab => tab.classList.toggle('focus', tab.dataset.tabKey === tabKey));
        dom.subTabPanes.forEach(pane => pane.classList.toggle('active', pane.dataset.tabKey === tabKey));
    }

    // [优化] 用 selectedElements 直接操作已选元素，避免全局 querySelectorAll 扫描
    function clearComposerSelection() {
        for (const el of Object.values(selectedElements)) {
            el.classList.remove('selected');
        }
        selectedItems = {};
        selectedElements = {};
        lastSelectedItemKey = null;
        updatePreviewAndCode();
        closeAdjustPanel();
    }

    function editBmoFromCode(code) {
        if (!code || !bmoApi || !assets) return;
        const decoded = bmoApi.decodeCompact(code);
        if (!decoded?.items?.length) {
            console.warn('BMO Panel: Failed to decode or code is empty.', code);
            return;
        }
        clearComposerSelection();
        const newSelectedItems = {};
        const newSelectedElements = {};
        decoded.items.forEach(decodedItem => {
            const categoryData = assets[decodedItem.category];
            if (!categoryData) return;
            const itemData = categoryData.items.find(i => i.id === decodedItem.id);
            if (!itemData) return;
            const selectionKey = `${decodedItem.category}::${decodedItem.id}`;
            const modifiers = decodedItem.modifiers || {};
            let flipH = false, flipV = false, rotation = 0;
            if (modifiers.tf !== undefined) {
                const mask = Number(modifiers.tf) || 0;
                flipH = !!(mask & 1);
                flipV = !!(mask & 2);
                rotation = ((mask >> 2) & 3) * 90;
            }
            if (modifiers.rotate !== undefined) rotation = Number(modifiers.rotate) || 0;
            newSelectedItems[selectionKey] = {
                ...itemData,
                category: decodedItem.category,
                resolvedId: categoryData.id + itemData.id,
                hue: modifiers.h || 0,
                lightness: modifiers.l || 0,
                saturation: modifiers.s || 0,
                flipH, flipV, rotation
            };
            const itemDiv = document.querySelector(`.bmo-item[data-id="${decodedItem.id}"][data-category="${decodedItem.category}"]`);
            if (itemDiv) {
                itemDiv.classList.add('selected');
                newSelectedElements[selectionKey] = itemDiv;
                lastSelectedItemKey = selectionKey;
            }
        });
        selectedItems = newSelectedItems;
        selectedElements = newSelectedElements;
        switchMainTab('composer');
        updatePreviewAndCode();
    }

    function populateComposerPane() {
        if (!assets) return;
        Object.entries(assets).forEach(([categoryKey, category]) => {
            const pane = document.querySelector(`.bmo-sub-tab-pane[data-tab-key="${categoryKey}"]`);
            if (!pane) return;
            const fragment = document.createDocumentFragment();
            category.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'bmo-item';
                itemDiv.dataset.id = item.id;
                itemDiv.dataset.category = categoryKey;
                itemDiv.innerHTML = `<img src="${item.fullSrc}" alt="${item.id}">`;
                itemDiv.addEventListener('click', handleItemClick);
                fragment.appendChild(itemDiv);
            });
            pane.appendChild(fragment);
        });
    }

    // [优化] 用事件委托替代每个列表项的多个监听器
    function renderBmoList(pane, items, nameKey, noteKey, paneType) {
        pane.innerHTML = '';
        if (items.length === 0) {
            pane.innerHTML = `<p style="text-align:center; color: #999; margin-top: 20px;">${paneType === 'favorites' ? '你还没有收藏 BMO 哦' : '还没有历史记录'}</p>`;
            return;
        }

        const isHistory = paneType === 'history';
        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'bmo-generic-item';
            itemDiv.dataset.code = item.code;
            itemDiv.innerHTML = `
                <div class="bmo-generic-preview" data-code="${item.code}"></div>
                <div class="bmo-generic-info">
                    <strong>${item[nameKey] || '未命名'}</strong>
                    <small style="color: #888;">${noteKey && item[noteKey] || ''}</small>
                </div>
                <div class="bmo-generic-actions">
                    <a href="javascript:void(0);" class="btnGraySmall" data-action="edit" data-code="${item.code}">编辑</a>
                    <a href="javascript:void(0);" class="${isHistory ? 'btnPinkSmall' : 'btnGraySmall'}" data-action="${isHistory ? 'save' : 'delete'}" data-code="${item.code}">${isHistory ? '收藏' : '删除'}</a>
                </div>
            `;
            fragment.appendChild(itemDiv);
        });
        pane.appendChild(fragment);

        // [优化] 单个委托监听器处理所有点击
        pane.addEventListener('click', e => {
            const btn = e.target.closest('a[data-action]');
            if (btn) {
                e.stopPropagation();
                const { action, code } = btn.dataset;
                if (action === 'edit') editBmoFromCode(code);
                else if (action === 'save') addBmoToFavorites(code);
                else if (action === 'delete') deleteFavoriteItem(btn);
                return;
            }
            const item = e.target.closest('.bmo-generic-item');
            if (item) insertBmoCode(item);
        });

        pane.querySelectorAll('.bmo-generic-preview').forEach(div => bmoApi.render(div, { width: 50, height: 50 }));
    }

    async function getFavorites() {
        return cachedFavorites ?? await synchronizeFavorites();
    }

    async function populateFavoritesPane() {
        const favorites = await getFavorites();
        renderBmoList(dom.favoritesPane, favorites, 'name', 'note', 'favorites');
    }

    function populateHistoryPane() {
        if (dom.historyPane.dataset.populated === 'true') return;
        const history = getCloudData(HISTORY_CLOUD_KEY);
        renderBmoList(dom.historyPane, history, 'code', null, 'history');
        dom.historyPane.dataset.populated = 'true';
    }

    function handleItemClick(e) {
        const itemDiv = e.currentTarget;
        const { id, category } = itemDiv.dataset;
        const selectionKey = `${category}::${id}`;
        const categoryData = assets[category];

        if (selectedItems[selectionKey]) {
            delete selectedItems[selectionKey];
            delete selectedElements[selectionKey];
            itemDiv.classList.remove('selected');
            if (lastSelectedItemKey === selectionKey) lastSelectedItemKey = null;
        } else {
            if (!categoryData.multiSelect) {
                // [优化] 通过 selectedElements 直接操作，无需 querySelectorAll
                for (const key of Object.keys(selectedItems)) {
                    if (selectedItems[key].category === category) {
                        selectedElements[key]?.classList.remove('selected');
                        delete selectedItems[key];
                        delete selectedElements[key];
                    }
                }
            }
            const itemData = categoryData.items.find(i => i.id === id);
            selectedItems[selectionKey] = {
                ...itemData,
                category,
                resolvedId: categoryData.id + itemData.id,
                hue: 0, lightness: 0, saturation: 0,
                flipH: false, flipV: false, rotation: 0
            };
            selectedElements[selectionKey] = itemDiv;
            itemDiv.classList.add('selected');
            lastSelectedItemKey = selectionKey;
        }
        updatePreviewAndCode();
    }

    function updatePreviewAndCode() {
        const selectionForEncoding = Object.values(selectedItems).map(item => ({
            id: item.resolvedId,
            modifiers: buildBmojiModifiers(item)
        }));
        const code = selectionForEncoding.length > 0 ? bmoApi.encodeCompact(selectionForEncoding, { wrap: true }) : '';

        dom.previewCanvas.dataset.code = code;
        if (!code) {
            dom.previewCanvas.innerHTML = '';
            const canvas = document.createElement('canvas');
            canvas.width = 63; canvas.height = 63;
            dom.previewCanvas.appendChild(canvas);
            drawCheckerOnCanvas(canvas);
        } else {
            bmoApi.render(dom.previewCanvas, { width: 63, height: 63, renderAsImage: false }).then(() => {
                const canvas = dom.previewCanvas.querySelector('canvas');
                if (canvas) drawCheckerOnCanvas(canvas);
            });
        }

        dom.insertBtn.dataset.code = code;
        dom.favoriteBtn.dataset.code = code;
        dom.insertBtn.classList.toggle('disabled', !code);
        dom.favoriteBtn.classList.toggle('disabled', !code);
        const hasSelection = Object.keys(selectedItems).length > 0;
        dom.adjustBtn.classList.toggle('disabled', !hasSelection);
        if (dom.adjustPanel.style.display === 'block') {
            if (!hasSelection) closeAdjustPanel();
            else { populateAdjustParts(); if (selectedItems[lastSelectedItemKey]) loadAdjustValues(selectedItems[lastSelectedItemKey]); }
        }
        dom.codeTextarea.value = code;
    }

    function addBmoToHistory(code) {
        if (!code) return;
        let history = getCloudData(HISTORY_CLOUD_KEY);
        history = history.filter(item => item.code !== code);
        history.unshift({ code });
        if (history.length > HISTORY_MAX_ITEMS) history = history.slice(0, HISTORY_MAX_ITEMS);
        if (saveCloudData(HISTORY_CLOUD_KEY, history)) {
            dom.historyPane.dataset.populated = 'false';
        }
    }

    async function addBmoToFavorites(code) {
        if (!code) return;
        const favorites = await getFavorites();
        if (favorites.some(fav => fav.code === code)) {
            alert('这个 BMO 已经收藏过了。');
            return;
        }
        const favName = prompt("为这个 BMO 收藏命名（可留空）：", "我的 BMO");
        if (favName === null) return;
        const now = Date.now();
        const newItem = {
            id: 'bmo_' + Math.random().toString(36).substring(2, 11),
            code,
            name: favName || "未命名",
            note: '',
            createdAt: now,
            updatedAt: now
        };
        favorites.unshift(newItem);
        if (await _saveFavorites(favorites)) {
            alert('收藏成功！');
            await populateFavoritesPane();
        }
    }

    async function deleteFavoriteItem(btn) {
        const codeToDelete = btn.dataset.code;
        if (!codeToDelete || !confirm('确定要删除这个收藏吗？')) return;
        const favorites = await getFavorites();
        const newFavorites = favorites.filter(fav => fav.code !== codeToDelete);
        if (await _saveFavorites(newFavorites)) {
            alert('删除成功！');
            btn.closest('.bmo-generic-item').remove();
        }
    }

    async function _saveFavorites(favoritesArray) {
        try {
            const newTimestamp = Date.now().toString();
            localStorage.setItem(FAVORITES_CLOUD_KEY, JSON.stringify(favoritesArray));
            localStorage.setItem('chii_saved_bmo_updated', newTimestamp);
            chiiApp.cloud_settings.update({
                [FAVORITES_CLOUD_KEY]: JSON.stringify(favoritesArray),
                [FAVORITES_CLOUD_TIMESTAMP_KEY]: newTimestamp
            });
            await chiiApp.cloud_settings.save();
            cachedFavorites = favoritesArray;  // [优化] 保存后同步更新内存缓存
            return true;
        } catch (error) {
            console.error('BMO Panel: Failed to save favorites.', error);
            return false;
        }
    }

    function getTargetTextarea() {
        const activeEl = document.activeElement;
        if (activeEl?.tagName.toLowerCase() === 'textarea') return activeEl;
        return document.querySelector('#comment_list textarea')
            || document.getElementById('content')
            || document.querySelector('textarea');
    }

    function insertBmoCode(sourceEl) {
        const code = sourceEl.dataset.code;
        if (!code) return;
        addBmoToHistory(code);
        const textarea = externalTargetTextarea || getTargetTextarea();
        if (!textarea) { console.error('BMO Panel: Textarea not found.'); return; }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + code + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + code.length;
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        hidePanel();
    }

    let assetsReady = false;
    let assetsLoading = false;

    async function loadAssetsOnce() {
        if (assetsReady) return true;
        if (assetsLoading) {
            await new Promise(resolve => {
                const check = setInterval(() => { if (!assetsLoading) { clearInterval(check); resolve(); } }, 50);
            });
            return assetsReady;
        }
        assetsLoading = true;
        try {
            if (typeof chiiApp?.cloud_settings !== 'undefined') {
                await synchronizeFavorites();
            } else {
                console.warn("BMO Panel: `chiiApp.cloud_settings` not found. Cloud synchronization is disabled.");
            }
            await injectScript(BMO_JS_URL);
            bmoApi = await waitForBmoji();
            assets = await loadAssets(MANIFEST_URL);
            if (!assets) {
                console.error('BMO Panel: Failed to load assets, panel is non-functional.');
                return false;
            }
            bmoApi.setAssets(assets);
            populateComposerPane();
            switchMainTab('composer');
            switchSubTab('face');
            assetsReady = true;
        } finally {
            assetsLoading = false;
        }
        return assetsReady;
    }

    async function showPanel(targetTextarea = null) {
        if (targetTextarea?.nodeType === 1 && targetTextarea.tagName.toLowerCase() === 'textarea') {
            externalTargetTextarea = targetTextarea;
        }
        dom.backdrop.style.display = 'flex';
        dom.panel.style.display = 'flex';
        if (!await loadAssetsOnce()) return;
        updatePreviewAndCode();
    }

    function hidePanel() {
        dom.backdrop.style.display = 'none';
        dom.panel.style.display = 'none';
        closeAdjustPanel();
        externalTargetTextarea = null;
    }

    function initialize() {
        createAndCacheDom();
        bindEvents();
        window.BgmBmoQuickPanel = {
            open: showPanel,
            close: hidePanel,
            isOpen: () => dom.backdrop?.style.display === 'flex'
        };
    }

    function hijackBmoButton() {
        const observer = new MutationObserver(() => {
            const createBmoButton = document.querySelector('.markItUpButton.bmo_smiles a[title="管理 Bmoji"]');
            if (createBmoButton && !createBmoButton.dataset.hijacked) {
                createBmoButton.dataset.hijacked = 'true';
                createBmoButton.textContent = 'Bmoji 快速拼装';
                createBmoButton.title = 'Bmoji 快速拼装';
                createBmoButton.addEventListener('mousedown', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    showPanel();
                    createBmoButton.closest('ul')?.style.setProperty('display', 'none');
                }, true);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    initialize();
    hijackBmoButton();
})();