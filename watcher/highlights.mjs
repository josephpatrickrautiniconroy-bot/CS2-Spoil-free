/*
  Finds the organisers' official highlight videos ("Team A vs Team B - HIGHLIGHTS | Event")
  on their main YouTube channels, and links each one to its match. The site offers them as
  a short version of a series.

  A video counts as a match's highlights when its title says "highlights", names both
  teams, and it came out within a few days after the match started. Titles are only read
  here to make that match: they are never saved, since they can carry the score.

  Results are kept in state.highlights (match id -> video id), so they survive a tournament
  page being read again and the video scrolling out of the channel's latest uploads.
*/

const str = v => (v === null || v === undefined) ? '' : String(v);
const arr = v => Array.isArray(v) ? v : [];
const HOUR = 3600 * 1000;
// Lowercase letters and digits only, so "Team Vitality" matches "TEAM VITALITY" and "Vitality".
const flat = s => str(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

// The ways a team's name can appear in a title: "Team Falcons" also as "Falcons".
export function nameForms(name) {
  const n = str(name).trim();
  const forms = new Set([flat(n)]);
  const bare = n.replace(/^team\s+/i, '').replace(/\s+(esports|e-sports|gaming|team|club|gg|academy)$/i, '');
  forms.add(flat(bare));
  return [...forms].filter(f => f.length >= 2);
}

// Is this title a highlight video of a match between these two teams?
export function titleMatches(title, formsA, formsB) {
  if (!/highlight/i.test(title) || /#shorts?\b/i.test(title)) return false;
  const t = flat(title);
  return formsA.some(f => t.includes(f)) && formsB.some(f => t.includes(f));
}

// Picks a match for each upload: both teams in the title, published 0 to maxDays after the match started.
// When a pair played more than once, the latest match before the upload wins.
export function matchUploads(uploads, matches, teamName, maxDays = 4) {
  const found = {};
  const forms = new Map();
  const formsOf = id => { if (!forms.has(id)) forms.set(id, nameForms(teamName(id))); return forms.get(id); };
  for (const up of uploads) {
    const at = Date.parse(up.publishedAt);
    if (!at) continue;
    let best = null;
    for (const m of matches) {
      const t = Date.parse(m.time);
      if (!t || at < t || at - t > maxDays * 24 * HOUR) continue;
      if (!titleMatches(up.title, formsOf(m.a), formsOf(m.b))) continue;
      if (!best || t > Date.parse(best.time)) best = m;
    }
    if (best && !found[best.id]) found[best.id] = up.id;
  }
  return found;
}

/* Reads the latest uploads of the configured channels and records new highlight matches.
   yt(endpoint, params) is the watcher's YouTube helper. Returns how many new links it found. */
export async function findHighlights({ config, state, auto, yt, now, log, warn }) {
  const hc = config.highlights;
  if (!hc || !arr(hc.channels).length) return 0;
  const hs = state.highlightScan = (state.highlightScan && typeof state.highlightScan === 'object') ? state.highlightScan : {};
  state.highlights = (state.highlights && typeof state.highlights === 'object') ? state.highlights : {};
  hs.uploads = (hs.uploads && typeof hs.uploads === 'object') ? hs.uploads : {};
  const every = (+hc.everyHours || 3) * HOUR;
  if (hs.checkedAt && now.getTime() - Date.parse(hs.checkedAt) < every) return 0;

  // Only matches from the last few weeks can still get highlights.
  const since = now.getTime() - (+hc.lookBackDays || 21) * 24 * HOUR;
  const recent = auto.matches.filter(m => m.time && Date.parse(m.time) > since && !state.highlights[m.id]);
  if (!recent.length) return 0;
  hs.checkedAt = now.toISOString();

  const teams = new Map(arr(auto.teams).map(t => [t.id, t.name]));
  const uploads = [];
  for (const handle of arr(hc.channels).map(str)) {
    try {
      // A channel's uploads are a playlist. Its id is looked up once per channel (1 quota unit).
      let list = hs.uploads[handle];
      if (!list) {
        const res = await yt('channels', { part: 'contentDetails', forHandle: handle.replace(/^@/, '') });
        list = (((arr(res.items)[0] || {}).contentDetails || {}).relatedPlaylists || {}).uploads || '';
        if (!list) { warn('Couldn’t find the YouTube channel ' + handle + ' for highlights.'); continue; }
        hs.uploads[handle] = list;
      }
      let token = '';
      for (let page = 0; page < (+hc.pages || 2); page++) {
        const q = { part: 'snippet', playlistId: list, maxResults: '50' };
        if (token) q.pageToken = token;
        const res = await yt('playlistItems', q);
        for (const it of arr(res.items)) {
          const sn = it.snippet || {};
          const id = (sn.resourceId || {}).videoId;
          if (id) uploads.push({ id, title: str(sn.title), publishedAt: str(sn.publishedAt) });
        }
        token = res.nextPageToken;
        if (!token) break;
      }
    } catch (e) { warn('Couldn’t read the uploads of ' + handle + ': ' + e.message); }
  }
  const found = matchUploads(uploads, recent, id => teams.get(id) || '', +hc.maxDaysAfter || 4);
  Object.assign(state.highlights, found);
  const n = Object.keys(found).length;
  log('Read ' + uploads.length + ' recent uploads from ' + arr(hc.channels).join(', ') + ' and found highlights for ' + n + ' more matches.');
  return n;
}
