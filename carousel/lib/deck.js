// Deck logic: pure functions over plain card objects. No DOM, no storage, so
// tests/deck.test.mjs can run it under node.

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} url
 * @property {string} description
 * @property {string|null} comment
 * @property {number} addedAt
 * @property {number|null} readAt
 * @property {string|null} lane
 * @property {string|null} from
 */

/** @typedef {"youtube"|"instagram"|"facebook"|"other"} Platform */
/** @typedef {"embed"|"open"|"page"} RenderMode */

/** A saved reading position. `at` outlives the card, for when it's gone. */
/** @typedef {{ id: string, at: number }} Position */

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/**
 * What a share sheet hands over, as a URL and a best-guess description.
 * Android usually puts the link in `text`, not `url`.
 *
 * @param {URLSearchParams} params title, text, url
 * @returns {{ url: string, description: string } | null}
 */
export function parseShare(params) {
  const title = (params.get("title") ?? "").trim();
  const text = (params.get("text") ?? "").trim();
  const url = (params.get("url") ?? "").trim().match(URL_RE)?.[0] ?? text.match(URL_RE)?.[0];
  if (!url) return null;
  const rest = text.replace(url, "").trim();
  const description = [title, rest].find((s) => s && !URL_RE.test(s)) ?? "";
  return { url, description };
}

/**
 * @param {string} url
 * @returns {Platform}
 */
export function platformOf(url) {
  const host = hostOf(url);
  if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(host)) return "youtube";
  if (/(^|\.)(instagram\.com|instagr\.am)$/.test(host)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/.test(host)) return "facebook";
  return "other";
}

/** @param {string} url */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\.|^m\./, "");
  } catch {
    return "";
  }
}

/**
 * The URL to put in the reading iframe, or null to open it outside the app.
 *
 * @param {string} url
 * @param {RenderMode} mode
 * @returns {string|null}
 */
export function frameUrl(url, mode) {
  if (mode === "open") return null;
  if (mode === "page") return url;
  return embedUrl(url) ?? url;
}

/**
 * The platform's own embed player for a link, or null if it has none.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function embedUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const platform = platformOf(url);
  const parts = u.pathname.split("/").filter(Boolean);

  if (platform === "youtube") {
    const id =
      u.hostname.endsWith("youtu.be") ? parts[0]
      : ["shorts", "live", "embed", "v"].includes(parts[0]) ? parts[1]
      : u.searchParams.get("v");
    if (!id) return null;
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`);
    embed.searchParams.set("autoplay", "1");
    embed.searchParams.set("playsinline", "1");
    const t = parseInt(u.searchParams.get("t") ?? u.searchParams.get("start") ?? "", 10);
    if (t > 0) embed.searchParams.set("start", String(t));
    return embed.href;
  }

  if (platform === "instagram") {
    // /p/CODE, /reel/CODE, /tv/CODE, also behind a /username/ prefix.
    const i = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p));
    if (i < 0 || !parts[i + 1]) return null;
    const kind = parts[i] === "reels" ? "reel" : parts[i];
    return `https://www.instagram.com/${kind}/${encodeURIComponent(parts[i + 1])}/embed/captioned/`;
  }

  if (platform === "facebook") {
    const isVideo = u.hostname.endsWith("fb.watch") || /\/(videos|watch|reel|share\/[vr])(\/|$)/.test(u.pathname);
    const plugin = isVideo ? "video.php" : "post.php";
    const embed = new URL(`https://www.facebook.com/plugins/${plugin}`);
    embed.searchParams.set("href", url);
    embed.searchParams.set("show_text", "true");
    if (isVideo) embed.searchParams.set("autoplay", "true");
    return embed.href;
  }

  return null;
}

/** Prefixes a lane's position key in the read view. A sentinel, so no user lane can collide. */
export const READ = "\u0000read";

/**
 * The cards a lane shows, oldest first: the lane's unread cards, or its read
 * ones when `read`, plus `keepId` either way, so a card doesn't vanish while
 * you're looking at it. Lane "" is every lane.
 *
 * @param {Card[]} cards
 * @param {string} lane
 * @param {boolean} [read]
 * @param {string|null} [keepId]
 * @returns {Card[]}
 */
export function laneCards(cards, lane, read = false, keepId = null) {
  return cards
    .filter((c) => ((read ? !!c.readAt : !c.readAt) || c.id === keepId) && (lane === "" || c.lane === lane))
    .sort((a, b) => a.addedAt - b.addedAt);
}

/**
 * Where a saved position lands in a lane's cards: the card itself, else the
 * next one added after it, wrapping round to the start.
 *
 * @param {Card[]} list from laneCards
 * @param {Position|null|undefined} pos
 * @returns {number} index into list, or -1 if empty
 */
export function resolve(list, pos) {
  if (!list.length) return -1;
  if (!pos) return 0;
  const exact = list.findIndex((c) => c.id === pos.id);
  if (exact >= 0) return exact;
  const after = list.findIndex((c) => c.addedAt > pos.at);
  return after >= 0 ? after : 0;
}

/**
 * @param {number} index
 * @param {number} delta
 * @param {number} length
 */
export function wrap(index, delta, length) {
  return length ? (((index + delta) % length) + length) % length : -1;
}

/**
 * A random index other than `current`, when there's more than one card.
 *
 * @param {number} current
 * @param {number} length
 * @param {() => number} [rand]
 */
export function spin(current, length, rand = Math.random) {
  if (length < 2) return current;
  const pick = Math.floor(rand() * (length - 1));
  return pick >= current ? pick + 1 : pick;
}

/**
 * Comments save as null when blank.
 * @param {string} s
 * @returns {string|null}
 */
export function cleanText(s) {
  const t = s.trim();
  return t === "" ? null : t;
}
