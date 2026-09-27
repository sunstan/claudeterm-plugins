# ClaudeTerm plugins catalogue

`registry.json` is the default plugin catalogue of [ClaudeTerm](https://github.com/sunstan) (Réglages > Plugins).
The app fetches it from `https://raw.githubusercontent.com/sunstan/claudeterm-plugins/main/registry.json`.

Each plugin lives in its own repository and publishes a `.tgz` (release asset or GitHub archive) with
`plugin.json` at the root or under a single top folder.

## Entry format

```json
{
  "version": 1,
  "plugins": [
    {
      "id": "acme.hello",
      "name": "Hello",
      "description": "What it does",
      "version": "1.0.0",
      "engine": ">=2.0.0",
      "permissions": ["network"],
      "repo": "https://github.com/acme/claudeterm-hello",
      "url": "https://github.com/acme/claudeterm-hello/releases/download/v1.0.0/hello-1.0.0.tgz",
      "sha256": "<sha256 of the .tgz>"
    }
  ]
}
```

- `id` and `version` must equal the ones in the archive's `plugin.json`.
- `permissions` (`process`, `fs:home`, `network`, `secrets`): the manifest may not ask for more.
- `url`: https only. `sha256`: `shasum -a 256 hello-1.0.0.tgz`.
- `engine` (optional): minimal ClaudeTerm version.

Entries that fail validation are skipped by the app and reported in the Catalogue tab.
