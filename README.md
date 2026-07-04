[English](README.md) | [Русский](README_ru.md)

---

# Lorebook Manager

A SillyTavern extension that gives World Info the management panel it never had: all your lorebooks in one place, with folders, hiding, cross-book search, bulk entry operations and a live overview of where each book is bound.

**Important:** Your lorebook files are never touched by folders or hiding — all of that lives in the extension's settings. Delete the extension and everything returns exactly as it was. Only the explicit Delete/Rename/Duplicate/bulk-entry actions modify books, and every destructive action asks for confirmation first. (Still, make backups.)

**Note:** This extension is actively developed and not perfect. Bugs can and will happen. If something breaks, check the browser console for `[LBM]` errors and report an issue with details.

---

## Features

### 1. The manager panel
One popup with every lorebook you have. Open it from:
- the wand menu (Extensions ➜ **Lorebook Manager**),
- the 📚 button inside the World Info drawer,
- the `/lorebooks` slash command,
- the button in the extension's settings.

The panel is a modal dialog with a **maximize button** (⤢) that expands it to full screen and back; the state is remembered. On phones it is always fullscreen, with icon toolbars and big tap targets.

Each book row shows: a green **activation dot** (tap to toggle the book globally), the name, an **entry counter** (enabled/total), and **binding badges** — 🌐 global, 💬 chat, 👤 character primary, 👥 character auxiliary, 🎭 persona.

### 2. Hide, don't delete
The `⋮` menu on any book has **Hide**. A hidden book:
- disappears from ST's own selectors — the global "Active World(s)" list, the editor's "Pick to Edit" dropdown, the character card's lorebook pickers and the chat-lorebook picker;
- stays completely intact on disk and keeps working if it was active or bound (the manager shows a ⚠ badge for "active but hidden");
- lives in a dimmed **Hidden** section of the manager (toggle "Show hidden"), from which one tap brings it back.

If the book is currently used somewhere, the hide dialog lists its bindings and offers to also deactivate it globally.

**Auto-hide by name.** In the extension settings you can enter one or more **masks** (one per line) to hide matching books automatically — including books you create later. `*` and `?` are wildcards (`chat_*` hides everything starting with `chat_`); a plain word matches any name that contains it, case-insensitively (`diary` hides "Alice's diary"). A live counter shows how many books currently match. This is ideal for the "one lorebook per chat" workflow: mask the chat books once and only your shared/global books stay in view. Manually clicking **Show** on a masked book keeps it visible as an exception — manual choice always wins over a mask.

### 3. Folders
Collapsible folders with a colour stripe and an emoji icon, nestable via the parent picker (with cycle protection). File books by drag-and-drop on desktop or through the "Move to folder…" picker anywhere. Folder counters show the real number of books including subfolders. Sorting: alphabetical or manual (with per-row up/down arrows).

### 4. Search across ALL books
ST's built-in search only looks inside the currently opened book. The manager's search box scans **every** book — keys, secondary keys, titles and content, multi-word queries use AND logic. The first search indexes your books once (with a progress indicator and cancel); after that it's instant. Results are grouped by book with highlighted snippets; one click opens the entry in ST's native editor, pre-filtered and flashed.

### 5. Bulk entry operations
Open any book inside the manager: every entry with its status dot (🟢 enabled / 🔵 constant / ⚪ disabled), title and keys. Toggle single entries with a tap, or hit **Select** and check many at once — then enable, disable or delete them in one action. **Enable all / Disable all** buttons handle the whole book. Everything operates on the book data directly (not the paginated editor DOM) and reloads ST's editor if it has that book open.

### 6. Bindings
The `⋮` ➜ **Bindings** dialog shows and edits where a book is used: toggle global activation, bind/unbind it to the current chat, make it the primary or an auxiliary lorebook of the current character. Renaming a book through the manager keeps all these bindings pointing at the new name (something ST itself only partially does).

### 7. Housekeeping
- **EN/RU interface** (Russian by default, auto mode follows ST's language).
- **Export / Import** of the extension's data (folders, assignments, hidden list) as JSON.
- **Clear all data** button that resets the extension and returns hidden books to ST's selectors — lorebooks themselves are untouched.

---

## Installation

In SillyTavern: **Extensions ➜ Install extension** and paste this repository URL:

```
https://github.com/XaYS-101/Lorebook-Manager-Silly-Tavern
```

No server plugin, no `config.yaml` edits — the extension is fully client-side.

Requires SillyTavern 1.12.0 or newer (developed and tested on 1.17.0).

---

## How hiding works (technical note)

ST derives its lorebook selectors from the `world_names` list, where each `<option>` carries the book's index as its value. The extension removes the options of hidden books (select2 ignores CSS hiding) without ever renumbering or reordering the rest, and never removes an option that is currently selected — so hiding can't silently change your active set. When ST rebuilds the selectors, MutationObservers re-apply the filter.

## License

MIT
