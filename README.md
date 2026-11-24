# Websight — Swipe Arena (event game)

**Live:** https://tonymans33.github.io/swipe-arena/ · booth iPad: https://tonymans33.github.io/swipe-arena/?kiosk=1 · QR poster: https://tonymans33.github.io/swipe-arena/qr-poster.html

The whole game is one file: `index.html`. Host it anywhere static (for example websight.kw/play, Netlify or GitHub Pages).

## Modes
- **Battle:** a this-or-that bracket. 8 projects take 7 picks, and the result is a champion plus a full ranking.
- **Swipe:** a Tinder-style like or pass on each card. Players with 2 or more likes can then battle their likes.

## Game features
- **3-2-1 countdown**, round banners, and a drumroll before the **final** and the **champion reveal**.
- **Score:** points per pick, plus a QUICK bonus while the ⚡ timer bar is still full, and 🔥 streaks for fast picks in a row.
- **Super Like** (Swipe mode): swipe up or tap ⭐, once per game. It marks the player's top pick in the Sheet.
- **Results:** 1–3 stars, a rank title (Rookie → Legend), badges (Lightning Fingers, Streak Master, Big Heart, Tough Critic, Super Fan, Kingmaker), and a Share button on phones.
- **Kiosk:** "Today's top players" (first name + score, stored on that device only) on the results screen, and today's best on the start screen.

## Links
| URL | Use |
|---|---|
| `index.html` | Phones. Remembers the player and shows a WhatsApp button at the end. |
| `index.html?kiosk=1` | Event iPad. No WhatsApp or Share button and no contact memory; project links still work. The results screen resets after 25 s, and an abandoned game resets after 90 s. |
| `?lang=ar` | Opens in Arabic. By default the phone's language is used. |

On the iPad, open the kiosk link, use **Share → Add to Home Screen**, then turn on **Guided Access** so players can't leave the app.

## Contact details on phones
- **iPhone:** websites can't read contacts. The fields use `autocomplete`, so iOS offers the player's own name, phone and email above the keyboard (one tap each).
- **Android (Chrome):** a "Fill from my contacts" button appears and opens the native contact picker.

## Save results to Google Sheets
1. Create a Google Sheet, then open **Extensions → Apps Script**.
2. Replace the code with `google-sheet-script.gs` and save.
3. Choose **Deploy → New deployment → Web app**. Set *Execute as*: **Me** and *Who has access*: **Anyone**, then deploy and authorise.
4. Copy the web app URL into `CONFIG.SHEET_URL` at the top of the script in `index.html`.

Each game becomes one row in a **Plays** tab, and the row updates as the player goes: `playing` → `finished`, `quit`, `left` or `abandoned`. Rows are saved even if the player stops halfway. When the device is offline, results are queued and sent later.

## Projects
The 8 cards are real Websight case studies: AQL, KIB Mubader, ILG, Riders, LIVE, Al Muheet, Wasfat and Arzaq. Edit `PROJECTS` in `index.html`:
- `logo`: shown on a white panel when there is no `image` (LIVE uses its logo until a screenshot is added).
- `image`: a websight.kw path such as `/assets/work/riders-cover.webp` (loaded resized, about 30 KB each, through the site's image optimizer), a full URL, or a local file like `img/x.jpg`. If an image fails to load, the card shows generated art instead. Portrait phone screenshots: add `phone:true` and the image is shown inside a phone frame (LIVE uses `img/live.jpg`).
- `industry` and `desc`: the English and Arabic text on the card.
- `tags`: any of `web`, `app`, `system`, `ai`, `shop`. They show as icon stickers.
- `slug`: the case-study page, websight.kw/<lang>/work/<slug>. Results screens link there.

Battle works with any number of projects; odd counts get a bye.

## Other settings (`CONFIG`)
`REQUIRE_CONTACT: true` makes a phone number or email mandatory. You can also change the WhatsApp number, the site URL and the kiosk timers there. The Websight logo is built into the page, so it shows even when offline.

## Event QR poster
Open `qr-poster.html` in a browser. It is an A4 poster in the game's style, with buttons for **Print / Save PDF**, **QR as PNG** (2000 px) and **QR as SVG**.
Set the game link in `GAME_URL` at the bottom of the file, or open `qr-poster.html?url=https://your-link`. Until then it shows a red placeholder warning.
Point the QR at the public link, not `?kiosk=1` (kiosk mode is only for the booth iPad).

## Music
`audio/music.m4a` is **"Level 3" from the Retro Game Music Pack by Juhani Junkala**, released as **CC0 (public domain)** on OpenGameArt: https://opengameart.org/content/5-chiptunes-action. It's free for commercial use and needs no credit (credited here anyway).
`audio/alt-level-1.m4a` and `audio/alt-level-2.m4a` are Levels 1 and 2 from the same pack. To preview one, add `?music=1` or `?music=2` to the game link. To make one the default, rename it to `music.m4a`.
The tracks were converted from WAV to AAC 96 kbps (about 0.9 MB each). The game loops the music seamlessly, speeds it up for the Final, and dips it under the drumrolls. If the file is missing, a built-in generated loop plays instead.
