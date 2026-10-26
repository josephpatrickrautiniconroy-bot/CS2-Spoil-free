// Measures which quality YouTube picks for the site's player at different sizes.
// Run by .github/workflows/quality-probe.yml; results show as notices on the run.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./quality.html', import.meta.url));
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); }).listen(8123);
const V = 'PBsT2Ju9eX4', START = 106;
const desk = { viewport: { width: 1440, height: 900 } };
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const cases = [
  ['desk 854x480', desk, 'w=854&h=480'],
  ['desk 854x480 drawn at 1920x1080', desk, 'w=854&h=480&vw=1920&vh=1080'],
  ['desk 854x480 with overlay', desk, 'w=854&h=480&overlay=1'],
  ['desk 854x480 controls', desk, 'w=854&h=480&controls=1'],
  ['desk 1280x720', desk, 'w=1280&h=720'],
  ['phone 390x219', phone, 'w=390&h=219'],
  ['phone 390x219 drawn at 1920x1080', phone, 'w=390&h=219&vw=1920&vh=1080'],
  ['control video 854x480', desk, 'w=854&h=480', 'aqz-KE-bpKQ', 30],
];
const browser = await chromium.launch({ channel: process.env.PROBE_CHANNEL || undefined, headless: !process.env.PROBE_HEADED, args: ['--autoplay-policy=no-user-gesture-required'] });
const only = (process.env.PROBE_CASES || '').split(',').filter(Boolean);

async function sample(p, label) {
  const out = [];
  for (const at of [5, 15, 30]) {
    await p.waitForTimeout(at === 5 ? 5000 : at === 15 ? 10000 : 15000);
    const yf = p.frames().find(f => /youtube/.test(f.url()));
    let v = null, q = '';
    try { v = yf && await yf.evaluate(() => { const x = document.querySelector('video'); return x ? [x.videoWidth, x.videoHeight, Math.round(x.currentTime)] : null; }); } catch (e) { v = 'err ' + e.message.slice(0, 60); }
    try { q = await p.evaluate(() => window.player && window.player.getPlaybackQuality ? window.player.getPlaybackQuality() + ' state ' + window.player.getPlayerState() + (window.ytError ? ' error ' + window.ytError : '') : ''); } catch (e) { /* the live site keeps its player private */ }
    out.push(at + 's=' + (Array.isArray(v) ? v[1] + 'p@' + v[2] : v) + (q ? '/' + q : ''));
  }
  try {
    const yf = p.frames().find(f => /youtube/.test(f.url()));
    const txt = yf ? await yf.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)) : 'no youtube frame';
    out.push('| ' + txt);
  } catch (e) { out.push('| ' + e.message.slice(0, 60)); }
  const line = (process.env.PROBE_TAG || '') + label + ': ' + out.join(' ');
  console.log('::notice::' + line);
}

for (const [label, ctx, qs, vid = V, start = START] of cases) {
  if (only.length && !only.some(o => label.includes(o))) continue;
  const c = await browser.newContext(ctx);
  const p = await c.newPage();
  await p.goto('http://localhost:8123/?' + qs + '&v=' + vid + '&start=' + start);
  await sample(p, label);
  await c.close();
}
// The real site, normal and wide, clicking play like a viewer would.
for (const [label, wide] of [['site desk', false], ['site desk wide', true]]) {
  if (only.length && !only.some(o => label.includes(o))) continue;
  const c = await browser.newContext(desk);
  await c.addInitScript(w => { try { localStorage.setItem('sf:wide', w ? 'true' : 'false'); } catch (e) {} }, wide);
  const p = await c.newPage();
  await p.goto('https://josephpatrickrautiniconroy-bot.github.io/CS2-Spoil-free/#/match/lp-a77df7458c/0');
  try { await p.click('.big-play', { timeout: 20000 }); } catch (e) { console.log('::notice::' + label + ': no play button, ' + e.message.slice(0, 80)); }
  const size = await p.evaluate(() => { const f = document.querySelector('.video-frame'); return f ? Math.round(f.clientWidth) + 'x' + Math.round(f.clientHeight) : '?'; });
  await sample(p, label + ' ' + size);
  await c.close();
}
await browser.close();
server.close();
