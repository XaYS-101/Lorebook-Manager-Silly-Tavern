// Manager popup shell: one fullscreen modal dialog with a persistent header
// search box, a per-view toolbar and a single scrollable body. Views
// (books / book / search) render into it through the `nav` object so the view
// modules never import this one.

import { eventSource, event_types } from '../../../../../script.js';
import { Popup, POPUP_TYPE, callGenericPopup } from '../../../../popup.js';
import { t, localize } from './i18n.js';
import { debounce, LOG } from './util.js';
import { isInternalWrite } from './wi.js';
import { renderBooksView, resetBooksSelection } from './ui-books.js';
import { renderBookView } from './ui-book.js';
import { renderSearchView } from './ui-search.js';

let current = null; // { root, toolbar, body, dlg, view, params, cleanups }

export function isOpen() {
    return !!current;
}

function buildRoot() {
    const root = document.createElement('div');
    root.className = 'lbm-root';
    root.innerHTML = `
        <div class="lbm-header">
            <div class="lbm-title" data-lbm-i18n="ext_name"></div>
            <input type="search" class="lbm-search text_pole" data-lbm-i18n="[placeholder]search_placeholder">
        </div>
        <div class="lbm-toolbar"></div>
        <div class="lbm-body"></div>
    `;
    localize(root);
    return root;
}

function makeNav() {
    return {
        openBooks: () => showView('books'),
        openBook: (name) => showView('book', { name }),
        openSearch: (query) => showView('search', { query }),
        rerender: () => rerenderNow(),
        setSearchText: (text) => {
            if (current) current.root.querySelector('.lbm-search').value = text;
        },
        get root() { return current?.root; },
    };
}

async function showView(view, params = {}) {
    if (!current) return;
    current.view = view;
    current.params = params;
    // Fresh containers on every render: a stale async render (e.g. a slow
    // loadBook) keeps writing into the detached old nodes instead of racing
    // the new view for the same DOM.
    const toolbar = current.toolbar.cloneNode(false);
    const body = current.body.cloneNode(false);
    current.toolbar.replaceWith(toolbar);
    current.body.replaceWith(body);
    current.toolbar = toolbar;
    current.body = body;
    const nav = makeNav();
    try {
        if (view === 'book') await renderBookView(toolbar, body, nav, params);
        else if (view === 'search') await renderSearchView(toolbar, body, nav, params);
        else await renderBooksView(toolbar, body, nav);
    } catch (err) {
        console.error(LOG, `render view "${view}" failed`, err);
        body.textContent = t('toast_error');
    }
}

function rerenderNow() {
    if (current) showView(current.view, current.params);
}

const rerenderDebounced = debounce(() => {
    if (!current || isInternalWrite()) return;
    rerenderNow();
}, 200);

export async function openManager(initialView = 'books', initialParams = {}) {
    if (current) return;
    resetBooksSelection();
    const root = buildRoot();
    const toolbar = root.querySelector('.lbm-toolbar');
    const body = root.querySelector('.lbm-body');
    current = { root, toolbar, body, dlg: null, view: initialView, params: initialParams, cleanups: [] };

    // Header wiring
    const searchBox = root.querySelector('.lbm-search');
    const onSearchInput = debounce(() => {
        const q = searchBox.value.trim();
        if (q.length >= 2) showView('search', { query: q });
        else if (current?.view === 'search') showView('books');
    }, 300);
    searchBox.addEventListener('input', onSearchInput);

    // Keep the panel live while open
    const events = [event_types?.WORLDINFO_UPDATED, event_types?.WORLDINFO_SETTINGS_UPDATED, event_types?.CHAT_CHANGED].filter(Boolean);
    for (const ev of events) {
        const handler = () => rerenderDebounced();
        eventSource.on(ev, handler);
        current.cleanups.push(() => eventSource.removeListener?.(ev, handler));
    }

    const popupOptions = { okButton: t('close'), wide: true, large: true };
    let closedPromise;
    try {
        const popup = new Popup(root, POPUP_TYPE.TEXT, '', popupOptions);
        current.dlg = popup.dlg ?? null;
        closedPromise = popup.show();
    } catch (err) {
        console.error(LOG, 'Popup class failed, falling back to callGenericPopup', err);
        closedPromise = callGenericPopup(root, POPUP_TYPE.TEXT ?? 1, '', popupOptions);
    }
    // Tag the dialog so our CSS makes it fullscreen (fallback path attaches it
    // a tick later).
    requestAnimationFrame(() => {
        if (!current) return;
        current.dlg = current.dlg || root.closest('dialog');
        current.dlg?.classList.add('lbm-dialog');
    });
    current.dlg?.classList.add('lbm-dialog');

    showView(initialView, initialParams);

    try {
        await closedPromise;
    } finally {
        for (const fn of current?.cleanups ?? []) {
            try { fn(); } catch { /* already gone */ }
        }
        rerenderDebounced.cancel();
        current = null;
    }
}
