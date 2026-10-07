# Shared Notion editor

`/imenu` and `/engravida` use `app.js` for rendering, rich-text serialization,
and Notion synchronization, and `mechanics.js` for editing transactions.
`netlify/functions/notion.js` is the server-side Notion adapter.

Opening a page fetches current Notion content. Only Ctrl/Cmd+S writes it back.
Unsaved edits and undo history stay in the current tab; leaving warns about
unsaved changes. The existing password gate and visual theme are unchanged.

## Editing behavior

- Enter splits text blocks; Shift+Enter inserts a soft break. Code/table cells
  keep their line breaks inside their block. Empty list items exit their list.
- Native text selection works across blocks. Deletion and replacement reconcile
  block boundaries instead of letting the browser remove editor wrappers.
- Escape selects a block; Shift+arrows and Shift+click extend block selection.
  Dragging in the page margin selects a range of blocks. Ctrl/Cmd+A selects the
  current text, then the page's blocks; the page title stays separate.
- Tab/Shift+Tab nest/un-nest blocks. Handles support moving and Alt-drag copying.
  Ctrl/Cmd+D duplicates; Delete/Backspace removes selected blocks.
- Slash menus, Markdown triggers, heading/list shortcuts, rich formatting,
  links, text/highlight colors, toggles, and checkboxes share undo/redo history.
- Tables support cell editing, Tab navigation, and adding rows and columns.
- Copy/cut/paste inside this editor preserves block types and nested children.
  External rich HTML is sanitized; multiline text becomes separate blocks.
- Undo/redo includes structural edits and survives successful saves. A saved
  deletion can be undone by recreating the deleted block.

## Persistence constraints

Notion's API cannot move existing blocks or change their type in place. Moves,
nesting, type conversion, and table width changes therefore create replacement
blocks before trashing their originals. Those operations change block IDs and
can affect links to the original blocks. Existing unsupported blocks and
Notion-hosted files are protected from recreation; their supported text children
can still be edited. Subpages, databases, synced blocks, full column management,
comments, collaboration, uploads, and workspace/page search are not implemented.
This is a block editor with Notion-like mechanics, not full Notion parity.

Controls are frozen during saving. Returned block mappings survive partial
failures so retrying does not recreate already-confirmed blocks. Tables whose
row mapping lookup fails recover their existing row IDs on the next save.
All supported payloads are validated before writes. Notion writes themselves
are not an atomic transaction; an interrupted request can have partial results.

## Regression checks

```sh
npm install
npx playwright install chromium
npm run test:editor
```

Set `NOTION_TEST_CHROMIUM` to use an existing Chromium binary. Tests run against
an isolated static server and an in-memory Notion API adapter. They never call
the production API or modify real notes. Coverage includes keyboard and mouse
selection, deletion/replacement, soft breaks, undo/redo, nested moves, dragging,
clipboard, colors, mentions, columns, tables, saving/retries, IME, and mobile
layout. The adapter enforces block type immutability and table creation shape.
