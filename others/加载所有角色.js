// ==UserScript==
// @name         角色介绍栏目加载所有角色
// @version      0.1
// @author       ayazumi
// @match        https://bgm.tv/*
// @match        https://bangumi.tv/*
// @match        https://chii.in/*
// @description  为条目页的角色介绍一栏添加滚动条属性，并把所有角色添加进来
// ==/UserScript==

window.FULLcharacterListLoader = { //告诉其他组件本组件存在
  loaded: true,
  initTime: Date.now()
};

async function loadFullcharacterList() {

  if (!/^\/subject\/\d+\/?$/.test(location.pathname)) return;

  /*
    const orLis = document.querySelectorAll('#browserItemList > li');
    // 遍历所有 li，提取每个 li 中的 orName 文本，存入数组
    const orNameArray = Array.from(orLis).map(li => {
      return li.querySelector("div p a")?.innerText || ''; 
    });
    console.log(orNameArray);
  */
  //console.log('1');

  const charactersURL = location.pathname.replace(/\/?$/, '/characters');
  const resp = await fetch(charactersURL);
  if (!resp.ok) {
    // 派发失败事件
    dispatchComponentEvent('componentLoadFailed', { error: 'Fetch failed', status: resp.status });
    return;
  }
  const html = await resp.text();

  //console.log('2');

  const newdom = new DOMParser().parseFromString(html, 'text/html');
  const items = newdom.querySelectorAll('.item');
  if (!items.length) {
    // 派发失败事件
    dispatchComponentEvent('componentLoadFailed', { error: 'No items found' });
    return;
  } 

  //console.log(items);

  const targetList = document.getElementById('browserItemList') || document.querySelector('#browserItemList');
  
  //判断用户是否启用了中文化组件
  var is4636 = false;
  if (typeof window.addChineseNameToCharacter === 'function') {
    is4636 = true;
    window.skipAddChineseNameToCharacter= true;
  }
  var jues = {};
  var jobs = {};
  targetList.replaceChildren();
  //targetList.innerHTML = '';

  const tooltips = document.querySelectorAll('.tooltip');
  if (tooltips.length > 0) {
    tooltips.forEach(tooltip => tooltip.remove());
  } 

  items.forEach(item => {
    targetList.appendChild(convertCharacter(item));
    //console.log('new');
  });
  function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }

  document.querySelectorAll('.castTypeFilter li a').forEach(li => {
    const originalText = li.textContent.trim();

    // 提取括号外文本（key）和括号内数值（value）
    const match = originalText.match(/^([^()]+)\((\d+)\)$/);
    if (!match) return; // 跳过不符合格式的 li

    const [, key, bracketValue] = match; // key: 括号外文本，bracketValue: 括号内数值
    const cleanKey = key.trim(); // 去除可能的空格
    //console.log(jobs,jues);
    // 检查 key 是否存在于 zhuJue 对象中
    if (jues.hasOwnProperty(cleanKey)) {
      // 计算总和（转为数字后相加）
      const total = Number(jues[cleanKey]); //+ Number(bracketValue);
      // 替换 li 文本为 "key(total)"
      li.textContent = `${cleanKey}(${total})`;
    }

    if (jobs.hasOwnProperty(cleanKey)) {
      // 计算总和（转为数字后相加）
      const total = Number(jobs[cleanKey]);//+ Number(bracketValue);
      // 替换 li 文本为 "key(total)"
      li.textContent = `${cleanKey}(${total})`;
    }
  });

  function isCrtNumber(str) {
    // 正则表达式：^开头，crt-固定文本，\d+至少1个数字，$结尾
    const regex = /^crt-\d+$/;
    // test()方法返回布尔值：true=匹配，false=不匹配
    return regex.test(str);
  }
  function extractNumberFromCrt(str) {
    // 正则：匹配crt-开头，用()捕获数字部分
    const match = str.match(/^crt-(\d+)$/);
    // 若匹配成功，返回捕获组的数字（转为Number类型）；否则返回null
    return match ? match[1] : null;
  }
  const castTypeUl = document.querySelector('.castTypeFilter');

  castTypeUl.addEventListener('click', function (e) {
    e.preventDefault();
    const targetLi = e.target.closest('li');
    let isFlexIsBlock;
    document.querySelectorAll('.flex-center-v.rr a span').forEach(span => {
      if (span.classList.contains('ico_grid')) {
        isFlexIsBlock = 'flex';
      } else if (span.classList.contains('ico_list')) {
        isFlexIsBlock = 'block';
      }
    });
    isFlexIsBlock = '';
    if (targetLi.querySelector('a').getAttribute('data-type') === 'all-crt') {
      const elements = document.querySelectorAll('li#added');
      elements.forEach(element => {
        element.style.display = isFlexIsBlock;
      });
    } else if (isCrtNumber(targetLi.querySelector('a').getAttribute('data-type'))) {
      const elements = document.querySelectorAll('li#added');
      elements.forEach(element => {
        const elementtag = element.querySelector(".inner .info .jobs .badge_job_tip")
        if (elementtag.getAttribute('attr-crt-type') === extractNumberFromCrt(targetLi.querySelector('a').getAttribute('data-type'))) {
          element.style.display = isFlexIsBlock;
        } else {
          element.style.display = 'none';
        }
      });
      // 获取目标分隔元素
      const sepElement = document.querySelector("#columnSubjectHomeB > div.subject_section.clearit > div.flex-center-v.rr > div > ul > li.sep");

      if (sepElement) {
        const parentUl = sepElement.parentElement; // 获取<ul>父元素
        const allLis = Array.from(parentUl.children); // 获取所有<li>子元素
        const sepIndex = allLis.indexOf(sepElement); // 获取.sep的位置索引

        // 清除前面所有<li>中的<a>的focus类
        allLis.slice(0, sepIndex).forEach(li => {
          const aTag = li.querySelector('a');
          if (aTag) aTag.classList.remove('focus');
        });
        allLis.slice(sepIndex + 1).forEach(li => {
          const aTag = li.querySelector('a');
          if (aTag) aTag.classList.remove('focus');
        });
      }
      // 假设 targetLi 是已获取的<li>元素
      if (targetLi) {
        const aTag = targetLi.querySelector('a');
        if (aTag) {
          aTag.classList.add('focus'); // 添加focus类
        }
      }

    } else if (targetLi.querySelector('a').getAttribute('data-type') === 'all-rlt') {
      const elements = document.querySelectorAll('li#added .inner .info .badge_actor');
      elements.forEach(element => {
        if (element.getAttribute('attr-rlt-type') !== '114514') {
          element.style.display = ' inline-block';
        }
      });
    } else if (targetLi.querySelector('a').getAttribute('data-type') === 'primary') {
      const elements = document.querySelectorAll('li#added .inner .info .badge_actor');
      elements.forEach(element => {
        if (element.getAttribute('attr-rlt-primary') === '1') {
          element.style.display = ' inline-block';
        } else {
          element.style.display = 'none';
        }
      });
    } else if (isNumeric(targetLi.querySelector('a').getAttribute('data-type'))) {
      const elements = document.querySelectorAll('li#added .inner .info .badge_actor');
      elements.forEach(element => {
        if (targetLi.querySelector('a').getAttribute('data-type') === element.getAttribute('attr-rlt-type')) {
          element.style.display = ' inline-block';
        } else {
          element.style.display = 'none';
        }
        // 获取目标分隔元素
        const sepElement = document.querySelector("#columnSubjectHomeB > div.subject_section.clearit > div.flex-center-v.rr > div > ul > li.sep");

        if (sepElement) {
          const parentUl = sepElement.parentElement; // 获取<ul>父元素
          const allLis = Array.from(parentUl.children); // 获取所有<li>子元素
          const sepIndex = allLis.indexOf(sepElement); // 获取.sep的位置索引
          // 清除前面所有<li>中的<a>的focus类
          allLis.slice(0, sepIndex).forEach(li => {
            const aTag = li.querySelector('a');
            if (aTag) aTag.classList.remove('focus');
          });
          allLis.slice(sepIndex + 1).forEach(li => {
            const aTag = li.querySelector('a');
            if (aTag) aTag.classList.remove('focus');
          });
          // 假设 targetLi 是已获取的<li>元素
          if (targetLi) {
            const aTag = targetLi.querySelector('a');
            if (aTag) {
              aTag.classList.add('focus'); // 添加focus类
            }
          }
        }
      });
    } else if (targetLi.querySelector('a').getAttribute('data-type') === 'spoiler-toggle') {
  // 找到所有剧透角色（你的脚本添加的）
  const spoilerItems = document.querySelectorAll('li#added.spoiler');
  
  if (spoilerItems.length === 0) return;
  
  // 判断当前状态（检查第一个 li 是否有 show_spoiler 类）
  const isShowing = spoilerItems[0]?.classList.contains('show_spoiler');
  
  // 切换所有剧透 li 的 show_spoiler 类
  spoilerItems.forEach(item => {
    if (isShowing) {
      item.classList.remove('show_spoiler');
    } else {
      item.classList.add('show_spoiler');
    }
  });
  
  // 更新按钮文字
  const count = spoilerItems.length;
  aTag.textContent = isShowing 
    ? `显示剧透角色(${count})` 
    : `隐藏剧透角色(${count})`;
  
  return;
}
  });

document.querySelectorAll('.castTypeFilterList .thumbTip[data-original-title]').forEach(el => {
  // 鼠标进入时创建并显示提示框
  el.addEventListener('mouseenter', () => {
    // 创建提示节点
    const tip = document.createElement('div');
    tip.className = 'custom-tooltip tooltip fade top';
    tip.role = 'tooltip';
    tip.style = 'display: block; opacity: 0; position: absolute;'; // 初始隐藏
    
    // 创建箭头元素
    const arrow = document.createElement('div');
    arrow.className = 'tooltip-arrow';
    arrow.style = 'left: 50%;';
    
    // 创建内容元素
    const inner = document.createElement('div');
    inner.className = 'tooltip-inner';
    inner.textContent = el.dataset.originalTitle;
    
    // 组装提示框结构
    tip.appendChild(arrow);
    tip.appendChild(inner);
    document.body.appendChild(tip);
    
    // 计算位置并显示
    const rect = el.getBoundingClientRect();
    tip.style.left = `${rect.left + window.scrollX + (rect.width - tip.offsetWidth) / 2}px`;
    tip.style.top = `${rect.top + window.scrollY - tip.offsetHeight - 6}px`;
    tip.style.opacity = 1; // 触发显示动画
    
    // 存储提示框引用，供离开时使用
    el._tooltip = tip;
  });

  // 鼠标离开时移除提示框
  el.addEventListener('mouseleave', () => {
    if (el._tooltip) {
      el._tooltip.remove(); // 从DOM中移除
      delete el._tooltip; // 清除引用
    }
  });
});


  function convertCharacter(oldNode) {
    const avatarImg = oldNode.querySelector('img.avatar.ll');
    const bgImgUrl = avatarImg ? avatarImg.src.replace(/^\/\//, 'https://') : 'https://bgm.tv/img/info_only.png';
    const nameLink = oldNode.querySelector('h2>a');
    const jpnameText = nameLink ? nameLink.textContent.trim() : '';
    const nameText = nameLink.parentNode.querySelector('.tip') ? nameLink.parentNode.querySelector('.tip').textContent.trim() : jpnameText;
    /*if (orNameArray.includes(jpnameText)){return document.createComment('I LOVE SAI') ;}*/
    const charLink = nameLink ? nameLink.href : '';
    const badgeSpan = oldNode.querySelector('.badge_job');
    const badgeText = badgeSpan ? badgeSpan.textContent.trim() : '';
    const attrCrtType = badgeSpan?.getAttribute('attr-crt-type') || '';
    if (jues.hasOwnProperty(badgeText)) {
      jues[badgeText]++; // 存在则数值加一
    } else {
      jues[badgeText] = 1; // 不存在则创建索引并设为 1

      const targetUl = document.querySelector("#columnSubjectHomeB > div.subject_section.clearit > div.flex-center-v.rr > div > ul");

      if (targetUl.querySelector('li')) {
        // 1. 定位分隔线 li.sep
        const separatorLi = targetUl.querySelector("li.sep");
        const existingLinks = targetUl.querySelectorAll("li > a");

        // 检查是否有 a 元素的 data-type 等于 attrRltTtype
        const hasDuplicate = Array.from(existingLinks).some(link => {
          return extractNumberFromCrt(link.dataset.type) === attrCrtType; // 对比 data-type 属性
        });
        // 3. 不存在重复时，在分隔线前插入新元素
        if (!hasDuplicate) {
          const newLi = `<li><a href="#" data-type="crt-${attrCrtType}" class="bve-processed">${badgeText}(0)</a></li>`;
          if (separatorLi) {
            // 有分隔线：插入到分隔线前面
            separatorLi.insertAdjacentHTML('beforebegin', newLi);
          } else {
             // 没有分隔线：直接追加到 ul 末尾
            targetUl.insertAdjacentHTML('beforeend', newLi);
          }

        }
      }



    }
    const cmtNum = oldNode.querySelector('.rr small') ? oldNode.querySelector('.rr small').textContent.trim() : '(+0)';

    let allBadgeHtml = '';
    const primaryBadges = oldNode.querySelectorAll('.actorBadge');
    primaryBadges.forEach(badge => {
      const cv = badge.querySelector('p a')?.textContent?.trim() || '';
      const cvlink = badge.querySelector('p a')?.getAttribute('href') || '';
      const attrRltPrimary = badge?.getAttribute('attr-rlt-primary') || '';
      let display;
      if (attrRltPrimary === '1') {
        display = 'flex';
      } else {
        display = 'none'
      }
      const attrRltTtype = badge?.getAttribute('attr-rlt-type') || '';
      const attRltTypeName = badge?.getAttribute('att-rlt-type-name') || '';
      if (jobs.hasOwnProperty(attRltTypeName)) {
        jobs[attRltTypeName]++; // 存在则数值加一
      } else {
        jobs[attRltTypeName] = 1; // 不存在则创建索引并设为 1
        // 获取目标 ul 元素
      const targetUl = document.querySelector("#columnSubjectHomeB > div.subject_section.clearit > div.flex-center-v.rr > div > ul");

        // 确保目标 ul 存在
        if (targetUl) {
          // 获取所有已存在的 li > a 元素
          const existingLinks = targetUl.querySelectorAll("li > a");

          // 检查是否有 a 元素的 data-type 等于 attrRltTtype
          const hasDuplicate = Array.from(existingLinks).some(link => {
            return link.dataset.type === attrRltTtype; // 对比 data-type 属性
          });

          // 如果不存在重复，则追加新 li
          if (!hasDuplicate) {
            const newLi = `<li><a href="#" data-type="${attrRltTtype}" class="bve-processed">${attRltTypeName}(0)</a></li>`;
            targetUl.insertAdjacentHTML('beforeend', newLi);
          }
        }

      }
      if (cv) {
        allBadgeHtml += `
            <p class="badge_actor" attr-rlt-type="${attrRltTtype}" att-rlt-type-name="${attRltTypeName}" attr-rlt-primary="${attrRltPrimary}" style='display:'${display}'>
              <span class="tip_i">${attRltTypeName}</span>
              <a href="${cvlink}" class="bve-processed">${cv}</a>
            </p>
          `;
      }
    });

    const is4636a = is4636 ? nameText : '';

    const li = document.createElement('li');
    //li.className = 'item clearit';
    li.className = oldNode.className;
    // 用 classList 操作
    li.classList.add('clearit');     // 添加 clearit
    li.classList.remove('light_odd'); // 移除 light_odd
    const hasSpoiler = oldNode.classList.contains('spoiler');
    const avatarSpanClass = hasSpoiler 
      ? 'avatarNeue avatarCoverPortrait avatarTop spoilerable'
      : 'avatarNeue avatarCoverPortrait avatarTop';


    li.id = 'added';

    li.innerHTML = `
      <a href="${charLink}" title class="thumbTip" data-original-title="${nameText}">
        <span class="${avatarSpanClass}"
              style="background-image:url('${bgImgUrl}')"></span>
      </a>
      <div class = "inner ${hasSpoiler ? 'spoilerable' : ''}">
        <p class="title">
          ${is4636a ? `<a href="${charLink}" class="title">${is4636a}</a>` : ''}
          <a href="${charLink}" class="title bve-processed">${jpnameText}</a>
        </p>
        <div class="info">
          <p class="jobs">
            ${badgeText ? `<span class="badge_job_tip" attr-crt-type="${attrCrtType}" >${badgeText}</span>` : ''}
            ${cmtNum ? `<small class="primary">${cmtNum}</small>` : ''}
            </p>
            ${allBadgeHtml}
        </div>
      </div>
    `;

    //console.log(li);
    return li;
  }



}

loadFullcharacterList().then(() => {
  // 派发组件加载完成事件
  dispatchComponentEvent('FullListLoaded', {
    component: 'FULLcharacterListLoader',
    timestamp: Date.now(),
    success: true
  });
});



// 派发自定义事件的辅助函数
function dispatchComponentEvent(eventName, detail) {
  const event = new CustomEvent(eventName, {
    detail: {
      ...detail,
      component: 'FULLcharacterListLoader',
      timestamp: Date.now()
    }
  });
  document.dispatchEvent(event);
}