#!/usr/bin/env node
// Publishes the plugins and writes registry.json, the catalogue the app reads.
//   node scripts/release.mjs --repo owner/name   (CI, on main) each plugin version not released yet gets a release
//                                                 <id>@<version> with its .tgz; registry.json lists every plugin
//   node scripts/release.mjs --local <dir>        packs every plugin into <dir> with a registry.json of file: URLs,
//                                                 to try the catalogue in the app (Réglages › Plugins › Catalogue)
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { checkPlugin } from './validate.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PLUGINS = join(ROOT, 'plugins')
const REGISTRY = join(ROOT, 'registry.json')

/** The files of a plugin folder, sorted, as tar paths under `<id>/`. */
function files(dir, id) {
  const out = []
  const visit = (d) => { for (const n of readdirSync(d, { withFileTypes: true })) { const p = join(d, n.name); n.isDirectory() ? visit(p) : out.push(p) } }
  visit(dir)
  return out.map((p) => ({ path: `${id}/${relative(dir, p).split(sep).join('/')}`, data: readFileSync(p) })).sort((a, b) => (a.path < b.path ? -1 : 1))
}

/** A .tgz of the files, the same bytes for the same files (fixed owner, mode and time; gzip without a timestamp). */
export function pack(entries) {
  const blocks = []
  for (const { path, data } of entries) {
    const h = Buffer.alloc(512)
    let name = path, prefix = ''
    if (Buffer.byteLength(name) > 100) {
      const cut = path.lastIndexOf('/', 155)
      prefix = path.slice(0, cut); name = path.slice(cut + 1)
      if (cut < 0 || Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new Error(`chemin trop long : ${path}`)
    }
    const field = (s, off, len) => h.write(s, off, len, 'utf8')
    const octal = (n, off, len) => field(n.toString(8).padStart(len - 1, '0') + '\0', off, len)
    field(name, 0, 100); octal(0o644, 100, 8); octal(0, 108, 8); octal(0, 116, 8); octal(data.length, 124, 12)
    octal(946684800, 136, 12); h.fill(0x20, 148, 156); field('0', 156, 1); field('ustar\0', 257, 6); field('00', 263, 2); field(prefix, 345, 155)
    let sum = 0
    for (const b of h) sum += b
    field(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8)
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512))
  }
  blocks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(blocks), { level: 9 })
}

/** A registry entry from a plugin's manifest (the fields the app reads, plugin-registry.ts). */
const entryOf = (m, url, sha256, repo) => ({
  id: m.id, name: m.name, description: m.description, version: m.version, ...(m.engine ? { engine: m.engine } : {}),
  permissions: m.permissions ?? [], ...(repo ? { repo } : {}), url, sha256,
})

function plugins() {
  const out = []
  for (const id of readdirSync(PLUGINS).sort()) {
    const dir = join(PLUGINS, id)
    const r = checkPlugin(dir)
    if (r.errors.length) throw new Error(`${id} : ${r.errors.join(' ; ')}`)
    out.push({ dir, manifest: r.manifest })
  }
  return out
}

function local(outDir) {
  mkdirSync(outDir, { recursive: true })
  const entries = plugins().map(({ dir, manifest: m }) => {
    const gz = pack(files(dir, m.id))
    const file = join(outDir, `${m.id}-${m.version}.tgz`)
    writeFileSync(file, gz)
    return entryOf(m, pathToFileURL(file).href, createHash('sha256').update(gz).digest('hex'))
  })
  writeFileSync(join(outDir, 'registry.json'), JSON.stringify({ version: 1, plugins: entries }, null, 2) + '\n')
  console.log(`${entries.length} plugin(s) → ${pathToFileURL(join(outDir, 'registry.json')).href}`)
}

function publish(repo) {
  const gh = (...args) => execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const old = existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf8')).plugins ?? [] : []
  const dist = join(ROOT, 'dist')
  mkdirSync(dist, { recursive: true })
  const entries = plugins().map(({ dir, manifest: m }) => {
    const tag = `${m.id}@${m.version}`, name = `${m.id}-${m.version}.tgz`
    const url = `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${name}`
    const source = `https://github.com/${repo}/tree/main/plugins/${m.id}`
    const kept = old.find((e) => e.id === m.id && e.version === m.version && e.url === url)
    // a version already released keeps its archive: a new archive needs a new version
    if (kept) return entryOf(m, url, kept.sha256, source)
    const gz = pack(files(dir, m.id))
    writeFileSync(join(dist, name), gz)
    gh('release', 'create', tag, join(dist, name), '--title', `${m.name} ${m.version}`, '--notes', `${m.description}\n\nPermissions : ${(m.permissions ?? []).join(', ') || 'aucune'}.`)
    console.log(`publié : ${tag}`)
    return entryOf(m, url, createHash('sha256').update(gz).digest('hex'), source)
  })
  writeFileSync(REGISTRY, JSON.stringify({ version: 1, plugins: entries }, null, 2) + '\n')
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined }
  if (arg('--local')) local(resolve(arg('--local')))
  else if (arg('--repo')) publish(arg('--repo'))
  else { console.error('usage : release.mjs --repo owner/name | --local <dir>'); process.exit(2) }
}
