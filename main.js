// Renders the page from the files in data/. Edit those, not this.

// Motion (motion.dev) drives the interruptible bits. It loads alongside the page and
// everything has a plain fallback, so a slow or blocked CDN never holds anything up.
let motion = null;
const motionReady = import("https://cdn.jsdelivr.net/npm/motion@13.5.1/+esm")
  .then((m) => (motion = m))
  .catch(() => null);

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

  // While commissions are open, the hero leads with a way to hire me.
  const hire = site.commissions?.open
    ? el("a", { class: "hero-cta", href: "#commissions" },
        el("span", { class: "status-dot", "aria-hidden": "true" }), "Open for commissions")
    : null;
  $("hero-links").replaceChildren(...[hire, ...site.links.map(linkNode)].filter(Boolean));
}

if (roblox?.avatar) {
  $("avatar").src = roblox.avatar;
  $("avatar").hidden = false;
}

// A link with a URL opens it. One with only a handle (Discord usernames have no
// public URL) copies the handle instead.
function linkNode(l) {
  const text = l.handle ? `${l.label}: ${l.handle}` : l.label;
  if (l.url) return el("a", { href: l.url, target: "_blank", rel: "me noopener" }, text);

  const button = el("button", { type: "button", class: "copy" }, text);
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(l.handle);
      button.textContent = `Copied ${l.handle}`;
      button.classList.add("is-copied");
    } catch {
      button.textContent = text;
    }
    clearTimeout(button.resetTimer);
    button.resetTimer = setTimeout(() => {
      button.textContent = text;
      button.classList.remove("is-copied");
    }, 1800);
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

// Clip tabs: a card can hold several clips; the tabs swap which one plays.
for (const fig of document.querySelectorAll("[data-clip-switch]")) {
  const video = fig.querySelector("video");
  const caption = fig.querySelector("figcaption");
  const tabs = [...fig.querySelectorAll(".clip-tabs button")];
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      if (tab.getAttribute("aria-pressed") === "true") return;
      tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
      video.poster = tab.dataset.poster;
      video.src = tab.dataset.src;
      video.setAttribute("aria-label", tab.dataset.alt);
      caption.textContent = tab.dataset.caption;
      if (!reduceMotion) video.play().catch(() => {});
    });
  }
}

// ---------- Cloud buddy ----------
// Click it for a line. It nods off when nobody's around and notices when you come back
// to the tab. With Motion, its face also follows the cursor.

const buddy = $("buddy");
const buddyArt = buddy.querySelector(".buddy-art");
const buddyFace = buddy.querySelector(".buddy-face");
const say = $("buddy-say");
const buddyLines = ["I love Cinnamoroll", "zzz…", "hi!", "five more minutes", "*yawn*", "go play Pull a Planet", "☁️"];
let buddyIndex = 0;
let buddyClicks = 0;
let buddyTimer;
let buddySaying = false;
let buddyOnScreen = true;
let faceRest = null; // set once the face is following the cursor

new IntersectionObserver(([e]) => (buddyOnScreen = e.isIntersecting)).observe(buddy);

function buddySay(text) {
  say.textContent = text;
  clearTimeout(buddyTimer);
  if (motion && !reduceMotion) {
    // The bubble springs up from its tail; a new line while one is showing just bumps it.
    motion.animate(say,
      { opacity: 1, scale: [buddySaying ? 0.88 : 0.6, 1], y: [6, 0] },
      { type: "spring", visualDuration: 0.3, bounce: 0.45, opacity: { duration: 0.15 } });
    buddySaying = true;
    buddyTimer = setTimeout(() => {
      buddySaying = false;
      motion.animate(say, { opacity: 0, scale: 0.92, y: 3 }, { duration: 0.15, ease: "easeIn" });
    }, 1600);
    return;
  }
  say.classList.add("is-showing");
  buddyTimer = setTimeout(() => say.classList.remove("is-showing"), 1600);
}

function buddyWiggle() {
  if (reduceMotion) return;
  if (motion) {
    // Each wiggle starts from wherever the last one left off (null = current value),
    // so fast clicking never snaps.
    motion.animate(buddyArt,
      { rotate: [null, -9, 7, -3, 0], scale: [null, 1.07, 1.04, 1.01, 1] },
      { duration: 0.55, ease: "easeInOut" });
    return;
  }
  buddy.classList.remove("is-awake");
  void buddy.offsetWidth; // restart the CSS wiggle
  buddy.classList.add("is-awake");
}

buddy.addEventListener("click", () => {
  buddyClicks++;
  buddyWiggle();
  wakeBuddy();
  // Poke it ten times and the sky starts dropping bricks.
  if (buddyClicks >= 10 && motion && !reduceMotion && rainBricks(buddyClicks === 10 ? 14 : 3)) {
    if (buddyClicks === 10) return buddySay("uh oh");
  }
  buddySay(buddyLines[buddyIndex++ % buddyLines.length]);
});

// It nods off after 20 seconds with nobody moving, scrolling or typing.
const SLEEP_AFTER = 20000;
let sleepTimer;
let lastActivity = 0;
function wakeBuddy() {
  if (buddy.classList.contains("is-sleeping")) {
    buddy.classList.remove("is-sleeping");
    faceRest?.(false);
    if (buddyOnScreen) buddySay("huh? oh, hi");
  }
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    buddy.classList.add("is-sleeping");
    faceRest?.(true);
  }, SLEEP_AFTER);
}
const onActivity = () => {
  const now = performance.now();
  if (now - lastActivity < 400 && !buddy.classList.contains("is-sleeping")) return;
  lastActivity = now;
  wakeBuddy();
};
for (const type of ["pointermove", "pointerdown", "keydown", "scroll"]) {
  addEventListener(type, onActivity, { passive: true });
}
wakeBuddy();

let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  if (hiddenAt && Date.now() - hiddenAt > 5000 && buddyOnScreen) {
    buddy.classList.remove("is-sleeping");
    faceRest?.(false);
    buddyWiggle();
    buddySay("oh, you're back!");
  }
});

// The face (closed eyes, cheeks, mouth) leans a few units toward the cursor on a spring.
function trackFace(m) {
  if (reduceMotion || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const fx = m.springValue(0, { stiffness: 170, damping: 16 });
  const fy = m.springValue(0, { stiffness: 170, damping: 16 });
  m.styleEffect(buddyFace, { x: fx, y: fy });
  faceRest = (asleep) => {
    fx.set(0);
    fy.set(asleep ? 3 : 0);
  };
  addEventListener("pointermove", (e) => {
    if (!buddyOnScreen || buddy.classList.contains("is-sleeping")) return;
    const r = buddy.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / 260);
    fx.set((dx / d) * reach * 7);
    fy.set((dy / d) * reach * 4);
  }, { passive: true });
}

// Bricks fall from the top of the sky, bounce on the grass and pile up two high.
const brickColors = ["#e8584a", "#f5cd30", "#0d69ac", "#6cbf4a", "#9b7be8", "#f2b1c5"];
const brickSvg = (fill) =>
  `<svg viewBox="0 0 76 54"><g fill="${fill}" stroke="#1b2a35" stroke-width="4" stroke-linejoin="round"><rect x="13" y="3" width="18" height="11" rx="3"/><rect x="45" y="3" width="18" height="11" rx="3"/><rect x="2" y="12" width="72" height="40" rx="6"/></g><rect x="8" y="17" width="26" height="4" rx="2" fill="#fff" opacity=".45"/></svg>`;
const bounceOut = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
const MAX_BRICKS = 30;
let rain = null;
const rainStacks = new Map();
let rainCount = 0;

function rainBricks(count) {
  if (rainCount >= MAX_BRICKS) return false;
  const world = document.querySelector(".world");
  const ground = document.querySelector(".ground");
  if (!rain) {
    rain = el("div", { class: "brick-rain", "aria-hidden": "true" });
    world.append(rain);
  }
  const colWidth = 44;
  const cols = Math.max(1, Math.floor(world.clientWidth / colWidth));
  const groundTop = ground.offsetTop;
  for (let i = 0; i < count && rainCount < MAX_BRICKS; i++) {
    let col = -1;
    for (let tries = 0; tries < 8; tries++) {
      const c = Math.floor(Math.random() * cols);
      if ((rainStacks.get(c) ?? 0) < 2) { col = c; break; }
    }
    if (col < 0) break;
    const level = rainStacks.get(col) ?? 0;
    rainStacks.set(col, level + 1);
    rainCount++;

    const brick = el("span", { class: "rain-brick" });
    brick.innerHTML = brickSvg(brickColors[Math.floor(Math.random() * brickColors.length)]);
    brick.style.left = `${col * colWidth + Math.random() * 6}px`;
    rain.append(brick);

    const startY = -50 - Math.random() * 140;
    const landY = groundTop - 25 - level * 23 + 3;
    const duration = 0.65 + (landY - startY) / 1800;
    const delay = i * 0.07 + Math.random() * 0.12;
    motion.animate(brick, { y: [startY, landY] }, { duration, delay, ease: bounceOut });
    motion.animate(brick,
      { rotate: [(Math.random() - 0.5) * 240, (Math.random() - 0.5) * (level ? 10 : 24)] },
      { duration: duration * 0.75, delay, ease: "easeOut" });
  }
  return true;
}

// ---------- Games ----------

// Order: live games first, busiest (players online at the last stats update) on top,
// then most visits; unreleased games next, the ones I have the most roles on first;
// retired games last, by visits.
const liveStats = (g) => roblox?.games?.[String(g.placeId)] ?? {};
const roleCount = (g) => [g.role ?? []].flat().length;
const shown = [...(games?.games ?? [])].sort((a, b) => {
  const rank = (g) => ({ Live: 0, Retired: 2 })[g.status] ?? 1;
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (rank(a) === 0) {
    return (liveStats(b).playing ?? 0) - (liveStats(a).playing ?? 0)
      || (liveStats(b).visits ?? 0) - (liveStats(a).visits ?? 0);
  }
  if (rank(a) === 2) return (liveStats(b).visits ?? 0) - (liveStats(a).visits ?? 0);
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
  const shots = [...new Set([...(g.screenshots ?? []), ...(live.thumbnails ?? [])])];
  const image = shots[0] || live.icon;
  const url = g.url || live.url;
  const status = g.status || "In development";
  const isLive = status === "Live";
  const isRetired = status === "Retired";
  const statusClass = isLive ? "tag-live" : isRetired ? "tag-retired" : "tag-dev";
  const roles = [g.role ?? []].flat();

  const tags = () => [
    el("li", { class: `tag-status ${statusClass}` }, el("span", { class: "status-dot", "aria-hidden": "true" }), status),
    g.duo ? el("li", { class: "tag-friend" }, "Built with a friend") : null,
    ...roles.map((r) => el("li", { class: `tag-${roleArea[r.toLowerCase()] ?? "other"}` }, r)),
  ];
  const play = () =>
    url && (isLive || isRetired) ? el("a", { href: url, target: "_blank", rel: "noopener", class: "game-play" }, `Play ${title} on Roblox`) : null;

  const stats = [];
  // Brand-new games show no count until it means something.
  if (live.visits >= 100) stats.push(`${compact.format(live.visits)} visits`);
  if (live.playing) stats.push(`${fmt.format(live.playing)} playing now`);

  // Games with pictures open into a bigger view; the rest wait for screenshots.
  let media;
  if (image) {
    media = el("button", { type: "button", class: "game-media game-open", "aria-haspopup": "dialog", "aria-label": `See more of ${title}` },
      fadeIn(el("img", { src: image, alt: "", loading: "lazy" })));
    media.addEventListener("click", () =>
      openSheet({ title, blurb: g.blurb, shots: shots.length ? shots : [image], live, tags, play }, media));
  } else {
    media = el("div", { class: "game-media" }, el("span", { class: "game-media-empty" }, el("span", {}, "Screenshots soon")));
  }

  return el("article", { class: "game" },
    media,
    el("h3", {}, title),
    el("ul", { class: "game-tags" }, tags()),
    g.blurb ? el("p", {}, g.blurb) : null,
    stats.length ? el("p", { class: "game-stats" }, stats.join(", ")) : null,
    play()
  );
}

// Pictures fade up from a soft blur once they've loaded, instead of popping in.
function fadeIn(img) {
  img.classList.add("fade-img");
  const done = () => img.classList.add("is-loaded");
  if (img.complete && img.naturalWidth) done();
  else {
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  }
  return img;
}

// ---------- Game sheet ----------
// A game card's picture lifts off the card and grows into a bigger view with every
// screenshot, the full stats and the play button; closing flies it back. The flying
// picture is a stand-in ("ghost") so the real ones never stretch.

let sheet = null;

function getSheet() {
  if (sheet) return sheet;
  const dialog = el("dialog", { class: "sheet", "aria-labelledby": "sheet-title" });
  const close = el("button", { type: "button", class: "sheet-close", "aria-label": "Close" }, "×");
  const img = el("img", { class: "sheet-img", alt: "" });
  const media = el("div", { class: "sheet-media" }, img);
  const thumbs = el("div", { class: "sheet-thumbs", role: "group", "aria-label": "Screenshots" });
  const body = el("div", { class: "sheet-body" });
  const panel = el("div", { class: "sheet-panel" }, close, media, thumbs, body);
  const ghost = el("img", { class: "sheet-ghost", alt: "", "aria-hidden": "true" });
  dialog.append(panel, ghost);
  document.body.append(dialog);

  close.addEventListener("click", closeSheet);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeSheet();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeSheet();
  });
  sheet = { dialog, panel, media, img, thumbs, body, ghost, opener: null, token: 0, closing: false };
  return sheet;
}

function openSheet(info, opener) {
  const s = getSheet();
  if (s.dialog.open) return;
  s.opener = opener;
  s.closing = false;
  const token = ++s.token;

  const show = (i) => {
    s.img.src = info.shots[i];
    s.img.alt = `${info.title} screenshot ${i + 1} of ${info.shots.length}`;
    for (const [j, t] of [...s.thumbs.children].entries()) t.setAttribute("aria-pressed", String(i === j));
  };
  s.thumbs.replaceChildren(...(info.shots.length > 1 ? info.shots.map((src, i) => {
    const t = el("button", { type: "button", "aria-label": `Screenshot ${i + 1}` }, el("img", { src, alt: "" }));
    t.addEventListener("click", () => {
      show(i);
      // The picture has visibly landed by now even if its spring is still settling.
      if (!s.closing) {
        s.media.style.visibility = "";
        s.ghost.style.visibility = "hidden";
      }
    });
    return t;
  }) : []));
  show(0);

  const live = info.live;
  const stats = [
    live.visits >= 100 ? ["Visits", fmt.format(live.visits)] : null,
    live.favorites >= 10 ? ["Favorites", fmt.format(live.favorites)] : null,
    live.playing ? ["Playing now", fmt.format(live.playing)] : null,
  ].filter(Boolean);
  s.body.replaceChildren(...[
    el("h3", { id: "sheet-title" }, info.title),
    el("ul", { class: "game-tags" }, info.tags()),
    info.blurb ? el("p", {}, info.blurb) : null,
    stats.length ? el("dl", { class: "sheet-stats" }, stats.map(([k, v]) => el("div", {}, el("dt", {}, k), el("dd", {}, v)))) : null,
    info.play(),
  ].filter(Boolean));

  s.dialog.showModal();
  s.panel.scrollTop = 0;
  requestAnimationFrame(() => s.dialog.classList.add("is-open"));
  if (!motion || reduceMotion) return;

  const from = opener.getBoundingClientRect();
  const to = s.media.getBoundingClientRect();
  placeGhost(s, to, opener.querySelector("img").currentSrc || info.shots[0]);
  s.media.style.visibility = "hidden";
  opener.style.visibility = "hidden";

  motion.animate(s.panel, { opacity: [0, 1], y: [14, 0] }, { duration: 0.22, ease: "easeOut" });
  motion.animate(s.ghost,
    { x: [from.left - to.left, 0], y: [from.top - to.top, 0], scale: [from.width / to.width, 1] },
    { type: "spring", visualDuration: 0.42, bounce: 0.18 }
  ).then(() => {
    if (s.token !== token) return;
    s.media.style.visibility = "";
    s.ghost.style.visibility = "hidden";
  });
}

function placeGhost(s, rect, src) {
  s.ghostBox = rect;
  Object.assign(s.ghost.style, {
    visibility: "visible",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  s.ghost.src = src;
  motion.animate(s.ghost, { x: 0, y: 0, scale: 1 }, { duration: 0 });
}

function closeSheet() {
  const s = sheet;
  if (!s || !s.dialog.open || s.closing) return;
  const opener = s.opener;
  const token = ++s.token;
  const done = () => {
    s.dialog.close();
    s.closing = false;
    s.media.style.visibility = "";
    s.ghost.style.visibility = "hidden";
    opener.style.visibility = "";
    opener.focus({ preventScroll: true });
  };
  s.dialog.classList.remove("is-open");
  if (!motion || reduceMotion) return done();

  s.closing = true;
  // If the picture already landed, take off from wherever it sits now (the panel may
  // have scrolled). If it's still flying in, turn it around mid-air.
  if (s.ghost.style.visibility === "hidden") placeGhost(s, s.media.getBoundingClientRect(), s.img.currentSrc);
  s.media.style.visibility = "hidden";
  const from = opener.getBoundingClientRect();
  const box = s.ghostBox;

  motion.animate(s.panel, { opacity: 0 }, { duration: 0.15, ease: "easeIn" });
  motion.animate(s.ghost,
    { x: from.left - box.left, y: from.top - box.top, scale: from.width / box.width },
    // A tween rather than a spring so the page unlocks the moment it visibly lands.
    { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
  ).then(() => {
    if (s.token === token) done();
  });
}

// ---------- Builds ----------

const shownBuilds = builds?.builds ?? [];
$("builds-section").hidden = shownBuilds.length === 0;
$("builds").replaceChildren(
  ...shownBuilds.map((b) =>
    el("figure", { class: "build" },
      fadeIn(el("img", { src: b.image, alt: b.alt || b.title, loading: "lazy" })),
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
  status.replaceChildren(
    el("span", { class: "status-dot", "aria-hidden": "true" }),
    open ? "Open for commissions" : "Commissions closed for now");
  status.classList.toggle("is-open", !!open);
  $("commission-note").textContent = site.commissions?.note ?? "";

  $("contact-links").replaceChildren(
    ...[...site.links].sort((a, b) => (b.label === "Discord") - (a.label === "Discord")).map((l) =>
      el("li", { class: l.label === "Discord" ? "is-primary" : null }, linkNode(l))
    )
  );
}

// ---------- Scroll reveal ----------
// The pipeline bricks drop in one after another the first time they scroll into view,
// because they're a real sequence. Other cards don't: their plate and heading already
// make the entrance.
// Cards already on screen at load show immediately (no animation on first paint).

const revealGroups = [".pipeline > li"];
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
  const catchUp = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const waiting = document.querySelectorAll(".reveal:not(.is-in)");
      if (waiting.length === 0) window.removeEventListener("scroll", catchUp);
      for (const node of waiting) {
        if (node.getBoundingClientRect().bottom > 0) continue;
        node.classList.remove("reveal");
        node.style.removeProperty("--i");
        seen.unobserve(node);
      }
    });
  };
  window.addEventListener("scroll", catchUp, { passive: true });
}

// ---------- Stacking plates and dropping headings ----------
// Once Motion is in and the intro is over: each plate below the fold waits a little low,
// then clicks up into the plate above as it scrolls in, and each section heading drops
// in letter by letter like loose bricks. Both play once. Anything the visitor jumps
// straight past is put in place without animating, so there's never a hole.

const unsettled = new Map();
let settleQueued = false;
addEventListener("scroll", () => {
  if (settleQueued || unsettled.size === 0) return;
  settleQueued = true;
  requestAnimationFrame(() => {
    settleQueued = false;
    for (const [node, settle] of unsettled) {
      if (node.getBoundingClientRect().bottom > 0) continue;
      unsettled.delete(node);
      settle();
    }
  });
}, { passive: true });

Promise.all([motionReady, introDone]).then(([m]) => {
  if (!m) return;
  trackFace(m);
  if (reduceMotion) return;
  stackPlates(m);
  dropHeadings(m);
});

function stackPlates(m) {
  const DROP = 36;
  for (const plate of document.querySelectorAll(".plate:not([hidden])")) {
    if (plate.getBoundingClientRect().top < innerHeight) continue;
    plate.style.transform = `translateY(${DROP}px)`;
    const stop = m.inView(plate, () => {
      unsettled.delete(plate);
      m.animate(plate, { y: [DROP, 0] }, { type: "spring", visualDuration: 0.5, bounce: 0.35 })
        .then(() => (plate.style.transform = ""));
    }, { margin: "0px 0px -8% 0px" });
    unsettled.set(plate, () => {
      stop();
      plate.style.transform = "";
    });
  }
}

function dropHeadings(m) {
  for (const h of document.querySelectorAll("main h2")) {
    if (h.closest("[hidden]") || h.getBoundingClientRect().top < innerHeight) continue;
    const letters = splitLetters(h);
    for (const l of letters) l.style.opacity = "0";
    const lift = parseFloat(getComputedStyle(h).fontSize) * 0.9;
    const stop = m.inView(h, () => {
      unsettled.delete(h);
      letters.forEach((l, i) => {
        const delay = 0.08 + i * 0.03;
        m.animate(l,
          { opacity: [0, 1], y: [-lift, 0], rotate: [(Math.random() - 0.5) * 36, 0] },
          { type: "spring", visualDuration: 0.4, bounce: 0.5, delay, opacity: { duration: 0.1, delay } });
      });
    }, { margin: "0px 0px -15% 0px" });
    unsettled.set(h, () => {
      stop();
      for (const l of letters) l.style.opacity = "";
    });
  }
}

// Screen readers get the heading as one word-run; the letters are for show.
function splitLetters(node) {
  const text = node.textContent.trim();
  const shown = el("span", { "aria-hidden": "true" });
  const letters = [];
  text.split(/\s+/).forEach((word, i) => {
    if (i) shown.append(" ");
    const w = el("span", { class: "split-word" });
    for (const ch of word) {
      const l = el("span", { class: "split-letter" }, ch);
      letters.push(l);
      w.append(l);
    }
    shown.append(w);
  });
  node.replaceChildren(el("span", { class: "sr-only" }, text), shown);
  return letters;
}

// ---------- Footer ----------

$("updated").textContent = roblox?.updated
  ? `Roblox stats updated ${dateFmt.format(new Date(roblox.updated))}.`
  : `© ${new Date().getFullYear()} ${site?.name ?? "Mezz"}`;
