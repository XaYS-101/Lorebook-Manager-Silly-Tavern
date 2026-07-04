// Self-contained EN/RU i18n. Leaf module — reads settings directly off
// extension_settings to avoid a circular import with state.js.
// Uses the custom attribute data-lbm-i18n so ST's own data-i18n observer
// never touches our nodes.

import { extension_settings } from '../../../../extensions.js';

const MODULE = 'LorebookManager';

export const I18N = {
    en: {
        ext_name: 'Lorebook Manager',
        open_manager: 'Open manager',
        wand_button: 'Lorebook Manager',
        drawer_button_title: 'Open Lorebook Manager',
        close: 'Close',
        back: 'Back',
        cancel: 'Cancel',
        ok: 'OK',
        create: 'Create',
        apply: 'Apply',
        loading: 'Loading…',
        books_count: '${n} books',
        st_incompatible: 'Lorebook Manager: this SillyTavern version is missing required World Info APIs. Some features are disabled.',

        // Books view
        new_book: 'New book',
        new_folder: 'New folder',
        show_hidden: 'Show hidden',
        hidden_section: 'Hidden',
        hidden_by_rule: 'Hidden by an auto-hide mask. "Show" keeps it visible as an exception.',
        no_folder: 'Unfiled',
        empty_list: 'No lorebooks yet. Create one with "New book".',
        toggle_global_title: 'Toggle global activation',
        active_hidden_badge: 'Active but hidden',
        entries_short: 'entries',
        collapse_all: 'Collapse all',
        expand_all: 'Expand all',

        // Book actions
        act_open_editor: 'Open in ST editor',
        act_open_manager: 'Open entries',
        act_rename: 'Rename',
        act_duplicate: 'Duplicate',
        act_hide: 'Hide',
        act_unhide: 'Unhide',
        act_move: 'Move to folder…',
        act_bindings: 'Bindings…',
        act_delete: 'Delete',
        actions_title: 'Book actions',

        // Folder dialog
        folder_new_title: 'New folder',
        folder_edit_title: 'Edit folder',
        folder_name: 'Name',
        folder_parent: 'Parent folder',
        folder_root: '— root —',
        folder_color: 'Color',
        folder_icon: 'Icon (emoji)',
        folder_name_required: 'Folder name is required',
        folder_delete: 'Delete folder',
        confirm_delete_folder: 'Delete this folder? Books inside it are NOT deleted — they just become unfiled. Subfolders move to the parent.',
        folder_edit_title_btn: 'Edit folder',

        // Move picker
        move_title: 'Move to folder',
        move_none: '— no folder —',

        // New book / rename
        new_book_title: 'New lorebook',
        new_book_name: 'Book name',
        rename_title: 'Rename book',
        rename_new_name: 'New name',
        name_required: 'Name cannot be empty',
        name_exists: 'A book with this name already exists',
        rename_affects_primary: 'Warning: this book is the primary lorebook of other characters (${chars}). SillyTavern cannot relink those automatically — you will need to re-select the book on their cards.',
        confirm_delete_book: 'Delete lorebook "${name}"? The file will be permanently deleted. This cannot be undone. If you only want it out of the way, use "Hide" instead.',

        // Hide flow
        confirm_hide_book: 'Hide lorebook "${name}"? It disappears from SillyTavern\'s selectors but the file stays untouched. You can unhide it here anytime.',
        hide_bound_note: 'This book is currently used: ${bindings}. Hiding does not unbind it.',
        hide_also_deactivate: 'Also deactivate globally',
        hide_dont_ask: 'Don\'t show this confirmation again',
        opt_confirm_hide: 'Confirm before hiding a book',
        toast_hidden: 'Book hidden',
        toast_unhidden: 'Book is visible again',

        // Book view (entries)
        sel_mode: 'Select',
        sel_exit: 'Done',
        selected_n: 'Selected: ${n}',
        bulk_enable: 'Enable',
        bulk_disable: 'Disable',
        bulk_delete: 'Delete',
        confirm_bulk_delete: 'Delete ${n} entries from "${name}"? This cannot be undone.',
        confirm_bulk_toggle: 'Apply to ${n} entries?',
        enable_all: 'Enable all',
        disable_all: 'Disable all',
        confirm_enable_all: 'Enable ALL ${n} entries of "${name}"?',
        confirm_disable_all: 'Disable ALL ${n} entries of "${name}"?',
        show_more: 'Show more (${n} left)',
        no_entries: 'This book has no entries.',
        entries_stat: '${enabled} of ${total} entries enabled',
        entry_constant_title: 'Constant (always active)',
        entry_enabled_title: 'Enabled',
        entry_disabled_title: 'Disabled',
        untitled_entry: '(untitled)',
        toast_bulk_done: 'Done: ${n} entries updated',
        toast_bulk_deleted: 'Deleted ${n} entries',

        // Search
        search_placeholder: 'Search all books…',
        search_indexing: 'Indexing books: ${done}/${total}…',
        search_cancel: 'Cancel',
        search_cancelled: 'Indexing cancelled',
        search_no_results: 'Nothing found',
        search_results: '${n} matches in ${m} books',
        search_include_hidden: 'Search hidden books',
        search_min_chars: 'Type at least 2 characters',
        field_key: 'key',
        field_title: 'title',
        field_content: 'content',

        // Bindings
        bind_title: 'Bindings: ${name}',
        bind_global: 'Active globally',
        bind_chat: 'Bound to current chat',
        bind_chat_none: 'No chat open',
        bind_char_primary: 'Primary for current character',
        bind_char_aux: 'Additional for current character',
        bind_char_none: 'No character open',
        bind_persona: 'Persona lorebook',
        bind_set_primary_confirm: 'Set "${name}" as the primary lorebook of the current character? The previous primary link (if any) will be replaced.',
        badge_global: 'Active globally',
        badge_chat: 'Bound to a chat',
        badge_primary: 'Primary of ${chars}',
        badge_aux: 'Additional of ${chars}',
        badge_persona: 'Persona lorebook',
        used_by: 'used by',

        // Settings panel
        language: 'Language',
        lang_auto: 'Auto',
        opt_show_hidden: 'Show the "Hidden" section in the manager',
        opt_confirm_bulk: 'Confirm bulk operations',
        auto_hide_title: 'Auto-hide by name',
        auto_hide_help: 'One mask per line. Use * and ? as wildcards (chat_* hides names starting with chat_); a plain word matches any name containing it (case-insensitive). Manually showing a book overrides its mask.',
        auto_hide_placeholder: 'chat_*\ntemp *\nдневник',
        auto_hide_preview: 'Masks match ${n} books',
        auto_hide_apply: 'Apply masks',
        auto_hide_applied: 'Auto-hide masks applied',
        export_btn: 'Export data',
        import_btn: 'Import data',
        import_ok: 'Data imported',
        import_bad: 'Import failed: not a Lorebook Manager export',
        clear_all_btn: 'Clear all data…',
        confirm_clear_all: 'Delete ALL Lorebook Manager data (folders, book assignments, hidden list, settings)? Your lorebooks themselves are NOT touched — hidden books will simply reappear in SillyTavern. This cannot be undone. Export your data first if unsure.',
        clear_done: 'Lorebook Manager data cleared',

        // Misc toasts
        toast_book_created: 'Book "${name}" created',
        toast_book_deleted: 'Book deleted',
        toast_book_renamed: 'Book renamed',
        toast_book_duplicated: 'Duplicated as "${name}"',
        toast_error: 'Lorebook Manager: operation failed, see console',
        slash_help: 'Open the Lorebook Manager panel',
        maximize_title: 'Maximize / restore',
    },
    ru: {
        ext_name: 'Менеджер лорбуков',
        open_manager: 'Открыть менеджер',
        wand_button: 'Менеджер лорбуков',
        drawer_button_title: 'Открыть менеджер лорбуков',
        close: 'Закрыть',
        back: 'Назад',
        cancel: 'Отмена',
        ok: 'ОК',
        create: 'Создать',
        apply: 'Применить',
        loading: 'Загрузка…',
        books_count: 'Книг: ${n}',
        st_incompatible: 'Менеджер лорбуков: в этой версии SillyTavern нет нужных API World Info. Часть функций отключена.',

        new_book: 'Новая книга',
        new_folder: 'Новая папка',
        show_hidden: 'Показать скрытые',
        hidden_section: 'Скрытые',
        hidden_by_rule: 'Скрыто маской авто-скрытия. «Показать» оставит книгу видимой как исключение.',
        no_folder: 'Без папки',
        empty_list: 'Лорбуков пока нет. Создайте первый кнопкой «Новая книга».',
        toggle_global_title: 'Вкл/выкл глобальную активацию',
        active_hidden_badge: 'Активна, но скрыта',
        entries_short: 'записей',
        collapse_all: 'Свернуть все',
        expand_all: 'Развернуть все',

        act_open_editor: 'Открыть в редакторе ST',
        act_open_manager: 'Открыть записи',
        act_rename: 'Переименовать',
        act_duplicate: 'Дублировать',
        act_hide: 'Скрыть',
        act_unhide: 'Показать',
        act_move: 'В папку…',
        act_bindings: 'Привязки…',
        act_delete: 'Удалить',
        actions_title: 'Действия с книгой',

        folder_new_title: 'Новая папка',
        folder_edit_title: 'Изменить папку',
        folder_name: 'Название',
        folder_parent: 'Родительская папка',
        folder_root: '— корень —',
        folder_color: 'Цвет',
        folder_icon: 'Иконка (эмодзи)',
        folder_name_required: 'Укажите название папки',
        folder_delete: 'Удалить папку',
        confirm_delete_folder: 'Удалить эту папку? Книги внутри НЕ удаляются — они просто останутся без папки. Вложенные папки переедут к родителю.',
        folder_edit_title_btn: 'Изменить папку',

        move_title: 'Переместить в папку',
        move_none: '— без папки —',

        new_book_title: 'Новый лорбук',
        new_book_name: 'Название книги',
        rename_title: 'Переименовать книгу',
        rename_new_name: 'Новое название',
        name_required: 'Название не может быть пустым',
        name_exists: 'Книга с таким названием уже существует',
        rename_affects_primary: 'Внимание: эта книга — основной лорбук других персонажей (${chars}). SillyTavern не умеет перепривязывать их автоматически — книгу придётся заново выбрать в их карточках.',
        confirm_delete_book: 'Удалить лорбук «${name}»? Файл будет удалён безвозвратно. Если книга просто мешает — используйте «Скрыть».',

        confirm_hide_book: 'Скрыть лорбук «${name}»? Он исчезнет из селекторов SillyTavern, но файл останется нетронутым. Вернуть его можно здесь в любой момент.',
        hide_bound_note: 'Книга сейчас используется: ${bindings}. Скрытие не отвязывает её.',
        hide_also_deactivate: 'Также деактивировать глобально',
        hide_dont_ask: 'Больше не показывать это подтверждение',
        opt_confirm_hide: 'Подтверждать скрытие книги',
        toast_hidden: 'Книга скрыта',
        toast_unhidden: 'Книга снова видима',

        sel_mode: 'Выбрать',
        sel_exit: 'Готово',
        selected_n: 'Выбрано: ${n}',
        bulk_enable: 'Включить',
        bulk_disable: 'Выключить',
        bulk_delete: 'Удалить',
        confirm_bulk_delete: 'Удалить ${n} записей из «${name}»? Это действие необратимо.',
        confirm_bulk_toggle: 'Применить к ${n} записям?',
        enable_all: 'Вкл. все',
        disable_all: 'Выкл. все',
        confirm_enable_all: 'Включить ВСЕ ${n} записей книги «${name}»?',
        confirm_disable_all: 'Выключить ВСЕ ${n} записей книги «${name}»?',
        show_more: 'Показать ещё (осталось ${n})',
        no_entries: 'В этой книге нет записей.',
        entries_stat: 'Включено ${enabled} из ${total} записей',
        entry_constant_title: 'Константа (всегда активна)',
        entry_enabled_title: 'Включена',
        entry_disabled_title: 'Выключена',
        untitled_entry: '(без названия)',
        toast_bulk_done: 'Готово: обновлено записей — ${n}',
        toast_bulk_deleted: 'Удалено записей: ${n}',

        search_placeholder: 'Поиск по всем книгам…',
        search_indexing: 'Индексация книг: ${done}/${total}…',
        search_cancel: 'Отмена',
        search_cancelled: 'Индексация отменена',
        search_no_results: 'Ничего не найдено',
        search_results: 'Совпадений: ${n} в ${m} книгах',
        search_include_hidden: 'Искать в скрытых книгах',
        search_min_chars: 'Введите минимум 2 символа',
        field_key: 'ключ',
        field_title: 'заголовок',
        field_content: 'текст',

        bind_title: 'Привязки: ${name}',
        bind_global: 'Активна глобально',
        bind_chat: 'Привязана к текущему чату',
        bind_chat_none: 'Чат не открыт',
        bind_char_primary: 'Основная у текущего персонажа',
        bind_char_aux: 'Дополнительная у текущего персонажа',
        bind_char_none: 'Персонаж не открыт',
        bind_persona: 'Лорбук персоны',
        bind_set_primary_confirm: 'Сделать «${name}» основным лорбуком текущего персонажа? Прежняя привязка (если была) будет заменена.',
        badge_global: 'Активна глобально',
        badge_chat: 'Привязана к чату',
        badge_primary: 'Основная у: ${chars}',
        badge_aux: 'Дополнительная у: ${chars}',
        badge_persona: 'Лорбук персоны',
        used_by: 'используется',

        language: 'Язык',
        lang_auto: 'Авто',
        opt_show_hidden: 'Показывать секцию «Скрытые» в менеджере',
        opt_confirm_bulk: 'Подтверждать массовые операции',
        auto_hide_title: 'Авто-скрытие по имени',
        auto_hide_help: 'По одной маске на строку. Знаки * и ? — подстановочные (chat_* спрячет имена, начинающиеся с chat_); обычное слово совпадает с любым именем, где оно встречается (без учёта регистра). Ручное «Показать» имеет приоритет над маской.',
        auto_hide_placeholder: 'chat_*\nвременный *\nдневник',
        auto_hide_preview: 'Маски совпадают с ${n} книгами',
        auto_hide_apply: 'Применить маски',
        auto_hide_applied: 'Маски авто-скрытия применены',
        export_btn: 'Экспорт данных',
        import_btn: 'Импорт данных',
        import_ok: 'Данные импортированы',
        import_bad: 'Импорт не удался: это не экспорт Менеджера лорбуков',
        clear_all_btn: 'Очистить все данные…',
        confirm_clear_all: 'Удалить ВСЕ данные Менеджера лорбуков (папки, распределение книг, список скрытых, настройки)? Сами лорбуки НЕ затрагиваются — скрытые книги просто снова появятся в SillyTavern. Действие необратимо. Если не уверены — сначала сделайте экспорт.',
        clear_done: 'Данные Менеджера лорбуков очищены',

        toast_book_created: 'Книга «${name}» создана',
        toast_book_deleted: 'Книга удалена',
        toast_book_renamed: 'Книга переименована',
        toast_book_duplicated: 'Дубликат: «${name}»',
        toast_error: 'Менеджер лорбуков: операция не удалась, подробности в консоли',
        slash_help: 'Открыть панель Менеджера лорбуков',
        maximize_title: 'Развернуть / свернуть',
    },
};

export function getLang() {
    const pref = extension_settings[MODULE]?.language ?? 'ru';
    if (pref === 'en' || pref === 'ru') return pref;
    // auto: follow ST's UI language
    try {
        const stLang = localStorage.getItem('language') || navigator.language || 'ru';
        return String(stLang).toLowerCase().startsWith('ru') ? 'ru' : 'en';
    } catch {
        return 'ru';
    }
}

/** Translate a key with optional ${var} interpolation. Falls back lang → en → key. */
export function t(key, vars = null) {
    const lang = getLang();
    let str = I18N[lang]?.[key] ?? I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            str = str.replaceAll('${' + k + '}', String(v));
        }
    }
    return str;
}

/**
 * Walk [data-lbm-i18n] under root and apply translations.
 * Spec syntax, ';'-separated: "key" sets textContent, "[attr]key" sets an attribute.
 */
export function localize(root) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    const nodes = scope.querySelectorAll('[data-lbm-i18n]');
    for (const el of nodes) {
        const spec = el.getAttribute('data-lbm-i18n');
        if (!spec) continue;
        for (const part of spec.split(';')) {
            const m = part.trim().match(/^\[([^\]]+)\](.+)$/);
            if (m) {
                el.setAttribute(m[1], t(m[2]));
            } else if (part.trim()) {
                el.textContent = t(part.trim());
            }
        }
    }
}
