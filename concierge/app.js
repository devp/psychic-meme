// Wiring. Everything app-shaped lives here in the open: where the data comes
// from (service.js), what each URL shows (views.js), and who hears what.

import { syncAppHeight } from "./lib/viewport.js";
import { momentOf } from "./lib/moment.js";
import { parse, format } from "./lib/router.js";
import { createPlayer } from "./lib/player.js";
import { service, engine } from "./service.js";
import { viewFor } from "./views.js";
import { recent } from "./state.js";
import { SideNav } from "./components/side-nav.js";
import { StageView } from "./components/stage-view.js";
import { PlayerBar } from "./components/player-bar.js";
import { UpdateToast } from "./components/update-toast.js";

customElements.define("side-nav", SideNav);
customElements.define("stage-view", StageView);
customElements.define("player-bar", PlayerBar);
customElements.define("update-toast", UpdateToast);

const nav = /** @type {SideNav} */ (document.querySelector("side-nav"));
const stage = /** @type {StageView} */ (document.getElementById("stage"));
const bar = /** @type {PlayerBar} */ (document.getElementById("player"));

// ---- the moment -----------------------------------------------------------
// ?day=friday&period=night pins it, for looking at another time's lineup.

const params = new URLSearchParams(location.search);
const moment = momentOf(new Date(), { day: params.get("day"), period: params.get("period") });
// theme.css keys the sky off this.
document.documentElement.setAttribute("data-period", moment.period);

// ---- the player -----------------------------------------------------------

const player = createPlayer({ service, engine });

player.subscribe((state) => {
  bar.state = state;
  stage.playingId = state.collection?.id ?? null;
  stage.playing = state.playing;
});

bar.addEventListener("toggle", () => player.toggle());
bar.addEventListener("skip", () => void player.skip());
bar.addEventListener("vote", (e) => void player.vote(/** @type {CustomEvent<"up" | "down">} */ (e).detail));

/**
 * @param {string} id
 * @param {{ toggle: boolean }} options toggle: pause it if it's the one playing
 */
async function play(id, { toggle }) {
  if (player.state.collection?.id === id) {
    if (toggle || !player.state.playing) player.toggle();
    return;
  }
  const [collection] = await service.getCollections([id]);
  if (!collection) return;
  recent.add(collection.id);
  await player.play(collection);
}

// stage-view marks what should start something; see its header.
stage.addEventListener("click", (e) => {
  const el = e.target instanceof Element ? e.target.closest("[data-play], [data-toggle]") : null;
  if (!el) return;
  const toggle = el.getAttribute("data-toggle");
  void play(toggle ?? el.getAttribute("data-play") ?? "", { toggle: toggle !== null });
});

// ---- the stage ------------------------------------------------------------

async function main() {
  const config = await service.getConfig();

  nav.brand = config.brand;
  nav.searchPlaceholder = config.searchPlaceholder;
  recent.subscribe((ids) => {
    nav.hasRecent = ids.length > 0;
  });
  void service.getGalleries().then((galleries) => {
    nav.galleries = galleries;
  });

  const notice = document.getElementById("notice");
  if (notice && config.notice) {
    const { text, linkText, href } = config.notice;
    notice.replaceChildren("Check out ");
    if (linkText && href) notice.append(Object.assign(document.createElement("a"), { href, textContent: linkText }), " ");
    notice.append(text);
    notice.hidden = false;
  }

  // Counts route changes, so a slow answer for a page already left is dropped.
  let visit = 0;
  async function show() {
    const mine = ++visit;
    const route = parse(location.hash);
    nav.active = route.name === "browse" ? `browse/${route.gallery}` : route.name;
    const view = await viewFor(route, { service, config, moment, recentIds: recent.get() });
    if (mine !== visit) return;
    stage.view = view;
    document.title = view.key === "concierge" ? config.brand : `${view.subtitle ?? view.title} · ${config.brand}`;
  }
  window.addEventListener("hashchange", show);
  await show();

  nav.addEventListener("search", (e) => {
    const query = /** @type {CustomEvent<string>} */ (e).detail;
    const searching = parse(location.hash).name === "search";
    const hash = query ? format({ name: "search", query }) : format({ name: "concierge" });
    // Each keystroke replaces the last, so Back leaves the search in one step.
    if (searching) location.replace(hash);
    else if (query) location.hash = hash;
  });
}

void main();

// ---- shell glue -----------------------------------------------------------

const about = /** @type {HTMLDialogElement} */ (document.getElementById("about-dialog"));
nav.addEventListener("about", () => about.showModal());
document.getElementById("about-close")?.addEventListener("click", () => about.close());

// Share: the QR page (misc/qr/) encodes whatever ?q= holds.
const shareLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById("share-link"));
if (shareLink) shareLink.search = new URLSearchParams({ q: new URL(".", location.href).href }).toString();

// ---- phone ----------------------------------------------------------------

syncAppHeight();

// ---- offline --------------------------------------------------------------

if ("serviceWorker" in navigator) {
  const register = () =>
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* not fatal -- the app still works, it just won't survive the subway */
    });

  // Not simply addEventListener("load", ...): check readyState first, so this
  // stays correct if the module ever finishes after the load event.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });

  // Updates: the toast checks for them on every launch and resume.
  document.body.append(new UpdateToast());
}
