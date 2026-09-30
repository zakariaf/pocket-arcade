# The Toybox icon catalogue

## Contents

- How to read the table
- The 41 icons
- The rating-star layers

## How to read the table

Every icon is drawn on the 24-unit grid in one colour. `stroke w` = the path stroked at width w with round caps and round joins (unless noted); `fill` = filled with the nonzero rule; `fill even-odd` = the lock body with its keyhole; `+ edge 1.4` = a filled shape that also gets a 1.4 stroke with a butt cap and round join, which rounds its corners. The same data is in `templates/packages/tooling/src/art/icon-layers.json` (what `build-icon-paths.ts` reads). Only `back`, `chevron`, `forward` and `undo` mirror in RTL.

## The 41 icons

| Icon | Mockup name | Mirrors | Used for | Layers, in draw order |
|---|---|---|---|---|
| `play` | play | no | Play caps, flag, week today mark | fill: `M8 5c0-1 1.1-1.6 1.9-1l10 6.9c.7.5.7 1.6 0 2.1l-10 6.9c-.8.6-1.9 0-1.9-1z`<br>stroke 1.4 (butt cap): `M8 5c0-1 1.1-1.6 1.9-1l10 6.9c.7.5.7 1.6 0 2.1l-10 6.9c-.8.6-1.9 0-1.9-1z` |
| `pause` | pause | no | game top bar | fill: `M7.1 4.5H8.7A1.6 1.6 0 0 1 10.3 6.1V17.9A1.6 1.6 0 0 1 8.7 19.5H7.1A1.6 1.6 0 0 1 5.5 17.9V6.1A1.6 1.6 0 0 1 7.1 4.5Z`<br>fill: `M15.3 4.5H16.9A1.6 1.6 0 0 1 18.5 6.1V17.9A1.6 1.6 0 0 1 16.9 19.5H15.3A1.6 1.6 0 0 1 13.7 17.9V6.1A1.6 1.6 0 0 1 15.3 4.5Z` |
| `gear` | gear | no | settings button | stroke 3.6: `M12 2.9v2M12 19.1v2M2.9 12h2M19.1 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4`<br>stroke 2.5: `M5.9 12A6.1 6.1 0 1 0 18.1 12A6.1 6.1 0 1 0 5.9 12Z`<br>fill: `M9.7 12A2.3 2.3 0 1 0 14.3 12A2.3 2.3 0 1 0 9.7 12Z` |
| `back` | back | yes | top-bar back, import save | stroke 2.5: `M10.5 5 3.8 12l6.7 7M4.6 12h15.6` |
| `star-filled` | star | no | icon tiles, benefits, debug | fill: `M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z`<br>stroke 1.4 (butt cap): `M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z` |
| `star-outline` | starEmpty | no | rate row | stroke 2.5: `M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z` |
| `lock` | lock | no | locked tiles and packs, local note | stroke 2.5: `M8 10.8V8a4 4 0 0 1 8 0v2.8`<br>fill even-odd: `M7.5 10.5h9A2.5 2.5 0 0 1 19 13v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18v-5a2.5 2.5 0 0 1 2.5-2.5zM12 13.4a1.5 1.5 0 0 0-.85 2.74V18h1.7v-1.86A1.5 1.5 0 0 0 12 13.4z` |
| `crown` | crown | no | Premium | fill: `M3.4 7.6l4.8 4.1L12 4.9l3.8 6.8 4.8-4.1-1.9 10.1H5.3z`<br>stroke 1.4 (butt cap): `M3.4 7.6l4.8 4.1L12 4.9l3.8 6.8 4.8-4.1-1.9 10.1H5.3z`<br>stroke 2.5: `M5.6 20.8h12.8` |
| `calendar` | calendar | no | daily | stroke 2.5: `M6 5.5H18A2.5 2.5 0 0 1 20.5 8V18A2.5 2.5 0 0 1 18 20.5H6A2.5 2.5 0 0 1 3.5 18V8A2.5 2.5 0 0 1 6 5.5Z`<br>stroke 2.5: `M3.5 10.5h17M8 3.3v4M16 3.3v4`<br>fill: `M14.3 13.5H16.1A0.9 0.9 0 0 1 17 14.4V16.2A0.9 0.9 0 0 1 16.1 17.1H14.3A0.9 0.9 0 0 1 13.4 16.2V14.4A0.9 0.9 0 0 1 14.3 13.5Z` |
| `stats` | stats | no | statistics | fill: `M4.8 12H6.8A1.3 1.3 0 0 1 8.1 13.3V19.2A1.3 1.3 0 0 1 6.8 20.5H4.8A1.3 1.3 0 0 1 3.5 19.2V13.3A1.3 1.3 0 0 1 4.8 12Z`<br>fill: `M11 4.5H13A1.3 1.3 0 0 1 14.3 5.8V19.2A1.3 1.3 0 0 1 13 20.5H11A1.3 1.3 0 0 1 9.7 19.2V5.8A1.3 1.3 0 0 1 11 4.5Z`<br>fill: `M17.2 8.5H19.2A1.3 1.3 0 0 1 20.5 9.8V19.2A1.3 1.3 0 0 1 19.2 20.5H17.2A1.3 1.3 0 0 1 15.9 19.2V9.8A1.3 1.3 0 0 1 17.2 8.5Z` |
| `sound` | sound | no | sound rows and keys | fill: `M3.8 9.2h3.4l4.6-4v13.6l-4.6-4H3.8z`<br>stroke 1.4 (butt cap): `M3.8 9.2h3.4l4.6-4v13.6l-4.6-4H3.8z`<br>stroke 2.5: `M15.6 9a4.2 4.2 0 0 1 0 6M18.4 6.2a8 8 0 0 1 0 11.6` |
| `music` | music | no | music rows and keys | stroke 2.5: `M9.5 17.5V6l10-2.3v11.6`<br>fill: `M4.1 17.5A2.9 2.9 0 1 0 9.9 17.5A2.9 2.9 0 1 0 4.1 17.5Z`<br>fill: `M14.1 15.3A2.9 2.9 0 1 0 19.9 15.3A2.9 2.9 0 1 0 14.1 15.3Z` |
| `vibration` | vibration | no | vibration rows and keys | stroke 2.5: `M10 3.6H14A2.2 2.2 0 0 1 16.2 5.8V18.2A2.2 2.2 0 0 1 14 20.4H10A2.2 2.2 0 0 1 7.8 18.2V5.8A2.2 2.2 0 0 1 10 3.6Z`<br>stroke 2.5: `M4.3 8.5v7M19.7 8.5v7M1.6 10.5v3M22.4 10.5v3` |
| `globe` | globe | no | language | stroke 2.5: `M3.3 12A8.7 8.7 0 1 0 20.7 12A8.7 8.7 0 1 0 3.3 12Z`<br>stroke 2.5: `M3.6 12h16.8M12 3.3c2.5 2.4 3.8 5.3 3.8 8.7s-1.3 6.3-3.8 8.7c-2.5-2.4-3.8-5.3-3.8-8.7S9.5 5.7 12 3.3z` |
| `restore` | restore | no | replay, restore, restart | stroke 2.5: `M19.3 13.2A7.5 7.5 0 1 1 17 6.6`<br>fill: `M20.2 3.6 20 9.9l-6-1.8z`<br>stroke 1.4 (butt cap): `M20.2 3.6 20 9.9l-6-1.8z` |
| `info` | info | no | about, notes | stroke 2.5: `M3.3 12A8.7 8.7 0 1 0 20.7 12A8.7 8.7 0 1 0 3.3 12Z`<br>stroke 2.5: `M12 11v5.6`<br>fill: `M10.45 7.7A1.55 1.55 0 1 0 13.55 7.7A1.55 1.55 0 1 0 10.45 7.7Z` |
| `trash` | trash | no | reset | stroke 2.5: `M3.8 6.5h16.4M9.5 6.5V4h5v2.5M6.2 6.5l.9 12.6a1.6 1.6 0 0 0 1.6 1.4h6.6a1.6 1.6 0 0 0 1.6-1.4l.9-12.6M10 10.5v6M14 10.5v6` |
| `check` | check | no | toggles, segments, radio, done | stroke 3.1: `m4.6 12.6 4.7 4.7L19.4 7` |
| `close` | close | no | no ads, missed, ads never | stroke 3.1: `M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7` |
| `chevron` | chevron | yes | row ends | stroke 3.1: `m9.2 5.2 6.8 6.8-6.8 6.8` |
| `forward` | forward | yes | Next, Continue, export save | stroke 2.5: `M13.5 5l6.7 7-6.7 7M19.4 12H3.8` |
| `home` | home | no | Home | stroke 2.5: `M3.5 11.2 12 4l8.5 7.2M6 9.6V19a1.5 1.5 0 0 0 1.5 1.5h3v-5.4h3v5.4h3A1.5 1.5 0 0 0 18 19V9.6` |
| `grid` | grid | no | Levels | fill: `M5.3 3.5H9.1A1.8 1.8 0 0 1 10.9 5.3V9.1A1.8 1.8 0 0 1 9.1 10.9H5.3A1.8 1.8 0 0 1 3.5 9.1V5.3A1.8 1.8 0 0 1 5.3 3.5Z`<br>fill: `M14.9 3.5H18.7A1.8 1.8 0 0 1 20.5 5.3V9.1A1.8 1.8 0 0 1 18.7 10.9H14.9A1.8 1.8 0 0 1 13.1 9.1V5.3A1.8 1.8 0 0 1 14.9 3.5Z`<br>fill: `M5.3 13.1H9.1A1.8 1.8 0 0 1 10.9 14.9V18.7A1.8 1.8 0 0 1 9.1 20.5H5.3A1.8 1.8 0 0 1 3.5 18.7V14.9A1.8 1.8 0 0 1 5.3 13.1Z`<br>fill: `M14.9 13.1H18.7A1.8 1.8 0 0 1 20.5 14.9V18.7A1.8 1.8 0 0 1 18.7 20.5H14.9A1.8 1.8 0 0 1 13.1 18.7V14.9A1.8 1.8 0 0 1 14.9 13.1Z` |
| `book` | book | no | How to play | stroke 2.5: `M3.5 5.8c2.9-1.2 5.8-1 8.5.9 2.7-1.9 5.6-2.1 8.5-.9v12.8c-2.9-1.2-5.8-1-8.5.9-2.7-1.9-5.6-2.1-8.5-.9zM12 6.7v12.8` |
| `chain` | chain | no | streak | stroke 2.5: `M10.2 13.8l-1.9 1.9a3.3 3.3 0 0 1-4.7-4.7l2.6-2.6a3.3 3.3 0 0 1 4.7 0M13.8 10.2l1.9-1.9a3.3 3.3 0 0 1 4.7 4.7l-2.6 2.6a3.3 3.3 0 0 1-4.7 0M9.6 14.4l4.8-4.8` |
| `mail` | mail | no | contact | stroke 2.5: `M5.4 5.5H18.6A2.2 2.2 0 0 1 20.8 7.7V16.3A2.2 2.2 0 0 1 18.6 18.5H5.4A2.2 2.2 0 0 1 3.2 16.3V7.7A2.2 2.2 0 0 1 5.4 5.5Z`<br>stroke 2.5: `m4.2 7.4 7.8 5.9 7.8-5.9` |
| `shield` | shield | no | privacy | stroke 2.5: `M12 3.3l7.2 2.9v5.3c0 4.5-3 8-7.2 9.2-4.2-1.2-7.2-4.7-7.2-9.2V6.2z`<br>stroke 2.5: `m8.8 12 2.3 2.3 4.2-4.4` |
| `doc` | doc | no | policy, licences | stroke 2.5: `M6.8 3.5h7l4.4 4.4v11.1a1.5 1.5 0 0 1-1.5 1.5H6.8A1.5 1.5 0 0 1 5.3 19V5a1.5 1.5 0 0 1 1.5-1.5zM13.5 3.8v4.4h4.4M8.7 12.5h6.6M8.7 16h6.6` |
| `wifi-off` | wifiOff | no | offline | stroke 2.5: `M2.6 8.6a14 14 0 0 1 18.8 0M5.6 12a9.5 9.5 0 0 1 12.8 0M8.8 15.3a5 5 0 0 1 6.4 0M3.6 3.6l16.8 16.8`<br>fill: `M10.5 19.2A1.5 1.5 0 1 0 13.5 19.2A1.5 1.5 0 1 0 10.5 19.2Z` |
| `clock` | clock | no | pending | stroke 2.5: `M3.3 12A8.7 8.7 0 1 0 20.7 12A8.7 8.7 0 1 0 3.3 12Z`<br>stroke 2.5: `M12 7.2V12l3.3 2.2` |
| `alert` | alert | no | errors, lose reason | stroke 2.5: `M10.4 4.4a1.8 1.8 0 0 1 3.2 0l7.3 13.3a1.8 1.8 0 0 1-1.6 2.7H4.7a1.8 1.8 0 0 1-1.6-2.7z`<br>stroke 2.5: `M12 9.5v4.3`<br>fill: `M10.55 16.9A1.45 1.45 0 1 0 13.45 16.9A1.45 1.45 0 1 0 10.55 16.9Z` |
| `endless` | endless | no | Endless | stroke 2.5: `M12 12c-1.6-2.1-3-3.4-4.9-3.4a3.4 3.4 0 0 0 0 6.8c1.9 0 3.3-1.3 4.9-3.4s3-3.4 4.9-3.4a3.4 3.4 0 0 1 0 6.8c-1.9 0-3.3-1.3-4.9-3.4z` |
| `undo` | undo | yes | game top bar | stroke 2.5: `M8.5 5.5 4 10l4.5 4.5`<br>stroke 2.5: `M4.6 10H15a5 5 0 0 1 0 10h-3` |
| `hint` | hint | no | hints | stroke 2.5: `M9.2 18h5.6M10.2 21h3.6M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z` |
| `ad` | ad | no | rewarded ad | stroke 2.5: `M5.5 5H18.5A2.5 2.5 0 0 1 21 7.5V16.5A2.5 2.5 0 0 1 18.5 19H5.5A2.5 2.5 0 0 1 3 16.5V7.5A2.5 2.5 0 0 1 5.5 5Z`<br>fill: `M10 9.2v5.6l4.6-2.8z`<br>stroke 1.4 (butt cap): `M10 9.2v5.6l4.6-2.8z` |
| `hash` | hash | no | numbers, font test | stroke 2.5: `M9.6 4 8 20M16 4l-1.6 16M4.5 9h15.5M4 15h15.5` |
| `theme` | theme | no | theme | stroke 2.5: `M3.4 12A8.6 8.6 0 1 0 20.6 12A8.6 8.6 0 1 0 3.4 12Z`<br>fill: `M12 3.4a8.6 8.6 0 0 1 0 17.2z` |
| `eye` | eye | no | colour-blind | stroke 2.5: `M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12z`<br>fill: `M8.9 12A3.1 3.1 0 1 0 15.1 12A3.1 3.1 0 1 0 8.9 12Z` |
| `motion` | motion | no | reduce motion | stroke 2.5: `M2.8 12h3.4l2.6-5.5 4.2 11 2.6-5.5h5.6` |
| `bug` | bug | no | debug badge | stroke 2.5: `M12 7.6H12A5 5 0 0 1 17 12.6V15A5 5 0 0 1 12 20H12A5 5 0 0 1 7 15V12.6A5 5 0 0 1 12 7.6Z`<br>stroke 2.5: `M12 11v9M7 13H3.6M20.4 13H17M7.4 17.4l-2.8 2M16.6 17.4l2.8 2M7.5 9.6 5 7.2M16.5 9.6 19 7.2M9.4 7.8a2.6 2.6 0 0 1 5.2 0` |
| `dash` | dash | no | toggle off, pause key off | stroke 3.1: `M7 12h10` |

## The rating-star layers

The rating star is two colours, so it is not a normal icon: tiles and rows stack two icon rasters of the same star path, `rating-fill` tinted `starOn` and `rating-edge` tinted `border` (filled star), or only `rating-edge` tinted `starOff` (hollow star; `onPrimary` on the current level tile). 13 pt mini stars use `rating-edge-mini` (edge 2.2 instead of 1.8).

Star path: `M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z`

| Layer | What it is |
|---|---|
| `rating-fill` | the star filled (nonzero) |
| `rating-edge` | the star outline stroked 1.8, round join |
| `rating-edge-mini` | the star outline stroked 2.2, round join (13 pt mini stars) |

The single-colour glyphs `star-filled` and `star-outline` above are for icon tiles and rows, not for ratings.
