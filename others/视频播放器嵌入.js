// ==UserScript==
// @name         视频播放器嵌入
// @match        *://bgm.tv/*
// @match        *://bangumi.tv/*
// @match        *://chii.in/*
// ==/UserScript==

(function () {
    'use strict';

    // --- 配置与常量 ---
    const CONFIG_KEY_DEFAULT_COLLAPSE = 'bve_default_collapse';
    const ATTR_PROCESSED = 'data-embed-processed';
    const ATTR_TEXT_SCANNED = 'data-text-scanned';

    // 内容区域选择器
    const CONTENT_SELECTORS = '.topic_content, .reply_content, .message, p.comment, .text, .blog_entry, .epDesc, .intro, .bio';

    let isDefaultCollapse = false;

    function initConfig() {
        if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
            const cloudVal = chiiApp.cloud_settings.get(CONFIG_KEY_DEFAULT_COLLAPSE);
            if (cloudVal === 'true') {
                isDefaultCollapse = true;
            }
        }
    }

    initConfig();

    const siteHandlers = [
        {
            name: 'Direct',
            regex: /\.(mp4|webm|ogv)(\?.*)?$/i,
            type: 'horizontal',
            create: (m, auto) => {
                const v = document.createElement('video');
                v.src = m.input; v.controls = true; v.autoplay = auto;
                return v;
            }
        },
        {
            name: 'Youtube',
            regex: /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/,
            src: (m, auto) => `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&autoplay=${auto}`
        },
        {
            name: 'Bilibili',
            regex: /(?:bilibili\.com\/(?:video\/|player\.html\?.*?bvid=|player\.html\?.*?aid=)|live\.bilibili\.com\/)(?:(BV[a-zA-Z0-9_]+)|(?:av)?(\d+))(?:\?([\s\S]*))?/,
            create: (m, auto) => {
                const isLive = m[0].includes('live.bilibili.com');
                if (isLive) {
                    return `https://www.bilibili.com/blackboard/live/live-activity-player.html?cid=${m[2]}&danmaku=0&autoplay=${auto}`;
                }
                const idType = m[1] ? 'bvid' : 'aid';
                const id = m[1] || m[2];
                let params = `?${idType}=${id}&p=1&as_wide=1&high_quality=1&danmaku=0&autoplay=${auto}`;
                if (m[3]) {
                    try {
                        const qs = new URLSearchParams(m[3]);
                        if (qs.has('p')) params += `&p=${qs.get('p')}`;
                        let t = qs.get('t') || (qs.get('start_progress') ? Math.floor(qs.get('start_progress') / 1000) : 0);
                        if (t) params += `&t=${t}`;
                    } catch (e) { }
                }
                return `https://player.bilibili.com/player.html${params}`;
            }
        },
        {
            name: 'Niconico',
            regex: /(?:nicovideo\.jp\/watch\/|nico\.ms\/)((?:[a-z]{2})?\d+)/,
            src: (m, auto) => `https://embed.nicovideo.jp/watch/${m[1]}?oldScript=1&autoplay=${auto}`
        },
        {
            name: 'AcFun',
            regex: /(?:acfun\.cn\/v\/)(ac\d+)/,
            src: (m) => `https://www.acfun.cn/player/${m[1]}`
        },
        {
            name: 'Vimeo',
            regex: /(?:vimeo\.com\/)(\d+)/,
            src: (m, auto) => `https://player.vimeo.com/video/${m[1]}?autoplay=${auto}`
        },
        {
            name: 'TikTok',
            regex: /(?:tiktok\.com\/(?:@.+?\/video\/|v\/)|open\.tiktok\.com\/embed\/video\/)(\d+)/,
            type: 'vertical',
            src: (m, auto) => `https://www.tiktok.com/embed/${m[1]}?autoplay=${auto}`
        },
        {
            name: 'Douyin',
            regex: /(?:douyin\.com\/video\/|open\.douyin\.com\/player\/video\?vid=)(\d+)/,
            type: 'vertical',
            src: (m, auto) => `https://open.douyin.com/player/video?vid=${m[1]}&autoplay=${auto}`
        },
        {
            name: 'Youku',
            regex: /(?:v\.youku\.com\/v_show\/id_)([^.]+)/,
            src: (m, auto) => `https://player.youku.com/embed/${m[1]}?autoplay=${auto}`
        },
        {
            name: 'Other',
            regex: /(?:dailymotion\.com\/video\/([\w-]+))|(?:twitch\.tv\/videos\/(\d+))|(?:twitch\.tv\/([a-zA-Z0-9_]{4,25})(?!\/videos))|(?:v\.douyu\.com\/(?:show|video)\/([\w]+))|(?:huya\.com\/video\/play\/(\d+)\.html)|(?:huya\.com\/(?!video)([\w]+))/,
            create: (m, auto) => {
                const autoStr = auto ? 'true' : 'false';
                const autoInt = auto ? 1 : 0;
                if (m[1]) return `https://geo.dailymotion.com/player.html?video=${m[1]}&autoplay=${autoStr}`;
                if (m[2]) return `https://player.twitch.tv/?video=${m[2]}&parent=${location.hostname}&autoplay=${autoStr}`;
                if (m[3]) return `https://player.twitch.tv/?channel=${m[3]}&parent=${location.hostname}&autoplay=${autoStr}`;
                if (m[4]) return `https://v.douyu.com/video/videoshare/index?vid=${m[4]}&autoplay=${autoInt}`;
                if (m[5]) return `https://s1-static.msstatic.com/vod-player-360/index.html?id=${m[5]}`;
                if (m[6]) return `https://liveshare.huya.com/iframe/${m[6]}`;
            }
        }
    ];

    function getHandler(url) {
        if (!url) return null;
        for (const site of siteHandlers) {
            const match = url.match(site.regex);
            if (match) return { site, match };
        }
        return null;
    }

    function createPlayerElement(handlerResult, enableAutoplay) {
        const { site, match } = handlerResult;
        const wrapper = document.createElement('div');
        wrapper.className = `embed-player-wrapper embed-wrapper-${site.type || 'horizontal'}`;

        let content;
        const auto = enableAutoplay ? 1 : 0;

        if (site.create) {
            content = site.create(match, auto);
        } else if (site.src) {
            content = site.src(match, auto);
        }

        if (content instanceof Node) {
            wrapper.appendChild(content);
        } else if (typeof content === 'string') {
            const iframe = document.createElement('iframe');
            iframe.src = content;
            iframe.allow = `accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share${enableAutoplay ? '; autoplay' : ''}`;
            iframe.allowFullscreen = true;
            wrapper.appendChild(iframe);
        }
        return wrapper;
    }

    function togglePlayer(e) {
        const btn = e.currentTarget;
        const isExpanded = btn.getAttribute('data-expanded') === 'true';

        if (isExpanded) {
            if (btn.nextSibling && btn.nextSibling.classList && btn.nextSibling.classList.contains('embed-player-wrapper')) {
                btn.nextSibling.remove();
            }
            btn.setAttribute('data-expanded', 'false');
            btn.innerHTML = '&#9654; 播放'; // unicode 播放三角
        } else {
            const handler = getHandler(btn.dataset.url);
            if (handler) {
                const player = createPlayerElement(handler, true);
                btn.after(player);
                btn.setAttribute('data-expanded', 'true');
                btn.innerHTML = '&#9650; 收起'; // unicode 向上三角
            }
        }
    }

    function createButton(url) {
        const btn = document.createElement('span');
        btn.className = 'embed-play-btn';
        btn.dataset.url = url;
        btn.addEventListener('click', togglePlayer);

        if (isDefaultCollapse) {
            btn.innerHTML = '&#9654; 播放';
            btn.setAttribute('data-expanded', 'false');
        } else {
            btn.innerHTML = '&#9650; 收起';
            btn.setAttribute('data-expanded', 'true');
        }
        return btn;
    }

    function processLink(link) {
        if (link.hasAttribute(ATTR_PROCESSED) || link.closest('.embed-player-wrapper, .infobox')) return;

        const handler = getHandler(link.href);
        if (!handler) return;

        link.setAttribute(ATTR_PROCESSED, 'true');
        const btn = createButton(link.href);
        link.after(btn);

        if (!isDefaultCollapse) {
            btn.after(createPlayerElement(handler, false));
        }
    }

    function processContainerText(container) {
        if (container.hasAttribute(ATTR_TEXT_SCANNED)) return;
        if (container.parentElement && container.parentElement.closest(`[${ATTR_TEXT_SCANNED}="true"]`)) return;

        container.setAttribute(ATTR_TEXT_SCANNED, 'true');

        if (container.closest('.embed-player-wrapper')) return;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        const nodesToProcess = [];

        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.nodeValue.match(/https?:\/\//) &&
                node.parentNode.tagName !== 'A' &&
                node.parentNode.tagName !== 'SCRIPT' &&
                node.parentNode.tagName !== 'STYLE') {
                nodesToProcess.push(node);
            }
        }

        const urlRegex = /https?:\/\/[^\s"'<>`【】]+/g;

        nodesToProcess.forEach(textNode => {
            const text = textNode.nodeValue;
            let lastIndex = 0;
            let match;
            const fragment = document.createDocumentFragment();
            let hasReplacement = false;

            while ((match = urlRegex.exec(text)) !== null) {
                const url = match[0];
                const handler = getHandler(url);
                if (handler) {
                    hasReplacement = true;
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                    const textSpan = document.createTextNode(url);
                    fragment.appendChild(textSpan);
                    const btn = createButton(url);
                    fragment.appendChild(btn);

                    if (!isDefaultCollapse) {
                        fragment.appendChild(createPlayerElement(handler, false));
                    }

                    lastIndex = urlRegex.lastIndex;
                }
            }

            if (hasReplacement) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
                textNode.parentNode.replaceChild(fragment, textNode);
            }
        });
    }

    function processNode(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

        let containers = [];
        if (root.matches && root.matches(CONTENT_SELECTORS)) {
            containers.push(root);
        }
        containers = containers.concat(Array.from(root.querySelectorAll(CONTENT_SELECTORS)));

        containers.forEach(container => {
            container.querySelectorAll('a').forEach(processLink);
            processContainerText(container);
        });
    }

    function registerBangumiSettings() {
        if (window.chiiLib && window.chiiLib.ukagaka) {
            window.chiiLib.ukagaka.addGeneralConfig({
                title: '视频播放器嵌入',
                name: 'bve_config',
                type: 'radio',
                defaultValue: 'false',
                getCurrentValue: function () {
                    return isDefaultCollapse ? 'true' : 'false';
                },
                onChange: function (value) {
                    isDefaultCollapse = value === 'true';
                    if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
                        chiiApp.cloud_settings.update({ [CONFIG_KEY_DEFAULT_COLLAPSE]: value });
                        chiiApp.cloud_settings.save();
                    }
                },
                options: [
                    { value: 'false', label: '默认展开' },
                    { value: 'true', label: '默认折叠' }
                ]
            });
        }
    }

    const style = document.createElement('style');
    style.textContent = `
    .embed-player-wrapper{position:relative;width:100%;background:#000;margin:10px 0;border-radius:8px;overflow:hidden;clear:both;box-shadow:0 4px 12px rgba(0,0,0,.1)}.embed-wrapper-horizontal{padding-bottom:56.25%}.embed-wrapper-vertical{padding-bottom:177%;max-width:340px;margin:10px auto}.embed-player-wrapper iframe,.embed-player-wrapper video{position:absolute;top:0;left:0;width:100%;height:100%;border:0}.embed-play-btn{display:inline-flex;align-items:center;justify-content:center;margin:0 2px 0 6px;padding:2px 8px;height:20px;font-size:11px;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border-radius:10px;color:var(--primary-color);background-color:color-mix(in srgb,var(--primary-color),transparent 85%);cursor:pointer;user-select:none;transition:all .2s cubic-bezier(.4,0,.2,1);vertical-align:1px;font-weight:700;white-space:nowrap}.embed-play-btn:hover,.embed-play-btn[data-expanded=true]{background-color:var(--primary-color);color:#fff;box-shadow:0 2px 6px color-mix(in srgb,var(--primary-color),transparent 60%);transform:translateY(-1px)}.embed-play-btn:active{transform:translateY(0);box-shadow:none}
    `;
    document.head.appendChild(style);

    registerBangumiSettings();
    processNode(document.body);

    new MutationObserver(mutations => {
        mutations.forEach(m => m.addedNodes.forEach(processNode));
    }).observe(document.body, { childList: true, subtree: true });

})();