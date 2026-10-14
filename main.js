// Renders the page from the files in data/. Edit those, not this.

const load = (path) =>
  fetch(path, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

const [site, games, builds, roblox] = await Promise.all([
  load("data/site.json"),
  load("data/games.json"),
  load("data/builds.json"),
  load("data/roblox.json"),
]);

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

const fmt = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Hero ----------

if (site) {
  $("name").textContent = site.name;
  $("tagline").textContent = site.tagline;

  $("hero-links").replaceChildren(...site.links.map(linkNode));
}

// A link with a URL opens it. One with only a handle (Discord usernames have no
// public URL) copies the handle instead.
function linkNode(l) {
  const text = l.handle ? `${l.label}: ${l.handle}` : l.label;
  if (l.url) return el("a", { href: l.url, rel: "me noopener" }, text);

  const button = el("button", { type: "button", class: "copy" }, text);
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(l.handle);
      button.textContent = `Copied ${l.handle}`;
    } catch {
      button.textContent = text;
    }
    setTimeout(() => (button.textContent = text), 1800);
  });
  return button;
}

// The one moment of motion on the page: the visit count rolls up on load.
function rollUp(node, target) {
  if (reduceMotion || target < 10) {
    node.textContent = fmt.format(target);
    return;
  }
  const duration = 1400;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    node.textContent = fmt.format(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const total = roblox?.totalVisits ?? 0;
if (total > 0) {
  rollUp($("visits-number"), total);
  const n = roblox.gameCount;
  $("visits-label").textContent =
    `visits across ${n} game${n === 1 ? "" : "s"} I've worked on`;
} else {
  $("visits").classList.add("is-empty");
  $("visits-number").textContent = "–";
  $("visits-label").textContent = "Visit count updates once games are added";
}

// ---------- Games ----------

const shown = games?.games ?? [];
if (shown.length === 0) {
  $("games").replaceChildren(
    el("div", { class: "empty" },
      el("p", {}, "Games go here as they're ready to show. Several are in development now."))
  );
} else {
  $("games").replaceChildren(...shown.map(renderGame));
}

function renderGame(g) {
  const live = roblox?.games?.[String(g.placeId)] ?? {};
  const title = g.title || live.name || "Untitled game";
  const image = g.screenshots?.[0] || live.thumbnails?.[0] || live.icon;
  const url = g.url || live.url;
  const status = g.status || "In development";
  const isLive = status === "Live";
  const roles = [g.role ?? []].flat();

  const tags = [
    el("li", { class: isLive ? null : "is-dev" }, status),
    g.duo ? el("li", {}, "Duo project") : null,
    ...roles.map((r) => el("li", {}, r)),
  ];

  const stats = [];
  if (live.visits) stats.push(`${compact.format(live.visits)} visits`);
  if (live.playing) stats.push(`${fmt.format(live.playing)} playing now`);

  return el("article", { class: "game" },
    el("div", { class: "game-media" },
      image
        ? el("img", { src: image, alt: `${title} screenshot`, loading: "lazy" })
        : el("span", { class: "game-media-empty" }, "Screenshots soon")),
    el("h3", {}, title),
    el("ul", { class: "game-tags" }, tags),
    g.blurb ? el("p", {}, g.blurb) : null,
    stats.length ? el("p", { class: "game-stats" }, stats.join(", ")) : null,
    url && isLive ? el("a", { href: url }, `Play ${title} on Roblox`) : null
  );
}

// ---------- Builds ----------

const shownBuilds = builds?.builds ?? [];
$("builds-section").hidden = shownBuilds.length === 0;
$("builds").replaceChildren(
  ...shownBuilds.map((b) =>
    el("figure", { class: "build" },
      el("img", { src: b.image, alt: b.alt || b.title, loading: "lazy" }),
      el("figcaption", {},
        el("strong", {}, b.title),
        b.game ? ` for ${b.game}` : null,
        b.note ? el("span", { class: "build-note" }, b.note) : null))
  )
);

// ---------- Commissions ----------

if (site) {
  const open = site.commissions?.open;
  const status = $("commission-status");
  status.textContent = open ? "Open for commissions" : "Commissions closed for now";
  status.classList.toggle("is-open", !!open);
  $("commission-note").textContent = site.commissions?.note ?? "";

  $("contact-links").replaceChildren(
    ...[...site.links].sort((a, b) => (b.label === "Discord") - (a.label === "Discord")).map((l) =>
      el("li", { class: l.label === "Discord" ? "is-primary" : null }, linkNode(l))
    )
  );
}

// ---------- Footer ----------

$("updated").textContent = roblox?.updated
  ? `Roblox stats updated ${dateFmt.format(new Date(roblox.updated))}.`
  : `© ${new Date().getFullYear()} ${site?.name ?? "Mezz"}`;
