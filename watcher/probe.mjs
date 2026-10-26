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
  const out = { at: new Date().toISOString(), descriptions: {}, searches: {}, liquipedia: {} };

  // 1. Descriptions of long stream recordings
  const longIds = Object.entries(state.debug || {}).filter(([, v]) => v.minutes > 240).map(([id]) => id);
  for (let i = 0; i < longIds.length; i += 50) {
    try {
      const res = await yt('videos', { part: 'snippet', id: longIds.slice(i, i + 50).join(',') });
      for (const v of res.items || []) {
        const desc = String(v.snippet.description || '');
        const lines = desc.split(/\r?\n/);
        out.descriptions[v.id] = {
          title: v.snippet.title,
          length: desc.length,
          timestampLines: lines.filter(l => TIME.test(l)).slice(0, 40),
          start: desc.slice(0, 400)
        };
      }
    } catch (e) { out.descriptions.error = e.message; }
  }

  // 2. YouTube search for known matches
  const queries = [
    'Spirit vs MOUZ BLAST Open Porto 2026 grand final',
    'Spirit vs MOUZ map 1 BLAST Open Porto 2026',
    'G2 vs NAVI PGL Masters Bucharest 2026',
    'FURIA vs Vitality BLAST Open Porto 2026 quarterfinal',
    'ESL Pro League Season 24 grand final',
    'ESL Pro League Season 24 map 1',
    'BLAST Open Porto 2026 full match',
    'CS2 full match VOD 2026'
  ];
  for (const q of queries) {
    try {
      const res = await yt('search', { part: 'snippet', type: 'video', maxResults: '15', q, order: 'relevance' });
      const items = (res.items || []).map(it => ({ id: it.id.videoId, channel: it.snippet.channelTitle, channelId: it.snippet.channelId, title: it.snippet.title, published: it.snippet.publishedAt }));
      if (items.length) {
        const det = await yt('videos', { part: 'contentDetails,status,liveStreamingDetails', id: items.map(x => x.id).join(',') });
        for (const d of det.items || []) {
          const x = items.find(i => i.id === d.id);
          if (x) { x.duration = d.contentDetails.duration; x.embeddable = d.status && d.status.embeddable; x.wasLive = !!(d.liveStreamingDetails && d.liveStreamingDetails.actualStartTime); }
        }
      }
      out.searches[q] = items;
    } catch (e) { out.searches[q] = { error: e.message }; }
  }

  // 3. Liquipedia VOD links (API rules: own user agent, at most one request every 2 seconds)
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
  for (const term of ['BLAST Open Porto 2026', 'ESL Pro League Season 24', 'PGL Masters Bucharest 2026', 'IEM Cologne 2025']) {
    const entry = out.liquipedia[term] = { pages: [] };
    try {
      const s = await lp({ action: 'query', list: 'search', srsearch: term, srlimit: '6' });
      const titles = (s.query && s.query.search || []).map(x => x.title);
      entry.searchHits = titles;
      for (const title of titles.slice(0, 4)) {
        const c = await lp({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title });
        const page = Object.values(c.query.pages)[0];
        const text = page && page.revisions ? page.revisions[0].slots.main['*'] : '';
        const vods = [...text.matchAll(/\|\s*vod[a-z]*\d*\s*=\s*([^\s|}]+)/gi)].map(m => m[1]);
        entry.pages.push({ title, length: text.length, vodCount: vods.length, vodSamples: vods.slice(0, 15), hasMatch2: /\{\{Match\b/i.test(text) });
      }
    } catch (e) { entry.error = e.message; }
  }

  log('Research probe saved to state.json.');
  return out;
}
