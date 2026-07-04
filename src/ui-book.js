// Single-book view: entries table with per-entry enable toggle, selection
// mode with bulk enable/disable/delete, and enable-all/disable-all. All
// mutations act on the loaded data object (ST's editor list is paginated,
// its DOM is never the source of truth), then one immediate save.

import { callGenericPopup, POPUP_TYPE, POPUP_RESULT } from '../../../../popup.js';
import { t, localize } from './i18n.js';
import { escapeHtml, LOG } from './util.js';
import { getSettings } from './state.js';
import * as wi from './wi.js';
import * as searchMod from './search.js';

const CHUNK = 200;
const toast = () => globalThis.toastr;

export async function renderBookView(toolbar, body, nav, { name }) {
    toolbar.innerHTML = `
        <div class="menu_button lbm-tb-btn lbm-back"><i class="fa-solid fa-arrow-left"></i><span data-lbm-i18n="back"></span></div>
        <div class="lbm-book-title">${escapeHtml(name)}</div>
        <div class="menu_button lbm-tb-btn lbm-open-st" data-lbm-i18n="[title]act_open_editor"><i class="fa-solid fa-up-right-from-square"></i></div>
        <div class="menu_button lbm-tb-btn lbm-all-on" data-lbm-i18n="[title]enable_all"><i class="fa-solid fa-toggle-on"></i><span data-lbm-i18n="enable_all"></span></div>
        <div class="menu_button lbm-tb-btn lbm-all-off" data-lbm-i18n="[title]disable_all"><i class="fa-solid fa-toggle-off"></i><span data-lbm-i18n="disable_all"></span></div>
        <div class="menu_button lbm-tb-btn lbm-sel-toggle"><i class="fa-solid fa-list-check"></i><span data-lbm-i18n="sel_mode"></span></div>
    `;
    localize(toolbar);
    toolbar.querySelector('.lbm-back').addEventListener('click', () => {
        nav.setSearchText('');
        nav.openBooks();
    });
    toolbar.querySelector('.lbm-open-st').addEventListener('click', () => wi.openEditor(name));

    body.innerHTML = `<div class="lbm-empty">${escapeHtml(t('loading'))}</div>`;
    const data = await wi.loadBook(name);
    if (!data) {
        body.innerHTML = `<div class="lbm-empty">${escapeHtml(t('toast_error'))}</div>`;
        return;
    }
    const entries = Object.entries(data.entries ?? {}).map(([uid, e]) => ({ uid, e }));
    const state = { selMode: false, selected: new Set(), shown: Math.min(CHUNK, entries.length) };

    const stats = document.createElement('div');
    stats.className = 'lbm-book-stats';
    const list = document.createElement('div');
    list.className = 'lbm-entries';
    const bulkBar = document.createElement('div');
    bulkBar.className = 'lbm-bulk-bar lbm-hidden-el';
    bulkBar.innerHTML = `
        <span class="lbm-bulk-count"></span>
        <div class="menu_button lbm-tb-btn lbm-bulk-on"><span data-lbm-i18n="bulk_enable"></span></div>
        <div class="menu_button lbm-tb-btn lbm-bulk-off"><span data-lbm-i18n="bulk_disable"></span></div>
        <div class="menu_button lbm-tb-btn lbm-danger lbm-bulk-del"><span data-lbm-i18n="bulk_delete"></span></div>
    `;
    localize(bulkBar);
    body.innerHTML = '';
    body.append(stats, list, bulkBar);

    const refreshStats = () => {
        const { total, enabled } = wi.countEntries(data);
        stats.textContent = t('entries_stat', { enabled, total });
    };

    const refreshBulkBar = () => {
        bulkBar.classList.toggle('lbm-hidden-el', !state.selMode || state.selected.size === 0);
        bulkBar.querySelector('.lbm-bulk-count').textContent = t('selected_n', { n: state.selected.size });
    };

    const entryTitle = (e) => e.comment || (Array.isArray(e.key) ? e.key[0] : '') || t('untitled_entry');

    const renderRow = ({ uid, e }) => {
        const row = document.createElement('div');
        row.className = 'lbm-entry-row' + (e.disable ? ' lbm-entry-off' : '');
        row.dataset.uid = uid;
        const statusTitle = e.disable ? t('entry_disabled_title') : (e.constant ? t('entry_constant_title') : t('entry_enabled_title'));
        row.innerHTML = `
            <input type="checkbox" class="lbm-entry-check ${state.selMode ? '' : 'lbm-hidden-el'}" ${state.selected.has(uid) ? 'checked' : ''}>
            <div class="lbm-entry-dot ${e.disable ? '' : (e.constant ? 'lbm-const' : 'lbm-on')}" title="${escapeHtml(statusTitle)}"></div>
            <div class="lbm-entry-main">
                <div class="lbm-entry-title">${escapeHtml(entryTitle(e))}</div>
                <div class="lbm-entry-keys">${escapeHtml((Array.isArray(e.key) ? e.key : []).join(', '))}</div>
            </div>
            <span class="lbm-entry-len" title="${escapeHtml(t('field_content'))}">${String(e.content ?? '').length}</span>
            <div class="lbm-mini-btn fa-solid fa-up-right-from-square lbm-entry-open" title="${escapeHtml(t('act_open_editor'))}"></div>
        `;
        row.querySelector('.lbm-entry-check').addEventListener('change', (ev) => {
            if (ev.target.checked) state.selected.add(uid);
            else state.selected.delete(uid);
            refreshBulkBar();
        });
        row.querySelector('.lbm-entry-dot').addEventListener('click', () => applyOps([uid], { disable: !e.disable }));
        row.querySelector('.lbm-entry-open').addEventListener('click', () => {
            wi.focusEntryInEditor(name, { uid, title: e.comment, keys: e.key });
        });
        row.querySelector('.lbm-entry-main').addEventListener('click', () => {
            if (!state.selMode) return;
            const box = row.querySelector('.lbm-entry-check');
            box.checked = !box.checked;
            box.dispatchEvent(new Event('change'));
        });
        return row;
    };

    const renderList = () => {
        list.innerHTML = '';
        if (entries.length === 0) {
            list.innerHTML = `<div class="lbm-empty">${escapeHtml(t('no_entries'))}</div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        for (const item of entries.slice(0, state.shown)) frag.appendChild(renderRow(item));
        if (state.shown < entries.length) {
            const more = document.createElement('div');
            more.className = 'menu_button lbm-show-more';
            more.textContent = t('show_more', { n: entries.length - state.shown });
            more.addEventListener('click', () => {
                state.shown = Math.min(state.shown + CHUNK, entries.length);
                renderList();
            });
            frag.appendChild(more);
        }
        list.appendChild(frag);
        refreshStats();
    };

    /** Mutate entries by uid: { disable: bool } or { delete: true }, then save once. */
    async function applyOps(uids, op) {
        try {
            for (const uid of uids) {
                if (!data.entries?.[uid]) continue;
                if (op.delete) delete data.entries[uid];
                else data.entries[uid].disable = op.disable;
            }
            await wi.saveBook(name, data);
            searchMod.invalidate(name);
            wi.reloadEditorIfOpen(name);
            if (op.delete) {
                for (let i = entries.length - 1; i >= 0; i--) {
                    if (uids.includes(entries[i].uid)) entries.splice(i, 1);
                }
                state.selected.clear();
                toast()?.success(t('toast_bulk_deleted', { n: uids.length }));
            } else if (uids.length > 1) {
                toast()?.success(t('toast_bulk_done', { n: uids.length }));
            }
            state.shown = Math.min(Math.max(state.shown, CHUNK), entries.length || CHUNK);
            renderList();
            refreshBulkBar();
        } catch (err) {
            console.error(LOG, 'bulk op failed', err);
            toast()?.error(t('toast_error'));
        }
    }

    async function confirmedBulk(uids, op) {
        if (uids.length === 0) return;
        const s = getSettings();
        if (op.delete) {
            const ok = await callGenericPopup(t('confirm_bulk_delete', { n: uids.length, name }), POPUP_TYPE.CONFIRM ?? 2);
            if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
        } else if (s.confirmBulk && uids.length > 1) {
            const ok = await callGenericPopup(t('confirm_bulk_toggle', { n: uids.length }), POPUP_TYPE.CONFIRM ?? 2);
            if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
        }
        await applyOps(uids, op);
    }

    toolbar.querySelector('.lbm-all-on').addEventListener('click', async () => {
        const uids = entries.filter(({ e }) => e.disable).map(({ uid }) => uid);
        if (uids.length === 0) return;
        const ok = await callGenericPopup(t('confirm_enable_all', { n: uids.length, name }), POPUP_TYPE.CONFIRM ?? 2);
        if (ok === (POPUP_RESULT?.AFFIRMATIVE ?? 1)) await applyOps(uids, { disable: false });
    });
    toolbar.querySelector('.lbm-all-off').addEventListener('click', async () => {
        const uids = entries.filter(({ e }) => !e.disable).map(({ uid }) => uid);
        if (uids.length === 0) return;
        const ok = await callGenericPopup(t('confirm_disable_all', { n: uids.length, name }), POPUP_TYPE.CONFIRM ?? 2);
        if (ok === (POPUP_RESULT?.AFFIRMATIVE ?? 1)) await applyOps(uids, { disable: true });
    });
    toolbar.querySelector('.lbm-sel-toggle').addEventListener('click', (e) => {
        state.selMode = !state.selMode;
        state.selected.clear();
        e.currentTarget.querySelector('span').textContent = state.selMode ? t('sel_exit') : t('sel_mode');
        e.currentTarget.classList.toggle('lbm-active', state.selMode);
        renderList();
        refreshBulkBar();
    });
    bulkBar.querySelector('.lbm-bulk-on').addEventListener('click', () => confirmedBulk([...state.selected], { disable: false }));
    bulkBar.querySelector('.lbm-bulk-off').addEventListener('click', () => confirmedBulk([...state.selected], { disable: true }));
    bulkBar.querySelector('.lbm-bulk-del').addEventListener('click', () => confirmedBulk([...state.selected], { delete: true }));

    renderList();
}
