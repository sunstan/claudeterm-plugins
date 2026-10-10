# ClaudeTerm plugins

The plugins of [ClaudeTerm](https://github.com/sunstan/claude-term), one folder each under `plugins/`, and the catalogue
the app reads (Réglages › Plugins › Catalogue): `registry.json`, written by the CI.

Anyone can add a plugin with a pull request: see [CONTRIBUTING.md](CONTRIBUTING.md).

## How it works

- `plugins/<id>/`: a plugin's source (`plugin.json`, `main.js`, `README.md`…). The folder is named after the plugin's id.
- On each pull request, `validate` checks the plugin it changes (`scripts/validate.mjs`).
- On main, `release` publishes each plugin version not released yet: a GitHub release `<id>@<version>` with the
  plugin's `.tgz`, then `registry.json` (url and sha256 of each archive) is written again and committed.
- The app fetches `https://raw.githubusercontent.com/sunstan/claudeterm-plugins/main/registry.json`, checks each
  archive's sha256 against it, and asks the user before installing (with the permissions the plugin asks for).

A released version keeps its archive: changing a plugin means a new version.

## Catalogue format (`registry.json`, written by the CI)

```json
{
  "version": 1,
  "plugins": [
    {
      "id": "claudeterm.example",
      "name": "Exemple : Markdown du projet",
      "description": "…",
      "version": "1.0.0",
      "engine": ">=2.0.0",
      "permissions": [],
      "repo": "https://github.com/sunstan/claudeterm-plugins/tree/main/plugins/claudeterm.example",
      "url": "https://github.com/sunstan/claudeterm-plugins/releases/download/claudeterm.example%401.0.0/claudeterm.example-1.0.0.tgz",
      "sha256": "…"
    }
  ]
}
```
