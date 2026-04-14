# Trawl Obsidian Plugin

This package is the first scaffold for the Trawl promotion layer inside Obsidian.

Current scaffold features:

- plugin manifest and build pipeline
- settings tab for API URL, API key, destination folder, note template, and default status filter
- connection test against `GET /health`
- inbox modal that lists Trawl items from the API
- manual processing trigger for `pending` and `failed` items
- automatic polling while pending items are visible in the modal
- source-note creation from a configurable template for processed items
- write-back of `obsidian_note_id` to Trawl after note creation/open

## Development

```bash
bun install
bun run dev:obsidian-plugin
```

That watches `src/main.ts` and rebuilds `main.js` in place.

## Build

```bash
bun run build:obsidian-plugin
```

Or from the app directory:

```bash
bun run build
bun run package
```

## Installing into a vault during development

1. Build the plugin.
2. Copy these files into your vault plugin directory, for example:
   `.obsidian/plugins/trawl-obsidian/`
   - `main.js`
   - `manifest.json`
   - `versions.json`
3. Enable the plugin in Obsidian community plugins.
4. Configure the Trawl API URL and API key in the plugin settings.

## Current promotion behavior

- processed items can be turned into source notes from the modal
- the plugin uses the configured template variables, including `{{obsidian_note_id}}` and `{{trawl_id}}`
- note frontmatter is normalized so the note always carries an `id` and `trawl_id`
- if a note with the same frontmatter `id` already exists, the plugin opens it instead of creating a duplicate
- after creation or open, the plugin patches Trawl with the chosen `obsidian_note_id`

## Next milestones

- poll individual items until completion and surface more explicit completion state
- create notes automatically when a processed item is selected from the modal
- detect newly processed-but-unlinked items more proactively
- add richer note templating and destination rules
