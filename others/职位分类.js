// ==UserScript==
// @name         Bangumi 制作人员职位分类
// @version      1.4.0
// @description  Bangumi制作人员职位分类
// @author       Sumora、Gemini
// @match        *://bgm.tv/*
// @match        *://bangumi.tv/*
// @match        *://chii.in/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const injectStyle = () => {
        if (document.getElementById('bangumi-staff-helper-style')) return;
        const style = document.createElement('style');
        style.id = 'bangumi-staff-helper-style';
        style.textContent = `
            .custom-category-ul { display: none; padding: 0; margin: 0; list-style: none; border-left: 2px solid #0084FF; margin-left: 5px; padding-left: 10px; margin-bottom: 5px; }
            .category-tags-wrapper { padding: 4px 0 8px 0; border-bottom: 1px dashed #ccc; margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
            .tag.group_tag {
                cursor: pointer; user-select: none; padding: 2px 8px;
                border: 1px solid #d4d4d4; border-radius: 4px;
                background: #fdfdfd; color: #666; font-size: 12px;
                transition: all 0.1s;
                display: inline-block;
            }
            .tag.group_tag:hover { background: #f0f7ff; border-color: #0084FF; color: #0084FF; }
            .tag.group_tag.active { background-color: #0084FF; color: white !important; border-color: #0084FF; }
            .tag.more { cursor: pointer; color: #0084FF; font-weight: bold; border: none; background: none; margin-left: 5px; }
            .tag.more:hover { text-decoration: underline; color: #0056b3; }
            #infobox li.original-job:not(.keep-visible) { display: none !important; }
            .custom-category-row, .keep-visible { display: block !important; }
            
            .category-control {
                margin-bottom: 20px;
                padding: 10px;
                background: #f9f9f9;
                border-radius: 4px;
            }
            .category-control .select-group {
                margin-bottom: 10px;
            }
            .category-control .select-group label {
                margin-right: 10px;
                font-weight: bold;
            }
            .category-control .category-select {
                padding: 4px 8px;
                border: 1px solid #d4d4d4;
                border-radius: 4px;
                background: #fff;
                color: #333;
                font-size: 12px;
                min-width: 150px;
            }
            .category-control .button-group {
                margin-top: 15px;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            .category-control .button-group button {
                padding: 6px 16px;
                font-size: 12px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .btnRed {
                background-color: #dc3545;
                color: white;
                border: 1px solid #dc3545;
            }
            .btnRed:hover {
                background-color: #c82333;
                border-color: #bd2130;
            }
            .category-control .button-group button.disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .refresh-notice {
                background: #fff3cd !important;
                border: 1px solid #ffeaa7 !important;
                border-radius: 4px;
                padding: 10px;
                margin-bottom: 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                opacity: 1 !important;
                z-index: 1000 !important;
            }
            .refresh-notice.show {
                display: flex !important;
            }
            .refresh-notice .notice-text {
                color: #856404 !important;
                font-size: 12px;
            }
            .custom-content .btnRedSmall {
                background-color: #dc3545;
                color: white;
                border: 1px solid #dc3545;
                border-radius: 4px;
                padding: 2px 8px;
                font-size: 12px;
                cursor: pointer;
                text-decoration: none;
                transition: all 0.1s;
            }
            .custom-content .btnRedSmall:hover {
                background-color: #c82333;
                border-color: #bd2130;
            }
            [data-theme="dark"] .refresh-notice {
                background: #4a3a00 !important;
                border-color: #6b5400 !important;
            }
            [data-theme="dark"] .refresh-notice .notice-text {
                color: #ffd700 !important;
            }
            [data-theme="dark"] .custom-content .btnRedSmall {
                background-color: #c82333;
                border-color: #bd2130;
            }
            [data-theme="dark"] .custom-content .btnRedSmall:hover {
                background-color: #a71e2a;
                border-color: #941b25;
            }
            .category-control .status-display {
                margin-top: 10px;
                padding: 5px;
                background: #f0f0f0;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
            }
            [data-theme="dark"] .category-control .status-display {
                background: #444;
                color: #ddd;
            }
            [data-theme="dark"] .category-control {
                background: #333;
            }
            [data-theme="dark"] .category-control .category-select {
                border-color: #555;
                background: #444;
                color: #ddd;
            }
            
            .whitelist-container {
                margin-top: 10px;
            }
            .whitelist-input {
                margin-bottom: 10px;
            }
            .whitelist-input input {
                padding: 4px 8px;
                border: 1px solid #d4d4d4;
                border-radius: 4px;
                margin-right: 5px;
            }
            #whitelist-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .pagination-container {
                margin-top: 10px;
            }
            #whitelist-list li {
                margin-bottom: 5px;
                padding: 5px;
                background: #f9f9f9;
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #whitelist-list li button {
                padding: 2px 6px;
                font-size: 12px;
            }
            .pagination {
                margin-top: 10px;
                display: flex;
                gap: 5px;
                flex-wrap: wrap;
            }
            .pagination-btn {
                padding: 2px 8px;
                font-size: 12px;
                border: 1px solid #d4d4d4;
                border-radius: 4px;
                background: #fdfdfd;
                cursor: pointer;
            }
            .pagination-btn.active {
                background: #0084FF;
                color: white;
                border-color: #0084FF;
            }
            .pagination-btn:hover:not(.active) {
                background: #f0f7ff;
                border-color: #0084FF;
                color: #0084FF;
            }
            [data-theme="dark"] .pagination-btn {
                border-color: #555;
                background: #333;
                color: #ddd;
            }
            [data-theme="dark"] .pagination-btn.active {
                background: #3498db;
                border-color: #3498db;
            }
            [data-theme="dark"] .pagination-btn:hover:not(.active) {
                background: #2a3a4a;
                border-color: #3498db;
                color: #3498db;
            }
            
            .custom-category-container {
                margin-top: 10px;
            }
            .custom-category-input {
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .custom-category-input input {
                padding: 4px 8px;
                border: 1px solid #d4d4d4;
                border-radius: 4px;
            }
            .custom-category-input select {
                padding: 4px 8px;
                border: 1px solid #d4d4d4;
                border-radius: 4px;
                min-width: 120px;
            }
            #custom-category-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            #custom-category-list li {
                margin-bottom: 5px;
                padding: 5px;
                background: #f9f9f9;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            #custom-category-list li select {
                padding: 2px 6px;
                border: 1px solid #d4d4d4;
                border-radius: 4px;
                font-size: 12px;
                min-width: 100px;
            }
            [data-theme="dark"] #custom-category-list li select {
                border-color: #555;
                background: #444;
                color: #ddd;
            }
            #custom-category-list li button {
                padding: 2px 6px;
                font-size: 12px;
            }
            [data-theme="dark"] .custom-category-input input,
            [data-theme="dark"] .custom-category-input select {
                border-color: #555;
                background: #333;
                color: #ddd;
            }
            [data-theme="dark"] #custom-category-list li {
                background: #333;
                color: #ddd;
            }
            
            [data-theme="dark"] .custom-category-ul { border-left-color: #3498db; }
            [data-theme="dark"] .category-tags-wrapper { border-bottom-color: #444; }
            [data-theme="dark"] .tag.group_tag {
                border-color: #555;
                background: #333;
                color: #ddd;
            }
            [data-theme="dark"] .tag.group_tag:hover {
                background: #2a3a4a;
                border-color: #3498db;
                color: #3498db;
            }
            [data-theme="dark"] .tag.group_tag.active {
                background-color: #3498db;
                border-color: #3498db;
            }
            [data-theme="dark"] .tag.more {
                color: #3498db;
            }
            [data-theme="dark"] .tag.more:hover {
                color: #2980b9;
            }
            [data-theme="dark"] #whitelist-list li {
                background: #333;
                color: #ddd;
            }
            [data-theme="dark"] .whitelist-input input {
                border-color: #555;
                background: #333;
                color: #ddd;
            }
        `;
        document.head.appendChild(style);
    };

    let whiteList = ["原作", "导演", "总导演", "动画制作"];
    let gameWhiteList = [];
    let customCategoryMap = {};
    let customCategories = [];
    let gameCustomCategoryMap = {};
    let gameCustomCategories = [];
    
    const loadWhiteList = (isGame = false) => {
        const key = isGame ? 'staff_game_whitelist' : 'staff_whitelist';
        if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
            const saved = chiiApp.cloud_settings.get(key);
            if (saved) {
                try {
                    if (isGame) {
                        gameWhiteList = JSON.parse(saved);
                    } else {
                        whiteList = JSON.parse(saved);
                    }
                } catch (e) {
                    console.error('解析白名单设置失败:', e);
                }
            }
        } else if (typeof $ !== 'undefined') {
            const saved = $.cookie(key);
            if (saved) {
                try {
                    if (isGame) {
                        gameWhiteList = JSON.parse(saved);
                    } else {
                        whiteList = JSON.parse(saved);
                    }
                } catch (e) {
                    console.error('解析白名单设置失败:', e);
                }
            }
        }
    };
    
    const saveWhiteList = (isGame = false) => {
        const key = isGame ? 'staff_game_whitelist' : 'staff_whitelist';
        const data = isGame ? gameWhiteList : whiteList;
        if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
            chiiApp.cloud_settings.update({ [key]: JSON.stringify(data) });
            chiiApp.cloud_settings.save();
        } else if (typeof $ !== 'undefined') {
            $.cookie(key, JSON.stringify(data), { expires: 30, path: '/' });
        }
    };
    
    const loadCustomCategoryMap = (isGame = false) => {
        const key = isGame ? 'staff_game_custom_category_map' : 'staff_custom_category_map';
        if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
            const saved = chiiApp.cloud_settings.get(key);
            if (saved) {
                try {
                    if (isGame) {
                        gameCustomCategoryMap = JSON.parse(saved);
                    } else {
                        customCategoryMap = JSON.parse(saved);
                    }
                } catch (e) {
                    console.error('解析自定义分类映射失败:', e);
                }
            }
        } else if (typeof $ !== 'undefined') {
            const saved = $.cookie(key);
            if (saved) {
                try {
                    if (isGame) {
                        gameCustomCategoryMap = JSON.parse(saved);
                    } else {
                        customCategoryMap = JSON.parse(saved);
                    }
                } catch (e) {
                    console.error('解析自定义分类映射失败:', e);
                }
            }
        }
    };
    
    const saveCustomCategoryMap = (isGame = false) => {
        const key = isGame ? 'staff_game_custom_category_map' : 'staff_custom_category_map';
        const data = isGame ? gameCustomCategoryMap : customCategoryMap;
        if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
            chiiApp.cloud_settings.update({ [key]: JSON.stringify(data) });
            chiiApp.cloud_settings.save();
        } else if (typeof $ !== 'undefined') {
            $.cookie(key, JSON.stringify(data), { expires: 30, path: '/' });
        }
    };
    
    const loadCustomCategories = (isGame = false) => {
        const key = isGame ? 'staff_game_custom_categories' : 'staff_custom_categories';
        if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
            const saved = chiiApp.cloud_settings.get(key);
            if (saved) {
                try {
                    if (isGame) {
                        gameCustomCategories = JSON.parse(saved);
                    } else {
                        customCategories = JSON.parse(saved);
                    }
                } catch (e) {
                    console.error('解析自定义类别失败:', e);
                }
            }
        } else if (typeof $ !== 'undefined') {
            const saved = $.cookie(key);
            if (saved) {
                try {
                    if (isGame) {
                        gameCustomCategories = JSON.parse(saved);
                    } else {
                        customCategories = JSON.parse(saved);
                    }
                } catch (e) {
                    console.error('解析自定义类别失败:', e);
                }
            }
        }
    };
    
    const saveCustomCategories = (isGame = false) => {
        const key = isGame ? 'staff_game_custom_categories' : 'staff_custom_categories';
        const data = isGame ? gameCustomCategories : customCategories;
        if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
            chiiApp.cloud_settings.update({ [key]: JSON.stringify(data) });
            chiiApp.cloud_settings.save();
        } else if (typeof $ !== 'undefined') {
            $.cookie(key, JSON.stringify(data), { expires: 30, path: '/' });
        }
    };
    
    const baseInfoList = ["中文名", "别名", "话数", "放送开始", "上映年度","发售日","放送星期", "官方网站", "在线播放平台", "播放电视台", "其他电视台", "播放结束", "链接", "其他", "Copyright","开始","结束","集数","类型","语言","季数","电视台","电视网","上映日","imdb_id","国家/地区","片长","罗马名","英文名","索引名","拼音名", "平台", "游戏类型", "游戏引擎", "游玩人数", "售价", "website", "发行日期"];
    const insertionPriority = ["放送星期", "放送开始", "话数", "中文名"];

    const categoryConfig = [
        { id: "1", name: "导演类", keywords: ["总导演", "导演", "副导演", "美术监督", "总作画监督", "作画监督", "构图作画监督", "机械作画监督", "动作作画监督", "摄影监督", "道具作画监督", "CG 导演", "3DCG 导演", "技术导演", "特技导演", "动作导演", "监修", "音乐监督", "系列监督", "音响监督", "特效作画监督", "视觉导演", "创意总监", "角色作画监督", "作画监修", "配音监督", "联合导演", "演员监督"] },
        { id: "2", name: "分镜/脚本类", keywords: ["脚本", "分镜", "分镜协力", "分镜抄写", "系列构成", "OP・ED 分镜", "原案", "故事概念", "剧本协调", "脚本协力", "副系列构成", "构成协力"] },
        { id: "3", name: "演出类", keywords: ["主演出", "演出", "演出助理", "OP・ED 演出", "Bank 分镜演出", "Live 分镜演出", "剧中剧分镜演出", "构图", "构图监修", "原画", "第二原画", "主动画师", "动画检查"] },
        { id: "4", name: "作画类", keywords: ["总作画监督", "总作画监督助理", "作画监督", "作画监督助理", "构图作画监督", "机械作画监督", "动作作画监督", "道具作画监督", "原画", "第二原画", "主动画师", "动画检查", "转场绘", "插画", "角色作画监督", "作画监修", "3D 动画师", "补间动画"] },
        { id: "5", name: "设定类", keywords: ["原作", "人物原案", "人物设定", "副人物设定", "客座人物设定", "剧中剧人设", "美术设计", "印象板", "色彩设计", "机械设定", "概念设计", "服装设计", "标题设计", "设定协力", "道具设计", "2D 设计", "3D 设计", "背景美术", "色彩指定", "数码绘图", "设定", "设定制作", "机设原案", "概念艺术", "视觉概念", "画面设计", "怪物设计", "设定制作助理", "背景设定"] },
        { id: "6", name: "美术类", keywords: ["美术监督", "美术设计", "美术板", "美术", "印象板", "背景美术", "美术制作人", "美术制作进行", "美术监督助理"] },
        { id: "7", name: "声音类", keywords: ["音乐", "音乐制作", "音乐制作人", "音乐助理", "音乐监督", "选曲", "插入歌作词", "插入歌作曲", "插入歌编曲", "主题歌编曲", "主题歌作曲", "主题歌作词", "主题歌演出", "插入歌演出", "录音", "录音助理", "音响监督", "音响", "音效", "录音工作室", "整音", "音响制作担当", "音响制作人", "配音监督"] },
        { id: "8", name: "制作类", keywords: ["摄影监督", "CG 导演", "3DCG 导演", "技术导演", "特技导演", "动作导演", "动画制作", "摄影", "音乐制作", "音乐制作人", "制作助理", "3DCG", "制作管理", "剪辑", "企画", "宣传", "製作", "制作", "特效作画监督", "特效", "特摄效果", "录音工作室", "音响制作担当", "在线剪辑", "离线剪辑", "3D 动画师", "CG 制作人", "宣传制片人", "CG 制作进行", "美术制作进行", "摄影监督助理", "制作管理助理", "制作统括", "现场制片人", "制作进行", "制作进行协力", "台词编辑", "后期制片协调", "制作助理", "制作协调", "制作协力"] },
        { id: "9", name: "制片类", keywords: ["企划制作人", "CG 制作人", "宣传制片人", "美术制作人", "音响制作人", "CG 制作进行", "美术制作进行", "总制片人", "联合制片人", "制片人", "执行制片人", "助理制片人", "动画制片人", "创意制片人", "副制片人", "现场制片人", "文艺制作", "企画协力", "监制", "演员监督"] },
        { id: "10", name: "色彩类", keywords: ["色彩设计", "色彩指定", "上色", "上色检查", "色彩检查", "色彩脚本", "色彩设计助理"] },
        { id: "11", name: "视觉类", keywords: ["特效作画监督", "特效", "视觉导演", "视觉效果", "特摄效果", "转场绘", "视觉概念", "画面设计"] },
        { id: "12", name: "助理类", keywords: ["副导演", "分镜协力", "分镜抄写", "演出助理", "设定协力", "总作画监督助理", "作画监督助理", "音乐助理", "制作助理", "录音助理", "脚本协力", "构成协力", "美术监督助理", "色彩设计助理", "摄影监督助理", "制作管理助理", "设定制作助理", "助理制片人", "副制片人", "企画协力", "制作进行协力", "后期制片协调", "制作协力", "特别鸣谢", "协力"] },
        { id: "13", name: "其他", keywords: [] }
    ];

    const gameCategoryConfig = [
        { id: "game_1", name: "发行类", keywords: ["开发", "開発元", "发行", "発売元"] },
        { id: "game_2", name: "导演类", keywords: ["游戏设计师", "ゲームクリエイター", "导演", "監督", "演出", "シリーズ監督", "制作人", "プロデューサー", "监修", "監修", "制作总指挥"] },
        { id: "game_3", name: "脚本类", keywords: ["剧本", "腳本", "系列构成", "シリーズ構成"] },
        { id: "game_4", name: "设定类", keywords: ["原作", "人物设定", "キャラ設定", "キャラクターデザイン", "机械设定", "メカニック設定", "关卡设计"] },
        { id: "game_5", name: "美术类", keywords: ["作画监督", "作画監督", "原画", "美工", "美術", "CG 监修", "CG 監修", "SD原画", "背景", "海报", "表紙"] },
        { id: "game_6", name: "动画类", keywords: ["动画制作", "アニメーション制作", "アニメ制作", "アニメーション", "动画监督", "アニメーション監督", "动画剧本", "アニメーション脚本"] },
        { id: "game_7", name: "声音类", keywords: ["音响监督", "Sound Director", "音乐", "音楽", "主题歌作曲", "Theme Song Composition", "主题歌作词", "Theme Song Lyrics", "主题歌演出", "Theme Song Performance", "插入歌演出", "Inserted Song Performance"] },
        { id: "game_8", name: "制作/程序类", keywords: ["企画", "程序", "プログラム", "QC", "QC"] },
        { id: "game_9", name: "助理类", keywords: ["协力", "協力"] },
        { id: "game_10", name: "其他", keywords: [] }
    ];

    const addStaffPanel = () => {
        if (typeof chiiLib === 'undefined' || !chiiLib.ukagaka) return;

        const getCloudSetting = (key, defaultValue = 'hide') => {
            if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
                const value = chiiApp.cloud_settings.get(key);
                return value !== undefined ? value : defaultValue;
            }
            return (typeof $ !== 'undefined' && $.cookie(key)) || defaultValue;
        };

        const setCloudSetting = (key, value) => {
            if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
                chiiApp.cloud_settings.update({[key]: value});
                chiiApp.cloud_settings.save();
            } else if (typeof $ !== 'undefined') {
                $.cookie(key, value, {expires: 30, path: '/'});
            }
        };

        const configItems = [
            ...categoryConfig.map(conf => ({
                title: `默认显示：${conf.name}`,
                name: `staff_show_${conf.id}`,
                type: 'radio',
                defaultValue: 'hide',
                getCurrentValue: function() { 
                    return getCloudSetting(`staff_show_${conf.id}`, 'hide');
                },
                onChange: function(value) { 
                    setCloudSetting(`staff_show_${conf.id}`, value);
                },
                options: [
                    { value: 'show', label: '显示' },
                    { value: 'hide', label: '隐藏' }
                ]
            })),
            ...gameCategoryConfig.map(conf => ({
                title: `默认显示：${conf.name}`,
                name: `staff_show_${conf.id}`,
                type: 'radio',
                defaultValue: 'hide',
                getCurrentValue: function() { 
                    return getCloudSetting(`staff_show_${conf.id}`, 'hide');
                },
                onChange: function(value) { 
                    setCloudSetting(`staff_show_${conf.id}`, value);
                },
                options: [
                    { value: 'show', label: '显示' },
                    { value: 'hide', label: '隐藏' }
                ]
            }))
        ];

        chiiLib.ukagaka.addPanelTab({
            tab: 'staff_helper',
            label: '职位分类设置',
            type: 'custom',
            customContent: function() {
                return `
                    <div class="custom-content">
                        <div class="refresh-notice" style="display: none;">
                            <span class="notice-text">组件状态已更新，保存后生效</span>
                        </div>
                        <h3>分类显示设置</h3>
                        <div class="category-control">
                            <div class="select-group">
                                <label>选择页面类型：</label>
                                <select id="category-page-type-select" class="category-select">
                                    <option value="movie">动画/影视页面</option>
                                    <option value="game">游戏页面</option>
                                </select>
                            </div>
                            <div class="select-group">
                                <label>选择分类：</label>
                                <select id="category-select" class="category-select">
                                    ${categoryConfig.map(conf => `
                                        <option value="${conf.id}">${conf.name}</option>
                                    `).join('')}
                                    ${customCategories.map((cat, index) => `
                                        <option value="custom_${index + 1}">${cat.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="button-group">
                                <button class="btnBlue" id="show-category-btn">显示</button>
                                <button class="btnGray" id="hide-category-btn">隐藏</button>
                                <button class="btnRed" id="reset-category-btn" style="background-color: #dc3545; color: white; border: 1px solid #dc3545; padding: 6px 16px; font-size: 12px; border-radius: 4px; cursor: pointer; transition: all 0.2s;">重置状态</button>
                            </div>
                        </div>
                        
                        <div class="settings-tabs">
                            <div class="select-group">
                                <label>选择页面类型：</label>
                                <select id="page-type-select" class="category-select">
                                    <option value="movie">动画/影视页面</option>
                                    <option value="game">游戏页面</option>
                                </select>
                            </div>
                            <div class="select-group">
                                <label>选择设置类型：</label>
                                <select id="settings-tab-select" class="category-select">
                                    <option value="whitelist">白名单设置</option>
                                    <option value="custom-category">自定义类别设置</option>
                                    <option value="custom-classification">自定义分类设置</option>
                                </select>
                            </div>
                            
                            <div id="whitelist-settings" class="settings-panel">
                                <h3>白名单设置</h3>
                                <p>白名单中的职位将始终显示，不受分类开关影响</p>
                                <div class="whitelist-container">
                                    <div class="whitelist-input">
                                        <input type="text" id="whitelist-input" placeholder="输入职位名称">
                                        <button class="btnBlue" id="add-whitelist-btn">添加</button>
                                    </div>
                                    <div class="pagination-container">
                                        <ul id="whitelist-list">
                                            ${whiteList.map(item => `<li>${item} <button class="btnGray delete-whitelist" data-item="${item}">删除</button></li>`).join('')}
                                        </ul>
                                        <div class="pagination" id="whitelist-pagination"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div id="custom-category-settings" class="settings-panel" style="display: none;">
                                <h3>自定义类别设置</h3>
                                <p>创建自定义的职位类别，可在自定义分类设置中使用</p>
                                <div class="custom-category-container">
                                    <div class="custom-category-input">
                                        <input type="text" id="new-category-name-input" placeholder="输入新类别名称">
                                        <button class="btnBlue" id="add-new-category-btn">添加类别</button>
                                    </div>
                                    <div class="pagination-container">
                                        <ul id="new-category-list">
                                            ${customCategories.map((cat, index) => `
                                                <li>${cat.name} <button class="btnGray delete-new-category" data-index="${index}">删除</button></li>
                                            `).join('')}
                                        </ul>
                                        <div class="pagination" id="new-category-pagination"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div id="custom-classification-settings" class="settings-panel" style="display: none;">
                                <h3>自定义分类设置</h3>
                                <p>为特定职位指定分类，添加后此职位将归为选择的类别</p>
                                <div class="custom-category-container">
                                    <div class="custom-category-input">
                                        <input type="text" id="custom-category-job-input" placeholder="输入职位名称">
                                        <select id="custom-category-select" class="category-select">
                                            <!-- 选项将通过JavaScript动态生成 -->
                                        </select>
                                        <button class="btnBlue" id="add-custom-category-btn">添加</button>
                                    </div>
                                    <div class="pagination-container">
                                        <ul id="custom-category-list">
                                            ${Object.entries(customCategoryMap).map(([job, categoryId]) => {
                                                return `
                                                    <li>
                                                        <span>${job} → </span>
                                                        <select class="custom-category-select" data-job="${job}">
                                                            ${categoryConfig.map(conf => `
                                                                <option value="${conf.id}" ${conf.id === categoryId ? 'selected' : ''}>${conf.name}</option>
                                                            `).join('')}
                                                            ${gameCategoryConfig.map(conf => `
                                                                <option value="${conf.id}" ${conf.id === categoryId ? 'selected' : ''}>${conf.name}</option>
                                                            `).join('')}
                                                            ${customCategories.map((cat, index) => `
                                                                <option value="custom_${index + 1}" ${'custom_' + (index + 1) === categoryId ? 'selected' : ''}>${cat.name}</option>
                                                            `).join('')}
                                                        </select>
                                                        <button class="btnGray delete-custom-category" data-job="${job}">删除</button>
                                                    </li>
                                                `;
                                            }).join('')}
                                        </ul>
                                        <div class="pagination" id="custom-category-pagination"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="button-group" style="margin-top: 20px; display: flex; justify-content: flex-end;">
                            <button class="btnGray" id="cancel-settings-btn">取消</button>
                            <button class="btnBlue" id="save-settings-btn">保存设置</button>
                        </div>
                    </div>
                `;
            },
            onInit: function(tabSelector, $tabContent) {
                loadWhiteList(false);
                loadWhiteList(true);
                loadCustomCategoryMap(false);
                loadCustomCategoryMap(true);
                loadCustomCategories(false);
                loadCustomCategories(true);
                
                const categoryPageTypeSelect = $tabContent.find('#category-page-type-select');
                const categorySelect = $tabContent.find('#category-select');
                const showBtn = $tabContent.find('#show-category-btn');
                const hideBtn = $tabContent.find('#hide-category-btn');
                // 使用更具体的选择器，确保statusDisplay插入到分类显示设置的按钮组后面
                const statusDisplay = $('<div class="status-display"></div>').insertAfter('.category-control .button-group');
                
                // 页面类型选择
                const pageTypeSelect = $tabContent.find('#page-type-select');
                let currentPageType = pageTypeSelect.val();
                let currentCategoryPageType = categoryPageTypeSelect.val();
                
                // 初始化设置选项卡切换
                const settingsTabSelect = $tabContent.find('#settings-tab-select');
                const settingsPanels = {
                    'whitelist': $tabContent.find('#whitelist-settings'),
                    'custom-category': $tabContent.find('#custom-category-settings'),
                    'custom-classification': $tabContent.find('#custom-classification-settings')
                };
                
                // 更新分类选择器选项
                const updateCategorySelect = () => {
                    const isGame = currentCategoryPageType === 'game';
                    const currentCustomCats = isGame ? gameCustomCategories : customCategories;
                    
                    // 清空分类选择器
                    categorySelect.empty();
                    
                    // 添加对应页面类型的分类
                    if (isGame) {
                        gameCategoryConfig.forEach(conf => {
                            categorySelect.append(`<option value="${conf.id}">${conf.name}</option>`);
                        });
                    } else {
                        categoryConfig.forEach(conf => {
                            categorySelect.append(`<option value="${conf.id}">${conf.name}</option>`);
                        });
                    }
                    
                    // 添加对应页面类型的自定义类别
                    currentCustomCats.forEach((cat, index) => {
                        categorySelect.append(`<option value="custom_${index + 1}">${cat.name}</option>`);
                    });
                    
                    // 更新状态显示
                    updateStatusDisplay();
                };
                
                // 更新设置面板内容
                const updateSettingsPanel = () => {
                    const isGame = currentPageType === 'game';
                    
                    // 更新白名单设置
                    const whitelistList = $tabContent.find('#whitelist-list');
                    whitelistList.empty();
                    const currentWhiteList = isGame ? gameWhiteList : whiteList;
                    currentWhiteList.forEach(item => {
                        whitelistList.append(`<li>${item} <button class="btnGray delete-whitelist" data-item="${item}">删除</button></li>`);
                    });
                    whitelistPagination.generatePagination();
                    
                    // 更新自定义类别列表
                    const currentCustomCats = isGame ? gameCustomCategories : customCategories;
                    const newCategoryList = $tabContent.find('#new-category-list');
                    newCategoryList.empty();
                    currentCustomCats.forEach((cat, index) => {
                        newCategoryList.append(`<li>${cat.name} <button class="btnGray delete-new-category" data-index="${index}">删除</button></li>`);
                    });
                    newCategoryPagination.generatePagination();
                    
                    // 更新自定义分类设置的下拉菜单
                    const customCategorySelect = $tabContent.find('#custom-category-select');
                    customCategorySelect.empty();
                    
                    // 添加对应页面类型的分类
                    if (isGame) {
                        gameCategoryConfig.forEach(conf => {
                            customCategorySelect.append(`<option value="${conf.id}">${conf.name}</option>`);
                        });
                    } else {
                        categoryConfig.forEach(conf => {
                            customCategorySelect.append(`<option value="${conf.id}">${conf.name}</option>`);
                        });
                    }
                    
                    // 添加对应页面类型的自定义类别
                    currentCustomCats.forEach((cat, index) => {
                        customCategorySelect.append(`<option value="custom_${index + 1}">${cat.name}</option>`);
                    });
                    
                    // 更新自定义分类列表
                    const currentCustomMap = isGame ? gameCustomCategoryMap : customCategoryMap;
                    const customCategoryList = $tabContent.find('#custom-category-list');
                    customCategoryList.empty();
                    Object.entries(currentCustomMap).forEach(([job, categoryId]) => {
                        const categoryName = categoryConfig.find(c => c.id === categoryId)?.name || 
                                           gameCategoryConfig.find(c => c.id === categoryId)?.name || 
                                           currentCustomCats.find((cat, index) => 'custom_' + (index + 1) === categoryId)?.name || 
                                           '未知分类';
                        
                        // 生成对应页面类型的选项
                        let options = '';
                        if (isGame) {
                            options += gameCategoryConfig.map(conf => `<option value="${conf.id}" ${conf.id === categoryId ? 'selected' : ''}>${conf.name}</option>`).join('');
                        } else {
                            options += categoryConfig.map(conf => `<option value="${conf.id}" ${conf.id === categoryId ? 'selected' : ''}>${conf.name}</option>`).join('');
                        }
                        options += currentCustomCats.map((cat, index) => `<option value="custom_${index + 1}" ${'custom_' + (index + 1) === categoryId ? 'selected' : ''}>${cat.name}</option>`).join('');
                        
                        customCategoryList.append(`<li><span>${job} → </span><select class="custom-category-select" data-job="${job}" data-is-game="${isGame}">${options}</select><button class="btnGray delete-custom-category" data-job="${job}" data-is-game="${isGame}">删除</button></li>`);
                    });
                    customCategoryPagination.generatePagination();
                };
                
                settingsTabSelect.on('change', function() {
                    const selectedTab = $(this).val();
                    Object.keys(settingsPanels).forEach(panel => {
                        settingsPanels[panel].hide();
                    });
                    settingsPanels[selectedTab].show();
                    
                    // 更新所有设置面板内容
                    updateSettingsPanel();
                });
                
                pageTypeSelect.on('change', function() {
                    currentPageType = $(this).val();
                    // 更新所有设置面板内容
                    updateSettingsPanel();
                });
                
                // 分类页面类型选择器事件
                categoryPageTypeSelect.on('change', function() {
                    currentCategoryPageType = $(this).val();
                    updateCategorySelect();
                });
                
                const showRefreshNotice = () => {
                    const notice = $tabContent.find('.refresh-notice');
                    notice.css({
                        'display': 'flex',
                        'background': '#fff3cd',
                        'border': '1px solid #ffeaa7',
                        'border-radius': '4px',
                        'padding': '10px',
                        'margin-bottom': '15px',
                        'justify-content': 'space-between',
                        'align-items': 'center',
                        'opacity': '1',
                        'z-index': '1000'
                    });
                    notice.addClass('show');
                };
                
                const updateStatusDisplay = () => {
                    const categoryId = categorySelect.val();
                    const currentStatus = getCloudSetting(`staff_show_${categoryId}`, 'hide');
                    statusDisplay.text(`当前状态：${currentStatus === 'show' ? '显示' : '隐藏'}`);
                    
                    if (currentStatus === 'show') {
                        showBtn.prop('disabled', true).addClass('disabled');
                        hideBtn.prop('disabled', false).removeClass('disabled');
                    } else {
                        showBtn.prop('disabled', false).removeClass('disabled');
                        hideBtn.prop('disabled', true).addClass('disabled');
                    }
                };
                
                updateCategorySelect();
                updateStatusDisplay();
                
                categorySelect.on('change', updateStatusDisplay);
                
                showBtn.on('click', function() {
                    const categoryId = categorySelect.val();
                    setCloudSetting(`staff_show_${categoryId}`, 'show');
                    updateStatusDisplay();
                    showRefreshNotice();
                });
                
                hideBtn.on('click', function() {
                    const categoryId = categorySelect.val();
                    setCloudSetting(`staff_show_${categoryId}`, 'hide');
                    updateStatusDisplay();
                    showRefreshNotice();
                });
                
                $tabContent.off('click', '#reset-category-btn').on('click', '#reset-category-btn', function() {
                    if (confirm('确定要重置所有分类的显示状态吗？')) {
                        // 重置动画/影视页面分类
                        categoryConfig.forEach(conf => {
                            setCloudSetting(`staff_show_${conf.id}`, 'hide');
                        });
                        customCategories.forEach((cat, index) => {
                            setCloudSetting(`staff_show_custom_${index + 1}`, 'hide');
                        });
                        // 重置游戏页面分类
                        gameCategoryConfig.forEach(conf => {
                            setCloudSetting(`staff_show_${conf.id}`, 'hide');
                        });
                        gameCustomCategories.forEach((cat, index) => {
                            setCloudSetting(`staff_show_custom_${index + 1}`, 'hide');
                        });
                        // 更新分类选择器和状态显示
                        updateCategorySelect();
                        updateStatusDisplay();
                        showRefreshNotice();
                    }
                });
                
                const initPagination = (listId, paginationId, itemsPerPage = 5) => {
                    const list = $tabContent.find(`#${listId}`);
                    const pagination = $tabContent.find(`#${paginationId}`);
                    const items = list.find('li');
                    const totalItems = items.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage);
                    
                    const showPage = (page) => {
                        items.hide();
                        const start = (page - 1) * itemsPerPage;
                        const end = start + itemsPerPage;
                        items.slice(start, end).show();
                    };
                    
                    const generatePagination = () => {
                        pagination.empty();
                        if (totalPages <= 1) return;
                        
                        for (let i = 1; i <= totalPages; i++) {
                            const button = $('<button class="btnGray pagination-btn">' + i + '</button>');
                            if (i === 1) button.addClass('active');
                            button.on('click', function() {
                                showPage(i);
                                pagination.find('.pagination-btn').removeClass('active');
                                $(this).addClass('active');
                            });
                            pagination.append(button);
                        }
                    };
                    
                    showPage(1);
                    generatePagination();
                    
                    return { generatePagination };
                };
                
                const whitelistPagination = initPagination('whitelist-list', 'whitelist-pagination');
                const customCategoryPagination = initPagination('custom-category-list', 'custom-category-pagination');
                const newCategoryPagination = initPagination('new-category-list', 'new-category-pagination');
                
                $tabContent.off('click', '#add-whitelist-btn').on('click', '#add-whitelist-btn', function(e) {
                    e.preventDefault();
                    const input = $tabContent.find('#whitelist-input');
                    const newItem = input.val().trim();
                    const isGame = currentPageType === 'game';
                    const currentWhiteList = isGame ? gameWhiteList : whiteList;
                    
                    if (newItem && !currentWhiteList.includes(newItem)) {
                        currentWhiteList.push(newItem);
                        saveWhiteList(isGame);
                        $tabContent.find('#whitelist-list').append(`<li>${newItem} <button class="btnGray delete-whitelist" data-item="${newItem}">删除</button></li>`);
                        input.val('');
                        whitelistPagination.generatePagination();
                        showRefreshNotice();
                    }
                });
                
                $tabContent.off('click', '#add-new-category-btn').on('click', '#add-new-category-btn', function(e) {
                    e.preventDefault();
                    const input = $tabContent.find('#new-category-name-input');
                    const newCategoryName = input.val().trim();
                    const isGame = currentPageType === 'game';
                    const currentCustomCats = isGame ? gameCustomCategories : customCategories;
                    
                    if (newCategoryName && !currentCustomCats.some(cat => cat.name === newCategoryName)) {
                        currentCustomCats.push({ name: newCategoryName });
                        saveCustomCategories(isGame);
                        const index = currentCustomCats.length - 1;
                        $tabContent.find('#new-category-list').append(`<li>${newCategoryName} <button class="btnGray delete-new-category" data-index="${index}">删除</button></li>`);
                        $tabContent.find('#category-select').append(`<option value="custom_${index + 1}">${newCategoryName}</option>`);
                        $tabContent.find('#custom-category-select').append(`<option value="custom_${index + 1}">${newCategoryName}</option>`);
                        input.val('');
                        newCategoryPagination.generatePagination();
                        showRefreshNotice();
                    }
                });
                
                $tabContent.off('click', '.delete-new-category').on('click', '.delete-new-category', function(e) {
                    e.preventDefault();
                    const index = $(this).data('index');
                    const isGame = currentPageType === 'game';
                    const currentCustomCats = isGame ? gameCustomCategories : customCategories;
                    const currentCustomMap = isGame ? gameCustomCategoryMap : customCategoryMap;
                    
                    const deletedCategoryId = `custom_${index + 1}`;
                    
                    // 清理属于该类别的所有职位映射
                    Object.keys(currentCustomMap).forEach(job => {
                        if (currentCustomMap[job] === deletedCategoryId) {
                            delete currentCustomMap[job];
                        }
                    });
                    
                    // 更新被删除类别之后的所有映射，将索引减1
                    Object.keys(currentCustomMap).forEach(job => {
                        const catId = currentCustomMap[job];
                        if (catId.startsWith('custom_')) {
                            const catIndex = parseInt(catId.replace('custom_', ''));
                            if (catIndex > index + 1) {
                                currentCustomMap[job] = `custom_${catIndex - 1}`;
                            }
                        }
                    });
                    saveCustomCategoryMap(isGame);
                    
                    // 更新被删除类别之后的自定义类别索引
                    for (let i = index + 1; i < currentCustomCats.length; i++) {
                        const oldOptionValue = `custom_${i + 1}`;
                        const newOptionValue = `custom_${i}`;
                        $tabContent.find(`#category-select option[value="${oldOptionValue}"]`).attr('value', newOptionValue);
                        $tabContent.find(`#custom-category-select option[value="${oldOptionValue}"]`).attr('value', newOptionValue);
                        // 更新自定义分类列表中的选项值
                        $tabContent.find(`#custom-category-list li select[data-job]`).each(function() {
                            const $select = $(this);
                            $select.find(`option[value="${oldOptionValue}"]`).attr('value', newOptionValue);
                        });
                    }
                    
                    currentCustomCats.splice(index, 1);
                    saveCustomCategories(isGame);
                    $(this).parent('li').remove();
                    $tabContent.find(`#category-select option[value="custom_${index + 1}"]`).remove();
                    $tabContent.find(`#custom-category-select option[value="custom_${index + 1}"]`).remove();
                    newCategoryPagination.generatePagination();
                    showRefreshNotice();
                });
                
                $tabContent.off('click', '.delete-whitelist').on('click', '.delete-whitelist', function(e) {
                    e.preventDefault();
                    const item = $(this).attr('data-item');
                    const isGame = currentPageType === 'game';
                    const currentWhiteList = isGame ? gameWhiteList : whiteList;
                    
                    const updatedList = currentWhiteList.filter(i => i.toString() !== item.toString());
                    if (isGame) {
                        gameWhiteList = updatedList;
                    } else {
                        whiteList = updatedList;
                    }
                    saveWhiteList(isGame);
                    $(this).parent('li').remove();
                    whitelistPagination.generatePagination();
                    showRefreshNotice();
                });
                
                $tabContent.off('click', '#add-custom-category-btn').on('click', '#add-custom-category-btn', function(e) {
                    e.preventDefault();
                    const jobInput = $tabContent.find('#custom-category-job-input');
                    const categorySelect = $tabContent.find('#custom-category-select');
                    const job = jobInput.val().trim();
                    const categoryId = categorySelect.val();
                    const isGame = currentPageType === 'game';
                    const currentCustomMap = isGame ? gameCustomCategoryMap : customCategoryMap;
                    const currentCustomCats = isGame ? gameCustomCategories : customCategories;
                    
                    if (job && categoryId) {
                        currentCustomMap[job] = categoryId;
                        saveCustomCategoryMap(isGame);
                        const categoryName = categoryConfig.find(c => c.id === categoryId)?.name || 
                                           gameCategoryConfig.find(c => c.id === categoryId)?.name || 
                                           currentCustomCats.find((cat, index) => 'custom_' + (index + 1) === categoryId)?.name || 
                                           '未知分类';
                        const options = categoryConfig.map(conf => `<option value="${conf.id}" ${conf.id === categoryId ? 'selected' : ''}>${conf.name}</option>`).join('') + 
                                      gameCategoryConfig.map(conf => `<option value="${conf.id}" ${conf.id === categoryId ? 'selected' : ''}>${conf.name}</option>`).join('') + 
                                      currentCustomCats.map((cat, index) => `<option value="custom_${index + 1}" ${'custom_' + (index + 1) === categoryId ? 'selected' : ''}>${cat.name}</option>`).join('');
                        $tabContent.find('#custom-category-list').append(`<li><span>${job} → </span><select class="custom-category-select" data-job="${job}" data-is-game="${isGame}">${options}</select><button class="btnGray delete-custom-category" data-job="${job}" data-is-game="${isGame}">删除</button></li>`);
                        jobInput.val('');
                        customCategoryPagination.generatePagination();
                        showRefreshNotice();
                    }
                });
                
                $tabContent.off('click', '.delete-custom-category').on('click', '.delete-custom-category', function(e) {
                    e.preventDefault();
                    const job = $(this).data('job');
                    const isGame = $(this).data('is-game') === 'true';
                    const currentCustomMap = isGame ? gameCustomCategoryMap : customCategoryMap;
                    
                    delete currentCustomMap[job];
                    saveCustomCategoryMap(isGame);
                    $(this).parent('li').remove();
                    customCategoryPagination.generatePagination();
                    showRefreshNotice();
                });
                
                $tabContent.off('change', '.custom-category-select').on('change', '.custom-category-select', function(e) {
                    const job = $(this).data('job');
                    const isGame = $(this).data('is-game') === 'true';
                    const newCategoryId = $(this).val();
                    const currentCustomMap = isGame ? gameCustomCategoryMap : customCategoryMap;
                    
                    currentCustomMap[job] = newCategoryId;
                    saveCustomCategoryMap(isGame);
                    showRefreshNotice();
                });
                
                // 保存设置按钮
                $tabContent.off('click', '#save-settings-btn').on('click', '#save-settings-btn', function() {
                    saveWhiteList(false);
                    saveWhiteList(true);
                    saveCustomCategoryMap(false);
                    saveCustomCategoryMap(true);
                    saveCustomCategories(false);
                    saveCustomCategories(true);
                    showRefreshNotice();
                    // 自动刷新页面
                    window.location.reload();
                });
                
                // 取消按钮
                $tabContent.off('click', '#cancel-settings-btn').on('click', '#cancel-settings-btn', function() {
                    if (confirm('确定要取消所有更改吗？')) {
                        // 重新加载设置，放弃当前更改
                        loadWhiteList(false);
                        loadWhiteList(true);
                        loadCustomCategoryMap(false);
                        loadCustomCategoryMap(true);
                        loadCustomCategories(false);
                        loadCustomCategories(true);
                        // 刷新页面以放弃当前更改
                        window.location.reload();
                    }
                });
            }
        });
    };

    function init() {
        loadWhiteList(false);
        loadWhiteList(true);
        loadCustomCategoryMap(false);
        loadCustomCategoryMap(true);
        loadCustomCategories(false);
        loadCustomCategories(true);
        
        addStaffPanel();
        

        injectStyle();
        

        const headerSubject = document.querySelector('div#headerSubject.headerHero.clearit');
        if (!headerSubject || (headerSubject.getAttribute('typeof') !== 'v:Movie' && headerSubject.getAttribute('typeof') !== 'v:Game')) return;
        
        const targetUl = document.querySelector('ul#infobox');
        if (!targetUl || targetUl.querySelector('.custom-category-row')) return;

        const isGamePage = headerSubject.getAttribute('typeof') === 'v:Game';
        const currentCategoryConfig = isGamePage ? gameCategoryConfig : categoryConfig;
        const currentCustomCategories = isGamePage ? gameCustomCategories : customCategories;
        const currentCustomCategoryMap = isGamePage ? gameCustomCategoryMap : customCategoryMap;
        const currentWhiteList = isGamePage ? gameWhiteList : whiteList;

        const keywordToCategoryMap = new Map();
        currentCategoryConfig.forEach(conf => {
            if (conf.id !== "13" && conf.id !== "game_10") {
                conf.keywords.forEach(kw => {
                    const key = typeof kw === 'string' ? kw : kw.source;
                    if (!keywordToCategoryMap.has(key)) {
                        const escaped = key.replace(/[.*+?^${}()|[\]]/g, '\\$&');
                        keywordToCategoryMap.set(key, { regex: new RegExp(`^${escaped}$`), categories: [] });
                    }
                    keywordToCategoryMap.get(key).categories.push(conf.id);
                });
            }
        });
        
        // 添加自定义类别到映射
        currentCustomCategories.forEach((cat, index) => {
            const categoryId = `custom_${index + 1}`;
            // 自定义类别暂时没有默认关键词，只用于手动映射
        });
        
        Object.entries(currentCustomCategoryMap).forEach(([job, categoryId]) => {
            if (!keywordToCategoryMap.has(job)) {
                const escaped = job.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                keywordToCategoryMap.set(job, { regex: new RegExp(`^${escaped}$`), categories: [] });
            }
            keywordToCategoryMap.get(job).categories = [categoryId]; 
        });

        const originalLis = Array.from(targetUl.querySelectorAll('li'));
        const categoryUls = {};
        const categoryButtons = [];
        const jobToCategoriesMap = new Map(); 
        let insertionAnchor = null;
        let hasAnyMatch = false;

        originalLis.forEach(li => {
            const tipSpan = li.querySelector('.tip');
            if (!tipSpan) return;
            const rawText = tipSpan.textContent.replace(/[:：]/g, "").trim();

            if (insertionPriority.includes(rawText) || baseInfoList.includes(rawText)) {
                insertionAnchor = li;
            }
            if (currentWhiteList.includes(rawText)) {
                li.classList.add('keep-visible');
                insertionAnchor = li;
            }
            if (baseInfoList.includes(rawText)) return;
            
            if (li.classList.contains('sub_container')) {
                li.classList.add('keep-visible');
                return;
            }
            
            if (li.closest('.sub_container')) {
                return;
            }

            let matchedAnyNormal = false;
            const matchedCategoryIds = [];

            for (const [key, value] of keywordToCategoryMap) {
                if (value.regex.test(rawText)) {
                    matchedCategoryIds.push(...value.categories);
                    matchedAnyNormal = true;
                    hasAnyMatch = true;
                }
            }

            // 去重并排序分类id
            const uniqueCategoryIds = [...new Set(matchedCategoryIds)].sort((a, b) => {
                // 自定义类别排在最后
                if (a.startsWith('custom_') && !b.startsWith('custom_')) return 1;
                if (!a.startsWith('custom_') && b.startsWith('custom_')) return -1;
                if (a.startsWith('custom_') && b.startsWith('custom_')) {
                    return parseInt(a.replace('custom_', '')) - parseInt(b.replace('custom_', ''));
                }
                return parseInt(a) - parseInt(b);
            });
            
            if (uniqueCategoryIds.length > 0) {
                // 记录职位到分类的映射
                jobToCategoriesMap.set(rawText, uniqueCategoryIds);
                
                uniqueCategoryIds.forEach(categoryId => {
                    if (!categoryUls[categoryId]) {
                        const newUl = document.createElement('ul');
                        newUl.className = 'custom-category-ul';
                        categoryUls[categoryId] = newUl;
                    }
                    const clonedLi = li.cloneNode(true);
                    // 添加data属性，记录该职位的所有分类id和当前分类id
                    clonedLi.setAttribute('data-job-name', rawText);
                    clonedLi.setAttribute('data-all-categories', uniqueCategoryIds.join(','));
                    clonedLi.setAttribute('data-current-category', categoryId);
                    categoryUls[categoryId].appendChild(clonedLi);
                });
            } else {
                const otherId = isGamePage ? "game_10" : "13";
                if (!categoryUls[otherId]) {
                    const newUl = document.createElement('ul');
                    newUl.className = 'custom-category-ul';
                    categoryUls[otherId] = newUl;
                }
                const clonedLi = li.cloneNode(true);
                clonedLi.setAttribute('data-job-name', rawText);
                clonedLi.setAttribute('data-all-categories', otherId);
                clonedLi.setAttribute('data-current-category', otherId);
                categoryUls[otherId].appendChild(clonedLi);
                hasAnyMatch = true;
            }
            li.classList.add('original-job');
        });

        if (!hasAnyMatch) return;

        const controlLi = document.createElement('li');
        controlLi.className = 'custom-category-row';
        const wrapper = document.createElement('div');
        wrapper.className = 'category-tags-wrapper';
        const tipLabel = document.createElement('span');
        tipLabel.className = 'tip';
        tipLabel.textContent = '职位分类: ';
        controlLi.appendChild(tipLabel);
        controlLi.appendChild(wrapper);

        // 先添加默认分类（除了"其他"分类）
        currentCategoryConfig.forEach(conf => {
            // 跳过"其他"分类，最后单独添加
            const isOtherCategory = (isGamePage && conf.id === "game_10") || (!isGamePage && conf.id === "13");
            if (isOtherCategory) return;
            
            const containerUl = categoryUls[conf.id];
            if (containerUl && containerUl.children.length > 0) {
                const btn = document.createElement('span');
                btn.className = 'tag group_tag';
                btn.textContent = `${conf.name}(${containerUl.children.length})`;
                
                let defaultState = 'hide';
                if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
                    const cloudValue = chiiApp.cloud_settings.get(`staff_show_${conf.id}`);
                    if (cloudValue !== undefined) {
                        defaultState = cloudValue;
                    } else if (typeof $ !== 'undefined') {
                        const cookieValue = $.cookie(`staff_show_${conf.id}`);
                        if (cookieValue) {
                            defaultState = cookieValue;
                        }
                    }
                } else if (typeof $ !== 'undefined') {
                    const cookieValue = $.cookie(`staff_show_${conf.id}`);
                    if (cookieValue) {
                        defaultState = cookieValue;
                    }
                }
                if (defaultState === 'show') {
                    btn.classList.add('active');
                    containerUl.style.display = 'block';
                }

                btn.addEventListener('click', () => {
                    const isActive = btn.classList.toggle('active');
                    containerUl.style.display = isActive ? 'block' : 'none';
                    updateDuplicateJobVisibility();
                });
                wrapper.appendChild(btn);
                categoryButtons.push({ btn, ul: containerUl, categoryId: conf.id });
            }
        });
        
        // 再添加自定义分类
        customCategories.forEach((cat, index) => {
            const categoryId = `custom_${index + 1}`;
            const containerUl = categoryUls[categoryId];
            if (containerUl && containerUl.children.length > 0) {
                const btn = document.createElement('span');
                btn.className = 'tag group_tag';
                btn.textContent = `${cat.name}(${containerUl.children.length})`;
                
                let defaultState = 'hide';
                if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
                    const cloudValue = chiiApp.cloud_settings.get(`staff_show_${categoryId}`);
                    if (cloudValue !== undefined) {
                        defaultState = cloudValue;
                    } else if (typeof $ !== 'undefined') {
                        const cookieValue = $.cookie(`staff_show_${categoryId}`);
                        if (cookieValue) {
                            defaultState = cookieValue;
                        }
                    }
                } else if (typeof $ !== 'undefined') {
                    const cookieValue = $.cookie(`staff_show_${categoryId}`);
                    if (cookieValue) {
                        defaultState = cookieValue;
                    }
                }
                if (defaultState === 'show') {
                    btn.classList.add('active');
                    containerUl.style.display = 'block';
                }

                btn.addEventListener('click', () => {
                    const isActive = btn.classList.toggle('active');
                    containerUl.style.display = isActive ? 'block' : 'none';
                    updateDuplicateJobVisibility();
                });
                wrapper.appendChild(btn);
                categoryButtons.push({ btn, ul: containerUl, categoryId: categoryId });
            }
        });
        
        // 最后添加"其他"分类
        const otherCategoryId = isGamePage ? "game_10" : "13";
        const otherContainerUl = categoryUls[otherCategoryId];
        if (otherContainerUl && otherContainerUl.children.length > 0) {
            const otherConf = currentCategoryConfig.find(conf => conf.id === otherCategoryId);
            if (otherConf) {
                const btn = document.createElement('span');
                btn.className = 'tag group_tag';
                btn.textContent = `${otherConf.name}(${otherContainerUl.children.length})`;
                
                let defaultState = 'hide';
                if (typeof chiiApp !== 'undefined' && chiiApp.cloud_settings) {
                    const cloudValue = chiiApp.cloud_settings.get(`staff_show_${otherCategoryId}`);
                    if (cloudValue !== undefined) {
                        defaultState = cloudValue;
                    } else if (typeof $ !== 'undefined') {
                        const cookieValue = $.cookie(`staff_show_${otherCategoryId}`);
                        if (cookieValue) {
                            defaultState = cookieValue;
                        }
                    }
                } else if (typeof $ !== 'undefined') {
                    const cookieValue = $.cookie(`staff_show_${otherCategoryId}`);
                    if (cookieValue) {
                        defaultState = cookieValue;
                    }
                }
                if (defaultState === 'show') {
                    btn.classList.add('active');
                    otherContainerUl.style.display = 'block';
                }

                btn.addEventListener('click', () => {
                    const isActive = btn.classList.toggle('active');
                    otherContainerUl.style.display = isActive ? 'block' : 'none';
                    updateDuplicateJobVisibility();
                });
                wrapper.appendChild(btn);
                categoryButtons.push({ btn, ul: otherContainerUl, categoryId: otherCategoryId });
            }
        }
        
        // 更新重复职位的可见性
        const updateDuplicateJobVisibility = () => {
            // 确定当前页面的"其他"分类ID
            const otherCategoryId = isGamePage ? "game_10" : "13";
            
            // 获取所有已展开的分类id
            const expandedCategoryIds = categoryButtons
                .filter(item => item.ul.style.display === 'block')
                .map(item => item.categoryId)
                .sort((a, b) => {
                    // 确保"其他"分类排在最后
                    if (a === otherCategoryId) return 1;
                    if (b === otherCategoryId) return -1;
                    
                    // 自定义类别排在默认分类之后
                    if (a.startsWith('custom_') && !b.startsWith('custom_')) return 1;
                    if (!a.startsWith('custom_') && b.startsWith('custom_')) return -1;
                    
                    // 自定义类别之间按数字排序
                    if (a.startsWith('custom_') && b.startsWith('custom_')) {
                        return parseInt(a.replace('custom_', '')) - parseInt(b.replace('custom_', ''));
                    }
                    
                    // 默认分类按ID升序排序
                    return parseInt(a) - parseInt(b);
                });
            
            // 遍历所有分类中的职位
            Object.keys(categoryUls).forEach(categoryId => {
                const ul = categoryUls[categoryId];
                Array.from(ul.children).forEach(li => {
                    const allCategories = li.getAttribute('data-all-categories').split(',');
                    const currentCategory = li.getAttribute('data-current-category');
                    const jobName = li.getAttribute('data-job-name');
                    
                    // 如果该职位属于多个分类，检查当前分类是否是优先级最高的展开分类
                    if (allCategories.length > 1 && expandedCategoryIds.length > 0) {
                        // 找出该职位所属的所有分类中，优先级最高的展开分类
                        const minExpandedCategoryId = allCategories
                            .filter(id => expandedCategoryIds.includes(id))
                            .sort((a, b) => {
                                // 确保"其他"分类排在最后
                                if (a === otherCategoryId) return 1;
                                if (b === otherCategoryId) return -1;
                                
                                // 自定义类别排在默认分类之后
                                if (a.startsWith('custom_') && !b.startsWith('custom_')) return 1;
                                if (!a.startsWith('custom_') && b.startsWith('custom_')) return -1;
                                
                                // 自定义类别之间按数字排序
                                if (a.startsWith('custom_') && b.startsWith('custom_')) {
                                    return parseInt(a.replace('custom_', '')) - parseInt(b.replace('custom_', ''));
                                }
                                
                                // 默认分类按ID升序排序
                                return parseInt(a) - parseInt(b);
                            })[0];
                        
                        // 如果当前分类不是优先级最高的展开分类，则隐藏该职位
                        if (minExpandedCategoryId && currentCategory !== minExpandedCategoryId) {
                            li.style.display = 'none';
                        } else {
                            li.style.display = 'list-item';
                        }
                    } else {
                        li.style.display = 'list-item';
                    }
                });
            });
        };
        
        // 初始化时更新一次重复职位的可见性
        updateDuplicateJobVisibility();

        const moreBtn = document.createElement('span');
        moreBtn.className = 'tag group_tag more';
        moreBtn.textContent = '展开+';
        moreBtn.addEventListener('click', () => {
            const isExpanding = moreBtn.textContent === '展开+';
            categoryButtons.forEach(item => {
                item.ul.style.display = isExpanding ? 'block' : 'none';
                item.btn.classList.toggle('active', isExpanding);
            });
            moreBtn.textContent = isExpanding ? '折叠-' : '展开+';
            updateDuplicateJobVisibility();
        });
        wrapper.appendChild(moreBtn);

        if (insertionAnchor) {
            insertionAnchor.after(controlLi);
        } else {
            targetUl.prepend(controlLi);
        }

        const sortedIds = Object.keys(categoryUls).sort((a,b) => {
            // 确定当前页面的"其他"分类ID
            const otherCategoryId = isGamePage ? "game_10" : "13";
            
            // 确保"其他"分类排在最后
            if (a === otherCategoryId) return 1;
            if (b === otherCategoryId) return -1;
            
            // 自定义分类排在默认分类之后
            if (a.startsWith('custom_') && !b.startsWith('custom_')) return 1;
            if (!a.startsWith('custom_') && b.startsWith('custom_')) return -1;
            
            // 自定义分类之间按数字排序
            if (a.startsWith('custom_') && b.startsWith('custom_')) {
                return parseInt(a.replace('custom_', '')) - parseInt(b.replace('custom_', ''));
            }
            
            // 默认分类按ID升序排序
            return parseInt(a) - parseInt(b);
        });

        const fragment = document.createDocumentFragment();
        sortedIds.forEach(id => {
            fragment.appendChild(categoryUls[id]);
        });
        controlLi.after(fragment);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();