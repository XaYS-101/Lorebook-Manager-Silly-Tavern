// Lazy in-memory index over all books, doubling as the entry-count cache for
// the list view. loadWorldInfo() caches book data in ST's worldInfoCache, so
// re-indexing after invalidation is cheap. Invalidation: WORLDINFO_UPDATED
// (wired in index.js) drops the single affected book.

import { loadBook } from './wi.js';

/** name -> { entries: [...], total, enabled } */
const index = new Map();

export function invalidate(name) {
    index.delete(name);
}

export function invalidateAll() {
    index.clear();
}

/** Entry counts if the book has been indexed, else null. */
export function getBookMeta(name) {
    const rec = index.get(name);
    return rec ? { total: rec.total, enabled: rec.enabled } : null;
}

export function isIndexed(name) {
    return index.has(name);
}

function buildRecord(data) {
    const entries = [];
    let enabled = 0;
    for (const [uid, e] of Object.entries(data?.entries ?? {})) {
        if (!e) continue;
        if (!e.disable) enabled++;
        const keys = Array.isArray(e.key) ? e.key.filter(Boolean).map(String) : [];
        const secondary = Array.isArray(e.keysecondary) ? e.keysecondary.filter(Boolean).map(String) : [];
        const comment = String(e.comment ?? '');
        const content = String(e.content ?? '');
        const keysDisplay = keys.concat(secondary).join(', ');
        entries.push({
            uid,
            disable: !!e.disable,
            constant: !!e.constant,
            title: comment || keys[0] || '',
            keys,
            keysDisplay,
            comment,
            content,
            keysLower: keysDisplay.toLowerCase(),
            commentLower: comment.toLowerCase(),
            contentLower: content.toLowerCase(),
        });
    }
    return { entries, total: entries.length, enabled };
}

/**
 * Index the given books sequentially (skipping ones already indexed).
 * @param {string[]} names
 * @param {{onProgress?: (done: number, total: number) => void, signal?: {cancelled: boolean}}} [opts]
 * @returns {Promise<boolean>} false if cancelled
 */
export async function ensureIndexed(names, opts = {}) {
    const missing = names.filter(n => !index.has(n));
    let done = 0;
    for (const name of missing) {
        if (opts.signal?.cancelled) return false;
        const data = await loadBook(name);
        if (data) index.set(name, buildRecord(data));
        done++;
        opts.onProgress?.(done, missing.length);
    }
    return true;
}

/**
 * Multi-term AND search. Every term must occur somewhere in the entry
 * (keys, title or content); the reported field/snippet comes from the first
 * term's first hit.
 * @returns {Array<{book: string, uid: string, title: string, field: 'key'|'title'|'content', snippet: {before: string, match: string, after: string}}>}
 */
export function search(query, names) {
    const terms = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const results = [];
    for (const name of names) {
        const rec = index.get(name);
        if (!rec) continue;
        for (const entry of rec.entries) {
            const fields = [
                ['key', entry.keysLower, entry.keysDisplay],
                ['title', entry.commentLower, entry.comment],
                ['content', entry.contentLower, entry.content],
            ];
            const matchesAll = terms.every(term => fields.some(([, lower]) => lower.includes(term)));
            if (!matchesAll) continue;
            let hit = { field: 'content', snippet: { before: '', match: '', after: '' } };
            for (const [field, lower, original] of fields) {
                const at = lower.indexOf(terms[0]);
                if (at !== -1) {
                    hit = { field, snippet: makeSnippet(original, terms[0], at) };
                    break;
                }
            }
            results.push({ book: name, uid: entry.uid, title: entry.title, ...hit });
        }
    }
    return results;
}

function makeSnippet(original, term, at) {
    const RADIUS = 40;
    const start = Math.max(0, at - RADIUS);
    const end = Math.min(original.length, at + term.length + RADIUS);
    return {
        before: (start > 0 ? '…' : '') + original.slice(start, at),
        match: original.slice(at, at + term.length),
        after: original.slice(at + term.length, end) + (end < original.length ? '…' : ''),
    };
}
