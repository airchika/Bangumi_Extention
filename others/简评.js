// ==UserScript==
// @name         为首页动态添加分类筛选“简评”
// @version      0.2
// @description  此分类下只看简评，即点格子时附带简评（吐槽箱内容）时产生的“收藏”大类下时间线项目。纯点格子条目将不会显示。
// @match        http*://bgm.tv/
// @match        http*://bangumi.tv/
// @grant        none
// ==/UserScript==
(function () {
    'use strict';

    function AddNewTimeLineMode() {
        if (window.location.pathname != "/") return;
        const menu = document.querySelector("#timelineTabs");
        const btn = document.createElement('li');

        btn.innerHTML = '<a href="javascript:void(0)">简评</a>';
        menu.appendChild(btn);
        const anchor = btn.querySelector('a');

        btn.onclick = async function () {
            let page = 1;
            const timeline = document.querySelector("#timeline");
            timeline.innerHTML = "";
            Array.from(menu.querySelectorAll("a.focus")).forEach(e => e.classList.remove("focus"));
            anchor.className = "focus";


            let loadMore = async (atLeast) => {
                let count = 0;
                let safeLoad = 10;
                do {
                    let text = await GetTimeline(page)
                    count += OnlyAppendShortReview(text, timeline);
                    page++;
                    safeLoad--;
                } while (count <= atLeast && safeLoad>0);
                let loadMoreBtn = document.createElement('div');
                loadMoreBtn.className = "page_inner";
                loadMoreBtn.innerHTML = `<a href="javascript:void(0)" class="p">再来点</a>`;
                loadMoreBtn.onclick = function () {
                    loadMoreBtn.onclick = null;
                    loadMoreBtn.innerHTML = "加载中…";
                    loadMore(atLeast).then(() => { loadMoreBtn.remove(); })
                };
                timeline.appendChild(loadMoreBtn);
            };

            loadMore(1);
        }
    }



    async function GetTimeline(page) {
        const r = await fetch(`https://bgm.tv/timeline?type=subject&page=${page}&ajax=1`);
        const t = await r.text();
        return t;
    }


    function OnlyAppendShortReview(text, div) {
        let r = "";
        const temp = document.createElement('div');
        temp.innerHTML = text;

        // Array.from(temp.querySelectorAll('li:has(q)')).forEach();
        Array.from(temp.querySelectorAll('li')).forEach(
            li => {
                if (li.querySelector('.comment') == null) {
                    li.remove();
                }
            }
        );
        const c = temp.querySelectorAll('li').length;
        const tempTimeline = temp.querySelector('#timeline');
        for (const e of Array.from(tempTimeline.children)) {
            if (e.id == "tmlPager") continue;
            if (e.tagName == "H4") continue;
            if (e.tagName == "UL" && e.children.length == 0) continue;
            div.appendChild(e);
        }
        return c;
    }
    AddNewTimeLineMode();
})();