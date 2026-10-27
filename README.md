# Tally

Live shot coverage for wedding and event photographers. Tally knows your shot list and family-formals list, reads preview photos as you shoot, and shows what is captured and what is still missing — while you can still fix it.

One file, no build step: [index.html](index.html). Face matching runs in the browser; photos never leave the device.

## Promo clip

[tally-promo.mp4](tally-promo.mp4) is a 38-second animated overview (1280×720, 30 fps) with a synthesized music score. Its source is [promo.html](promo.html): open it in a browser to watch it loop live (silent). The score comes from [promo-music.js](promo-music.js) (`node promo-music.js` writes `promo-music.wav`; no dependencies, no samples, so no licensing). The MP4 is rendered frame by frame from the page with headless Edge, then ffmpeg encodes the video and muxes the score.

## Run it

Open `index.html` in a browser, or serve the folder (needed to open it from a phone):

```bash
python -m http.server 8765 --bind 0.0.0.0
```

Then open `http://localhost:8765` (or `http://<your-LAN-ip>:8765` on a phone on the same Wi-Fi; Windows Firewall may need an inbound rule for the port).

The page needs internet **once** per browser to download the face-recognition library and models from jsdelivr. There is no offline mode yet.

## Use it

Pick a colour theme (aurora, sunset, ocean, blush) with the dots at the top right; the choice is remembered. Fonts (Sora, Plus Jakarta Sans, JetBrains Mono) load from Google Fonts and fall back to system fonts offline.

1. **Shot list** — one shot per line (or click *Load example*):

   ```
   label | people, comma separated | HH:MM-HH:MM | deadline HH:MM
   ```

   - Start a line with `!` for a must-have.
   - `people`, the time window and the deadline are all optional.
   - Moments with no people (e.g. `!Ring exchange | | 14:10-14:25`) are covered when a frame's EXIF time falls in the window.
   - Shots with neither people nor a window are manual: tap the row to mark it done.
2. **People** — names from the list appear here. Add 3+ clear photos of each person (different angles) with *+ photos*.
3. **Photos** — *Add previews* to pick photos, or on desktop Chrome/Edge *Watch folder* to rescan a drop folder (FTP / tether target) every 8 seconds. If the camera clock differs from the phone clock, enter the offset in minutes.
4. **Shots** — each shot is one of:

   | State | Meaning |
   |---|---|
   | Green, matched | All required people found in one frame (and inside the window, if set) |
   | Yellow, probable | Borderline face match — eyeball the named photo |
   | Red, missing | No qualifying frame yet |
   | Green, marked done | Manually ticked |

   Only matched and manually-done shots fill the coverage ring. Probable shots never count as covered.
5. **Alerts** — a must-have still missing after its deadline (default: end of its window) shows a red banner and vibrates the phone once.
6. **Ironclad (verified card backup)** — desktop Chrome/Edge only.
   1. *+ Backup folder* once per destination (e.g. a laptop SSD and an external drive). Re-pick them after a page reload.
   2. *Ingest card* → pick the card (or its DCIM folder) and give it a label. Every file is hashed (SHA-256), copied to each backup folder under `<label>/…`, **re-read from disk** and compared. A `<label>.sha256` manifest is written next to each copy. Hidden files/folders are skipped.
   3. Each card shows **Safe to format** only when at least `MIN_COPIES` (2) backup folders hold every file verified; otherwise **DON'T FORMAT**, with the first problems listed. An interrupted ingest stays red.
   4. Verified `.jpg`/`.jpeg` files from the card are also fed into coverage matching, so a card dump at a break updates the ring.
7. **Report** — *Build end-of-day report* produces a text summary: covered, probable, missing, and per-card backup status.

Everything (list, reference faces, scanned photos' face data, manual ticks) is saved in the browser's `localStorage`, per address. *Clear all data* wipes it.

## Tuning

At the top of the script in `index.html`:

```js
const OK=.5, MAYBE=.6;   // face-distance thresholds
```

Distance below `OK` is a match, below `MAYBE` is probable. With a single reference photo, real matches can land at 0.5–0.6, so use several references per person and adjust these on real shoots. Lower = stricter.

## Known limits

- **Camera link is not built.** Get previews to the phone/laptop with the camera vendor's app (e.g. Sony Transfer & Tagging, Nikon NX MobileAir) or an FTP drop folder, then add or watch them here. Shoot RAW+JPEG so previews exist. Canon's workflow is unverified.
- **Identity matching is imperfect:** veils, profiles, closed eyes, sunglasses, tiny faces in wide shots and dim light cause misses or borderline matches.
- One detected face can currently satisfy two required people (lookalikes could produce a false match).
- Browser `localStorage` is ~5 MB; very large shoots may hit it (the page warns).
- Watch-folder needs a Chromium desktop browser; on phones use the picker.
- No watch app, no offline/PWA mode.
- **Ironclad limits:** files over 1.5 GB (long video) can't be hashed in memory and are flagged as problems, so a card containing them is never marked safe. Backup folders aren't remembered across reloads. Copies are verified against what the browser reads back from disk — it doesn't prove the physical drive is healthy, and there is no offsite/cloud copy tracking yet. Treat it as a second check next to your normal backup routine until you've tested it on your own cards.
- Second-shooter sync, per-job custody timeline and the "vault" view are not built.

## Privacy

Face descriptors of guests are biometric data (e.g. Illinois BIPA, GDPR). Processing here is on-device only, but get consent in your contract and use *Clear all data* after delivery.
