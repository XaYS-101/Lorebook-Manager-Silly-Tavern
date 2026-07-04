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

// --- Mask compilation --------------------------------------------------------
// A mask with * or ? is a full-name glob; a mask without wildcards is a
// case-insensitive substring match. Compiled regexes are cached and rebuilt
// whenever the pattern list changes.

let compiledFor = null;   // reference-identity check against the patterns array
let compiled = [];

function compileMask(mask) {
    const raw = String(mask ?? '').trim();
    if (!raw) return null;
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape ALL regex meta
    const hasWildcard = /[*?]/.test(raw);
    // Re-enable our two wildcards on the escaped string (\* and \? came from escaping).
    const body = escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
    try {
        return new RegExp(hasWildcard ? `^${body}$` : body, 'i');
    } catch (err) {
        console.error(LOG, 'bad mask', mask, err);
        return null;
    }
}

function ensureCompiled() {
    const patterns = getSettings().hidePatterns;
    if (compiledFor === patterns) return compiled;
    compiled = patterns.map(compileMask).filter(Boolean);
    compiledFor = patterns;
    return compiled;
}

/** Force recompilation on the next check (call after replacing the array). */
function resetMaskCache() {
    compiledFor = null;
}

function matchesPattern(name) {
    return ensureCompiled().some(re => re.test(name));
}

// --- Hidden-state model ------------------------------------------------------

/** Manual "show" always wins over a mask. */
export function isHidden(name) {
    const s = getSettings();
    if (s.hideExceptions.includes(name)) return false;
    return s.hidden.includes(name) || matchesPattern(name);
}

/** Why a book is hidden — used by the manager to explain the "Show" action. */
export function isHiddenByRule(name) {
    const s = getSettings();
    return !s.hidden.includes(name) && !s.hideExceptions.includes(name) && matchesPattern(name);
}

/** How many of the given books match any mask (ignores exceptions; this is the
 * "does my mask work" preview). Pass `masks` to test un-applied textarea text;
 * omit it to test the saved masks. */
export function countMaskMatches(names, masks) {
    const regexes = masks
        ? masks.map(compileMask).filter(Boolean)
        : ensureCompiled();
    return (names ?? []).filter(n => regexes.some(re => re.test(n))).length;
}

/** Explicitly hide a book. Confirmation/deactivation is the caller's job. */
export function hideBook(name) {
    const s = getSettings();
    s.hideExceptions = s.hideExceptions.filter(n => n !== name);
    if (!s.hidden.includes(name)) s.hidden.push(name);
    save();
    scheduleApply();
}

/** Show a book again. If it still matches a mask, record an exception so the
 * mask doesn't immediately re-hide it. */
export async function unhideBook(name) {
    const s = getSettings();
    s.hidden = s.hidden.filter(n => n !== name);
    if (matchesPattern(name) && !s.hideExceptions.includes(name)) {
        s.hideExceptions.push(name);
    }
    save();
    // updateWorldInfoList() rebuilds the full option sets; our observers then
    // re-filter whatever is still hidden.
    await refreshList();
    scheduleApply();
}

// --- Auto-hide masks ---------------------------------------------------------

export function getPatterns() {
    return [...getSettings().hidePatterns];
}

/** Replace the mask list from raw textarea text or an array (one mask each).
 * Prunes exceptions that no longer match any mask, then re-applies filters. */
export async function setPatterns(input) {
    const lines = Array.isArray(input) ? input : String(input ?? '').split('\n');
    const seen = new Set();
    const masks = [];
    for (const line of lines) {
        const mask = String(line).trim();
        if (mask && !seen.has(mask)) {
            seen.add(mask);
            masks.push(mask);
        }
    }
    const s = getSettings();
    s.hidePatterns = masks;
    resetMaskCache();
    // Drop exceptions that no longer shield against any mask (keeps state tidy).
    s.hideExceptions = s.hideExceptions.filter(n => matchesPattern(n));
    save();
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
function filterSelect(select) {
    if (!select) return;
    let removed = false;
    for (const opt of [...select.options]) {
        if (opt.selected) continue;            // rule 2: keep selections intact
        if (!opt.value && opt.value !== '0') continue; // placeholders
        if (isHidden(opt.text)) {
            opt.remove();
            removed = true;
        }
    }
    return removed;
}

function applyFilters() {
    filterSelect(document.getElementById('world_editor_select'));
    filterSelect(document.getElementById('world_info'));
}

function filterPopupRoot(root) {
    for (const sel of root.querySelectorAll(
        '.character_world_info_selector, .character_extra_world_info_selector, .chat_world_info_selector')) {
        filterSelect(sel);
    }
}

/** True if any book is hidden by explicit list or by mask. */
function anythingHidden() {
    const s = getSettings();
    return s.hidden.length > 0 || s.hidePatterns.length > 0;
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
        if (!anythingHidden()) return;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;
                try {
                    filterPopupRoot(node);
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
