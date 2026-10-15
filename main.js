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

// Role tags are coloured by the skill area they belong to, matching "What I can help with".
const roleArea = {
  "full-stack scripting": "code",
  "scripting": "code",
  "modelling": "3d",
  "map building": "3d",
  "building": "3d",
  "vfx": "visual",
  "impact frames": "visual",
  "animation": "visual",
  "ui/ux": "visual",
  "ui": "visual",
  "project lead": "lead",
  "game design": "lead",
};


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

if (roblox?.avatar) {
  $("avatar").src = roblox.avatar;
  $("avatar").hidden = false;
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

// ---------- Intro ----------
// The cloud sits alone and large in the middle of the sky, flies to its spot, then the
// hero builds bottom-up like Lego: each piece drops from above and lands with a small
// squash. Click or press any key to skip. Resolves when the page is fully built.

const introDone = playIntro();

function playIntro() {
  const root = document.documentElement;
  if (!root.classList.contains("intro")) return Promise.resolve();

  return new Promise((resolve) => {
    const svg = $("buddy").querySelector("svg");
    const drops = [".ground", ".hero-links", "#visits", "#tagline", ".hello"]
      .map((sel) => document.querySelector(sel))
      .filter(Boolean);
    const anims = [];
    const timers = [];
    let finished = false;

    // Where the cloud lives vs. the middle of the screen, as one transform.
    const box = svg.getBoundingClientRect();
    const size = Math.min(window.innerWidth * 0.55, 420);
    const scale = size / box.width;
    const dx = window.innerWidth / 2 - (box.left + box.width / 2);
    const dy = window.innerHeight / 2 - (box.top + box.height / 2);
    const centered = `translate(${dx}px, ${dy}px) scale(${scale})`;

    svg.style.transformOrigin = "50% 50%";
    anims.push(svg.animate(
      [{ transform: `${centered} scale(0.9)`, opacity: 0 }, { transform: centered, opacity: 1 }],
      { duration: 450, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" }
    ));
    root.classList.add("intro-ready");

    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.finish());
      anims.forEach((a) => a.cancel());
      drops.forEach((el) => (el.style.visibility = ""));
      root.classList.remove("intro", "intro-ready", "intro-shrink", "intro-out");
      root.style.removeProperty("--sky-cut");
      try { sessionStorage.setItem("introSeen", "1"); } catch {}
      removeEventListener("pointerdown", finish);
      removeEventListener("keydown", finish);
      resolve();
    };
    addEventListener("pointerdown", finish);
    addEventListener("keydown", finish);

    // The cloud fades in (450ms), holds still for 0.4s, then flies home.
    const wait = 450 + 400;
    timers.push(setTimeout(() => {
      anims.push(svg.animate(
        [{ transform: centered, opacity: 1 }, { transform: "none", opacity: 1 }],
        { duration: 750, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" }
      ));
      // As the pieces start falling, the full-screen sky shrinks down to the grass,
      // then hands over to the real hero sky underneath.
      const ground = document.querySelector(".ground");
      const cut = Math.max(0, window.innerHeight - ground.getBoundingClientRect().top);
      timers.push(setTimeout(() => {
        root.style.setProperty("--sky-cut", `${cut}px`);
        root.classList.add("intro-shrink");
      }, 450));
      timers.push(setTimeout(() => root.classList.add("intro-out"), 450 + 800));

      // Then the pieces drop in, bottom piece first.
      const fall = [
        { transform: "translateY(-100vh)", easing: "cubic-bezier(0.55, 0, 1, 0.45)" },
        { transform: "translateY(0) scale(1.03, 0.94)", offset: 0.7, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
        { transform: "translateY(-8px) scale(1)", offset: 0.85, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
        { transform: "translateY(0)" },
      ];
      drops.forEach((el, i) => {
        el.style.transformOrigin = "50% 100%";
        el.style.visibility = "visible";
        anims.push(el.animate(fall, { duration: 650, delay: 450 + i * 120, fill: "backwards" }));
      });
      const buildTime = 450 + (drops.length - 1) * 120 + 650;
      timers.push(setTimeout(finish, buildTime + 50));
    }, wait));
  });
}

const total = roblox?.totalVisits ?? 0;
if (total > 0) {
  introDone.then(() => rollUp($("visits-number"), total));
  $("visits-label").textContent = "contributed visits";
} else {
  $("visits").classList.add("is-empty");
  $("visits-number").textContent = "–";
  $("visits-label").textContent = "Visit count updates once games are added";
}

// Skill clips autoplay like GIFs, except for visitors who asked for less motion:
// they get the still frame and play controls instead.
if (reduceMotion) {
  for (const v of document.querySelectorAll(".skill-clip video")) {
    v.removeAttribute("autoplay");
    v.pause();
    v.controls = true;
  }
}

// ---------- Cloud buddy ----------

const buddyLines = ["I love Cinnamoroll", "zzz…", "hi!", "five more minutes", "*yawn*", "go play Pull a Planet", "☁️"];
let buddyIndex = 0;
let buddyTimer;
$("buddy").addEventListener("click", () => {
  const buddy = $("buddy");
  const say = $("buddy-say");
  buddy.classList.remove("is-awake");
  void buddy.offsetWidth; // restart the wiggle
  buddy.classList.add("is-awake");
  say.textContent = buddyLines[buddyIndex++ % buddyLines.length];
  say.classList.add("is-showing");
  clearTimeout(buddyTimer);
  buddyTimer = setTimeout(() => say.classList.remove("is-showing"), 1600);
});

// ---------- Games ----------

// Order: live games first, busiest (players online at the last stats update) on top,
// then most visits; unreleased games after, the ones I have the most roles on first.
const liveStats = (g) => roblox?.games?.[String(g.placeId)] ?? {};
const roleCount = (g) => [g.role ?? []].flat().length;
const shown = [...(games?.games ?? [])].sort((a, b) => {
  const aLive = (a.status || "") === "Live", bLive = (b.status || "") === "Live";
  if (aLive !== bLive) return aLive ? -1 : 1;
  if (aLive) {
    return (liveStats(b).playing ?? 0) - (liveStats(a).playing ?? 0)
      || (liveStats(b).visits ?? 0) - (liveStats(a).visits ?? 0);
  }
  return roleCount(b) - roleCount(a);
});
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
    el("li", { class: isLive ? "tag-live" : "tag-dev" }, status),
    g.duo ? el("li", { class: "tag-friend" }, "Built with a friend") : null,
    ...roles.map((r) => el("li", { class: `tag-${roleArea[r.toLowerCase()] ?? "other"}` }, r)),
  ];

  const stats = [];
  // Brand-new games show no count until it means something.
  if (live.visits >= 100) stats.push(`${compact.format(live.visits)} visits`);
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

// ---------- Scroll reveal ----------
// Cards drop in once as they first scroll into view, staggered within each group.
// Cards already on screen at load show immediately (no animation on first paint).

const revealGroups = [".skills > .skill", ".jobs", ".pipeline > li", "#games > .game", "#builds > .build"];
if ("IntersectionObserver" in window) {
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const node = e.target;
      if (!e.isIntersecting) continue;
      node.classList.add("is-in");
      seen.unobserve(node);
      // Once landed, drop the reveal styles so hover uses its own quick timing.
      node.addEventListener("transitionend", function done(ev) {
        if (ev.target !== node || ev.propertyName !== "opacity") return;
        node.classList.remove("reveal", "is-in");
        node.style.removeProperty("--i");
        node.removeEventListener("transitionend", done);
      });
    }
  }, { rootMargin: "0px 0px -60px 0px" });

  const foldLine = window.innerHeight;
  for (const selector of revealGroups) {
    document.querySelectorAll(selector).forEach((node, i) => {
      if (node.getBoundingClientRect().top < foldLine) return; // already visible: leave it alone
      node.classList.add("reveal");
      node.style.setProperty("--i", i);
      seen.observe(node);
    });
  }
  document.documentElement.classList.add("js");

  // A jump past a section (a link, a fast fling) never makes its cards "intersect",
  // so on scroll, show anything already above the screen as-is rather than leave a hole.
  let queued = false;
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      for (const node of document.querySelectorAll(".reveal:not(.is-in)")) {
        if (node.getBoundingClientRect().bottom > 0) continue;
        node.classList.remove("reveal");
        node.style.removeProperty("--i");
        seen.unobserve(node);
      }
    });
  }, { passive: true });
}

// ---------- Footer ----------

$("updated").textContent = roblox?.updated
  ? `Roblox stats updated ${dateFmt.format(new Date(roblox.updated))}.`
  : `© ${new Date().getFullYear()} ${site?.name ?? "Mezz"}`;
