// A route in, a screen's worth of data out. No DOM: components/stage-view.js
// draws whatever this returns, and knows nothing about routes or the service.

import { format } from "./lib/router.js";

/** @typedef {import("./lib/types.js").Collection} Collection */
/** @typedef {import("./lib/types.js").Service} Service */
/** @typedef {import("./lib/router.js").Route} Route */

/**
 * One screen. The heading is `title` over `subtitle`; below it comes whichever
 * of tiles, links, cards and feature is present.
 * @typedef {Object} View
 * @property {string} key changes when the screen does
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [back] href of the step before this one
 * @property {{ href: string, title: string, icon?: string, description?: string }[]} [tiles] a row of square choices
 * @property {{ href: string, title: string, count: number }[]} [links] a plain list of choices
 * @property {Collection[]} [cards]
 * @property {string} [cardsTitle] a heading over the cards, when something precedes them
 * @property {Collection} [feature] one collection, large
 * @property {string} [empty] what to say when there's nothing to show
 */

/** @param {string} s */
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * @param {Route} route
 * @param {{
 *   service: Service,
 *   config: import("./lib/types.js").Config,
 *   moment: import("./lib/types.js").Moment,
 *   recentIds: string[],
 * }} context
 * @returns {Promise<View>} a route that leads nowhere gets the concierge
 */
export async function viewFor(route, context) {
  const { service, config, moment, recentIds } = context;
  const home = () => viewFor({ name: "concierge" }, context);

  switch (route.name) {
    case "concierge": {
      const situations = await service.getConcierge(moment);
      if (!route.situation) {
        return {
          key: "concierge",
          title: `It's ${moment.label}`,
          subtitle: config.prompt,
          tiles: situations.map((s) => ({
            href: format({ name: "concierge", situation: s.id }),
            title: s.title,
            icon: s.icon,
          })),
        };
      }
      const situation = situations.find((s) => s.id === route.situation);
      if (!situation) return home();
      const refinement = situation.refinements.find((r) => r.id === route.refinement);
      if (!refinement) {
        return {
          key: `for/${situation.id}`,
          back: format({ name: "concierge" }),
          title: situation.title,
          subtitle: config.refinePrompt,
          tiles: situation.refinements.map((r) => ({
            href: format({ name: "concierge", situation: situation.id, refinement: r.id }),
            title: r.title,
            description: r.description,
          })),
        };
      }
      return {
        key: `for/${situation.id}/${refinement.id}`,
        back: format({ name: "concierge", situation: situation.id }),
        title: situation.title,
        subtitle: refinement.title,
        cards: await service.getCollections(refinement.collectionIds),
      };
    }

    case "browse": {
      const gallery = (await service.getGalleries()).find((g) => g.id === route.gallery);
      if (!gallery) return home();
      const categories = await service.getCategories(gallery.id);
      const category = categories.find((c) => c.id === route.category);
      if (!category) {
        return {
          key: `browse/${gallery.id}`,
          title: gallery.title,
          subtitle: `Browse ${config.collectionNoun}`,
          links: categories.map((c) => ({
            href: format({ name: "browse", gallery: gallery.id, category: c.id }),
            title: c.title,
            count: c.collectionIds.length,
          })),
        };
      }
      return {
        key: `browse/${gallery.id}/${category.id}`,
        back: format({ name: "browse", gallery: gallery.id }),
        title: gallery.title,
        subtitle: category.title,
        cards: await service.getCollections(category.collectionIds),
      };
    }

    case "collection": {
      const [feature] = await service.getCollections([route.id]);
      if (!feature) return home();
      return {
        key: `c/${feature.id}`,
        title: feature.title,
        feature,
        cards: await service.getSimilar(feature.id),
        cardsTitle: `Similar ${config.collectionNoun}`,
      };
    }

    case "search":
      return {
        key: "search",
        title: "Search",
        subtitle: `“${route.query}”`,
        cards: await service.search(route.query),
        empty: `No ${config.collectionNoun} match “${route.query}”.`,
      };

    case "recent":
      return {
        key: "recent",
        title: "Recent",
        subtitle: `${capitalize(config.collectionNoun)} you played lately`,
        cards: await service.getCollections(recentIds),
        empty: "Nothing yet. Whatever you play shows up here.",
      };
  }
}
