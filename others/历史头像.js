// ==UserScript==
// @name         Bangumi 历史头像
// @include      /^https?:\/\/(bgm\.tv|bangumi\.tv|chii\.in)\/user\/.*/
// ==/UserScript==

(function () {
    'use strict';
    const API_BASE = "https://bgm.ry.mk";

    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    addStyle(`
    #ah-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;display:none}#ah-panel{display:flex!important;flex-direction:column;max-width:800px;max-height:80vh}#ah-panel .content{flex:1;overflow-y:auto;scrollbar-width:thin;max-height:none;padding:10px}.headerAvatar{position:relative!important}.ah-float-btn{position:absolute;bottom:0;right:0;width:25px;height:25px;background:rgba(255,255,255,.9);border:1px solid rgba(0,0,0,.1);color:#555;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;transition:all .2s ease}.headerAvatar:hover .ah-float-btn{opacity:1}.ah-float-btn:hover{background:#fff;color:var(--primary-color);transform:scale(1.1);box-shadow:0 4px 12px color-mix(in srgb,var(--primary-color),transparent 70%)}html[data-theme=dark] .ah-float-btn{background:rgba(45,46,47,.9);border-color:rgba(255,255,255,.1);color:#ccc}html[data-theme=dark] .ah-float-btn:hover{background:#3e3e3e;color:var(--primary-color)}.ah-float-btn svg{width:20px;height:20px}.ah-state-msg{text-align:center;padding:50px;color:#999;font-size:14px}.ah-error{color:#e74c3c}.ah-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}.ah-item{border-radius:8px;overflow:hidden;transition:all .2s ease;position:relative}.ah-item:hover{transform:translateY(-3px);box-shadow:0 5px 15px rgba(0,0,0,.15)}.ah-item.current-avatar::after{content:'Current';position:absolute;top:6px;right:6px;background:var(--primary-color);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;z-index:2;pointer-events:none}.ah-img-wrapper{width:100%;aspect-ratio:1;position:relative;background-color:#eee;background-image:linear-gradient(45deg,#f0f0f0 25%,transparent 25%,transparent 75%,#f0f0f0 75%,#f0f0f0),linear-gradient(45deg,#f0f0f0 25%,transparent 25%,transparent 75%,#f0f0f0 75%,#f0f0f0);background-size:20px 20px;background-position:0 0,10px 10px}.ah-img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;cursor:zoom-in;image-rendering:-webkit-optimize-contrast}.ah-date{position:absolute;bottom:4px;right:4px;font-size:10px;color:#fff;background:rgba(0,0,0,.6);padding:1px 6px;border-radius:9px;z-index:2;pointer-events:none;white-space:nowrap}html[data-theme=dark] .ah-item:hover{box-shadow:0 5px 15px rgba(0,0,0,.4)}html[data-theme=dark] .ah-img-wrapper{background-color:#333;background-image:linear-gradient(45deg,#444 25%,transparent 25%,transparent 75%,#444 75%,#444),linear-gradient(45deg,#444 25%,transparent 25%,transparent 75%,#444 75%,#444)}@media (max-width:768px){.ah-grid{grid-template-columns:repeat(3,1fr)!important;gap:8px}.ah-date{font-size:8px;padding:0 4px;bottom:2px;right:2px}}
    `);

    function getUserId() {
        const path = window.location.pathname;
        const match = path.match(/\/user\/([^\/]+)/);
        return match ? match[1] : null;
    }

    function init() {
        const avatarContainer = document.querySelector('.headerAvatar');
        if (!avatarContainer) return;

        const btn = document.createElement('div');
        btn.className = 'ah-float-btn';
        btn.title = '查看历史头像';

        const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
        `;
        btn.innerHTML = svgIcon;

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openModal();
        };

        avatarContainer.appendChild(btn);

        createModalDOM();
    }

    function createModalDOM() {
        if (document.getElementById('ah-backdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'ah-backdrop';

        backdrop.innerHTML = `
            <div id="ah-panel" class="modal-panel">
                <div class="header">
                    <h4>历史头像</h4>
                    <a href="javascript:;" class="close">关闭</a>
                </div>
                <div class="content" id="ah-content-body">
                    <div class="ah-state-msg">准备就绪...</div>
                </div>
            </div>
        `;

        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeModal();
        };
        backdrop.querySelector('.close').onclick = closeModal;

        document.body.appendChild(backdrop);
    }

    async function openModal() {
        const userId = getUserId();
        const backdrop = document.getElementById('ah-backdrop');
        const body = document.getElementById('ah-content-body');

        backdrop.style.display = 'block';
        document.getElementById('ah-panel').style.display = 'flex';
        body.innerHTML = '<div class="ah-state-msg">正在连接档案库 (bgm.ry.mk)...</div>';

        try {
            const response = await fetch(`${API_BASE}/search/users/${userId}/avatars`);
            if (!response.ok) {
                if (response.status === 404) {
                    body.innerHTML = `<div class="ah-state-msg">暂无该用户的历史记录。</div>`;
                } else {
                    body.innerHTML = `<div class="ah-state-msg ah-error">服务端错误 (${response.status})。</div>`;
                }
                return;
            }
            const data = await response.json();
            renderHistory(data);
        } catch (err) {
            console.error(err);
            body.innerHTML = `<div class="ah-state-msg ah-error">连接失败。<br><small>${err.message}</small></div>`;
        }
    }

    function closeModal() {
        document.getElementById('ah-panel').style.display = 'none';
        document.getElementById('ah-backdrop').style.display = 'none';
    }

    function toWaybackTimestamp(unixSeconds) {
        if (!unixSeconds) return new Date().toISOString().replace(/[-:T\.]/g, '').slice(0, 14);
        const date = new Date(unixSeconds * 1000);
        const pad = (n) => n.toString().padStart(2, '0');
        return date.getUTCFullYear() +
            pad(date.getUTCMonth() + 1) +
            pad(date.getUTCDate()) +
            pad(date.getUTCHours()) +
            pad(date.getUTCMinutes()) +
            pad(date.getUTCSeconds());
    }

    function renderHistory(data) {
        const body = document.getElementById('ah-content-body');
        const history = data.history || [];

        if (history.length === 0) {
            body.innerHTML = '<div class="ah-state-msg">未找到任何历史头像记录。</div>';
            return;
        }

        document.querySelector('#ah-panel .header h4').innerText = `历史头像 (${data.total}张)`;

        let html = '<div class="ah-grid">';

        history.forEach((item, index) => {
            const dateObj = item.captured_at ? new Date(item.captured_at * 1000) : null;
            const dateStr = dateObj ? dateObj.toLocaleString() : '未知时间';

            let originalUrl = item.avatar_url;
            if (originalUrl.startsWith('//')) originalUrl = 'https:' + originalUrl;

            let finalImageUrl = "";
            let linkUrl = "";
            let isCurrent = (index === 0);
            let useDirect = isCurrent;

            const cleanPath = originalUrl.split('?')[0];
            if (!useDirect && /_[\w-]+\.(jpg|jpeg|png|gif|webp)$/i.test(cleanPath)) {
                useDirect = true;
            }

            if (useDirect) {
                finalImageUrl = originalUrl;
                linkUrl = originalUrl;
            } else {
                // Use backend proxy for cached avatar images
                finalImageUrl = `${API_BASE}/search/avatar/proxy?url=${encodeURIComponent(originalUrl)}`;
                linkUrl = finalImageUrl;
            }

            const shortDate = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}` : '';

            html += `
                <div class="ah-item ${isCurrent ? 'current-avatar' : ''}">
                    <div class="ah-img-wrapper">
                        <a href="${linkUrl}" target="_blank" title="${isCurrent || useDirect ? '原始链接' : '存档图片'}\n${dateStr}">
                            <img src="${finalImageUrl}" class="ah-img" loading="lazy" referrerpolicy="no-referrer"
                            onerror="this.closest('.ah-item').style.display='none'">
                        </a>${shortDate ? `<span class="ah-date">${shortDate}</span>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        body.innerHTML = html;
    }

    init();
})();