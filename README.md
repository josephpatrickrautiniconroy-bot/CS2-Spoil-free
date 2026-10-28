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
| `ratings/database.rules.json` | Who can read and write ratings in Firebase | Nobody, paste it into Firebase once |
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

## "Worth watching" ratings

After marking a match as watched, a visitor can rate the whole series: **Must watch**, **Worth a watch** or **Only for fans**. Once at least 3 people have voted, match cards and the match page show a badge, but only for the two good tiers, so a missing badge can just as well mean too few votes. Votes never mention scores or maps, so they can't tell who won or how many maps were played. Anyone who'd rather not see badges can press **Hide ratings** at the bottom of the page.

Votes are shared between visitors through a free Firebase Realtime Database. Each browser gets an anonymous sign-in, so there's one vote per browser and nobody makes an account. Until it's set up, the site simply leaves ratings out.

To set it up (about 10 minutes, free Spark plan, no card needed):

1. Go to https://console.firebase.google.com, **Create a project**, and skip Google Analytics.
2. **Build → Authentication → Get started → Sign-in method → Anonymous**, turn it on and save.
3. **Build → Realtime Database → Create database**, pick a location, start in **locked mode**. On the **Rules** tab, paste the contents of `ratings/database.rules.json` and press **Publish**.
4. **Project settings (gear) → General → Your apps → Web (</>)**, register an app (any nickname, no hosting). Copy `apiKey` and `databaseURL` from the config it shows.
5. Add them to `data.json` under `site`:

   ```json
   "firebase": { "apiKey": "AIza...", "databaseURL": "https://your-project-default-rtdb.firebaseio.com" }
   ```

   These two values are meant to be public; the rules decide what visitors can do.

## Watch parties

On any match page, **Start a watch party** gives a link to send to friends. Everyone who opens it watches together: play, pause, skips and opening another map happen for everyone, and there's a chat beside the video (the latest message also shows over the video, so it's seen in full screen). Anyone can name themselves.

- There are no accounts and no server. Browsers connect to each other directly, and public Nostr relays only help them find each other. Some strict networks (some workplaces and mobile carriers) block direct connections, so a friend there may not be able to join.
- It's spoiler-free: only the time into the map is shared, never a video's length or a result. People who join later don't see the earlier chat, and land wherever the party is.
- Someone who opens the link gets a "Join in" button first, because browsers only play sound after a click.
- Best for small groups, up to about eight.

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
