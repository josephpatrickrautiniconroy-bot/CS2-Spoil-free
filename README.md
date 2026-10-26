# Spoiler-free CS2

A website for watching Counter-Strike tournaments as if they were live: no scores, no video lengths, nothing that gives a result away.

Live at **https://josephpatrickrautiniconroy-bot.github.io/CS2-Spoil-free/**

## How it works

Every 30 minutes GitHub runs the **video watcher** (`watcher/watch.mjs`). It:

1. finds the tournaments to show: every page in Liquipedia's S tier category that starts in the configured date range, plus any listed by hand,
2. reads each tournament's Liquipedia page: stages, rounds, matches, teams, and the video link and start time of every map,
3. checks with YouTube that each video can be played on other sites,
4. saves it all to `auto.json`, and republishes the site if anything changed.

The videos are the organisers' own uploads, mostly from their archive channels (ESL Archives, BLAST Premier VOD Archive, PGL VOD's), with one video per series. Liquipedia's editors add the links, usually within a day of a match. Each map plays from its start to where the next map begins, and skipping can't leave the map.

The watcher never saves scores, winners, placements or video titles. The only result-like fact it keeps is which maps of a series weren't played, and the site only reveals that when someone opens that map.

## What's in here

| File | What it is | Who changes it |
|---|---|---|
| `index.html` | The website | Nobody, unless you want to change the design |
| `data.json` | The site's own text (name, intro, footer) | You, through edit mode (`?edit` at the end of the address) |
| `auto.json` | Tournaments, teams, matches and videos from Liquipedia | The watcher |
| `watcher/config.json` | Which tournaments to show | You |
| `watcher/watch.mjs`, `watcher/liquipedia.mjs` | The watcher | Nobody |
| `watcher/state.json` | The watcher's notes (page versions, team names, checked videos) | The watcher |
| `.github/workflows/watch.yml` | Runs the watcher every 30 minutes and publishes the site | Nobody |

## Choosing tournaments (`watcher/config.json`)

- **`discover`** adds every tournament in the listed Liquipedia categories that starts between `from` and `to`. It's set to `Category:S-Tier Tournaments` from June 2026 to the end of 2027, so new events show up by themselves once Liquipedia has their page.
  - To add A tier events, add `"Category:A-Tier Tournaments"` to `categories`.
  - To leave an event out, put its Liquipedia page name in `exclude`, for example `"FISSURE/Playground/6"`.
- **`tournaments`** lists events by hand. Use `"liquipedia"` with the page name from its address (https://liquipedia.net/counterstrike/ESL/Pro_League/Season_24 is `"ESL/Pro League/Season 24"`), or `"search"` with the event's name. Add `"name"` to show a different name on the site.

The home page sorts events into **Happening now**, **Ready to watch** (finished) and **Coming up**, based on their dates. Upcoming events are listed before their matches are drawn. A finished event without any videos is hidden. FISSURE doesn't post match videos, for example.

## Event pictures

Each event's logo is copied from Liquipedia into `images/auto/` automatically, with a separate version for dark mode if Liquipedia has one.

To use your own picture instead, upload it to the `images/events/` folder, named after the event's id, for example `images/events/esl-pro-league-season-24.jpg` (JPG, PNG or WebP, ideally 1600×900). The id is the last part of the event's address on the site (`#/t/esl-pro-league-season-24`). On GitHub, open the repository, click **Add file → Upload files**, drag the picture in, and type `images/events/` before its name. The next watcher run (within 30 minutes) puts it on the site.

## If something looks wrong

- **The Actions tab** shows each run. A red cross means a run failed. Click it to see which step.
- **The Issues tab** gets an issue labelled `needs-review` when the watcher can't find a page or category. It closes itself once the problem is fixed.
- **A map says "Video coming soon"** when Liquipedia doesn't have its video link yet. It usually fills in within a day.
- **Video quality** is chosen by YouTube based on the player's size, and sites can't set it. The wide player (W) and full screen (F) get the best quality.

## Credits

Match data comes from [Liquipedia](https://liquipedia.net/counterstrike/), under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), and the site credits it in the footer. The watcher follows Liquipedia's API rules: it identifies itself and sends at most one request every two seconds. Videos are played from YouTube.
