// Example plugin: the Markdown files at the root of the open project, opened in the editor on a click.
// A plugin runs sandboxed (no Node, no network): everything goes through `ctx` (see claudeterm.d.ts in the app).

exports.activate = (ctx) => {
  const view = ctx.ui.view('docs')
  let unwatch = null

  function render() {
    const root = ctx.workspace.project
    if (!root) return view.set({ kind: 'empty', text: 'Aucun projet ouvert' })
    const docs = ctx.workspace.fs.list(root).filter((e) => !e.dir && /\.(md|markdown)$/i.test(e.name))
    if (!docs.length) return view.set({ kind: 'empty', text: 'Aucun fichier Markdown à la racine du projet' })
    view.set({
      kind: 'list',
      toolbar: [{ id: 'refresh', title: 'Actualiser', icon: 'refresh' }],
      items: docs.map((e) => ({ id: root + '/' + e.name, label: e.name, file: root + '/' + e.name })),
    })
  }

  // follow the project shown, and its root folder's changes
  function follow(root) {
    if (unwatch) unwatch()
    unwatch = root ? ctx.workspace.fs.watch(root, render) : null
    render()
  }

  view.onEvent((e) => {
    if (e.type === 'toolbar' && e.actionId === 'refresh') render()
    if ((e.type === 'select' || e.type === 'open') && e.itemId) ctx.workspace.openFile(e.itemId)
  })
  ctx.workspace.onDidChangeProject(follow)
  follow(ctx.workspace.project)
}
