// The URL hash, as data. No DOM: app.js listens for hashchange and calls parse.
//
//   #/                         concierge: pick a situation
//   #/for/<situation>          concierge: pick a refinement
//   #/for/<situation>/<ref>    concierge: pick a collection
//   #/browse/<gallery>         a gallery's categories
//   #/browse/<gallery>/<cat>   a category's collections
//   #/c/<collection>           one collection
//   #/search/<query>
//   #/recent

/**
 * @typedef {{ name: "concierge", situation?: string, refinement?: string }
 *   | { name: "browse", gallery: string, category?: string }
 *   | { name: "collection", id: string }
 *   | { name: "search", query: string }
 *   | { name: "recent" }} Route
 */

/**
 * @param {string} hash location.hash, with or without the "#"
 * @returns {Route} anything unrecognized is the concierge
 */
export function parse(hash) {
  const [head, a, b] = hash
    .replace(/^#?\/?/, "")
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  if (head === "for" && a) return b ? { name: "concierge", situation: a, refinement: b } : { name: "concierge", situation: a };
  if (head === "browse" && a) return b ? { name: "browse", gallery: a, category: b } : { name: "browse", gallery: a };
  if (head === "c" && a) return { name: "collection", id: a };
  if (head === "search" && a) return { name: "search", query: a };
  if (head === "recent") return { name: "recent" };
  return { name: "concierge" };
}

/**
 * @param {Route} route
 * @returns {string} a hash, "#" included
 */
export function format(route) {
  /** @param {(string | undefined)[]} parts */
  const join = (...parts) => "#/" + parts.filter((p) => p !== undefined).map((p) => encodeURIComponent(p ?? "")).join("/");
  switch (route.name) {
    case "concierge":
      return route.situation ? join("for", route.situation, route.refinement) : "#/";
    case "browse":
      return join("browse", route.gallery, route.category);
    case "collection":
      return join("c", route.id);
    case "search":
      return join("search", route.query);
    case "recent":
      return "#/recent";
  }
}
