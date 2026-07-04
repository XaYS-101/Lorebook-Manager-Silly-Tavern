// Books view: folder tree + book rows + the per-book action menu and all the
// small dialogs (new/rename/move/folder/bindings/hide/delete). Books are
// grouped by folder, then "Unfiled", then a dimmed "Hidden" section.

import { callGenericPopup, POPUP_TYPE, POPUP_RESULT } from '../../../../popup.js';
import { t, localize } from './i18n.js';
import { escapeHtml, LOG } from './util.js';
import { getSettings, save, nextFolderId, folderWithDescendants, noteBookListRendered } from './state.js';
import * as wi from './wi.js';
import * as hide from './hide.js';
import * as bindings from './bindings.js';
import * as searchMod from './search.js';

const toast = () => globalThis.toastr;

// ---------------------------------------------------------------------------
// Sorting & grouping
// ---------------------------------------------------------------------------

function sortBooks(names) {
    const s = getSettings();
    if (s.sortMode === 'manual') {
        const pos = new Map(s.manualOrder.map((n, i) => [n, i]));
        return [...names].sort((a, b) => {
            const pa = pos.has(a) ? pos.get(a) : Infinity;
            const pb = pos.has(b) ? pos.get(b) : Infinity;
            return pa !== pb ? pa - pb : a.localeCompare(b);
        });
    }
    return [...names].sort((a, b) => a.localeCompare(b));
}

function childFolders(parentId) {
    const s = getSettings();
    return Object.values(s.folders)
        .filter(f => (f.parentId || null) === (parentId || null))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

function booksInFolder(folderId, visibleNames) {
    const s = getSettings();
    return sortBooks(visibleNames.filter(n => s.assign[n] === folderId));
}

function folderTotalCount(folderId, visibleNames) {
    const ids = folderWithDescendants(folderId);
    const s = getSettings();
    return visibleNames.filter(n => ids.has(s.assign[n])).length;
}

function ensureManualSeed() {
    const s = getSettings();
    if (s.sortMode !== 'manual') return;
    const all = wi.listBooks();
    const known = new Set(s.manualOrder);
    for (const n of sortBooks(all)) if (!known.has(n)) s.manualOrder.push(n);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

let dragName = null;
let countsGeneration = 0;

export async function renderBooksView(toolbar, body, nav) {
    const s = getSettings();
    const allNames = wi.listBooks();
    noteBookListRendered(allNames);
    const visible = allNames.filter(n => !hide.isHidden(n));
    const hiddenExisting = allNames.filter(n => hide.isHidden(n));

    // Toolbar
    toolbar.innerHTML = `
        <div class="menu_button lbm-tb-btn lbm-new-book"><i class="fa-solid fa-plus"></i><span data-lbm-i18n="new_book"></span></div>
        <div class="menu_button lbm-tb-btn lbm-new-folder"><i class="fa-solid fa-folder-plus"></i><span data-lbm-i18n="new_folder"></span></div>
        <select class="lbm-sort text_pole">
            <option value="alpha">A→Я</option>
            <option value="manual">↕</option>
        </select>
        <label class="checkbox_label lbm-show-hidden">
            <input type="checkbox" ${s.showHidden ? 'checked' : ''}>
            <span data-lbm-i18n="show_hidden"></span>
        </label>
        <div class="menu_button lbm-tb-btn lbm-collapse-all fa-solid fa-compress" data-lbm-i18n="[title]collapse_all"></div>
        <div class="lbm-tb-count" data-count></div>
    `;
    localize(toolbar);
    toolbar.querySelector('[data-count]').textContent = t('books_count', { n: allNames.length });
    toolbar.querySelector('.lbm-sort').value = s.sortMode;

    toolbar.querySelector('.lbm-new-book').addEventListener('click', () => createBookFlow(nav));
    toolbar.querySelector('.lbm-new-folder').addEventListener('click', () => folderDialog(null, nav));
    toolbar.querySelector('.lbm-sort').addEventListener('change', (e) => {
        s.sortMode = e.target.value === 'manual' ? 'manual' : 'alpha';
        ensureManualSeed();
        save();
        nav.rerender();
    });
    toolbar.querySelector('.lbm-show-hidden input').addEventListener('change', (e) => {
        s.showHidden = !!e.target.checked;
        save();
        nav.rerender();
    });
    toolbar.querySelector('.lbm-collapse-all').addEventListener('click', () => {
        const anyOpen = Object.values(s.folders).some(f => !f.collapsed);
        for (const f of Object.values(s.folders)) f.collapsed = anyOpen;
        save();
        nav.rerender();
    });

    // Body
    if (allNames.length === 0) {
        body.innerHTML = `<div class="lbm-empty">${escapeHtml(t('empty_list'))}</div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    for (const folder of childFolders(null)) {
        frag.appendChild(renderFolder(folder, visible, nav, 0));
    }
    const unfiled = sortBooks(visible.filter(n => !s.folders[s.assign[n]]));
    if (unfiled.length > 0 || Object.keys(s.folders).length === 0) {
        const section = document.createElement('div');
        section.className = 'lbm-section';
        if (Object.keys(s.folders).length > 0) {
            const head = document.createElement('div');
            head.className = 'lbm-unfiled-head';
            head.textContent = `${t('no_folder')} (${unfiled.length})`;
            wireDropTarget(head, null, nav);
            section.appendChild(head);
        }
        for (const name of unfiled) section.appendChild(renderBookRow(name, unfiled, nav, false));
        frag.appendChild(section);
    }
    if (s.showHidden && hiddenExisting.length > 0) {
        const section = document.createElement('div');
        section.className = 'lbm-section lbm-hidden-section';
        const head = document.createElement('div');
        head.className = 'lbm-unfiled-head lbm-hidden-head';
        head.innerHTML = `<i class="fa-solid fa-eye-slash"></i> ${escapeHtml(t('hidden_section'))} (${hiddenExisting.length})`;
        section.appendChild(head);
        for (const name of sortBooks(hiddenExisting)) section.appendChild(renderBookRow(name, hiddenExisting, nav, true));
        frag.appendChild(section);
    }
    body.appendChild(frag);

    loadCountsInBackground(visible.concat(hiddenExisting), body);
}

function renderFolder(folder, visible, nav, depth) {
    const s = getSettings();
    const wrap = document.createElement('div');
    wrap.className = 'lbm-folder';
    wrap.style.marginLeft = depth > 0 ? `${Math.min(depth, 6) * 14}px` : '';

    const head = document.createElement('div');
    head.className = 'lbm-folder-head';
    if (folder.color) head.style.borderLeftColor = folder.color;
    const count = folderTotalCount(folder.id, visible);
    head.innerHTML = `
        <i class="fa-solid ${folder.collapsed ? 'fa-caret-right' : 'fa-caret-down'} lbm-caret"></i>
        <span class="lbm-folder-icon">${escapeHtml(folder.icon || '📁')}</span>
        <span class="lbm-folder-name">${escapeHtml(folder.name)}</span>
        <span class="lbm-folder-count">${count}</span>
        <div class="lbm-folder-edit menu_button fa-solid fa-pencil" title="${escapeHtml(t('folder_edit_title_btn'))}"></div>
    `;
    head.addEventListener('click', (e) => {
        if (e.target.closest('.lbm-folder-edit')) return;
        folder.collapsed = !folder.collapsed;
        save();
        nav.rerender();
    });
    head.querySelector('.lbm-folder-edit').addEventListener('click', () => folderDialog(folder, nav));
    wireDropTarget(head, folder.id, nav);
    wrap.appendChild(head);

    if (!folder.collapsed) {
        const inner = document.createElement('div');
        inner.className = 'lbm-folder-body';
        for (const sub of childFolders(folder.id)) {
            inner.appendChild(renderFolder(sub, visible, nav, depth + 1));
        }
        const books = booksInFolder(folder.id, visible);
        for (const name of books) inner.appendChild(renderBookRow(name, books, nav, false));
        wrap.appendChild(inner);
    }
    return wrap;
}

function badgesHtml(name) {
    try {
        const b = bindings.getBindings(name);
        const parts = [];
        if (b.global) parts.push(`<span class="lbm-badge" title="${escapeHtml(t('badge_global'))}">🌐</span>`);
        if (b.chat) parts.push(`<span class="lbm-badge" title="${escapeHtml(t('badge_chat'))}">💬</span>`);
        if (b.primaryChars.length) parts.push(`<span class="lbm-badge" title="${escapeHtml(t('badge_primary', { chars: b.primaryChars.join(', ') }))}">👤</span>`);
        if (b.auxChars.length) parts.push(`<span class="lbm-badge" title="${escapeHtml(t('badge_aux', { chars: b.auxChars.join(', ') }))}">👥</span>`);
        if (b.persona) parts.push(`<span class="lbm-badge" title="${escapeHtml(t('badge_persona'))}">🎭</span>`);
        return parts.join('');
    } catch (err) {
        console.error(LOG, 'badges failed', err);
        return '';
    }
}

function countText(name) {
    const meta = searchMod.getBookMeta(name);
    return meta ? `${meta.enabled}/${meta.total}` : '…';
}

function renderBookRow(name, siblings, nav, isHiddenRow) {
    const s = getSettings();
    const row = document.createElement('div');
    row.className = 'lbm-book-row' + (isHiddenRow ? ' lbm-row-hidden' : '');
    row.dataset.name = name;
    const active = wi.isGlobalActive(name);
    const byRule = isHiddenRow && hide.isHiddenByRule(name);
    row.innerHTML = `
        <div class="lbm-dot ${active ? 'lbm-on' : ''}" title="${escapeHtml(t('toggle_global_title'))}"></div>
        <div class="lbm-book-main">
            <span class="lbm-book-name">${escapeHtml(name)}</span>
            <span class="lbm-badges">${badgesHtml(name)}${isHiddenRow && active ? `<span class="lbm-badge lbm-badge-warn" title="${escapeHtml(t('active_hidden_badge'))}">⚠</span>` : ''}${byRule ? `<span class="lbm-badge lbm-badge-rule" title="${escapeHtml(t('hidden_by_rule'))}">✳</span>` : ''}</span>
        </div>
        <span class="lbm-count" title="${escapeHtml(t('entries_short'))}">${escapeHtml(countText(name))}</span>
        <div class="lbm-row-actions">
            ${s.sortMode === 'manual' && !isHiddenRow ? `
                <div class="lbm-mini-btn fa-solid fa-arrow-up" data-move="-1"></div>
                <div class="lbm-mini-btn fa-solid fa-arrow-down" data-move="1"></div>` : ''}
            <div class="lbm-mini-btn lbm-menu-btn fa-solid fa-ellipsis-vertical" title="${escapeHtml(t('actions_title'))}"></div>
        </div>
    `;
    row.querySelector('.lbm-dot').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await wi.toggleGlobal(name);
            e.target.classList.toggle('lbm-on', wi.isGlobalActive(name));
        } catch (err) {
            console.error(LOG, 'toggle failed', err);
            toast()?.error(t('toast_error'));
        }
    });
    row.querySelector('.lbm-book-main').addEventListener('click', () => nav.openBook(name));
    row.querySelector('.lbm-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openActionMenu(e.currentTarget, name, isHiddenRow, nav);
    });
    for (const btn of row.querySelectorAll('[data-move]')) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            moveManual(name, siblings, Number(btn.dataset.move), nav);
        });
    }
    if (!isHiddenRow) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => {
            dragName = name;
            e.dataTransfer?.setData('text/plain', name);
            row.classList.add('lbm-dragging');
        });
        row.addEventListener('dragend', () => {
            dragName = null;
            row.classList.remove('lbm-dragging');
        });
    }
    return row;
}

function wireDropTarget(el, folderId, nav) {
    el.addEventListener('dragover', (e) => {
        if (!dragName) return;
        e.preventDefault();
        el.classList.add('lbm-drop-hover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('lbm-drop-hover'));
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('lbm-drop-hover');
        if (!dragName) return;
        assignBook(dragName, folderId, nav);
        dragName = null;
    });
}

function assignBook(name, folderId, nav) {
    const s = getSettings();
    if (folderId) s.assign[name] = folderId;
    else delete s.assign[name];
    save();
    nav.rerender();
}

function moveManual(name, siblings, dir, nav) {
    const s = getSettings();
    ensureManualSeed();
    const idx = siblings.indexOf(name);
    const swapWith = siblings[idx + dir];
    if (!swapWith) return;
    const a = s.manualOrder.indexOf(name);
    const b = s.manualOrder.indexOf(swapWith);
    if (a === -1 || b === -1) return;
    [s.manualOrder[a], s.manualOrder[b]] = [s.manualOrder[b], s.manualOrder[a]];
    save();
    nav.rerender();
}

async function loadCountsInBackground(names, body) {
    const missing = names.filter(n => !searchMod.isIndexed(n));
    if (missing.length === 0) return;
    const generation = ++countsGeneration;
    for (const name of missing) {
        if (generation !== countsGeneration || !body.isConnected) return;
        await searchMod.ensureIndexed([name]);
        const row = body.querySelector(`.lbm-book-row[data-name="${CSS.escape(name)}"] .lbm-count`);
        if (row) row.textContent = countText(name);
    }
}

// ---------------------------------------------------------------------------
// Action menu (custom dropdown inside the manager — no nested dialogs)
// ---------------------------------------------------------------------------

function closeMenus(root) {
    for (const m of root?.querySelectorAll('.lbm-menu') ?? []) m.remove();
}

function openActionMenu(anchor, name, isHiddenRow, nav) {
    const root = nav.root;
    if (!root) return;
    // Second tap on the same ⋮ toggles the menu closed instead of reopening it.
    const existing = root.querySelector('.lbm-menu');
    const wasFor = existing?.dataset.for;
    closeMenus(root);
    if (wasFor === name) return;
    const menu = document.createElement('div');
    menu.className = 'lbm-menu';
    menu.dataset.for = name;
    const items = [
        ['fa-list', t('act_open_manager'), () => nav.openBook(name)],
        ['fa-up-right-from-square', t('act_open_editor'), () => wi.openEditor(name)],
        ['fa-pencil', t('act_rename'), () => renameFlow(name, nav)],
        ['fa-copy', t('act_duplicate'), () => duplicateFlow(name, nav)],
        ['fa-folder-open', t('act_move'), () => movePickerFlow(name, nav)],
        ['fa-link', t('act_bindings'), () => bindingsDialog(name, nav)],
        isHiddenRow
            ? ['fa-eye', t('act_unhide'), () => unhideFlow(name, nav)]
            : ['fa-eye-slash', t('act_hide'), () => hideFlow(name, nav)],
        ['fa-trash-can', t('act_delete'), () => deleteFlow(name, nav), 'lbm-danger'],
    ];
    for (const [icon, label, action, extra] of items) {
        const item = document.createElement('div');
        item.className = 'lbm-menu-item' + (extra ? ` ${extra}` : '');
        item.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(label)}</span>`;
        item.addEventListener('click', () => {
            close();
            Promise.resolve(action()).catch(err => {
                console.error(LOG, 'action failed', err);
                toast()?.error(t('toast_error'));
            });
        });
        menu.appendChild(item);
    }
    root.appendChild(menu);
    // Position near the anchor, clamped inside the root
    const rootRect = root.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const top = Math.min(a.bottom - rootRect.top + 4, rootRect.height - menu.offsetHeight - 8);
    const left = Math.max(8, Math.min(a.right - rootRect.left - menu.offsetWidth, rootRect.width - menu.offsetWidth - 8));
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.left = `${left}px`;
    // Close on outside tap AND on any list scroll (on phones the list keeps
    // scrolling under an open menu, inviting misclicks).
    const scrollHost = root.querySelector('.lbm-body');
    const close = () => {
        menu.remove();
        document.removeEventListener('click', closer, true);
        scrollHost?.removeEventListener('scroll', close);
    };
    const closer = (e) => {
        if (menu.contains(e.target)) return;
        // Taps on any ⋮ button are handled by openActionMenu itself (toggle /
        // switch to another book) — closing here would break the toggle.
        if (e.target instanceof Element && e.target.closest('.lbm-menu-btn')) return;
        close();
    };
    setTimeout(() => {
        document.addEventListener('click', closer, true);
        scrollHost?.addEventListener('scroll', close, { passive: true });
    }, 0);
}

// ---------------------------------------------------------------------------
// Flows & dialogs
// ---------------------------------------------------------------------------

async function promptBookName(title, initial) {
    const value = await callGenericPopup(title, POPUP_TYPE.INPUT ?? 3, initial ?? '');
    if (value === null || value === false || value === POPUP_RESULT?.CANCELLED) return null;
    const name = String(value).trim();
    if (!name) {
        toast()?.warning(t('name_required'));
        return null;
    }
    if (wi.listBooks().includes(name)) {
        toast()?.warning(t('name_exists'));
        return null;
    }
    return name;
}

async function createBookFlow(nav) {
    const name = await promptBookName(t('new_book_title'), '');
    if (!name) return;
    await wi.createBook(name);
    toast()?.success(t('toast_book_created', { name }));
    nav.rerender();
}

async function renameFlow(oldName, nav) {
    const newName = await promptBookName(t('rename_title'), oldName);
    if (!newName || newName === oldName) return;
    const b = bindings.getBindings(oldName);
    if (b.primaryOthers.length > 0) {
        const ok = await callGenericPopup(t('rename_affects_primary', { chars: b.primaryOthers.join(', ') }), POPUP_TYPE.CONFIRM ?? 2);
        if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
    }
    await wi.renameBook(oldName, newName);
    searchMod.invalidate(oldName);
    searchMod.invalidate(newName);
    toast()?.success(t('toast_book_renamed'));
    nav.rerender();
}

async function duplicateFlow(name, nav) {
    const newName = await wi.duplicateBook(name);
    toast()?.success(t('toast_book_duplicated', { name: newName }));
    nav.rerender();
}

async function deleteFlow(name, nav) {
    const ok = await callGenericPopup(t('confirm_delete_book', { name }), POPUP_TYPE.CONFIRM ?? 2);
    if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
    await wi.deleteBook(name);
    searchMod.invalidate(name);
    toast()?.success(t('toast_book_deleted'));
    nav.rerender();
}

async function hideFlow(name, nav) {
    const s = getSettings();
    if (s.confirmHide) {
        const b = bindings.getBindings(name);
        const wrap = document.createElement('div');
        wrap.className = 'lbm-dialog-content';
        const usedParts = [];
        if (b.global) usedParts.push(t('badge_global'));
        if (b.chat) usedParts.push(t('badge_chat'));
        if (b.primaryChars.length) usedParts.push(t('badge_primary', { chars: b.primaryChars.join(', ') }));
        if (b.auxChars.length) usedParts.push(t('badge_aux', { chars: b.auxChars.join(', ') }));
        if (b.persona) usedParts.push(t('badge_persona'));
        wrap.innerHTML = `
            <p>${escapeHtml(t('confirm_hide_book', { name }))}</p>
            ${usedParts.length ? `<p class="lbm-warn-text">${escapeHtml(t('hide_bound_note', { bindings: usedParts.join('; ') }))}</p>` : ''}
            ${b.global ? `<label class="checkbox_label"><input type="checkbox" class="lbm-deact"><span>${escapeHtml(t('hide_also_deactivate'))}</span></label>` : ''}
            <label class="checkbox_label lbm-muted"><input type="checkbox" class="lbm-noask"><span>${escapeHtml(t('hide_dont_ask'))}</span></label>
        `;
        const ok = await callGenericPopup(wrap, POPUP_TYPE.CONFIRM ?? 2);
        if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
        if (b.global && wrap.querySelector('.lbm-deact')?.checked) {
            await wi.setGlobalActive(name, false);
        }
        if (wrap.querySelector('.lbm-noask')?.checked) {
            s.confirmHide = false;
            save();
        }
    }
    hide.hideBook(name);
    toast()?.success(t('toast_hidden'));
    nav.rerender();
}

async function unhideFlow(name, nav) {
    await hide.unhideBook(name);
    toast()?.success(t('toast_unhidden'));
    nav.rerender();
}

function buildFolderOptionTree(selectedId, excludeId, firstLabel = null) {
    const s = getSettings();
    const excluded = excludeId ? folderWithDescendants(excludeId) : new Set();
    const options = [`<option value="">${escapeHtml(firstLabel ?? t('folder_root'))}</option>`];
    const walk = (parentId, depth) => {
        for (const f of childFolders(parentId)) {
            if (excluded.has(f.id)) continue;
            const pad = ' '.repeat(depth * 3);
            options.push(`<option value="${escapeHtml(f.id)}" ${f.id === selectedId ? 'selected' : ''}>${pad}${escapeHtml(f.icon || '📁')} ${escapeHtml(f.name)}</option>`);
            walk(f.id, depth + 1);
        }
    };
    walk(null, 0);
    return options.join('');
}

async function folderDialog(folder, nav) {
    const s = getSettings();
    const isEdit = !!folder;
    const wrap = document.createElement('div');
    wrap.className = 'lbm-dialog-content';
    wrap.innerHTML = `
        <h4>${escapeHtml(isEdit ? t('folder_edit_title') : t('folder_new_title'))}</h4>
        <label>${escapeHtml(t('folder_name'))}<input type="text" class="text_pole lbm-f-name" value="${escapeHtml(folder?.name ?? '')}"></label>
        <label>${escapeHtml(t('folder_parent'))}<select class="text_pole lbm-f-parent">${buildFolderOptionTree(folder?.parentId ?? '', folder?.id)}</select></label>
        <div class="lbm-dialog-row">
            <label>${escapeHtml(t('folder_color'))}<input type="color" class="lbm-f-color" value="${escapeHtml(folder?.color || '#888888')}"></label>
            <label>${escapeHtml(t('folder_icon'))}<input type="text" class="text_pole lbm-f-icon" maxlength="4" value="${escapeHtml(folder?.icon ?? '')}"></label>
        </div>
        ${isEdit ? `<div class="menu_button lbm-danger lbm-f-delete"><i class="fa-solid fa-trash-can"></i> ${escapeHtml(t('folder_delete'))}</div>` : ''}
    `;

    let deleted = false;
    wrap.querySelector('.lbm-f-delete')?.addEventListener('click', async () => {
        const ok = await callGenericPopup(t('confirm_delete_folder'), POPUP_TYPE.CONFIRM ?? 2);
        if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
        deleted = true;
        // Reparent children, unfile books
        for (const f of Object.values(s.folders)) {
            if (f.parentId === folder.id) f.parentId = folder.parentId ?? null;
        }
        for (const [book, fid] of Object.entries(s.assign)) {
            if (fid === folder.id) delete s.assign[book];
        }
        delete s.folders[folder.id];
        save();
        wrap.closest('dialog')?.close?.();
        nav.rerender();
    });

    const ok = await callGenericPopup(wrap, POPUP_TYPE.CONFIRM ?? 2, '', { okButton: isEdit ? t('apply') : t('create'), cancelButton: t('cancel') });
    if (deleted || ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
    const name = wrap.querySelector('.lbm-f-name').value.trim();
    if (!name) {
        toast()?.warning(t('folder_name_required'));
        return;
    }
    const parentId = wrap.querySelector('.lbm-f-parent').value || null;
    const color = wrap.querySelector('.lbm-f-color').value;
    const icon = wrap.querySelector('.lbm-f-icon').value.trim();
    if (isEdit) {
        Object.assign(folder, { name, parentId, color, icon });
    } else {
        const id = nextFolderId();
        s.folders[id] = { id, name, parentId, color, icon, collapsed: false, order: Object.keys(s.folders).length };
    }
    save();
    nav.rerender();
}

async function movePickerFlow(name, nav) {
    const s = getSettings();
    const wrap = document.createElement('div');
    wrap.className = 'lbm-dialog-content';
    wrap.innerHTML = `
        <h4>${escapeHtml(t('move_title'))}: ${escapeHtml(name)}</h4>
        <select class="text_pole lbm-move-target">
            ${buildFolderOptionTree(s.assign[name] ?? '', null, t('move_none'))}
        </select>
    `;
    const ok = await callGenericPopup(wrap, POPUP_TYPE.CONFIRM ?? 2, '', { okButton: t('apply'), cancelButton: t('cancel') });
    if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
    assignBook(name, wrap.querySelector('.lbm-move-target').value || null, nav);
}

async function bindingsDialog(name, nav) {
    const b = bindings.getBindings(name);
    const wrap = document.createElement('div');
    wrap.className = 'lbm-dialog-content';
    const hasChat = bindings.hasCurrentChat();
    const hasChar = bindings.hasCurrentCharacter();
    wrap.innerHTML = `
        <h4>${escapeHtml(t('bind_title', { name }))}</h4>
        <label class="checkbox_label"><input type="checkbox" class="lbm-b-global" ${b.global ? 'checked' : ''}><span>${escapeHtml(t('bind_global'))}</span></label>
        <label class="checkbox_label ${hasChat ? '' : 'lbm-disabled'}"><input type="checkbox" class="lbm-b-chat" ${b.chat ? 'checked' : ''} ${hasChat ? '' : 'disabled'}><span>${escapeHtml(hasChat ? t('bind_chat') : t('bind_chat_none'))}</span></label>
        <label class="checkbox_label ${hasChar ? '' : 'lbm-disabled'}"><input type="checkbox" class="lbm-b-primary" ${b.primaryCurrent ? 'checked' : ''} ${hasChar ? '' : 'disabled'}><span>${escapeHtml(hasChar ? t('bind_char_primary') : t('bind_char_none'))}</span></label>
        <label class="checkbox_label ${hasChar ? '' : 'lbm-disabled'}"><input type="checkbox" class="lbm-b-aux" ${b.auxCurrent ? 'checked' : ''} ${hasChar ? '' : 'disabled'}><span>${escapeHtml(t('bind_char_aux'))}</span></label>
        ${b.persona ? `<p class="lbm-muted">🎭 ${escapeHtml(t('bind_persona'))}</p>` : ''}
        ${b.primaryChars.length ? `<p class="lbm-muted">👤 ${escapeHtml(t('used_by'))}: ${escapeHtml(b.primaryChars.join(', '))}</p>` : ''}
        ${b.auxChars.length ? `<p class="lbm-muted">👥 ${escapeHtml(t('used_by'))}: ${escapeHtml(b.auxChars.join(', '))}</p>` : ''}
    `;

    wrap.querySelector('.lbm-b-global').addEventListener('change', async (e) => {
        try { await wi.setGlobalActive(name, e.target.checked); } catch (err) { console.error(LOG, err); }
    });
    wrap.querySelector('.lbm-b-chat').addEventListener('change', async (e) => {
        try { await bindings.bindChat(e.target.checked ? name : null); } catch (err) { console.error(LOG, err); }
    });
    wrap.querySelector('.lbm-b-primary').addEventListener('change', async (e) => {
        const box = e.target;
        try {
            if (box.checked) {
                const ok = await callGenericPopup(t('bind_set_primary_confirm', { name }), POPUP_TYPE.CONFIRM ?? 2);
                if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) {
                    box.checked = false;
                    return;
                }
                await bindings.setCurrentCharPrimary(name);
            } else {
                await bindings.setCurrentCharPrimary('');
            }
        } catch (err) {
            console.error(LOG, err);
            toast()?.error(t('toast_error'));
        }
    });
    wrap.querySelector('.lbm-b-aux').addEventListener('change', async (e) => {
        try { await bindings.setCurrentCharAux(name, e.target.checked); } catch (err) { console.error(LOG, err); toast()?.error(t('toast_error')); }
    });

    await callGenericPopup(wrap, POPUP_TYPE.TEXT ?? 1, '', { okButton: t('close') });
    nav.rerender();
}
