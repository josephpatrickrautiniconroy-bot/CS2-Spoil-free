/*
  Map symbols, for the redesign preview.

  Copies the pictures from each CS2 map's Liquipedia infobox (its icon, and its other images) into
  images/maps/, named <map-slug>--<infobox field>.<ext>. images/maps/index.json lists what was saved,
  and images/maps/debug.txt the infobox fields that name a file, so the right one can be picked.

  Liquipedia's API rules: an identifying User-Agent and at most one request every 2 seconds.
*/
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'images', 'maps');
const LP_API = 'https://liquipedia.net/counterstrike/api.php';
const LP_DELAY = 2500;
const USER_AGENT = 'cs2-spoiler-free-site video watcher (https://github.com/' + (process.env.GITHUB_REPOSITORY || 'josephpatrickrautiniconroy-bot/CS2-Spoil-free') + ')';
const MAPS = ['Mirage', 'Dust II', 'Nuke', 'Inferno', 'Ancient', 'Anubis', 'Overpass', 'Train', 'Vertigo', 'Cache'];
const arr = v => Array.isArray(v) ? v : [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

let last = 0;
async function polite() {
  const wait = last + LP_DELAY - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
}
async function lp(params) {
  await polite();
  const url = new URL(LP_API);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', ...params })) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' } });
  if (!r.ok) throw new Error('Liquipedia request failed: HTTP ' + r.status);
  const body = await r.json();
  if (body.error) throw new Error('Liquipedia: ' + (body.error.info || body.error.code));
  return body;
}

// Fields of the page's first infobox whose value is a picture's file name.
export function pictureFields(text) {
  const start = String(text).search(/\{\{\s*Infobox/i);
  if (start < 0) return {};
  const out = {};
  for (const line of String(text).slice(start).split('\n').slice(1)) {
    if (/^\s*\}\}/.test(line)) break;
    const m = line.match(/^\s*\|\s*([\w ]+?)\s*=\s*(.+?)\s*$/);
    if (m && /\.(png|jpe?g|svg|webp|gif)$/i.test(m[2])) out[m[1].trim()] = m[2].replace(/^(File|Image):/i, '').trim();
  }
  return out;
}

await mkdir(OUT, { recursive: true });
try {
const res = await lp({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: MAPS.join('|') });
const back = new Map();
for (const n of arr(res.query.normalized)) back.set(n.to, n.from);
for (const r of arr(res.query.redirects)) back.set(r.to, back.get(r.from) || r.from);
const debug = [];
const wanted = [];
for (const p of arr(res.query.pages)) {
  const name = back.get(p.title) || p.title;
  if (p.missing || !p.revisions) { debug.push(name + ': no page'); continue; }
  const text = p.revisions[0].slots.main.content || '';
  const fields = pictureFields(text);
  debug.push(name + ' (' + p.title + '): ' + JSON.stringify(fields) + '\n  starts: ' + text.slice(0, 300).replace(/\n/g, ' | '));
  for (const [field, file] of Object.entries(fields)) wanted.push({ map: slug(name), name, field, file });
}
// The infobox only has a screenshot, so also look for each map's symbol among Liquipedia's files.
for (const name of MAPS) {
  const q = name.replace(' II', ' 2');
  const found = await lp({ action: 'query', list: 'search', srnamespace: '6', srlimit: '15', srsearch: q + ' icon' });
  const titles = arr(found.query.search).map(x => x.title.replace(/^File:/, ''));
  debug.push(name + ' file search: ' + JSON.stringify(titles));
  const icon = titles.find(t => /icon|emblem|logo|symbol|pin/i.test(t) && t.toLowerCase().includes(q.split(' ')[0].toLowerCase()) && !/team|player/i.test(t));
  if (icon) wanted.push({ map: slug(name), name, field: 'icon', file: icon });
}
await writeFile(path.join(OUT, 'debug.txt'), debug.join('\n\n') + '\n');

const index = {};
for (let i = 0; i < wanted.length; i += 40) {
  const batch = wanted.slice(i, i + 40);
  const info = await lp({ action: 'query', prop: 'imageinfo', iiprop: 'url|mime', iiurlwidth: '256', titles: [...new Set(batch.map(w => 'File:' + w.file))].join('|') });
  const norm = new Map(arr(info.query.normalized).map(n => [n.to, n.from]));
  const urls = new Map(arr(info.query.pages).map(p => [norm.get(p.title) || p.title, p.imageinfo && p.imageinfo[0]]));
  for (const w of batch) {
    const ii = urls.get('File:' + w.file);
    if (!ii) { console.log('No picture for ' + w.name + ' ' + w.field + ' (' + w.file + ')'); continue; }
    const url = ii.thumburl || ii.url;
    const ext = (/\.(png|jpe?g|webp|gif|svg)(?:$|\?)/i.exec(url) || [, 'png'])[1].toLowerCase();
    const saved = w.map + '--' + slug(w.field) + '.' + (ext === 'jpeg' ? 'jpg' : ext);
    await polite();
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) { console.log('Download failed for ' + w.file + ': HTTP ' + r.status); continue; }
    await writeFile(path.join(OUT, saved), Buffer.from(await r.arrayBuffer()));
    (index[w.map] = index[w.map] || { name: w.name })[w.field] = 'images/maps/' + saved;
  }
}
await writeFile(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(Object.keys(index).length + ' maps with pictures');
} catch (e) {
  // Run logs can't be read from where this is looked at, so the error is saved with the pictures.
  await writeFile(path.join(OUT, 'error.txt'), String(e && e.stack || e) + '\n');
  console.log('Failed: ' + e.message);
}
