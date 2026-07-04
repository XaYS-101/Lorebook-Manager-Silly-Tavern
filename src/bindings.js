// Where is a book used? Global set / character primary / character aux
// (charLore) / current chat / persona — plus mutations for the quick-bind UI
// and the snapshot/restore pair that makes rename keep every binding.
// One-way dependency: this module talks to ST directly and knows nothing
// about wi.js or the UI.

import { characters, this_chid, saveSettingsDebounced } from '../../../../../script.js';
import { getContext } from '../../../../extensions.js';
import * as WI from '../../../../world-info.js';
import * as PU from '../../../../power-user.js';
import * as PS from '../../../../personas.js';
import * as U from '../../../../utils.js';
import { LOG } from './util.js';

const METADATA_KEY = WI.METADATA_KEY ?? 'world_info';

function charFileName(character) {
    return String(character?.avatar ?? '').replace(/\.[^.]+$/, '');
}

function currentCharFileName() {
    try {
        return U.getCharaFilename?.(null, {}) ?? null;
    } catch {
        return null;
    }
}

function displayNameByFile(fileName) {
    const found = (characters ?? []).find(c => charFileName(c) === fileName);
    return found?.name ?? fileName;
}

export function chatBoundBook() {
    try {
        return getContext()?.chatMetadata?.[METADATA_KEY] || null;
    } catch {
        return null;
    }
}

/**
 * @returns {{global: boolean, chat: boolean, persona: boolean,
 *   primaryChars: string[], auxChars: string[],
 *   primaryCurrent: boolean, auxCurrent: boolean, any: boolean}}
 */
export function getBindings(name) {
    const global = Array.isArray(WI.selected_world_info) && WI.selected_world_info.includes(name);
    const chat = chatBoundBook() === name;
    const persona = PU.power_user?.persona_description_lorebook === name;

    // Shallow character list entries may lack data.extensions — best effort.
    const primaryChars = (characters ?? [])
        .filter(c => c?.data?.extensions?.world === name)
        .map(c => c.name);

    const charLore = Array.isArray(WI.world_info?.charLore) ? WI.world_info.charLore : [];
    const auxOwners = charLore.filter(e => Array.isArray(e?.extraBooks) && e.extraBooks.includes(name));
    const auxChars = auxOwners.map(e => displayNameByFile(e.name));

    const currentFile = currentCharFileName();
    const currentName = characters?.[this_chid]?.name ?? null;
    const primaryCurrent = this_chid !== undefined && characters?.[this_chid]?.data?.extensions?.world === name;
    const auxCurrent = !!currentFile && auxOwners.some(e => e.name === currentFile);
    const primaryOthers = primaryCurrent ? primaryChars.filter(n => n !== currentName) : [...primaryChars];

    return {
        global, chat, persona, primaryChars, auxChars, primaryCurrent, auxCurrent, primaryOthers,
        any: global || chat || persona || primaryChars.length > 0 || auxChars.length > 0,
    };
}

export function hasCurrentChat() {
    try {
        return !!getContext()?.chatId;
    } catch {
        return false;
    }
}

export function hasCurrentCharacter() {
    return this_chid !== undefined && this_chid !== null && !!characters?.[this_chid];
}

// --- Mutations ---------------------------------------------------------------

export async function bindChat(name) {
    const ctx = getContext();
    if (!ctx?.chatMetadata) return;
    if (name) ctx.chatMetadata[METADATA_KEY] = name;
    else delete ctx.chatMetadata[METADATA_KEY];
    await ctx.saveMetadata?.();
}

/** Set (or clear with '') the primary book of the CURRENT character. */
export async function setCurrentCharPrimary(name) {
    if (typeof WI.charUpdatePrimaryWorld !== 'function') throw new Error('charUpdatePrimaryWorld unavailable');
    await WI.charUpdatePrimaryWorld(name || '');
}

export async function setCurrentCharAux(name, on) {
    const fileName = currentCharFileName();
    if (!fileName || typeof WI.charSetAuxWorlds !== 'function') throw new Error('aux binding unavailable');
    const charLore = Array.isArray(WI.world_info?.charLore) ? WI.world_info.charLore : [];
    const entry = charLore.find(e => e?.name === fileName);
    const books = new Set(entry?.extraBooks ?? []);
    if (on) books.add(name);
    else books.delete(name);
    WI.charSetAuxWorlds(fileName, [...books]);
}

// --- Rename support ----------------------------------------------------------

/** Capture everything pointing at `name` BEFORE the old book is deleted. */
export function snapshotBindings(name) {
    const charLore = Array.isArray(WI.world_info?.charLore) ? WI.world_info.charLore : [];
    return {
        name,
        global: Array.isArray(WI.selected_world_info) && WI.selected_world_info.includes(name),
        chat: chatBoundBook() === name,
        persona: PU.power_user?.persona_description_lorebook === name,
        primaryCurrent: this_chid !== undefined && characters?.[this_chid]?.data?.extensions?.world === name,
        auxOwners: charLore
            .filter(e => Array.isArray(e?.extraBooks) && e.extraBooks.includes(name))
            .map(e => ({ fileName: e.name, extraBooks: [...e.extraBooks] })),
    };
}

/** Re-point a snapshot at the renamed book. deleteWorldInfo() has already
 * stripped the global/persona/current-primary links; charLore it leaves as-is. */
export async function restoreBindings(newName, snap) {
    try {
        if (snap.global && typeof WI.onWorldInfoChange === 'function') {
            await WI.onWorldInfoChange({ state: 'on', silent: true }, newName);
        }
        if (snap.chat) {
            await bindChat(newName);
        }
        if (snap.persona && PU.power_user) {
            PU.power_user.persona_description_lorebook = newName;
            const descriptor = PU.power_user.persona_descriptions?.[PS.user_avatar];
            if (descriptor) descriptor.lorebook = newName;
            globalThis.jQuery?.('#persona_lore_button').toggleClass('world_set', true);
            saveSettingsDebounced();
        }
        if (snap.primaryCurrent && typeof WI.charUpdatePrimaryWorld === 'function') {
            await WI.charUpdatePrimaryWorld(newName);
        }
        for (const owner of snap.auxOwners) {
            if (typeof WI.charSetAuxWorlds !== 'function') break;
            const books = owner.extraBooks.map(b => (b === snap.name ? newName : b));
            WI.charSetAuxWorlds(owner.fileName, books);
        }
    } catch (err) {
        console.error(LOG, 'restoreBindings failed', err);
    }
}
