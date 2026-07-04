// Extensions-panel drawer: language, open-manager button, behaviour toggles,
// export/import of the extension's own data, and the clear-all danger button.

import { callGenericPopup, POPUP_TYPE, POPUP_RESULT } from '../../../../popup.js';
import { t, localize, getLang } from './i18n.js';
import { escapeHtml, LOG } from './util.js';
import { MODULE, getSettings, save, resetAllData } from './state.js';
import { restoreAll, scheduleApply, getPatterns, setPatterns, countMaskMatches } from './hide.js';
import { listBooks } from './wi.js';
import { invalidateAll } from './search.js';
import { openManager } from './ui-popup.js';

const toast = () => globalThis.toastr;

const PANEL_HTML = `
<div id="lbm_settings" class="lbm-settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Lorebook Manager</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="lbm-set-row">
                <label for="lbm_language" data-lbm-i18n="language"></label>
                <select id="lbm_language" class="text_pole">
                    <option value="auto" data-lbm-i18n="lang_auto"></option>
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                </select>
            </div>
            <div class="lbm-set-row">
                <div id="lbm_open_manager" class="menu_button lbm-open-btn">
                    <i class="fa-solid fa-book-atlas"></i>
                    <span data-lbm-i18n="open_manager"></span>
                </div>
            </div>
            <label class="checkbox_label">
                <input id="lbm_opt_show_hidden" type="checkbox">
                <span data-lbm-i18n="opt_show_hidden"></span>
            </label>
            <label class="checkbox_label">
                <input id="lbm_opt_confirm_bulk" type="checkbox">
                <span data-lbm-i18n="opt_confirm_bulk"></span>
            </label>
            <label class="checkbox_label">
                <input id="lbm_opt_confirm_hide" type="checkbox">
                <span data-lbm-i18n="opt_confirm_hide"></span>
            </label>
            <hr>
            <div class="lbm-set-block">
                <label for="lbm_patterns"><b data-lbm-i18n="auto_hide_title"></b></label>
                <small class="lbm-muted" data-lbm-i18n="auto_hide_help"></small>
                <textarea id="lbm_patterns" class="text_pole lbm-patterns" rows="3" data-lbm-i18n="[placeholder]auto_hide_placeholder"></textarea>
                <div class="lbm-set-row">
                    <div id="lbm_patterns_apply" class="menu_button"><i class="fa-solid fa-check"></i> <span data-lbm-i18n="auto_hide_apply"></span></div>
                    <small class="lbm-muted lbm-patterns-preview"></small>
                </div>
            </div>
            <hr>
            <div class="lbm-set-row">
                <div id="lbm_export" class="menu_button"><i class="fa-solid fa-file-export"></i> <span data-lbm-i18n="export_btn"></span></div>
                <div id="lbm_import" class="menu_button"><i class="fa-solid fa-file-import"></i> <span data-lbm-i18n="import_btn"></span></div>
                <input id="lbm_import_file" type="file" accept=".json" hidden>
            </div>
            <hr>
            <div class="lbm-set-row">
                <div id="lbm_clear_all" class="menu_button lbm-danger"><i class="fa-solid fa-triangle-exclamation"></i> <span data-lbm-i18n="clear_all_btn"></span></div>
            </div>
        </div>
    </div>
</div>`;

function updatePreview(panel, masksOverride) {
    const preview = panel.querySelector('.lbm-patterns-preview');
    if (!preview) return;
    const n = masksOverride
        ? countMaskMatches(listBooks(), masksOverride)
        : countMaskMatches(listBooks());
    preview.textContent = t('auto_hide_preview', { n });
}

function syncControls(panel) {
    const s = getSettings();
    panel.querySelector('#lbm_language').value = s.language;
    panel.querySelector('#lbm_opt_show_hidden').checked = !!s.showHidden;
    panel.querySelector('#lbm_opt_confirm_bulk').checked = !!s.confirmBulk;
    panel.querySelector('#lbm_opt_confirm_hide').checked = !!s.confirmHide;
    panel.querySelector('#lbm_patterns').value = getPatterns().join('\n');
    updatePreview(panel);
}

function exportData() {
    const s = getSettings();
    const payload = {
        _type: 'LorebookManager',
        version: 1,
        folders: s.folders,
        assign: s.assign,
        hidden: s.hidden,
        hidePatterns: s.hidePatterns,
        hideExceptions: s.hideExceptions,
        sortMode: s.sortMode,
        manualOrder: s.manualOrder,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lorebook-manager-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

async function importData(event, panel) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        if (data?._type !== 'LorebookManager' || typeof data.folders !== 'object' || !data.folders) {
            throw new Error('bad payload');
        }
        const s = getSettings();
        s.folders = data.folders ?? {};
        s.assign = typeof data.assign === 'object' && data.assign ? data.assign : {};
        s.hidden = Array.isArray(data.hidden) ? data.hidden.map(String) : [];
        s.hidePatterns = Array.isArray(data.hidePatterns) ? data.hidePatterns.map(String) : [];
        s.hideExceptions = Array.isArray(data.hideExceptions) ? data.hideExceptions.map(String) : [];
        s.sortMode = data.sortMode === 'manual' ? 'manual' : 'alpha';
        s.manualOrder = Array.isArray(data.manualOrder) ? data.manualOrder.map(String) : [];
        save();
        invalidateAll();
        await restoreAll();          // rebuild ST's selects, then re-filter
        syncControls(panel);
        toast()?.success(t('import_ok'));
    } catch (err) {
        console.error(LOG, 'import failed', err);
        toast()?.error(t('import_bad'));
    }
}

async function clearAll(panel) {
    const ok = await callGenericPopup(t('confirm_clear_all'), POPUP_TYPE.CONFIRM ?? 2);
    if (ok !== (POPUP_RESULT?.AFFIRMATIVE ?? 1)) return;
    resetAllData();
    invalidateAll();
    await restoreAll();          // bring hidden books back into ST's selects
    syncControls(panel);
    localize(panel);
    toast()?.success(t('clear_done'));
}

export function mountSettingsPanel() {
    const host = document.getElementById('extensions_settings2')
        ?? document.getElementById('extensions_settings')
        ?? document.body;
    const wrap = document.createElement('div');
    wrap.innerHTML = PANEL_HTML;
    const panel = wrap.firstElementChild;
    localize(panel);
    syncControls(panel);
    host.appendChild(panel);

    panel.querySelector('#lbm_language').addEventListener('change', (e) => {
        const s = getSettings();
        s.language = ['en', 'ru', 'auto'].includes(e.target.value) ? e.target.value : 'ru';
        save();
        localize(panel);
    });
    panel.querySelector('#lbm_open_manager').addEventListener('click', () => openManager());
    panel.querySelector('#lbm_opt_show_hidden').addEventListener('change', (e) => {
        getSettings().showHidden = !!e.target.checked;
        save();
    });
    panel.querySelector('#lbm_opt_confirm_bulk').addEventListener('change', (e) => {
        getSettings().confirmBulk = !!e.target.checked;
        save();
    });
    panel.querySelector('#lbm_opt_confirm_hide').addEventListener('change', (e) => {
        getSettings().confirmHide = !!e.target.checked;
        save();
    });
    const patternsBox = panel.querySelector('#lbm_patterns');
    const applyPatterns = async () => {
        // blur + Apply-click both fire; skip if nothing actually changed.
        if (patternsBox.value.trim() === getPatterns().join('\n')) return;
        await setPatterns(patternsBox.value);
        syncControls(panel);
        toast()?.success(t('auto_hide_applied'));
    };
    // Live preview while typing (against the un-applied text); commit on Apply or blur.
    patternsBox.addEventListener('input', () => {
        const masks = patternsBox.value.split('\n').map(l => l.trim()).filter(Boolean);
        updatePreview(panel, masks);
    });
    patternsBox.addEventListener('blur', applyPatterns);
    panel.querySelector('#lbm_patterns_apply').addEventListener('click', applyPatterns);

    panel.querySelector('#lbm_export').addEventListener('click', exportData);
    panel.querySelector('#lbm_import').addEventListener('click', () => panel.querySelector('#lbm_import_file').click());
    panel.querySelector('#lbm_import_file').addEventListener('change', (e) => importData(e, panel));
    panel.querySelector('#lbm_clear_all').addEventListener('click', () => clearAll(panel));
}
