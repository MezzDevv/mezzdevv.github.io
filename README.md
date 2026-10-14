# Mezz portfolio

Static site for GitHub Pages. No build step. Everything you edit lives in `data/`.

## Editing

| File | What it holds |
|---|---|
| `data/site.json` | Name, tagline, commission status, links |
| `data/games.json` | Games shown on the page |
| `data/counted-games.json` | Extra games that count toward total visits but aren't shown |
| `data/roblox.json` | **Generated. Don't edit.** Visits, player counts, Roblox thumbnails |
| `media/` | Your own screenshots (Studio shots of in-development games) |

### Add a game to the page

```json
{
  "games": [
    {
      "placeId": "1234567890",
      "status": "In development",
      "duo": true,
      "role": "Scripting, VFX",
      "blurb": "One or two sentences on what the game is.",
      "screenshots": ["media/my-game-1.png"]
    }
  ]
}
```

- `placeId` is the number in the game's Roblox URL. Title, visits and thumbnails come
  from Roblox automatically. Set `"title"` to override the name.
- `status`: `"In development"` hides the Play link. Anything else (e.g. `"Live"`) shows it.
- `screenshots` is optional. Without it the Roblox thumbnail is used.

### Count a game's visits without showing it

Add `{ "placeId": "1234567890" }` to `data/counted-games.json`.

## Visit counter

Roblox's API blocks direct browser requests, so `.github/workflows/roblox.yml` runs
`scripts/update-roblox.mjs` daily (and whenever a games file changes), writes
`data/roblox.json`, and commits it. Run it by hand from the repo's **Actions** tab, or
locally with `node scripts/update-roblox.mjs`.

## Preview locally

```bash
python -m http.server 8765
```

Then open http://localhost:8765. Opening `index.html` directly won't load the data.
