/*
  One-off research probe, run by watch.mjs when "debugProbe": true is in config.json.
  Saves into state.json (under "debugProbe"):
    - timestamp lines from the descriptions of the long stream recordings the watcher skipped,
    - what YouTube search finds for a few known matches (to spot per-map uploads on other channels),
    - whether Liquipedia's pages for recent events carry VOD links with timestamps.
  Remove once the research is done.
*/
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TIME = /(?:^|\s|\[|\()((?:\d{1,2}:)?\d{1,2}:\d{2})(?=$|\s|\]|\)|-)/;

export async function probe({ yt, state, log }) {
  const out = { at: new Date().toISOString(), wikitext: {}, pages: {}, prefix: {}, vodChannels: {} };
  const LP = 'https://liquipedia.net/counterstrike/api.php';
  const headers = { 'User-Agent': 'cs2-spoiler-free-site research probe (github.com/josephpatrickrautiniconroy-bot/CS2-Spoil-free)', 'Accept-Encoding': 'gzip' };
  const lp = async params => {
    const u = new URL(LP);
    for (const [k, v] of Object.entries({ format: 'json', ...params })) u.searchParams.set(k, v);
    await sleep(2500);
    const r = await fetch(u, { headers });
    if (!r.ok) throw new Error('Liquipedia HTTP ' + r.status);
    return r.json();
  };
  const content = async title => {
    const c = await lp({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title, redirects: '1' });
    const page = Object.values(c.query.pages)[0];
    return page && page.revisions ? page.revisions[0].slots.main['*'] : '';
  };
  const vodsIn = text => [...text.matchAll(/\|\s*vod[a-z]*\d*\s*=\s*([^\s|}]+)/gi)].map(m => m[1]);

  // Fixtures for building the Liquipedia reader.
  for (const title of ['PGL/2021/Stockholm', 'PGL/2021/Stockholm/Legends Stage', 'PGL/2026/Masters', 'Intel Extreme Masters/2025/Cologne']) {
    try { out.wikitext[title] = await content(title); } catch (e) { out.wikitext[title] = 'ERROR ' + e.message; }
  }
  try {
    out.expand = await lp({ action: 'expandtemplates', prop: 'wikitext', text: '{{TeamShort|falcons}}\n{{TeamShort|tyloo}}\n{{Team|parivision}}\n{{TeamShort|natus vincere}}\n{{TeamShort|navi}}' });
  } catch (e) { out.expand = 'ERROR ' + e.message; }
  try {
    out.revisions = await lp({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp', titles: 'ESL/Pro League/Season 24|BLAST/Open/2026/Fall|PGL/2026/Masters|Not a real page xyz' });
  } catch (e) { out.revisions = 'ERROR ' + e.message; }
  try {
    out.multiContent = await lp({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: 'FISSURE|FISSURE/Playground/8' });
    for (const pg of Object.values(out.multiContent.query.pages)) if (pg.revisions) pg.revisions[0].slots.main['*'] = pg.revisions[0].slots.main['*'].slice(0, 300);
  } catch (e) { out.multiContent = 'ERROR ' + e.message; }
  log('Research probe saved to state.json.');
  return out;
}
