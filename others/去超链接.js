// ==UserScript==
// @name         BGM用户名和条目标题去超链接
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  移除bgm.tv个人用户页面，条目页面，人物页面中标题的超链接，方便复制
// @author       You
// @match        https://bgm.tv/user/*
// @match        https://bangumi.tv/user/*
// @match        https://chii.in/user/*
// @match        https://bgm.tv/subject/*
// @match        https://bangumi.tv/subject/*
// @match        https://chii.in/subject/*
// @match        https://bgm.tv/*/list/*
// @match        https://bangumi.tv/*/list/*
// @match        https://chii.in/*/list/*
// @match        https://bgm.tv/person/*
// @match        https://bangumi.tv/person/*
// @match        https://chii.in/person/*
// @match        https://bgm.tv/character/*
// @match        https://bangumi.tv/character/*
// @match        https://chii.in/character/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function removeUserLinks() {
        // 查找 div.name 内指向用户页面的超链接
        const nameDiv = document.querySelector('div.name');

        if (!nameDiv) {
            console.log('未找到 div.name 元素');
            return;
        }

        const links = nameDiv.querySelectorAll('a[href*="/user/"]');

        let count = 0;
        links.forEach(link => {
            // 检查链接是否指向用户页面（不包含其他路径如 /timeline, /friends 等）
            const href = link.getAttribute('href');
            const match = href.match(/\/user\/[^\/]+$/);

            if (match) {
                // 创建一个普通文本节点替换超链接
                const textNode = document.createTextNode(link.textContent);
                link.parentNode.replaceChild(textNode, link);
                count++;
            }
        });

        if (count > 0) {
            console.log('已移除 ' + count + ' 个用户名超链接');
        }
    }

    function removeSubjectTitleLinks() {
        // 查找条目页面中 h1.nameSingle 内的标题超链接
        const titleH1 = document.querySelector('#headerSubject h1.nameSingle');

        if (!titleH1) {
            console.log('未找到条目标题元素');
            return;
        }

        const links = titleH1.querySelectorAll('a[href*="/subject/"]');

        let count = 0;
        links.forEach(link => {
            // 检查链接是否指向条目页面
            const href = link.getAttribute('href');
            const match = href.match(/\/subject\/\d+$/);

            if (match) {
                // 创建一个普通文本节点替换超链接
                const textNode = document.createTextNode(link.textContent);
                link.parentNode.replaceChild(textNode, link);
                count++;
            }
        });

        if (count > 0) {
            console.log('已移除 ' + count + ' 个条目标题超链接');
        }
    }

    function removePersonLinks() {
        // 查找人物页面中 h1.nameSingle 内的人物名称超链接
        // 适用于现实人物 (/person/) 和虚拟人物 (/character/)
        const titleH1 = document.querySelector('h1.nameSingle');

        if (!titleH1) {
            console.log('未找到人物标题元素');
            return;
        }

        const links = titleH1.querySelectorAll('a[href*="/person/"], a[href*="/character/"]');

        let count = 0;
        links.forEach(link => {
            // 检查链接是否指向人物或角色页面
            const href = link.getAttribute('href');
            const match = href.match(/\/(person|character)\/\d+$/);

            if (match) {
                // 创建一个普通文本节点替换超链接
                const textNode = document.createTextNode(link.textContent);
                link.parentNode.replaceChild(textNode, link);
                count++;
            }
        });

        if (count > 0) {
            console.log('已移除 ' + count + ' 个人物名称超链接');
        }
    }

    function removeLinks() {
        removeUserLinks();
        removeSubjectTitleLinks();
        removePersonLinks();
    }

    // 页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeLinks);
    } else {
        removeLinks();
    }

    // 监听页面变化（适用于单页应用）
    const observer = new MutationObserver(function() {
        removeLinks();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();