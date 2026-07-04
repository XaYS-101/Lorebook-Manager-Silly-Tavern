// Settings: single source of truth in extension_settings[MODULE].
// Folder/hide metadata is keyed by book NAME (books have no ids). Metadata for
// books that no longer exist is pruned lazily by noteBookListRendered().

import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';

export const MODULE = 'LorebookManager';

export const DEFAULTS = {
    schemaVersion: 1,
    language: 'ru',
    folders: {},        // id -> { id, name, parentId, color, icon, collapsed, order }
    assign: {},         // bookName -> folderId
    hidden: [],         // [bookName] — explicitly hidden
    hidePatterns: [],   // [mask] — auto-hide any book matching a mask
    hideExceptions: [], // [bookName] — forced visible despite matching a mask
    showHidden: false,
    sortMode: 'alpha',  // 'alpha' | 'manual'
    manualOrder: [],    // book names, manual mode only
    maximized: false,
    confirmBulk: true,
    confirmHide: true,
    searchHidden: false,
};

export function getSettings() {
    if (!extension_settings[MODULE]) extension_settings[MODULE] = structuredClone(DEFAULTS);
    const s = extension_settings[MODULE];
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (s[k] === undefined) s[k] = structuredClone(v);
    }
    return s;
}

export function save() {
    saveSettingsDebounced();
}

let _idCounter = 0;
export function nextFolderId() {
    const s = getSettings();
    let id;
    do {
        id = `f${Object.keys(s.folders).length}_${_idCounter++}`;
    } while (s.folders[id]);
    return id;
}

/** Folder ids of a folder plus all its descendants (cycle-safe). */
export function folderWithDescendants(folderId) {
    const s = getSettings();
    const out = new Set([folderId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const f of Object.values(s.folders)) {
            if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
                out.add(f.id);
                changed = true;
            }
        }
    }
    return out;
}

// --- Lazy pruning of orphaned book metadata -------------------------------
// A book renamed/deleted outside the manager leaves stale keys in assign/
// hidden/manualOrder. Harmless, but we clean them once the live book list has
// been non-empty for 2 consecutive renders (guards against a transiently
// empty world_names during startup or a failed fetch).

let orphanStreak = 0;
let lastOrphans = new Set();

export function noteBookListRendered(liveNames) {
    if (!Array.isArray(liveNames) || liveNames.length === 0) {
        orphanStreak = 0;
        lastOrphans = new Set();
        return;
    }
    const live = new Set(liveNames);
    const s = getSettings();
    const orphans = new Set();
    for (const name of Object.keys(s.assign)) if (!live.has(name)) orphans.add(name);
    for (const name of s.hidden) if (!live.has(name)) orphans.add(name);
    for (const name of s.hideExceptions) if (!live.has(name)) orphans.add(name);
    for (const name of s.manualOrder) if (!live.has(name)) orphans.add(name);

    if (orphans.size === 0) {
        orphanStreak = 0;
        lastOrphans = new Set();
        return;
    }
    const sameAsLast = orphans.size === lastOrphans.size && [...orphans].every(n => lastOrphans.has(n));
    orphanStreak = sameAsLast ? orphanStreak + 1 : 1;
    lastOrphans = orphans;

    if (orphanStreak >= 2) {
        for (const name of orphans) delete s.assign[name];
        s.hidden = s.hidden.filter(n => !orphans.has(n));
        s.hideExceptions = s.hideExceptions.filter(n => !orphans.has(n));
        s.manualOrder = s.manualOrder.filter(n => !orphans.has(n));
        orphanStreak = 0;
        lastOrphans = new Set();
        save();
    }
}

/** Rename migration for our own metadata. */
export function migrateBookName(oldName, newName) {
    const s = getSettings();
    if (Object.prototype.hasOwnProperty.call(s.assign, oldName)) {
        s.assign[newName] = s.assign[oldName];
        delete s.assign[oldName];
    }
    const hi = s.hidden.indexOf(oldName);
    if (hi !== -1) s.hidden[hi] = newName;
    const ei = s.hideExceptions.indexOf(oldName);
    if (ei !== -1) s.hideExceptions[ei] = newName;
    const mi = s.manualOrder.indexOf(oldName);
    if (mi !== -1) s.manualOrder[mi] = newName;
    save();
}

export function forgetBook(name) {
    const s = getSettings();
    delete s.assign[name];
    s.hidden = s.hidden.filter(n => n !== name);
    s.hideExceptions = s.hideExceptions.filter(n => n !== name);
    s.manualOrder = s.manualOrder.filter(n => n !== name);
    save();
}

/**
 * Reset everything to defaults IN PLACE (references captured by listeners
 * must stay valid), preserving the UI language.
 */
export function resetAllData() {
    const s = getSettings();
    const keepLanguage = s.language;
    for (const [k, v] of Object.entries(DEFAULTS)) {
        s[k] = structuredClone(v);
    }
    s.language = keepLanguage;
    save();
}
