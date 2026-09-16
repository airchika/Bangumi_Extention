// ==UserScript==
// @name         Bangumi 动态聚合按钮 全修
// @homepage     https://bangumi.tv/dev/app/6542
// @namespace    air.bgm.timeline.simple.combo
// @version      0.2.5
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
    likesData: Object.create(null),
    likesTemplate: null,
    lastErrors: [],
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
      .air-timeline-combo-warning {
        display: block;
        margin-bottom: 8px;
        color: #b06a00;
        font-size: 12px;
      }
      html[data-theme=dark] .air-timeline-combo-warning {
        color: #e0a84c;
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
    }, true);
  }

  async function onComboClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (state.loading) return;

    state.active = true;
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

  function resetState() {
    state.order = 0;
    state.items = [];
    state.seen = new Set();
    state.likesData = Object.create(null);
    state.likesTemplate = null;
    state.lastErrors = [];
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
    state.lastErrors = [];
    try {
      const results = await Promise.all(
        Object.entries(BATCH_PAGES).map(([type, count]) => loadTypeBatch(type, count)),
      );
      let attemptedPages = 0;
      let successfulPages = 0;

      for (const result of results) {
        attemptedPages += result.attemptedPages;
        successfulPages += result.successfulPages;
        if (result.error) state.lastErrors.push({ type: result.type, error: result.error });
        mergeLikesData(state.likesData, result.likesData);
        if (!state.likesTemplate && result.likesTemplate) {
          state.likesTemplate = result.likesTemplate;
        }
        for (const item of result.items) {
          if (item.type === 'subject' && !hasSubjectComment(item.li)) continue;
          addItem(item);
        }
      }

      if (attemptedPages > 0 && successfulPages === 0 && state.lastErrors.length) {
        throw new Error(state.lastErrors.map(({ type, error }) => `${type}: ${error.message || error}`).join('; '));
      }
      sortItems();
    } finally {
      state.loading = false;
    }
  }

  async function loadTypeBatch(type, count) {
    const result = {
      type,
      items: [],
      attemptedPages: 0,
      successfulPages: 0,
      likesData: Object.create(null),
      likesTemplate: null,
      error: null,
    };
    for (let i = 0; i < count; i++) {
      const page = state.page[type];
      if (page > MAX_PAGE[type]) break;
      result.attemptedPages += 1;
      try {
        const parsed = await fetchTimelineItems(type, page);
        result.items.push(...parsed.items);
        mergeLikesData(result.likesData, parsed.likesData);
        if (!result.likesTemplate && parsed.likesTemplate) {
          result.likesTemplate = parsed.likesTemplate;
        }
        result.successfulPages += 1;
        state.page[type] += 1;
      } catch (error) {
        result.error = error;
        break;
      }
    }
    return result;
  }

  async function fetchTimelineItems(type, page) {
    const url = buildTimelineUrl(type, page);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);

      const html = await response.text();
      return parseTimelineHtml(html, type, page);
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(`请求超时：${type} 第 ${page} 页`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
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
    const likesData = parseLikesData(temp);
    const likesTemplate = temp.querySelector('#likes_reaction_grid_item');
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

    return {
      items,
      likesData,
      likesTemplate: likesTemplate ? likesTemplate.cloneNode(true) : null,
    };
  }

  function parseLikesData(root) {
    const likesData = Object.create(null);

    // AJAX 片段把表情数据放在 #timeline 外的内联脚本中。
    // 这里只读取赋值右侧的 JSON 字面量，不执行响应中的任何脚本。
    for (const script of root.querySelectorAll('script:not([src])')) {
      const source = script.textContent || '';
      const assignment = source.match(/(?:^|[;\r\n])\s*(?:var|let|const)\s+data_likes_list\s*=/);
      if (!assignment) continue;

      try {
        const value = parseJsonLiteral(source, assignment.index + assignment[0].length);
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('data_likes_list 不是对象');
        }
        mergeLikesData(likesData, value);
      } catch (error) {
        console.warn('[AirTimelineCombo] likes data parse failed:', error);
      }
    }

    return likesData;
  }

  function parseJsonLiteral(source, startIndex) {
    let start = startIndex;
    while (/\s/.test(source[start] || '')) start += 1;

    if (source[start] !== '{' && source[start] !== '[') {
      throw new Error('找不到 JSON 起始位置');
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < source.length; i++) {
      const char = source[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{' || char === '[') {
        depth += 1;
      } else if (char === '}' || char === ']') {
        depth -= 1;
        if (depth === 0) return JSON.parse(source.slice(start, i + 1));
      }
    }

    throw new Error('JSON 数据不完整');
  }

  function mergeLikesData(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    for (const [relatedId, reactions] of Object.entries(source)) {
      target[relatedId] = reactions;
    }
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
    const likesGrid = li.querySelector('.likes_grid[id]');
    if (likesGrid) {
      return `reaction::${likesGrid.getAttribute('id').replace(/^likes_grid_/, '')}`;
    }

    const timelineId = li.getAttribute('id');
    if (timelineId) return `timeline::${timelineId.replace(/^tml_/, '')}`;

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
      prepareLikesData();
      window.chiiLib && window.chiiLib.tml && window.chiiLib.tml.prepareAjax && window.chiiLib.tml.prepareAjax();
    } catch (error) {
      console.warn('[AirTimelineCombo] prepareAjax failed:', error);
    }
  }

  function prepareLikesData() {
    if (!document.querySelector('#likes_reaction_grid_item') && state.likesTemplate) {
      document.body.appendChild(state.likesTemplate.cloneNode(true));
    }

    const merged = Object.create(null);
    if (window.data_likes_list && typeof window.data_likes_list === 'object'
      && !Array.isArray(window.data_likes_list)) {
      mergeLikesData(merged, window.data_likes_list);
    }
    mergeLikesData(merged, state.likesData);
    window.data_likes_list = merged;
  }

  function appendPager(timeline) {
    const hasMore = ['say', 'blog', 'subject'].some((type) => state.page[type] <= MAX_PAGE[type]);
    if (!hasMore) return;

    const pager = document.createElement('div');
    pager.className = 'page_inner air-timeline-combo-pager';

    if (state.lastErrors.length) {
      const labels = { say: '吐槽', blog: '日志', subject: '收藏' };
      const warning = document.createElement('span');
      warning.className = 'air-timeline-combo-warning';
      warning.textContent = `部分内容加载失败（${state.lastErrors.map(({ type }) => labels[type] || type).join('、')}），点击“再来点”重试。`;
      pager.appendChild(warning);
    }

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
