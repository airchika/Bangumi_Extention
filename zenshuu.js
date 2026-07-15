// ==UserScript==
// @name         Bangumi 动态聚合按钮 全修
// @homepage     https://bangumi.tv/dev/app/6542
// @namespace    air.bgm.timeline.simple.combo
// @version      0.2.4
// @description  聚合好友的吐槽、日志和有评论收藏；用户页仅聚合当前用户。
// @author       Air + ChatGPT
// @match        http*://bgm.tv/
// @match        http*://bgm.tv/timeline*
// @match        http*://bgm.tv/user/*/timeline*
// @match        http*://bangumi.tv/
// @match        http*://bangumi.tv/timeline*
// @match        http*://bangumi.tv/user/*/timeline*
// @match        http*://chii.in/
// @match        http*://chii.in/timeline*
// @match        http*://chii.in/user/*/timeline*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (window.__airTimelineSimpleComboInstalled) return;
  window.__airTimelineSimpleComboInstalled = true;

  const BTN_ID = 'air_timeline_combo_tab';
  const BTN_TEXT = '全修';
  const USER_TIMELINE_PATH = getUserTimelinePath();
  const ACTIVE_STORAGE_KEY = USER_TIMELINE_PATH
    ? `air_timeline_combo_active:${USER_TIMELINE_PATH}`
    : 'air_timeline_combo_active';

  // 每次初始加载 / 再来点时抓取的页数。
  // 有评论收藏通常比吐槽、日志稀疏，所以收藏页多抓几页。
  const BATCH_PAGES = {
    say: 1,
    blog: 1,
    subject: 3,
  };

  // 防止“收藏简评太稀疏”时无限翻页。
  const MAX_PAGE = {
    say: 20,
    blog: 20,
    subject: 80,
  };

  const state = {
    active: false,
    loading: false,
    order: 0,
    items: [],
    seen: new Set(),
    page: {
      say: 1,
      blog: 1,
      subject: 1,
    },
  };

  function initSoon() {
    // 等其它 timeline 插件先初始化，避免被“全站动态”插件 clone 到隐藏 tab 里。
    setTimeout(init, 200);
  }

  function init() {
    const tabs = document.querySelector('#timelineTabs');
    if (!tabs || document.querySelector('#' + BTN_ID)) return;

    injectStyle();
    insertButton(tabs);
    bindUnfocus(tabs);
    restoreComboState();
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
      #timelineTabs a#${BTN_ID} {
        border-radius: 999px !important;
        padding-left: 10px !important;
        padding-right: 10px !important;
        transition: background-color .15s ease, color .15s ease;
      }
      #timelineTabs a#${BTN_ID}.focus,
      #timelineTabs a#${BTN_ID}.air-timeline-combo-focus {
        border-radius: 999px !important;
      }
      .air-timeline-combo-pager {
        margin: 12px 0;
        text-align: center;
      }
      .air-timeline-combo-pager a,
      .air-timeline-combo-loading {
        display: inline-block;
        border-radius: 999px;
        padding: 4px 14px;
      }
      .air-timeline-combo-empty,
      .air-timeline-combo-error {
        margin: 12px 0;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(0, 0, 0, .04);
        color: #888;
      }
    `;
    document.head.appendChild(style);
  }

  function insertButton(tabs) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.id = BTN_ID;
    a.href = 'javascript:void(0);';
    a.textContent = BTN_TEXT;
    a.addEventListener('click', onComboClick);
    li.appendChild(a);

    // 优先插到可见的“动态”右侧；找不到就插到第一个“更多”前面；再找不到就 append。
    const timelineLi = Array.from(tabs.children).find((child) => {
      const anchor = child.querySelector(':scope > a');
      return anchor && anchor.textContent.trim() === '动态' && child.style.display !== 'none';
    });
    if (timelineLi) {
      timelineLi.insertAdjacentElement('afterend', li);
      return;
    }

    const moreLi = Array.from(tabs.children).find((child) => {
      const top = child.querySelector(':scope > a.top');
      return top && child.style.display !== 'none';
    });
    if (moreLi) {
      tabs.insertBefore(li, moreLi);
    } else {
      tabs.appendChild(li);
    }
  }

  function bindUnfocus(tabs) {
    tabs.addEventListener('click', (event) => {
      const a = event.target.closest && event.target.closest('a');
      if (!a) return;
      if (a.id === BTN_ID) return;

      const combo = document.querySelector('#' + BTN_ID);
      if (combo) combo.classList.remove('focus', 'air-timeline-combo-focus');
      state.active = false;
      saveComboState(false);
    }, true);
  }

  async function onComboClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (state.loading) return;

    state.active = true;
    saveComboState(true);
    resetState();
    focusComboTab();
    //加载全修动态中…
    renderLoading(' ');

    try {
      await loadNextBatch();
      renderItems();
    } catch (error) {
      console.error('[AirTimelineCombo] load failed:', error);
      renderError('加载失败，可以刷新页面后重试。');
    }
  }

  function saveComboState(active) {
    try {
      const value = active ? 'on' : 'off';
      if (localStorage.getItem(ACTIVE_STORAGE_KEY) === value) return;
      localStorage.setItem(ACTIVE_STORAGE_KEY, value);
    } catch (error) {
      console.warn('[AirTimelineCombo] local settings save failed:', error);
    }
  }

  function restoreComboState() {
    try {
      if (localStorage.getItem(ACTIVE_STORAGE_KEY) === 'on') {
        const combo = document.querySelector('#' + BTN_ID);
        if (combo) combo.click();
      }
    } catch (error) {
      console.warn('[AirTimelineCombo] local settings read failed:', error);
    }
  }

  function resetState() {
    state.order = 0;
    state.items = [];
    state.seen = new Set();
    state.page = {
      say: 1,
      blog: 1,
      subject: 1,
    };
  }

  function focusComboTab() {
    const tabs = document.querySelector('#timelineTabs');
    const combo = document.querySelector('#' + BTN_ID);
    if (!tabs || !combo) return;

    tabs.querySelectorAll('a.focus, a.global-timeline-focus').forEach((a) => {
      a.classList.remove('focus', 'global-timeline-focus');
    });
    combo.classList.add('focus', 'air-timeline-combo-focus');
  }

  async function loadNextBatch() {
    state.loading = true;
    try {
      const tasks = [];
      tasks.push(...makeFetchTasks('say', BATCH_PAGES.say));
      tasks.push(...makeFetchTasks('blog', BATCH_PAGES.blog));
      tasks.push(...makeFetchTasks('subject', BATCH_PAGES.subject));

      const results = await Promise.allSettled(tasks.map((task) => fetchTimelineItems(task.type, task.page)));

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const item of result.value) {
          if (item.type === 'subject' && !hasSubjectComment(item.li)) continue;
          addItem(item);
        }
      }

      sortItems();
    } finally {
      state.loading = false;
    }
  }

  function makeFetchTasks(type, count) {
    const tasks = [];
    for (let i = 0; i < count; i++) {
      const page = state.page[type];
      if (page > MAX_PAGE[type]) break;
      tasks.push({ type, page });
      state.page[type] += 1;
    }
    return tasks;
  }

  async function fetchTimelineItems(type, page) {
    const url = buildTimelineUrl(type, page);
    const response = await fetch(url, {
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);

    const html = await response.text();
    return parseTimelineHtml(html, type, page);
  }

  function buildTimelineUrl(type, page) {
    // 用户页只聚合当前用户的动态，其它页面保持原来的全好友数据源。
    const url = new URL(USER_TIMELINE_PATH || '/timeline', location.origin);
    url.searchParams.set('type', type);
    url.searchParams.set('page', String(page));
    url.searchParams.set('ajax', '1');
    return url.toString();
  }

  function getUserTimelinePath() {
    const match = location.pathname.match(/^\/user\/[^/]+\/timeline\/?$/);
    return match ? location.pathname.replace(/\/$/, '') : '';
  }

  function parseTimelineHtml(html, type, page) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const timeline = temp.querySelector('#timeline') || temp;
    const items = [];
    let currentHeader = '';

    for (const child of Array.from(timeline.children)) {
      if (child.id === 'tmlPager') continue;

      if (child.tagName === 'H4') {
        currentHeader = child.textContent.trim();
        continue;
      }

      if (child.tagName !== 'UL') continue;

      for (const li of Array.from(child.children)) {
        if (li.tagName !== 'LI') continue;
        items.push({
          li,
          type,
          page,
          header: currentHeader,
          timeValue: parseItemTime(li),
          order: state.order++,
        });
      }
    }

    return items;
  }

  function hasSubjectComment(li) {
    // Bangumi 收藏简评通常有 .comment；兼容其它脚本可能插入的 q / .quote。
    return !!li.querySelector('.comment, .quote, q');
  }

  function addItem(item) {
    const key = fingerprint(item.li, item.type);
    if (state.seen.has(key)) return;
    state.seen.add(key);
    state.items.push(item);
  }

  function fingerprint(li, type) {
    const links = Array.from(li.querySelectorAll('a[href]'))
      .slice(0, 5)
      .map((a) => a.getAttribute('href'))
      .join('|');
    const date = (li.querySelector('p.date, .date') || {}).textContent || '';
    const text = li.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
    return `${type}::${links}::${date}::${text}`;
  }

  function sortItems() {
    state.items.sort((a, b) => {
      if (a.timeValue != null && b.timeValue != null && a.timeValue !== b.timeValue) {
        return b.timeValue - a.timeValue;
      }
      return a.order - b.order;
    });
  }

  function parseItemTime(li) {
    const dateEl = li.querySelector('p.date, .date, time');
    const candidates = [];
    if (dateEl) {
      // Bangumi 当前把精确时间放在 .date 内部的 .titleTip[title] 上，
      // 而不是 .date 自身；只读取父元素会导致所有动态都只能按抓取顺序显示。
      for (const el of dateEl.querySelectorAll('[datetime], [title], [data-time]')) {
        candidates.push(el.getAttribute('datetime') || '');
        candidates.push(el.getAttribute('title') || '');
        candidates.push(el.getAttribute('data-time') || '');
      }
      candidates.push(dateEl.getAttribute('datetime') || '');
      candidates.push(dateEl.getAttribute('title') || '');
      candidates.push(dateEl.getAttribute('data-time') || '');
      candidates.push(dateEl.textContent || '');
    }
    candidates.push(li.getAttribute('title') || '');

    const text = candidates.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) return null;

    // 绝对时间：2026-7-6 20:30 / 2026/7/6 20:30 / 2026.7.6 20:30
    let m = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const [, y, mo, d, h, mi, s = '0'] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
    }

    const now = Date.now();

    m = text.match(/(\d+)\s*秒前/);
    if (m) return now - Number(m[1]) * 1000;

    m = text.match(/(\d+)\s*分(?:钟)?前/);
    if (m) return now - Number(m[1]) * 60 * 1000;

    m = text.match(/(\d+)\s*小时前/);
    if (m) return now - Number(m[1]) * 60 * 60 * 1000;

    m = text.match(/(\d+)\s*天前/);
    if (m) return now - Number(m[1]) * 24 * 60 * 60 * 1000;

    return null;
  }

  function getTimelineContainer() {
    return document.querySelector('#timeline');
  }

  function renderLoading(message) {
    const timeline = getTimelineContainer();
    if (!timeline) return;
    timeline.innerHTML = `<div class="loading"><span class="air-timeline-combo-loading">${escapeHtml(message)}</span></div>`;
  }

  function renderError(message) {
    const timeline = getTimelineContainer();
    if (!timeline) return;
    timeline.innerHTML = `<div class="air-timeline-combo-error">${escapeHtml(message)}</div>`;
  }

  function renderItems() {
    const timeline = getTimelineContainer();
    if (!timeline) return;

    timeline.innerHTML = '';

    if (state.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'air-timeline-combo-empty';
      empty.textContent = '没有找到符合条件的动态。';
      timeline.appendChild(empty);
      appendPager(timeline);
      return;
    }

    let currentHeader = null;
    let currentUl = null;
    let lastSubjectIndex = -1;

    for (let i = state.items.length - 1; i >= 0; i--) {
      if (state.items[i].type === 'subject') {
        lastSubjectIndex = i;
        break;
      }
    }

    for (const [index, item] of state.items.entries()) {
      const header = item.header || '动态';
      if (header !== currentHeader) {
        currentHeader = header;
        const h4 = document.createElement('h4');
        h4.className = 'Header';
        h4.textContent = header;
        timeline.appendChild(h4);

        currentUl = null;
      }

      if (!currentUl) {
        currentUl = document.createElement('ul');
        timeline.appendChild(currentUl);
      }

      currentUl.appendChild(item.li);

      if (index === lastSubjectIndex) {
        appendPager(timeline);
        // 后续同一日期的吐槽、日志另起列表，让按钮能留在收藏动态的截止位置。
        currentUl = null;
      }
    }

    if (lastSubjectIndex === -1) appendPager(timeline);

    try {
      window.chiiLib && window.chiiLib.tml && window.chiiLib.tml.prepareAjax && window.chiiLib.tml.prepareAjax();
    } catch (error) {
      console.warn('[AirTimelineCombo] prepareAjax failed:', error);
    }
  }

  function appendPager(timeline) {
    const hasMore = ['say', 'blog', 'subject'].some((type) => state.page[type] <= MAX_PAGE[type]);
    if (!hasMore) return;

    const pager = document.createElement('div');
    pager.className = 'page_inner air-timeline-combo-pager';

    const a = document.createElement('a');
    a.href = 'javascript:void(0);';
    a.className = 'p';
    a.textContent = '再来点';
    a.addEventListener('click', async () => {
      if (state.loading) return;
      a.textContent = '加载中…';
      try {
        await loadNextBatch();
        renderItems();
      } catch (error) {
        console.error('[AirTimelineCombo] load more failed:', error);
        a.textContent = '加载失败，点此重试';
      }
    });

    pager.appendChild(a);
    timeline.appendChild(pager);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[char]));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSoon);
  } else {
    initSoon();
  }
})();
