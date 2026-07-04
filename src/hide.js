// Hiding books from ST's own selectors without touching the files.
//
// select2 ignores display:none on <option>, so hidden books' options are
// REMOVED from the DOM. That is safe because every ST world-select carries
// explicit string values (the index into world_names): removing one option
// never renumbers the others, and ST maps a selection back through
// world_names[idx]. Two hard rules:
//   1. NEVER remove a selected option (in #world_info that would silently
//      change the active set; in single selects it would move the selection).
//   2. NEVER reorder or rewrite option values — only remove whole options.
//
// Re-application: ST rebuilds both selects inside updateWorldInfoList(), so
// each select gets a MutationObserver (disconnect -> filter -> reconnect on a
// microtask, the CharactersFolders pattern). The character-card and
// chat-lorebook popups are built on demand — a body-level observer catches
// them the moment they are inserted.

import { LOG } from './util.js';
import { getSettings, save } from './state.js';
import { refreshList } from './wi.js';

export function isHidden(name) {
    return getSettings().hidden.includes(name);
}

export function hiddenBooks() {
    return [...getSettings().hidden];
}

/** Add to the hidden list. Confirmation/deactivation is the caller's job. */
export function hideBook(name) {
    const s = getSettings();
    if (!s.hidden.includes(name)) {
        s.hidden.push(name);
        save();
    }
    scheduleApply();
}

/** Remove from the hidden list and restore the options everywhere. */
export async function unhideBook(name) {
    const s = getSettings();
    s.hidden = s.hidden.filter(n => n !== name);
    save();
    // updateWorldInfoList() rebuilds the full option sets; our observers then
    // re-filter whatever is still hidden.
    await refreshList();
    scheduleApply();
}

/** After clear-all: nothing is hidden anymore, rebuild ST's selects. */
export async function restoreAll() {
    await refreshList();
    scheduleApply();
}

// --- Filtering ---------------------------------------------------------------

/** Option text is the book name in every ST world-select; placeholder options
 * ("--- Pick to Edit ---", "--- None ---") never collide with real names. */
function filterSelect(select, hiddenSet) {
    if (!select) return;
    let removed = false;
    for (const opt of [...select.options]) {
        if (opt.selected) continue;            // rule 2: keep selections intact
        if (!opt.value && opt.value !== '0') continue; // placeholders
        if (hiddenSet.has(opt.text)) {
            opt.remove();
            removed = true;
        }
    }
    return removed;
}

function applyFilters() {
    const hiddenSet = new Set(getSettings().hidden);
    filterSelect(document.getElementById('world_editor_select'), hiddenSet);
    filterSelect(document.getElementById('world_info'), hiddenSet);
}

function filterPopupRoot(root, hiddenSet) {
    for (const sel of root.querySelectorAll(
        '.character_world_info_selector, .character_extra_world_info_selector, .chat_world_info_selector')) {
        filterSelect(sel, hiddenSet);
    }
}

// --- Observers ---------------------------------------------------------------

const selectObservers = new Map(); // element -> MutationObserver
let bodyObserver = null;
let pending = false;

export function scheduleApply() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
        pending = false;
        for (const obs of selectObservers.values()) obs.disconnect();
        try {
            applyFilters();
        } catch (err) {
            console.error(LOG, 'applyFilters failed', err);
        } finally {
            Promise.resolve().then(reconnectSelectObservers);
        }
    });
}

function reconnectSelectObservers() {
    for (const [el, obs] of selectObservers) {
        try {
            obs.observe(el, { childList: true });
        } catch { /* element detached */ }
    }
}

function watchSelect(id) {
    const el = document.getElementById(id);
    if (!el || selectObservers.has(el)) return;
    const obs = new MutationObserver(() => scheduleApply());
    obs.observe(el, { childList: true });
    selectObservers.set(el, obs);
}

function watchBody() {
    if (bodyObserver) return;
    bodyObserver = new MutationObserver((mutations) => {
        const hidden = getSettings().hidden;
        if (hidden.length === 0) return;
        const hiddenSet = new Set(hidden);
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;
                try {
                    filterPopupRoot(node, hiddenSet);
                } catch (err) {
                    console.error(LOG, 'popup filter failed', err);
                }
            }
        }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: false });
}

export function initHide() {
    watchSelect('world_editor_select');
    watchSelect('world_info');
    watchBody();
    scheduleApply();
}
