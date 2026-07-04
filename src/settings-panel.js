// Extensions-panel drawer: language, open-manager button, behaviour toggles,
// export/import of the extension's own data, and the clear-all danger button.

import { callGenericPopup, POPUP_TYPE, POPUP_RESULT } from '../../../../popup.js';
import { t, localize, getLang } from './i18n.js';
import { escapeHtml, LOG } from './util.js';
import { MODULE, getSettings, save, resetAllData } from './state.js';
import { restoreAll, scheduleApply } from './hide.js';
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

function syncControls(panel) {
    const s = getSettings();
    panel.querySelector('#lbm_language').value = s.language;
    panel.querySelector('#lbm_opt_show_hidden').checked = !!s.showHidden;
    panel.querySelector('#lbm_opt_confirm_bulk').checked = !!s.confirmBulk;
}

function exportData() {
    const s = getSettings();
    const payload = {
        _type: 'LorebookManager',
        version: 1,
        folders: s.folders,
        assign: s.assign,
        hidden: s.hidden,
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
        s.sortMode = data.sortMode === 'manual' ? 'manual' : 'alpha';
        s.manualOrder = Array.isArray(data.manualOrder) ? data.manualOrder.map(String) : [];
        save();
        invalidateAll();
        scheduleApply();
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
    panel.querySelector('#lbm_export').addEventListener('click', exportData);
    panel.querySelector('#lbm_import').addEventListener('click', () => panel.querySelector('#lbm_import_file').click());
    panel.querySelector('#lbm_import_file').addEventListener('change', (e) => importData(e, panel));
    panel.querySelector('#lbm_clear_all').addEventListener('click', () => clearAll(panel));
}
