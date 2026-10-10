#!/usr/bin/env node
// Checks the plugins of the repository: the manifest by the app's rules (src/shared/plugins.ts, plugin-registry.ts),
// and the repository's own (folder named after the id, README, no binaries, size).
//   node scripts/validate.mjs                  every plugin
//   node scripts/validate.mjs --pr <base-ref>  the plugin a pull request changes, against the base branch
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PLUGINS = join(ROOT, 'plugins')
/** the app's permissions (src/shared/plugins.ts PLUGIN_PERMISSIONS) */
export const PERMISSIONS = ['process', 'fs:home', 'network', 'secrets']
/** under the app's install limits (plugin-store.ts LIMITS), with room to spare */
const MAX_BYTES = 5 * 1024 * 1024, MAX_FILES = 500
/** what a plugin ships: code, data, docs and images; nothing that runs outside the sandbox */
const ALLOWED = /\.(js|mjs|cjs|json|md|txt|css|svg|png|jpe?g|gif|webp)$/i
const ID = /^[a-z0-9][a-z0-9.-]*$/
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v)
  return m ? { nums: [+m[1], +m[2], +m[3]], pre: m[4] ?? '' } : null
}
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b)
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] < y.nums[i] ? -1 : 1
  if (x.pre === y.pre) return 0
  if (!x.pre || !y.pre) return x.pre ? -1 : 1
  return x.pre < y.pre ? -1 : 1
}

/** Every file under a plugin folder (relative paths), or the errors found walking it. */
function walk(dir, errors) {
  const out = []
  const visit = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name), rel = relative(dir, p).split(sep).join('/')
      const st = lstatSync(p)
      if (st.isSymbolicLink()) errors.push(`${rel} : lien symbolique refusé`)
      else if (st.isDirectory()) { if (name === 'node_modules' || name === '.git') errors.push(`${rel} : dossier refusé`); else visit(p) }
      else if (!st.isFile()) errors.push(`${rel} : fichier spécial refusé`)
      else { if (!ALLOWED.test(name)) errors.push(`${rel} : type de fichier refusé (code, données, docs et images seulement)`); out.push({ rel, size: st.size }) }
    }
  }
  visit(dir)
  return out
}

/** The errors of one plugin folder (empty when it is fine), and its manifest. */
export function checkPlugin(dir) {
  const errors = []
  const folder = dir.split(sep).pop()
  let m
  try { m = JSON.parse(readFileSync(join(dir, 'plugin.json'), 'utf8')) } catch (e) { return { errors: [`plugin.json manquant ou illisible (${e.message})`] } }
  if (typeof m.id !== 'string' || !ID.test(m.id)) errors.push('id manquant ou invalide (minuscules, chiffres, . et -)')
  else if (m.id !== folder) errors.push(`le dossier doit s'appeler comme l'id (${m.id})`)
  if (typeof m.name !== 'string' || !m.name) errors.push('name manquant')
  if (typeof m.description !== 'string' || !m.description) errors.push('description manquante (affichée dans le catalogue)')
  if (typeof m.version !== 'string' || !VERSION.test(m.version)) errors.push('version manquante ou invalide (x.y.z)')
  if (m.engine !== undefined && (typeof m.engine !== 'string' || !parseVersion(m.engine.replace(/^>=\s*/, '')))) errors.push('engine invalide (">=2.0.0")')
  if (typeof m.main !== 'string' || !m.main) errors.push('main manquant')
  else if (!existsSync(join(dir, m.main))) errors.push(`main introuvable : ${m.main}`)
  if (m.permissions !== undefined && (!Array.isArray(m.permissions) || m.permissions.some((p) => !PERMISSIONS.includes(p)))) errors.push(`permissions invalides (${PERMISSIONS.join(', ')})`)
  for (const a of m.contributes?.activity ?? []) if (!a.id || !a.title || (a.side !== 'left' && a.side !== 'right')) errors.push('contributes.activity invalide (id, title, side left | right)')
  for (const v of m.contributes?.views ?? []) if (!v.id || (!v.activity && v.placement !== 'bottom')) errors.push('contributes.views invalide (id, activity ou placement bottom)')
  if (!existsSync(join(dir, 'README.md'))) errors.push('README.md manquant (ce que fait le plugin, ses permissions et pourquoi)')
  const files = walk(dir, errors)
  const bytes = files.reduce((n, f) => n + f.size, 0)
  if (bytes > MAX_BYTES) errors.push(`trop gros : ${(bytes / 1024 / 1024).toFixed(1)} Mo (max ${MAX_BYTES / 1024 / 1024})`)
  if (files.length > MAX_FILES) errors.push(`trop de fichiers : ${files.length} (max ${MAX_FILES})`)
  return { errors, manifest: m }
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/** A pull request changes one plugin (its folder only), bumps its version when it existed, never registry.json. */
function checkPullRequest(base) {
  const errors = []
  const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean)
  if (changed.includes('registry.json')) errors.push('registry.json est généré par la CI à la fusion : ne pas le modifier')
  const ids = [...new Set(changed.filter((f) => f.startsWith('plugins/')).map((f) => f.split('/')[1]))]
  if (ids.length > 1) errors.push(`une pull request par plugin (${ids.join(', ')})`)
  const outside = changed.filter((f) => !f.startsWith('plugins/') && f !== 'registry.json')
  if (ids.length && outside.length) errors.push(`un plugin et le reste du dépôt dans la même pull request : ${outside.join(', ')}`)
  for (const id of ids) {
    const dir = join(PLUGINS, id)
    if (!existsSync(dir)) { console.log(`${id} : retiré`); continue }
    const r = checkPlugin(dir)
    errors.push(...r.errors.map((e) => `${id} : ${e}`))
    let before = null
    try { before = JSON.parse(git('show', `${base}:plugins/${id}/plugin.json`)).version } catch { /* new plugin */ }
    const stale = before && r.manifest?.version && VERSION.test(r.manifest.version) && compareVersions(r.manifest.version, before) <= 0
    if (stale) errors.push(`${id} : la version doit augmenter (${before} sur la branche de base, ${r.manifest.version} ici)`)
    if (!r.errors.length && !stale) console.log(`${id} ${r.manifest.version} : ok${before ? ` (était ${before})` : ' (nouveau)'}`)
  }
  return errors
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const i = process.argv.indexOf('--pr')
  let errors = []
  if (i >= 0) errors = checkPullRequest(process.argv[i + 1] ?? 'origin/main')
  else for (const id of readdirSync(PLUGINS)) {
    const r = checkPlugin(join(PLUGINS, id))
    errors.push(...r.errors.map((e) => `${id} : ${e}`))
    if (!r.errors.length) console.log(`${id} ${r.manifest.version} : ok`)
  }
  for (const e of errors) console.error('✗ ' + e)
  process.exit(errors.length ? 1 : 0)
}
