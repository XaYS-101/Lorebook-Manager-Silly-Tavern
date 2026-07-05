[English](README.md) | [Русский](README_ru.md)

---

# Lorebook Manager

A SillyTavern extension for managing World Info. It puts all your lorebooks in one panel with folders, hiding, search across every book at once, bulk entry edits, and an overview of where each book is used.

**Your files stay safe.** Folders and hiding live in the extension's own settings and never touch the lorebook files. Remove the extension and everything goes back to how it was. Only Delete, Rename, Duplicate, and the bulk entry actions change a book, and each of those asks first. Keep backups anyway.

**Heads up:** this is still under active development, so bugs happen. If something breaks, open the browser console, look for `[LBM]` errors, and file an issue with the details.

---

## What it does

### The manager panel
One popup with every lorebook you have. You can open it from:
- the 📚 button in the World Info drawer,
- the `/lorebooks` slash command,
- the button in the extension's settings.

It opens as a fullscreen dialog. On phones it's the same, with icon-only toolbars and large tap targets.

Each book row shows a green activation dot (tap it to turn the book on or off globally), the name, an entry counter (enabled out of total), and small badges for where the book is bound: 🌐 global, 💬 chat, 👤 character primary, 👥 character auxiliary, 🎭 persona. A book that's active but hidden gets a ⚠, and one hidden by an auto-hide mask gets a ✳. If you forget what a symbol means, the **?** button in the toolbar opens a legend.

### Hide instead of delete
Every book has a **Hide** option in its `⋮` menu. A hidden book drops out of ST's own selectors: the global "Active World(s)" list, the "Pick to Edit" dropdown in the editor, the lorebook pickers on character cards, and the chat-lorebook picker. The file itself stays put and keeps working if it was active or bound (the manager flags that case with a ⚠). Hidden books collect in a dimmed **Hidden** section that you show or hide with the "Show hidden" toggle, and one tap brings any of them back.

If the book is in use somewhere, the hide dialog lists its bindings and offers to switch off its global activation at the same time.

**Auto-hide by name.** In the settings you can add masks, one per line, to hide matching books on sight, including ones you make later. `*` and `?` work as wildcards, so `chat_*` hides anything starting with `chat_`. A plain word matches any name that contains it, ignoring case, so `diary` hides "Alice's diary". A live counter tells you how many books currently match. This works well for the "one lorebook per chat" setup: mask the chat books once and only your shared books stay visible. If you click **Show** on a masked book, it stays visible as an exception, because a manual choice always beats a mask.

### Folders
Folders collapse, take a colour stripe and an emoji icon, and nest inside each other through the parent picker (with a check that stops loops). Sort books into them by dragging on desktop, or use the "Move to folder…" picker anywhere. Folder counts include books in subfolders. You can sort alphabetically or by hand, with up and down arrows on each row.

### Search across every book
ST's own search only looks inside the book you have open. The search box here reads every book at once: keys, secondary keys, titles, and content. Multi-word queries use AND. The first search indexes your books once, with a progress bar and a cancel button, and after that it's instant. Results group by book with the matching text highlighted, and a click opens the entry in ST's own editor, already filtered and flashed.

### Bulk entry edits
Open a book inside the manager and you get every entry with a status dot (🟢 enabled, 🔵 constant, ⚪ disabled), its title, and its keys. Tap a dot to flip one entry, or hit **Select** to tick several and enable, disable, or delete them together. **Enable all** and **Disable all** cover the whole book at once. It all works on the book data directly rather than the paginated editor, and it reloads ST's editor if that book is open there.

### Bindings
The `⋮` ➜ **Bindings** dialog shows where a book is used and lets you change it: toggle global activation, bind or unbind it to the current chat, or set it as the primary or an auxiliary lorebook for the current character. If you rename a book through the manager, these bindings follow the new name, which ST on its own only does part of the time.

### Odds and ends
- English and Russian interface (Russian by default; Auto follows ST's language).
- Export and import of the extension's data (folders, assignments, hidden list) as JSON.
- A **Clear all data** button that resets the extension and returns hidden books to ST's selectors. Your lorebooks are left alone.

---

## Installation

In SillyTavern, go to **Extensions ➜ Install extension** and paste this repository URL:

```
https://github.com/XaYS-101/Lorebook-Manager-Silly-Tavern
```

There's no server plugin and no `config.yaml` to edit. The extension runs entirely in the browser.

It needs SillyTavern 1.12.0 or newer (built and tested on 1.17.0).

---

## How hiding works (for the curious)

ST builds its lorebook selectors from the `world_names` list, where each `<option>` stores the book's index as its value. The extension removes the options for hidden books (hiding them with CSS doesn't work, since select2 ignores it), but it never renumbers or reorders the rest, and it never removes an option that's currently selected, so hiding can't quietly change your active set. Whenever ST rebuilds a selector, a MutationObserver puts the filter back.

## License

MIT
