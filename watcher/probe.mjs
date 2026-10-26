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

  // Full wikitext of two pages, to learn the match format.
  for (const title of ['ESL/Pro League/Season 24', 'BLAST/Open/2026/Fall']) {
    try { out.wikitext[title] = await content(title); } catch (e) { out.wikitext[title] = 'ERROR ' + e.message; }
  }
  // Subpages and VOD coverage for other events, including old CS:GO ones.
  for (const prefix of ['PGL/2026', 'Intel Extreme Masters/2025/Cologne', 'PGL/2021/Stockholm', 'ESL/One/2014/Cologne', 'BLAST/Premier/2023/World Final', 'StarLadder/2019/Major', 'FISSURE', 'Perfect World/Major/2025']) {
    try {
      const r = await lp({ action: 'query', list: 'prefixsearch', pssearch: prefix, pslimit: '20' });
      out.prefix[prefix] = (r.query.prefixsearch || []).map(x => x.title);
    } catch (e) { out.prefix[prefix] = 'ERROR ' + e.message; }
  }
  const pagesToCount = [];
  for (const list of Object.values(out.prefix)) if (Array.isArray(list)) pagesToCount.push(...list.filter(t => !/\/(Statistics|Results|Media|Broadcast|Qualifier|Qualifiers|Open Qualifier|Closed Qualifier)/i.test(t)).slice(0, 4));
  for (const title of [...new Set(pagesToCount)].slice(0, 24)) {
    try { const t = await content(title); const v = vodsIn(t); out.pages[title] = { length: t.length, vodCount: v.length, samples: v.slice(0, 6), matchTemplates: (t.match(/\{\{Match\b/gi) || []).length, bracketTemplates: (t.match(/\{\{(Bracket|Matchlist|SingleMatch)\b/gi) || []).length }; }
    catch (e) { out.pages[title] = 'ERROR ' + e.message; }
  }
  // Which YouTube channels the Liquipedia VOD links point at.
  const ids = new Set();
  for (const text of Object.values(out.wikitext)) for (const v of vodsIn(text)) { const m = v.match(/(?:youtu\.be\/|v=)([\w-]{11})/); if (m) ids.add(m[1]); }
  for (const p of Object.values(out.pages)) for (const v of (p.samples || [])) { const m = v.match(/(?:youtu\.be\/|v=)([\w-]{11})/); if (m) ids.add(m[1]); }
  const list = [...ids];
  for (let i = 0; i < list.length; i += 50) {
    try {
      const res = await yt('videos', { part: 'snippet,contentDetails,status', id: list.slice(i, i + 50).join(',') });
      for (const v of res.items || []) out.vodChannels[v.id] = { channel: v.snippet.channelTitle, channelId: v.snippet.channelId, title: v.snippet.title, duration: v.contentDetails.duration, embeddable: v.status.embeddable };
    } catch (e) { out.vodChannels.error = e.message; }
  }
  log('Research probe saved to state.json.');
  return out;
}
