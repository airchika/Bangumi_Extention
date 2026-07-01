// ==UserScript==
// @name         用户备注
// @version      2.2
// @description  为用户添加显式备注防改名，如果需要长备注可以使用详细备注。
// @author       age_anime
// @match        https://bgm.tv/*
// @match        https://chii.in/*
// @match        https://bangumi.tv/*
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    // 2.2版本说明：
    // 支持云端同步。

    const defaultNoteColors = {
        "预设0": "#40E0D0", "预设1": "#BB44BB", "预设2": "#000000",
        "预设3": "#DD6D22", "预设4": "#CC3333", "预设5": "#DD6D22"
    };
    
    // 从云端获取数据
    let cloudNoteTable = chiiApp.cloud_settings.get('userNoteTable_AGE') || {};
    let cloudNoteColors = chiiApp.cloud_settings.get('userNoteColors_') || {};
    
    // 检查并合并本地存储数据
    const localNoteTable = JSON.parse(localStorage.getItem('userNoteTable_AGE') || '{}');
    const localNoteColors = JSON.parse(localStorage.getItem('userNoteColors_') || '{}');
    
    // 合并用户备注表
    for (const userId in localNoteTable) {
        if (!cloudNoteTable.hasOwnProperty(userId)) {
            cloudNoteTable[userId] = localNoteTable[userId];
        }
    }
    
    // 合并颜色设置
    for (const colorName in localNoteColors) {
        if (!cloudNoteColors.hasOwnProperty(colorName)) {
            cloudNoteColors[colorName] = localNoteColors[colorName];
        }
    }
    
    // 保存合并后的数据到云端
    if (Object.keys(localNoteTable).length > 0 || Object.keys(localNoteColors).length > 0) {
        chiiApp.cloud_settings.update({
            'userNoteTable_AGE': cloudNoteTable,
            'userNoteColors_': cloudNoteColors
        });
        chiiApp.cloud_settings.save();
        
        // 删除本地存储
        localStorage.removeItem('userNoteTable_AGE');
        localStorage.removeItem('userNoteColors_');
    }
    
    let noteColors = Object.keys(cloudNoteColors).length > 0 ? cloudNoteColors : defaultNoteColors;
    let userNoteTable = cloudNoteTable;
    
    const defaultNote = "", defaultSecondaryNote = "点击修改详细备注";
    const defaultColor = "rgba(255, 255, 255, 0)";
    const defaultNoteColor = document.documentElement.getAttribute('data-theme') === 'light' 
        ? "rgba(102, 130, 85, 0.6)" : "rgba(170, 102, 85, 0.2)";

    function migrateUserNotes() {
        let needMigration = Object.keys(userNoteTable).some(userId => typeof userNoteTable[userId] === 'string');
        if (needMigration) {
            const newTable = {};
            Object.keys(userNoteTable).forEach(userId => {
                newTable[userId] = typeof userNoteTable[userId] === 'string' 
                    ? [userNoteTable[userId], ""] : userNoteTable[userId];
            });
            userNoteTable = newTable;
            chiiApp.cloud_settings.update({'userNoteTable_AGE': userNoteTable});
            chiiApp.cloud_settings.save();
        }
    }
    migrateUserNotes();

    function createNoteBadge(element, userId, notes) {
        const [primaryNote, secondaryNote = ""] = Array.isArray(notes) ? notes : [notes, ""];
        const badgeColor = primaryNote === defaultNote ? defaultColor : (noteColors[primaryNote] || defaultNoteColor);
        const noteColorSet = badgeColor === defaultColor ? "#9F9F9F" : "#FFF";

        const badge = $(`<span class="note-badge" style="
            background: ${badgeColor}; font-size: 10px; padding: 1px 4px; color: ${noteColorSet};
            border-radius: 6px; line-height: 150%; display: inline-block; cursor: pointer;
            position: relative;" title="双击修改备注">${primaryNote}</span>`);

        const badgeId = 'note-badge-' + userId + '-' + Math.random().toString(36).substr(2, 9);
        badge.attr({id: badgeId, 'data-user-id': userId, 'data-primary-note': primaryNote, 
                   'data-secondary-note': secondaryNote, 'data-secondary-loaded': 'false'});

        badge.click(function(e) {
            const $this = $(this), userId = $this.attr('data-user-id'), 
                  primaryNote = $this.attr('data-primary-note'),
                  storedSecondaryNote = $this.attr('data-secondary-note'),
                  secondaryLoaded = $this.attr('data-secondary-loaded') === 'true',
                  $target = $(e.target), isInteractive = $target.is('a, button, [contenteditable], input, select, textarea'),
                  isSecondaryArea = $target.closest('.secondary-note').length > 0;

            if (isSecondaryArea) {
                if (!isInteractive) openSecondaryNoteEditor($target.closest('.secondary-note'), storedSecondaryNote, userId, primaryNote);
                e.stopPropagation();
                return;
            }

            let currentSecondaryBadge = $this.find('.secondary-note');
            if (!secondaryLoaded) {
                currentSecondaryBadge = $(`<div class="secondary-note" style="
                    display: none; position: absolute; top: 100%; left: 0; width: 200px;
                    background: white; border: 1px solid #ccc; border-radius: 6px; padding: 5px;
                    margin-top: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000;
                    font-size: 12px; color: ${storedSecondaryNote ? '#333' : '#999'}; cursor: pointer;
                    max-height: 400px; overflow-y: auto; word-wrap: break-word; resize: both;"
                    title="点击编辑">${storedSecondaryNote || defaultSecondaryNote}</div>`);
                currentSecondaryBadge.on('click', 'a', e => e.stopPropagation());
                $this.append(currentSecondaryBadge).attr('data-secondary-loaded', 'true');
            }

            if (currentSecondaryBadge.is(':visible')) {
                const newNote = prompt("请输入新的备注：", primaryNote);
                if (newNote !== null) {
                    const trimmedNote = newNote.trim();
                    if (trimmedNote === "" || trimmedNote === defaultNote) {
                        delete userNoteTable[userId];
                        $this.remove();
                    } else if (trimmedNote !== primaryNote) {
                        userNoteTable[userId] = Array.isArray(userNoteTable[userId]) 
                            ? [trimmedNote, storedSecondaryNote] : [trimmedNote, storedSecondaryNote];
                        $this.contents().first().replaceWith(trimmedNote)
                            .css("background", noteColors[trimmedNote] || defaultNoteColor)
                            .attr({'data-primary-note': trimmedNote, 'data-secondary-note': storedSecondaryNote});
                    }
                    chiiApp.cloud_settings.update({'userNoteTable_AGE': userNoteTable});
                    chiiApp.cloud_settings.save();
                }
            } else {
                $('.secondary-note').hide();
                currentSecondaryBadge.show();
            }
        });

        element.after(badge);
        if (!window.noteClickHandlerAdded) {
            $(document).on('click', e => !$(e.target).closest('.note-badge').length && $('.secondary-note').hide());
            window.noteClickHandlerAdded = true;
        }
    }

    function openSecondaryNoteEditor(secondaryNoteElement, currentNote, userId, primaryNote) {
        const modal = $(`<div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
            background:white;padding:20px;border-radius:15px;box-shadow:0 0 10px rgba(0,0,0,0.5);
            z-index:9999;width:300px"><h3 style="margin-top:0;color:#333">备注修改</h3></div>`);
        
        const primaryNoteInput = $(`<input type="text" value="${primaryNote}" placeholder="备注" 
            style="width:100%;padding:2px 3px;border-radius:6px;box-sizing:border-box;margin-bottom:10px;border: 1px solid #ccc;box-shadow: none !important;">`);
        const noteTextarea = $(`<textarea placeholder="详细备注（可选）" 
            style="width:100%;height:150px;border-radius:6px;padding:3px 5px;box-sizing:border-box;resize:vertical;border: 1px solid #ccc;box-shadow: none !important;">${currentNote}</textarea>`);
        
        const linkForm = $(`<div style="margin:10px 0;padding:10px;background:#f5f5f5;border-radius:15px">
            <label style="color:black;display:block;margin-bottom:5px">添加链接:</label>
            <label style="color:black;display:inline-block;width:50px">URL:</label>
            <input type="text" placeholder="https://" style="width:calc(100% - 70px);padding:2px 3px;border-radius:6px;margin-bottom:5px;border: 1px solid #ccc;box-shadow: none !important;"><br>
            <label style="color:black;display:inline-block;width:50px">标题:</label>
            <input type="text" placeholder="链接标题" style="width:calc(100% - 70px);padding:2px 3px;border-radius:6px;border: 1px solid #ccc;box-shadow: none !important;"><br>
            <button type="button" style="margin-top:5px;padding:3px 5px;border-radius:6px;border: 1px solid #ccc;box-shadow: none !important;">插入链接</button></div>`);
        
        linkForm.find('button').on('click', function() {
            const inputs = linkForm.find('input');
            const urlInput = inputs.eq(0);
            const titleInput = inputs.eq(1);
            const linkUrl = urlInput.val().trim();
            const linkTitle = titleInput.val().trim() || '链接';
            
            if (linkUrl) {
                const textarea = noteTextarea[0];
                const selectionStart = textarea.selectionStart;
                const selectionEnd = textarea.selectionEnd;
                const selectedText = textarea.value.substring(selectionStart, selectionEnd);
                const finalTitle = selectedText || linkTitle;
                const linkHtml = `<a href="${linkUrl}" style="color:blue;" rel="nofollow">${finalTitle}</a>`;
                
                const beforeText = textarea.value.substring(0, selectionStart);
                const afterText = textarea.value.substring(selectionEnd);
                textarea.value = beforeText + linkHtml + afterText;
                
                urlInput.val('');
                titleInput.val('');
                
                const newCursorPos = selectionStart + linkHtml.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                textarea.focus();
            }
        });

        const buttonContainer = $(`<div style="text-align:right;margin-top:15px">
            <button type="button" style="padding:3px 5px;border-radius:6px;border: none;">取消</button><button type="button" style="margin-left:8px;padding:3px 5px;border-radius:6px;border: none;">保存</button></div>`);
        
        buttonContainer.find('button').first().on('click', () => modal.remove());
        buttonContainer.find('button').last().on('click', () => {
            const newPrimaryNote = primaryNoteInput.val().trim();
            const newSecondaryNote = noteTextarea.val().trim();
            
            if (newPrimaryNote === defaultNote && newSecondaryNote === "") {
                delete userNoteTable[userId];
                secondaryNoteElement.closest('.note-badge').remove();
            } else {
                userNoteTable[userId] = [newPrimaryNote, newSecondaryNote];
                const badge = secondaryNoteElement.closest('.note-badge');
                badge.attr({
                    'data-primary-note': newPrimaryNote, 
                    'data-secondary-note': newSecondaryNote
                })
                .contents().first().replaceWith(newPrimaryNote)
                .css("background", noteColors[newPrimaryNote] || defaultNoteColor);
                
                secondaryNoteElement.text(newSecondaryNote || defaultSecondaryNote)
                    .css('color', newSecondaryNote ? '#333' : '#999');
            }
            chiiApp.cloud_settings.update({'userNoteTable_AGE': userNoteTable});
            chiiApp.cloud_settings.save();
            modal.remove();
        });

        modal.append(primaryNoteInput, noteTextarea, linkForm, buttonContainer);
        $('body').append(modal);
    }

    function markUserNotes() {

        $(".note-badge").remove();
        const pathname = window.location.pathname;
        
        if (pathname.endsWith('/friends')) {
            $("strong a.avatar").each(function() {
                const userId = $(this).attr("href").split("/").pop();
                if (userNoteTable[userId]) createNoteBadge($(this), userId, userNoteTable[userId]);
            });
        } else {
            $("strong a.l:not(.avatar)").each(function() {
                const userId = $(this).attr("href").split("/").pop();
                if (userNoteTable[userId]) createNoteBadge($(this), userId, userNoteTable[userId]);
            });
            
            if (pathname.startsWith('/user/')) {
                const pathParts = pathname.split('/');
                if (pathParts.length === 3) {
                    const userId = pathname.split('/')[2];
                    if (userId && userNoteTable[userId]) {
                        const userNameLink = $(`a[href="/user/${userId}"]`).not('.avatar, .focus');
                        if (userNameLink.length) {
                            createNoteBadge(userNameLink, userId, userNoteTable[userId]);
                            userNameLink.after(' ');
                        }
                    }
                }
            }
        }
    }

    function openColorManager(returnCallback) {
        const modal = $(`<div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
            background:white;padding:20px;border-radius:15px;box-shadow:0 0 10px rgba(0,0,0,0.5);
            z-index:9999;width:300px"></div>`);
        
        const form = $(`<div style="margin-bottom:5px">
            <label style="color:#333;margin-right:5px">名称：</label>
            <input type="text" style="min-width:240px;width:auto;height:22px;padding:2px 3px;border-radius:6px;margin-right:5px;position:relative;top:-5px;border: 1px solid #ccc;box-shadow: none !important;">
            <label style="color:#333;margin-right:5px">颜色：</label>
            <input type="color" style="margin-right:5px;border-radius:6px;border: 1px solid #ccc;box-shadow: none !important;">
            <button style="padding:3px 5px;border-radius:6px;border: none;">添加</button></div>`);
        
        const textarea = $(`<textarea style="width:100%;height:200px;margin-bottom:10px;border: 1px solid #ccc;box-shadow: none !important;">${JSON.stringify(noteColors, null, 4)}</textarea>`);
        
        form.find('button').click(() => {
            const nameInput = form.find('input[type="text"]');
            const colorInput = form.find('input[type="color"]');
    
            if (nameInput.val().trim() && colorInput.val()) {
                noteColors[nameInput.val().trim()] = colorInput.val();
                textarea.val(JSON.stringify(noteColors, null, 4));
                nameInput.val('');
                colorInput.val('#000000');
            } else {
                alert('名称和颜色不能为空！');
            }
        });

        const buttonContainer = $(`<div style="text-align:right">
            <button style="padding:3px 5px;border-radius:6px;border: none;">备注管理</button>
            <button style="margin-left:8px;padding:3px 5px;border-radius:6px;border: none;">取消</button>
            <button style="margin-left:8px;padding:3px 5px;border-radius:6px;border: none;">保存</button></div>`);
        
        buttonContainer.find('button').eq(0).click(() => { 
            modal.remove(); 
            if (returnCallback) {
                returnCallback();
            } else {
                openUserNoteManager();
            }
        });
        
        buttonContainer.find('button').eq(1).click(() => modal.remove());
        
        buttonContainer.find('button').eq(2).click(() => {
            try {
                const newColors = JSON.parse(textarea.val());
                if (typeof newColors !== 'object') throw new Error('请输入有效的JSON对象');
                noteColors = newColors;
                chiiApp.cloud_settings.update({'userNoteColors_': noteColors});
                chiiApp.cloud_settings.save();
                $('.note-badge').each(function() {
                    const primaryNote = $(this).attr('data-primary-note');
                    $(this).css('background', noteColors[primaryNote] || defaultNoteColor);
                });
                modal.remove();
            } catch (error) {
                alert('错误: 请检查JSON格式（其他行的末尾是有英文逗号的，最后一行的末尾是没有逗号的！），还不会就把错误代码和JSON内容放在AI里面询问：' + error.message);
            }
        });

        modal.append(form, textarea, buttonContainer);
        $('body').append(modal);
    }

    function openUserNoteManager() {
        const modal = $(`<div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
            background:white;padding:20px;border-radius:15px;box-shadow:0 0 10px rgba(0,0,0,0.5);
            z-index:9999;width:300px"></div>`);
        
        const formContainer = $(`<div style="margin-bottom:10px">
            <div style="display:flex;align-items:center;margin-bottom:10px">
                <label style="width:60px;margin-right:10px;color:black">用户ID:</label>
                <input placeholder="输入用户ID" style="flex:1;margin-right:10px;padding:2px 3px;border-radius:6px;border: 1px solid #ccc;box-shadow: none !important;">
                <button style="width:60px;padding:3px 5px;border-radius:6px;border: none;">添加</button>
            </div>
            <div style="display:flex;align-items:center;margin-bottom:10px">
                <label style="width:50px;margin-right:10px;color:black">备注:</label>
                <input placeholder="输入备注" style="flex:1;padding:2px 3px;border-radius:6px;border: 1px solid #ccc;box-shadow: none !important;">
            </div>
            <div style="display:flex;margin-bottom:10px">
                <textarea placeholder="输入详细备注（可选）" style="flex:1;height:60px;resize:vertical;border: 1px solid #ccc;box-shadow: none !important;"></textarea>
            </div></div>`);
        
        formContainer.find('button').click(() => {
            const inputs = formContainer.find('input, textarea');
            const idInput = inputs.eq(0);
            const noteInput = inputs.eq(1);
            const secondaryNoteInput = inputs.eq(2);
    
            if (idInput.val().trim() && noteInput.val().trim()) {
                userNoteTable[idInput.val().trim()] = [noteInput.val().trim(), secondaryNoteInput.val().trim()];
                textarea.val(JSON.stringify(userNoteTable, null, 4));
                idInput.val('');
                noteInput.val('');
                secondaryNoteInput.val('');
        
                chiiApp.cloud_settings.update({'userNoteTable_AGE': userNoteTable});
                chiiApp.cloud_settings.save();
        
                markUserNotes();
            } else {
                alert('用户ID和主备注不能为空！');
            }
        });

        const textarea = $(`<textarea style="width:100%;height:200px;margin:10px 0;border: 1px solid #ccc;box-shadow: none !important;">${JSON.stringify(userNoteTable, null, 4)}</textarea>`);
        const buttonContainer = $(`<div style="text-align:right">
            <button style="padding:3px 5px;border-radius:6px;border: none;">导入</button><button style="margin-left:5px;padding:3px 5px;border-radius:6px;border: none;">导出</button>
            <button style="margin-left:5px;padding:3px 5px;border-radius:6px;border: none;">颜色管理</button>
            <button style="margin-left:5px;padding:3px 5px;border-radius:6px;border: none;">取消</button><button style="margin-left:5px;padding:3px 5px;border-radius:6px;border: none;">保存</button></div>`);
        
        buttonContainer.find('button').eq(0).click(() => {
            $('<input type="file" accept="application/json">').on('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = e => {
                        try {
                            userNoteTable = JSON.parse(e.target.result);
                            textarea.val(JSON.stringify(userNoteTable, null, 4));
                            chiiApp.cloud_settings.update({'userNoteTable_AGE': userNoteTable});
                            chiiApp.cloud_settings.save();
                            markUserNotes();
                            alert("导入成功！");
                        } catch (error) {
                            alert("错误: 请检查JSON格式（其他行的末尾是有英文逗号的，最后一行的末尾是没有逗号的！），还不会就把错误代码和JSON内容放在AI里面询问：" + error);
                        }
                    };
                    reader.readAsText(file);
                }
            }).click();
        });
        
        buttonContainer.find('button').eq(1).click(() => {
            const blob = new Blob([textarea.val()], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            $('<a>').attr({href: url, download: `user_notes_${Date.now()}.json`})[0].click();
            URL.revokeObjectURL(url);
        });
        
        buttonContainer.find('button').eq(2).click(() => { modal.remove(); openColorManager(openUserNoteManager); });
        buttonContainer.find('button').eq(3).click(() => modal.remove());
        buttonContainer.find('button').eq(4).click(() => {
            try {
                userNoteTable = JSON.parse(textarea.val());
                chiiApp.cloud_settings.update({'userNoteTable_AGE': userNoteTable});
                chiiApp.cloud_settings.save();
                markUserNotes();
                modal.remove();
            } catch (error) {
                alert('错误：请检查JSON格式（其他行的末尾是有英文逗号的，最后一行的末尾是没有逗号的！），还不会就把错误代码和JSON内容放在AI里面询问：' + error.message);
            }
        });

        modal.append(formContainer, textarea, buttonContainer);
        $('body').append(modal);
    }

    function addButtonFunctions() {
        const badgeUserPanel = $("ul#badgeUserPanel");
        if (badgeUserPanel.length) {
            badgeUserPanel.append('<li class="group"><a href="#">用户备注管理</a></li>');
            badgeUserPanel.find('a').last().click(e => { e.preventDefault(); openUserNoteManager(); });
        }
        
        if (window.location.pathname.startsWith('/user/')) {
            const actionsDiv = $("#headerProfile").find("div.actions");
            if (actionsDiv.length) {
                actionsDiv.append('<a id="editNickname" href="javascript:void(0)" class="chiiBtn"><span>修改备注</span></a>');
                $('#editNickname').click(() => {
                    const userId = window.location.pathname.split('/')[2];
                    const notes = userNoteTable[userId] || [defaultNote, ""];
                    openSecondaryNoteEditor($(), notes[1], userId, notes[0]);
                });
            }
        }
    }

    function addEditNoteButtonsToComments() {
        // 处理评论和回复中的下拉菜单
        $('.light_odd.row.row_reply.clearit, .light_even.row.row_reply.clearit, .sub_reply_bg.clearit, .postTopic.light_odd.clearit').each(function() {
            const $dropdown = $(this).find('.dropdown ul').first();
            if ($dropdown.length) {
                const ignoreButton = $dropdown.find('a[onclick^="ignoreUser"]').first();
                if (ignoreButton.length) {
                    // 从ignoreUser函数参数中提取用户ID
                    const onclickText = ignoreButton.attr('onclick');
                    const userIdMatch = onclickText.match(/ignoreUser\('([^']+)'/);
                    if (userIdMatch && userIdMatch[1]) {
                        const userId = userIdMatch[1];
                        const editNoteButton = $(`<li><a href="javascript:void(0)" class="edit-note-btn" data-user-id="${userId}">修改备注</a></li>`);
                        editNoteButton.insertBefore(ignoreButton.parent());
                        
                        editNoteButton.click(function() {
                            const userId = $(this).find('a').data('userId');
                            const notes = userNoteTable[userId] || [defaultNote, ""];
                            openSecondaryNoteEditor($(), notes[1], userId, notes[0]);
                        });
                    }
                }
            }
        });
    }

    const initUserNotes = () => {
        markUserNotes();
        setTimeout(() => {
            addButtonFunctions();
            addEditNoteButtonsToComments();
        }, 200);
    };

    if (document.readyState !== 'loading') {
        initUserNotes();
    } else {
        document.addEventListener('DOMContentLoaded', initUserNotes);
    }
})();