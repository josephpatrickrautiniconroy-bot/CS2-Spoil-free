# Spoiler-free CS2

A website for watching Counter-Strike tournaments as if they were live: no scores, no video lengths, nothing that gives a result away.

Live at **https://josephpatrickrautiniconroy-bot.github.io/CS2-Spoil-free/**

## How it works

Every 30 minutes GitHub runs the **video watcher** (`watcher/watch.mjs`). It:

1. finds the tournaments to show: every page in Liquipedia's S tier category that starts in the configured date range, plus any listed by hand,
2. reads each tournament's Liquipedia page: stages, rounds, matches, teams, and the video link and start time of every map,
3. every few hours, looks for the organisers' official highlight videos of recent matches (see **Short versions** below),
4. checks with YouTube that each video can be played on other sites,
5. saves it all to `auto.json`, writes a calendar feed per event into `calendar/`, and republishes the site if anything changed.

The videos are the organisers' own uploads, mostly from their archive channels (ESL Archives, BLAST Premier VOD Archive, PGL VOD's), with one video per series. Liquipedia's editors add the links, usually within a day of a match. Each map plays from its start to where the next map begins, and skipping can't leave the map.

The watcher never saves scores, winners, placements or video titles. The only result-like fact it keeps is which maps of a series weren't played, and the site only reveals that when someone opens that map.

## What's in here

| File | What it is | Who changes it |
|---|---|---|
| `index.html` | The website | Nobody, unless you want to change the design |
| `data.json` | The site's own text (name, intro, footer) | You, through edit mode (`?edit` at the end of the address) |
| `auto.json` | Tournaments, teams, matches and videos from Liquipedia | The watcher |
| `collections.json` | Hand-picked collections (see below) | You |
| `watcher/config.json` | Which tournaments to show | You |
| `watcher/watch.mjs`, `watcher/liquipedia.mjs`, `watcher/highlights.mjs`, `watcher/calendar.mjs` | The watcher | Nobody |
| `calendar/` | Calendar feeds for "Add to calendar" | The watcher |
| `watcher/state.json` | The watcher's notes (page versions, team names, checked videos) | The watcher |
| `vendor/trystero-nostr.mjs` | The library watch parties use to connect browsers (Trystero, bundled) | Nobody |
| `.github/workflows/watch.yml` | Runs the watcher every 30 minutes and publishes the site | Nobody |

## Choosing tournaments (`watcher/config.json`)

- **`discover`** adds every tournament in the listed Liquipedia categories that starts between `from` and `to`. It's set to `Category:S-Tier Tournaments` from June 2026 to the end of 2027, so new events show up by themselves once Liquipedia has their page.
  - To add A tier events, add `"Category:A-Tier Tournaments"` to `categories`.
  - To leave an event out, put its Liquipedia page name in `exclude`, for example `"BLAST/Rivals/2027"`. A name ending in `/` leaves out a whole series: `"FISSURE/"` is there because FISSURE doesn't post match videos. Remove it to bring FISSURE events back.
- **`tournaments`** lists events by hand. Use `"liquipedia"` with the page name from its address (https://liquipedia.net/counterstrike/ESL/Pro_League/Season_24 is `"ESL/Pro League/Season 24"`), or `"search"` with the event's name. Add `"name"` to show a different name on the site.

The home page sorts events into **Happening now**, **Ready to watch** (finished) and **Coming up**, based on their dates. Upcoming events are listed before their matches are drawn. A finished event without any videos is hidden two days after it ends.

## Pins

Visitors can pin an event (button on its page) or a team (buttons on a match page, or "Pin a team" on the home page). Pins live in that visitor's browser, there are no accounts. When they come back, a box at the top of the page lists:

- pinned events with matches that came out since they last looked and that they haven't marked as watched, and
- pinned teams whose next match is ready, but only once every earlier match of that team in that event is marked as watched (a team's first match only counts if it's in an open round). That way the notice can't give away who went through. It never names the opponent.

Opening a pinned event, following a notice or pressing Dismiss clears those notices.

## Continue watching

The home page lists the series a visitor started and hasn't marked as watched, newest first, with the map and time they stopped at. It's kept in their browser, like pins. When a map ends, the entry moves on to the next map listed, whether or not that map was played (opening it says so), so the list can't give away how long a series went. An entry goes away when the visitor marks the series as watched, finishes the last possible map, or presses Remove. Match cards show **In progress** for these series.

## Collections (`collections.json`)

Hand-picked groups of series and events, shown on the home page under **Collections**. Each collection has an `id` (used in its address, `#/c/<id>`), a `title`, a `blurb` and a list of `items`. An item is one of:

- a whole event: `{ "event": "ESL/Pro League/Season 24" }`
- a stage: `{ "event": "...", "stage": "Playoffs" }`
- a round: `{ "event": "...", "round": "Grand Final" }` (shows the match if the round has one, or the stage if it has several)
- a match: `{ "match": "lp-7efaffa731" }` (the id from the match's address, `#/match/<id>/0`)

`event` can be the Liquipedia page name, the site's event id, or the event's name. Any item can have a `note`. Items whose event isn't on the site yet are left out, so archive picks can be listed now and appear when the archive adds their event. A collection with nothing to show is hidden.

Keep it spoiler-free: titles, blurbs and notes say what to watch, never how it went. Avoid words like "comeback", "upset", "overtime thriller" or "five maps", since each gives a result away. A match in a hidden round (anything after an event's first round) is shown without its teams until the visitor opens it.

## Short versions and speed

For people short on time, the player has a **speed button** (1× up to 2×, also the `<` and `>` keys). It's remembered in the browser.

A match can also have a **short version**: the organiser's own highlight video of the series. The watcher reads the latest uploads of the channels listed under `highlights` in `watcher/config.json` (ESL, BLAST and PGL's main channels). A video counts as a match's highlights when its title says "highlights", names both teams, and it came out within 4 days of the match. Titles are only read to make that match and are never saved. Videos shorter than two minutes (Shorts) are skipped.

To keep this spoiler-free:

- The short version is only offered once **every match in that round** has one. Organisers don't cut highlights of every match, so a round where only some do could hint at which matches were worth watching.
- It plays like any map: length hidden, and the cover hides YouTube's titles and end screens.
- It covers the whole series, so you learn how many maps were played as you watch it, the same as live.

Liquipedia doesn't record when each round starts in a video, so a "key rounds only" cut of the full match isn't possible from the data we have.

## Calendar reminders

Events that are on now or coming up have an **Add to calendar** button (and pinned events a **Calendar reminders** button on the home page). It offers the event's calendar feed, `calendar/<event-id>.ics`, as a subscription (Apple Calendar, Outlook), in Google Calendar, or as a download. Each match day gets an all-day entry on the following day, "Saturday's matches ready to watch", with a 9am alert where the calendar app supports it. Entries never name teams. The days come from Liquipedia's schedule, and subscribed calendars pick up changes within about a day. `calendar/all.ics` holds every event on now or coming up.

Pinned teams don't get calendar entries, because the date of a team's next match would show whether they went through.

## Watch parties

On any match page, **Start a watch party** gives a link to send to friends. Everyone who opens it watches together: play, pause, skips and opening another map happen for everyone, and there's a chat beside the video (the latest message also shows over the video, so it's seen in full screen). Anyone can name themselves.

- There are no accounts and no server. Browsers connect to each other directly, and public Nostr relays only help them find each other. Some strict networks (some workplaces and mobile carriers) block direct connections, so a friend there may not be able to join.
- It's spoiler-free: only the time into the map is shared, never a video's length or a result. People who join later don't see the earlier chat, and land wherever the party is.
- Someone who opens the link gets a "Join in" button first, because browsers only play sound after a click.
- Best for small groups, up to about eight.
- Everyone watches at the same speed: changing it changes it for the whole party. A short version can be watched together too.

## Event pictures

Each event's logo is copied from Liquipedia into `images/auto/` automatically, with a separate version for dark mode if Liquipedia has one.

To use your own picture instead, upload it to the `images/events/` folder, named after the event's id, for example `images/events/esl-pro-league-season-24.jpg` (JPG, PNG or WebP, ideally 1600×900). The id is the last part of the event's address on the site (`#/t/esl-pro-league-season-24`). On GitHub, open the repository, click **Add file → Upload files**, drag the picture in, and type `images/events/` before its name. The next watcher run (within 30 minutes) puts it on the site.

## If something looks wrong

- **The Actions tab** shows each run. A red cross means a run failed. Click it to see which step.
- **The Issues tab** gets an issue labelled `needs-review` when the watcher can't find a page or category. It closes itself once the problem is fixed.
- **A map says "Video coming soon"** when Liquipedia doesn't have its video link yet. It usually fills in within a day.
- **Video quality**: YouTube picks the quality from the player's size, and sites can't set it directly. So the player's quality button (1080p by default, 720p on phones) draws the video at that size and scales it down to fit. YouTube can still drop lower on a slow connection. The button's menu shows the quality playing right now. If it's stuck at 360p while YouTube offers more, a browser's ad or tracker blocker is the usual cause (Opera's built-in one does this, even with YouTube's normal player). The test page at `tools/quality-test.html` compares the player with YouTube's own and shows where the quality is lost.

## Credits

Match data comes from [Liquipedia](https://liquipedia.net/counterstrike/), under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), and the site credits it in the footer. The watcher follows Liquipedia's API rules: it identifies itself and sends at most one request every two seconds. Videos are played from YouTube.
