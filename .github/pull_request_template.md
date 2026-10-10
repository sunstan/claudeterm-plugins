<!-- One pull request per plugin, its folder only (plugins/<id>/). registry.json is written by the CI. -->

**Plugin**: `<id>` — new / update to `x.y.z`

**What it does**:

**Permissions and why** (none, `process`, `fs:home`, `network`, `secrets`):

- [ ] Tried in ClaudeTerm (`node scripts/release.mjs --local /tmp/cat`, then Plugins › + with the `file://…tgz` URL)
- [ ] `node scripts/validate.mjs` passes
- [ ] No minified or obfuscated code; no dependency bundled without its source and license
