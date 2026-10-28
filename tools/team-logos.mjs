/*
  Team logos, for the redesign preview.

  Copies every known team's logo (light and dark versions, where Liquipedia has both) from Liquipedia
  into images/teams/, named after the team's id on the site: images/teams/<team-id>.png and
  images/teams/<team-id>-dark.png. images/teams/index.json lists what was saved.

  The teams come from watcher/state.json, so only teams the watcher has already seen are fetched.
  Logos are looked up through Liquipedia's own team templates ({{TeamIcon|key}}), the same templates
  the watcher uses for team names. Logos carry no results, so they're safe to show anywhere.

  Liquipedia's API rules: an identifying User-Agent and at most one request every 2 seconds.
*/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'images', 'teams');
const LP_API = 'https://liquipedia.net/counterstrike/api.php';
const LP_DELAY = 2500;
const USER_AGENT = 'cs2-spoiler-free-site video watcher (https://github.com/' + (process.env.GITHUB_REPOSITORY || 'josephpatrickrautiniconroy-bot/CS2-Spoil-free') + ')';
const arr = v => Array.isArray(v) ? v : [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

// One expanded template -> { light, dark } file names. The light/dark spans name which is which;
// a template with a single picture uses it for both.
export function logoFiles(html) {
  const files = [...String(html).matchAll(/\[\[(?:File|Image):([^|\]]+)/gi)].map(m => m[1].trim());
  const dark = (String(html).match(/darkmode[^[]*\[\[(?:File|Image):([^|\]]+)/i) || [])[1];
  const light = (String(html).match(/lightmode[^[]*\[\[(?:File|Image):([^|\]]+)/i) || [])[1];
  return { light: (light || files[0] || '').trim(), dark: (dark || '').trim() };
}

const state = JSON.parse(await readFile(path.join(ROOT, 'watcher', 'state.json'), 'utf8'));
const teams = Object.entries(state.teams || {});
console.log(teams.length + ' teams');
await mkdir(OUT, { recursive: true });

const SEP = '\n@@@\n';
const found = {};
const debug = [];
for (let i = 0; i < teams.length; i += 40) {
  const batch = teams.slice(i, i + 40);
  const res = await lp({ action: 'expandtemplates', prop: 'wikitext', text: batch.map(([k]) => '{{TeamIcon|' + k + '}}').join(SEP) });
  const parts = res.expandtemplates.wikitext.split('@@@');
  batch.forEach(([k, t], j) => {
    found[t.id] = { key: k, name: t.name, ...logoFiles(parts[j] || '') };
    if (debug.length < 4) debug.push(k + ':\n' + (parts[j] || '').trim());
  });
}
await writeFile(path.join(OUT, 'debug.txt'), debug.join('\n\n') + '\n');

const wanted = [];
for (const [id, f] of Object.entries(found)) {
  if (f.light) wanted.push({ id, file: f.light, saved: id + '.png', field: 'logo' });
  if (f.dark && f.dark !== f.light) wanted.push({ id, file: f.dark, saved: id + '-dark.png', field: 'logoDark' });
}
const index = {};
for (let i = 0; i < wanted.length; i += 40) {
  const batch = wanted.slice(i, i + 40);
  const res = await lp({ action: 'query', prop: 'imageinfo', iiprop: 'url|mime', iiurlwidth: '256', titles: [...new Set(batch.map(w => 'File:' + w.file))].join('|') });
  const norm = new Map(arr(res.query.normalized).map(n => [n.to, n.from]));
  const urls = new Map(arr(res.query.pages).map(p => [norm.get(p.title) || p.title, p.imageinfo && p.imageinfo[0]]));
  for (const w of batch) {
    const ii = urls.get('File:' + w.file);
    if (!ii) { console.log('No picture for ' + w.id + ' (' + w.file + ')'); continue; }
    await polite();
    const r = await fetch(ii.thumburl || ii.url, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) { console.log('Download failed for ' + w.file + ': HTTP ' + r.status); continue; }
    await writeFile(path.join(OUT, w.saved), Buffer.from(await r.arrayBuffer()));
    index[w.id] = { ...(index[w.id] || { name: found[w.id].name }), [w.field]: 'images/teams/' + w.saved };
  }
}
await writeFile(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(Object.keys(index).length + ' teams with a logo');
