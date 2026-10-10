# Adding a plugin

1. Fork this repository, copy `plugins/claudeterm.example/` to `plugins/<your id>/` (lowercase, digits, `.` and `-`;
   prefix it with your name or organisation: `acme.hello`).
2. Write `plugin.json`, `main.js` and `README.md`. The plugin API is typed in the app:
   [`resources/plugins/claudeterm.d.ts`](https://github.com/sunstan/claude-term/blob/main/resources/plugins/claudeterm.d.ts).
3. Check it: `node scripts/validate.mjs` (Node 22, no dependency).
4. Try it in ClaudeTerm: `node scripts/release.mjs --local /tmp/cat` packs every plugin into `/tmp/cat`, then in the app
   Plugins › + › `file:///tmp/cat/<id>-<version>.tgz` (or point Réglages › Plugins › catalogue to
   `file:///tmp/cat/registry.json`).
5. Open a pull request: one plugin per pull request, its folder only. Do not edit `registry.json`, the CI writes it.

To update a plugin, change its files and raise `version` in `plugin.json`.

## Rules (checked by `scripts/validate.mjs`)

- `plugin.json`: `id` (= the folder's name), `name`, `description`, `version` (`x.y.z`), `main`; optional `engine`
  (`">=2.0.0"`), `permissions`, `contributes`.
- `README.md`: what the plugin does, the permissions it asks for and why.
- Only code, data, docs and images (`.js .json .md .txt .css .svg .png .jpg .gif .webp`); no `node_modules`, no
  binaries, no links. 5 MB and 500 files at most.
- A plugin runs sandboxed (no Node, no network): everything goes through `ctx`.
- A plugin using an API newer than ClaudeTerm 2.0.0 says so with `engine`, so older versions do not offer it: the
  `prompt` permission, `ctx.claude.insertPrompt`, `ctx.workspace.selection` and `ctx.commands` need `">=2.0.12"`.

## Review

Every pull request is read before it is merged: the code runs on the users' machines with the permissions it asks for.
Keep it readable (no minified or obfuscated code; a bundled library comes with its source and its license), and ask
for the fewest permissions you need:

| Permission | Gives |
|---|---|
| (none) | the open project and the plugin's own folder, read only |
| `process` | running programs and commands in the terminal |
| `fs:home` | reading the home folder |
| `prompt` | typing prompts into the project's Claude tab, and sending them (`ctx.claude.insertPrompt`) |
| `network` | network access (not available yet in the app: refused) |
| `secrets` | secrets of the system keyring (not available yet) |
