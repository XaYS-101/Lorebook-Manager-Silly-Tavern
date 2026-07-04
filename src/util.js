// Small shared helpers. Leaf module — imports nothing from the extension.

export const LOG = '[LBM]';

/** Escape a string for safe interpolation into HTML. Book names, folder names,
 * entry titles and snippets all come from downloaded cards — treat as hostile. */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Trailing-edge debounce. */
export function debounce(fn, ms) {
    let timer = null;
    const wrapped = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { timer = null; fn(...args); }, ms);
    };
    wrapped.cancel = () => { clearTimeout(timer); timer = null; };
    return wrapped;
}

/** Serializing mutex: all lorebook writes go through one promise chain so
 * bulk ops, rename and duplicate never interleave. */
let chain = Promise.resolve();
export function withLock(fn) {
    const run = () => Promise.resolve().then(fn);
    const next = chain.then(run, run);
    // Keep the chain alive even if fn rejects; callers still see the rejection.
    chain = next.catch(() => {});
    return next;
}

/** Await-able pause. */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
