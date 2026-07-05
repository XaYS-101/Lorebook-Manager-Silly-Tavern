// Lorebook Manager — entry point.
// Client-only extension: a manager popup for World Info books (folders,
// hide-without-delete, cross-book search, bulk entry ops, binding overview).

import { eventSource, event_types } from '../../../../script.js';
import { LOG } from './src/util.js';
import { t } from './src/i18n.js';
import { getSettings } from './src/state.js';
import { available } from './src/wi.js';
import { initHide, scheduleApply } from './src/hide.js';
import { invalidate } from './src/search.js';
import { mountSettingsPanel } from './src/settings-panel.js';
import { openManager } from './src/ui-popup.js';

function addDrawerButton() {
    if (document.getElementById('lbm_drawer_button')) return;
    const anchor = document.getElementById('world_popup_delete');
    if (!anchor?.parentElement) return;
    const btn = document.createElement('div');
    btn.id = 'lbm_drawer_button';
    btn.className = 'menu_button fa-solid fa-book-atlas';
    btn.title = t('drawer_button_title');
    btn.addEventListener('click', () => openManager());
    anchor.parentElement.appendChild(btn);
}

async function addSlashCommand() {
    try {
        const { SlashCommandParser } = await import('../../../slash-commands/SlashCommandParser.js');
        const { SlashCommand } = await import('../../../slash-commands/SlashCommand.js');
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'lorebooks',
            helpString: t('slash_help'),
            callback: () => {
                openManager();
                return '';
            },
        }));
    } catch (err) {
        console.debug(LOG, 'slash command registration skipped', err);
    }
}

function init() {
    try {
        getSettings();
        mountSettingsPanel();

        if (!available()) {
            console.error(LOG, 'required world-info APIs are missing');
            globalThis.toastr?.warning(t('st_incompatible'));
            return;
        }

        initHide();
        addDrawerButton();
        addSlashCommand();

        if (event_types?.WORLDINFO_UPDATED) {
            eventSource.on(event_types.WORLDINFO_UPDATED, (name) => {
                // Keep the search index fresh no matter who saved the book.
                if (typeof name === 'string') invalidate(name);
            });
        }
        if (event_types?.WORLDINFO_SETTINGS_UPDATED) {
            // Backstop: re-filter hidden books after ST rebuilds its selects.
            eventSource.on(event_types.WORLDINFO_SETTINGS_UPDATED, () => scheduleApply());
        }

        console.log(LOG, 'initialized');
    } catch (err) {
        console.error(LOG, 'init failed', err);
    }
}

jQuery(async () => {
    let started = false;
    const start = () => {
        if (started) return;
        started = true;
        init();
    };
    if (event_types?.APP_READY) {
        eventSource.on(event_types.APP_READY, start);
        // Fallback in case APP_READY already fired or never comes.
        setTimeout(start, 1500);
    } else {
        setTimeout(start, 800);
    }
});
