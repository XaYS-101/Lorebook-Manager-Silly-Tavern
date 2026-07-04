// Cross-book search view. First run indexes every target book sequentially
// (with progress + cancel); afterwards searches are instant until a book is
// invalidated by WORLDINFO_UPDATED.

import { t, localize } from './i18n.js';
import { escapeHtml, LOG } from './util.js';
import { getSettings, save } from './state.js';
import * as wi from './wi.js';
import * as hide from './hide.js';
import * as searchMod from './search.js';

let activeSignal = null;

export async function renderSearchView(toolbar, body, nav, { query }) {
    const s = getSettings();
    toolbar.innerHTML = `
        <div class="menu_button lbm-tb-btn lbm-back"><i class="fa-solid fa-arrow-left"></i><span data-lbm-i18n="back"></span></div>
        <label class="checkbox_label">
            <input type="checkbox" class="lbm-search-hidden" ${s.searchHidden ? 'checked' : ''}>
            <span data-lbm-i18n="search_include_hidden"></span>
        </label>
        <div class="lbm-tb-count lbm-search-stat"></div>
    `;
    localize(toolbar);
    toolbar.querySelector('.lbm-back').addEventListener('click', () => {
        nav.setSearchText('');
        nav.openBooks();
    });
    toolbar.querySelector('.lbm-search-hidden').addEventListener('change', (e) => {
        s.searchHidden = !!e.target.checked;
        save();
        nav.openSearch(query);
    });

    if (String(query ?? '').trim().length < 2) {
        body.innerHTML = `<div class="lbm-empty">${escapeHtml(t('search_min_chars'))}</div>`;
        return;
    }

    const isBookHidden = (n) => hide.isHidden(n);
    const targets = wi.listBooks().filter(n => s.searchHidden || !isBookHidden(n));

    // Cancel any previous indexing run, start ours
    if (activeSignal) activeSignal.cancelled = true;
    const signal = { cancelled: false };
    activeSignal = signal;

    const missing = targets.filter(n => !searchMod.isIndexed(n));
    if (missing.length > 0) {
        body.innerHTML = `
            <div class="lbm-empty lbm-indexing">
                <div class="lbm-index-progress"></div>
                <div class="menu_button lbm-index-cancel">${escapeHtml(t('search_cancel'))}</div>
            </div>
        `;
        const progress = body.querySelector('.lbm-index-progress');
        progress.textContent = t('search_indexing', { done: 0, total: missing.length });
        body.querySelector('.lbm-index-cancel').addEventListener('click', () => {
            signal.cancelled = true;
            nav.setSearchText('');
            nav.openBooks();
        });
        try {
            const completed = await searchMod.ensureIndexed(targets, {
                signal,
                onProgress: (done, total) => {
                    if (progress.isConnected) progress.textContent = t('search_indexing', { done, total });
                },
            });
            if (!completed || signal.cancelled) return;
        } catch (err) {
            console.error(LOG, 'indexing failed', err);
            body.innerHTML = `<div class="lbm-empty">${escapeHtml(t('toast_error'))}</div>`;
            return;
        }
    }
    if (signal.cancelled || !body.isConnected) return;

    const results = searchMod.search(query, targets);
    const byBook = new Map();
    for (const r of results) {
        if (!byBook.has(r.book)) byBook.set(r.book, []);
        byBook.get(r.book).push(r);
    }

    toolbar.querySelector('.lbm-search-stat').textContent =
        results.length ? t('search_results', { n: results.length, m: byBook.size }) : '';

    if (results.length === 0) {
        body.innerHTML = `<div class="lbm-empty">${escapeHtml(t('search_no_results'))}</div>`;
        return;
    }

    body.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const [book, hits] of byBook) {
        const group = document.createElement('div');
        group.className = 'lbm-search-group';
        const head = document.createElement('div');
        head.className = 'lbm-search-book';
        head.innerHTML = `
            <span class="lbm-search-book-name">${escapeHtml(book)}${isBookHidden(book) ? ' <i class="fa-solid fa-eye-slash lbm-muted"></i>' : ''}</span>
            <span class="lbm-folder-count">${hits.length}</span>
            <div class="lbm-mini-btn fa-solid fa-list" title="${escapeHtml(t('act_open_manager'))}"></div>
        `;
        head.querySelector('.lbm-mini-btn').addEventListener('click', () => nav.openBook(book));
        group.appendChild(head);
        for (const hit of hits) {
            const row = document.createElement('div');
            row.className = 'lbm-search-hit';
            row.innerHTML = `
                <div class="lbm-entry-main">
                    <div class="lbm-entry-title">${escapeHtml(hit.title || t('untitled_entry'))}
                        <span class="lbm-hit-field">${escapeHtml(t('field_' + hit.field))}</span>
                    </div>
                    <div class="lbm-hit-snippet">${escapeHtml(hit.snippet.before)}<mark>${escapeHtml(hit.snippet.match)}</mark>${escapeHtml(hit.snippet.after)}</div>
                </div>
                <div class="lbm-mini-btn fa-solid fa-up-right-from-square" title="${escapeHtml(t('act_open_editor'))}"></div>
            `;
            row.querySelector('.lbm-mini-btn').addEventListener('click', () => {
                wi.focusEntryInEditor(book, { uid: hit.uid, title: hit.title });
            });
            group.appendChild(row);
        }
        frag.appendChild(group);
    }
    body.appendChild(frag);
}
