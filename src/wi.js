// Tolerant wrapper around ST's world-info.js. Namespace import: a missing
// export becomes `undefined` instead of breaking the whole module, so the
// extension degrades per-feature across ST versions instead of dying.
// All book writes are serialized through withLock() (util.js).

import * as WI from '../../../../world-info.js';
import { LOG, withLock } from './util.js';
import { migrateBookName, forgetBook } from './state.js';
import { snapshotBindings, restoreBindings } from './bindings.js';

export const METADATA_KEY = WI.METADATA_KEY ?? 'world_info';

/** Core APIs without which the manager cannot work at all. */
export function available() {
    return typeof WI.loadWorldInfo === 'function'
        && typeof WI.saveWorldInfo === 'function'
        && Array.isArray(WI.world_names);
}

export function listBooks() {
    return Array.isArray(WI.world_names) ? [...WI.world_names] : [];
}

export function bookIndex(name) {
    return Array.isArray(WI.world_names) ? WI.world_names.indexOf(name) : -1;
}

export function isGlobalActive(name) {
    return Array.isArray(WI.selected_world_info) && WI.selected_world_info.includes(name);
}

export function globalActiveBooks() {
    return Array.isArray(WI.selected_world_info) ? [...WI.selected_world_info] : [];
}

export async function setGlobalActive(name, on) {
    if (typeof WI.onWorldInfoChange === 'function') {
        await WI.onWorldInfoChange({ state: on ? 'on' : 'off', silent: true }, name);
        return;
    }
    // Fallback: drive the #world_info multiselect directly.
    const idx = bookIndex(name);
    if (idx === -1) return;
    const sel = document.getElementById('world_info');
    const opt = sel?.querySelector(`option[value="${idx}"]`);
    if (!opt) return;
    opt.selected = on;
    globalThis.jQuery?.(sel).trigger('change');
}

export async function toggleGlobal(name) {
    await setGlobalActive(name, !isGlobalActive(name));
}

// --- internal-write window (suppresses our own UI rerender loops) ---------

let internalDepth = 0;
export function isInternalWrite() {
    return internalDepth > 0;
}

async function internally(fn) {
    internalDepth++;
    try {
        return await fn();
    } finally {
        // WORLDINFO_UPDATED is emitted inside the awaited save, but leave a
        // small grace window for any queued microtask listeners.
        setTimeout(() => { internalDepth = Math.max(0, internalDepth - 1); }, 100);
    }
}

// --- CRUD ------------------------------------------------------------------

export async function loadBook(name) {
    try {
        return await WI.loadWorldInfo(name);
    } catch (err) {
        console.error(LOG, 'loadBook failed', name, err);
        return null;
    }
}

export async function saveBook(name, data) {
    return withLock(() => internally(() => WI.saveWorldInfo(name, data, true)));
}

export async function refreshList() {
    try {
        await WI.updateWorldInfoList?.();
    } catch (err) {
        console.error(LOG, 'updateWorldInfoList failed', err);
    }
}

export function uniqueBookName(base) {
    const names = new Set(listBooks());
    const clean = String(base ?? '').trim() || 'New lorebook';
    if (!names.has(clean)) return clean;
    for (let i = 2; i < 10000; i++) {
        const candidate = `${clean} #${i}`;
        if (!names.has(candidate)) return candidate;
    }
    return `${clean} #`; // unreachable in practice
}

export async function createBook(name) {
    return withLock(() => internally(async () => {
        if (typeof WI.createNewWorldInfo === 'function') {
            await WI.createNewWorldInfo(name, { interactive: false });
        } else {
            await WI.saveWorldInfo(name, { entries: {} }, true);
            await WI.updateWorldInfoList?.();
        }
    }));
}

export async function deleteBook(name) {
    return withLock(() => internally(async () => {
        await WI.deleteWorldInfo?.(name);
        forgetBook(name);
    }));
}

/** @returns the new book's name */
export async function duplicateBook(name) {
    const data = await loadBook(name);
    if (!data) throw new Error(`Book "${name}" could not be loaded`);
    const newName = uniqueBookName(name);
    await withLock(() => internally(async () => {
        await WI.saveWorldInfo(newName, structuredClone(data), true);
        await WI.updateWorldInfoList?.();
    }));
    return newName;
}

/**
 * Rename a book. ST's own renameWorldInfo is not exported (and is
 * interactive), so we replicate it: save-new -> delete-old -> restore every
 * binding onto the new name -> migrate our own metadata.
 * Caveat (same as ST's native rename): primary links of characters other
 * than the current one cannot be relinked programmatically — the UI warns
 * about those beforehand.
 */
export async function renameBook(oldName, newName) {
    const data = await loadBook(oldName);
    if (!data) throw new Error(`Book "${oldName}" could not be loaded`);
    const snapshot = snapshotBindings(oldName);
    await withLock(() => internally(async () => {
        await WI.saveWorldInfo(newName, structuredClone(data), true);
        await WI.deleteWorldInfo?.(oldName);
        await restoreBindings(newName, snapshot);
        migrateBookName(oldName, newName);
        await WI.updateWorldInfoList?.();
    }));
}

/**
 * Open a book in ST's native editor. Hidden books have no option in
 * #world_editor_select, so those go through showWorldEditor() directly.
 */
export async function openEditor(name) {
    const drawer = document.getElementById('WorldInfo');
    if (drawer && drawer.offsetParent === null) {
        globalThis.jQuery?.('#WIDrawerIcon').trigger('click');
    }
    const idx = bookIndex(name);
    const opt = document.querySelector(`#world_editor_select option[value="${idx}"]`);
    if (opt && idx !== -1) {
        globalThis.jQuery?.('#world_editor_select').val(String(idx)).trigger('change');
    } else if (typeof WI.showWorldEditor === 'function') {
        await WI.showWorldEditor(name);
    }
}

/** Name of the book currently open in ST's editor, or null. */
export function editorCurrentBook() {
    const sel = document.getElementById('world_editor_select');
    const idx = Number(sel?.value);
    if (!Number.isInteger(idx) || idx < 0) return null;
    return listBooks()[idx] ?? null;
}

/** Reload ST's editor if the given book is open there. */
export function reloadEditorIfOpen(name) {
    try {
        if (editorCurrentBook() === name) WI.reloadEditor?.(name, false);
    } catch (err) {
        console.error(LOG, 'reloadEditor failed', err);
    }
}

/**
 * Open ST's editor on a book and surface one entry. The entries list is
 * paginated, so instead of scrolling we feed ST's own search box a fragment
 * that matches the entry, then flash the row if it rendered.
 */
export async function focusEntryInEditor(name, entry) {
    await openEditor(name);
    const fragment = String(entry?.title || entry?.keys?.[0] || '').slice(0, 60);
    setTimeout(() => {
        try {
            const box = document.getElementById('world_info_search');
            if (box && fragment) {
                box.value = fragment;
                globalThis.jQuery?.(box).trigger('input');
            }
            setTimeout(() => {
                const row = document.querySelector(`#world_popup_entries_list .world_entry[uid="${CSS.escape(String(entry?.uid ?? ''))}"]`);
                row?.scrollIntoView({ block: 'center' });
                row?.classList.add('flash', 'animated');
                setTimeout(() => row?.classList.remove('flash', 'animated'), 2000);
            }, 350);
        } catch (err) {
            console.error(LOG, 'focusEntryInEditor failed', err);
        }
    }, 250);
}

export function countEntries(data) {
    const entries = Object.values(data?.entries ?? {});
    const enabled = entries.filter(e => !e.disable).length;
    return { total: entries.length, enabled };
}
