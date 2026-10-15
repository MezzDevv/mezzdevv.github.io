// Pulls live stats and media for every game the site knows about and writes
// data/roblox.json. Runs daily from .github/workflows/roblox.yml (Roblox's API
// blocks browser requests from other sites, so the page can't fetch it live).
//
// Games come from two lists:
//   data/games.json          - games shown on the page
//   data/counted-games.json  - extra games that only count toward total visits
//
// Run locally: node scripts/update-roblox.mjs

import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const site = await readJson("data/site.json");
const shown = await readJson("data/games.json");
const counted = await readJson("data/counted-games.json");

const placeIds = [
  ...new Set(
    [...shown.games, ...counted.games]
      .map((g) => String(g.placeId ?? "").trim())
      .filter((id) => /^\d+$/.test(id))
  ),
];

// Place ID -> universe ID. Roblox's game APIs key on universe.
const universeByPlace = {};
for (const placeId of placeIds) {
  const { universeId } = await getJson(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
  );
  if (universeId) universeByPlace[placeId] = universeId;
}

const universeIds = Object.values(universeByPlace);
const games = {};
let totalVisits = 0;

// The games APIs accept up to 50 universe IDs per call.
for (let i = 0; i < universeIds.length; i += 50) {
  const batch = universeIds.slice(i, i + 50).join(",");

  const [details, icons, thumbs] = await Promise.all([
    getJson(`https://games.roblox.com/v1/games?universeIds=${batch}`),
    getJson(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${batch}&size=512x512&format=Png`
    ),
    getJson(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${batch}&countPerUniverse=5&size=768x432&format=Png`
    ),
  ]);

  for (const d of details.data) {
    // Key by the place ID the JSON files use, which may not be the root place.
    const placeId =
      Object.keys(universeByPlace).find((p) => universeByPlace[p] === d.id) ??
      String(d.rootPlaceId);
    const icon = icons.data.find((x) => x.targetId === d.id);
    const thumb = thumbs.data.find((x) => x.universeId === d.id);
    games[placeId] = {
      name: d.name,
      creator: d.creator?.name ?? null,
      visits: d.visits ?? 0,
      playing: d.playing ?? 0,
      favorites: d.favoritedCount ?? 0,
      created: d.created,
      updated: d.updated,
      url: `https://www.roblox.com/games/${placeId}`,
      icon: icon?.state === "Completed" ? icon.imageUrl : null,
      thumbnails: (thumb?.thumbnails ?? [])
        .filter((t) => t.state === "Completed")
        .map((t) => t.imageUrl),
    };
    totalVisits += d.visits ?? 0;
  }
}

// Avatar headshot for the hero, from site.json's robloxUserId.
let avatar = null;
if (/^\d+$/.test(String(site.robloxUserId ?? ""))) {
  const { data } = await getJson(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${site.robloxUserId}&size=420x420&format=Png&isCircular=false`
  );
  if (data[0]?.state === "Completed") avatar = data[0].imageUrl;
}

// Site visitor total from GoatCounter's public counter. Fetched here, server-side,
// because ad blockers stop many browsers from reaching GoatCounter directly.
let siteVisitors = null;
try {
  const total = await getJson("https://mezz.goatcounter.com/counter/TOTAL.json");
  siteVisitors = Number(String(total.count ?? "").replace(/\D/g, "")) || 0;
} catch (err) {
  console.warn(`GoatCounter total unavailable: ${err.message}`);
}

const out = {
  updated: new Date().toISOString(),
  avatar,
  siteVisitors,
  totalVisits,
  gameCount: Object.keys(games).length,
  games,
};

await writeFile(
  new URL("data/roblox.json", root),
  JSON.stringify(out, null, 2) + "\n"
);
console.log(
  `Wrote data/roblox.json: ${out.gameCount} games, ${totalVisits} visits`
);
