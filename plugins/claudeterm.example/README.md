# Exemple : Markdown du projet

Lists the Markdown files at the root of the open project (left bar › Exemple) and opens one in the editor on a click.

It is the template for a new plugin: copy this folder to `plugins/<your id>/`, then change `plugin.json` and `main.js`.

- No permission: a plugin reads the open project and its own folder without asking.
- `main.js` exports `activate(ctx)`; the view is a model (`list`, `tree`, `markdown`…) the app draws.
