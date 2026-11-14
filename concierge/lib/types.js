// The data contract between the UI and whatever feeds it. Types only: nothing
// here runs. The UI imports these and `service.js`; it never imports `mock/`.
//
// The nouns are deliberately not musical. A "collection" was a station and an
// "item" was a song, but they could be a reading list and an article, a
// recipe box and a recipe, a lesson plan and an exercise.

/**
 * When the visitor showed up. The concierge asks for suggestions that fit.
 * @typedef {Object} Moment
 * @property {string} day lowercase weekday: "wednesday"
 * @property {string} period slug: "morning", "late-morning", "afternoon", "evening", "night", "late-night"
 * @property {number} month 1-12
 * @property {string} label for the heading: "Wednesday Afternoon"
 */

/**
 * The words that make it this product and not another. Everything the UI says
 * about the subject matter comes from here.
 * @typedef {Object} Config
 * @property {string} brand
 * @property {string} prompt second line of the concierge heading: "Play music for"
 * @property {string} refinePrompt heading over a situation's choices: "Pick a flavor"
 * @property {string} collectionNoun plural, for headings: "stations"
 * @property {string} searchPlaceholder
 * @property {{ text: string, linkText?: string, href?: string }} [notice] the strip across the top
 */

/**
 * A top-level concierge tile: what you're doing right now.
 * @typedef {Object} Situation
 * @property {string} id
 * @property {string} title
 * @property {string} [icon] URL an SVG `<use>` can reference: "icons.svg#sun"
 * @property {Refinement[]} refinements the second question; usually three
 */

/**
 * A narrower choice inside a situation, leading to a few collections.
 * @typedef {Object} Refinement
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string[]} collectionIds
 */

/**
 * A way to browse everything: by activity, genre, mood, decade.
 * @typedef {Object} Gallery
 * @property {string} id
 * @property {string} title
 */

/**
 * One shelf in a gallery.
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} title
 * @property {string[]} collectionIds
 */

/**
 * The thing you pick and then sit back from.
 * @typedef {Object} Collection
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} [cover] image URL; without one a cover is drawn from the title
 * @property {string} [curator]
 */

/**
 * One thing a collection serves up.
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} title
 * @property {string} byline
 * @property {number} duration seconds
 * @property {string} [src] media URL, for an engine that plays real media
 */

/**
 * Everything the UI asks of a backend. All async, so an implementation can be
 * a fetch() away. `mock/service.js` is the one that exists.
 * @typedef {Object} Service
 * @property {() => Promise<Config>} getConfig
 * @property {(moment: Moment) => Promise<Situation[]>} getConcierge
 * @property {() => Promise<Gallery[]>} getGalleries
 * @property {(galleryId: string) => Promise<Category[]>} getCategories
 * @property {(ids: string[]) => Promise<Collection[]>} getCollections in the order asked; unknown ids dropped
 * @property {(collectionId: string) => Promise<Collection[]>} getSimilar
 * @property {(query: string) => Promise<Collection[]>} search
 * @property {(collectionId: string) => Promise<Item>} nextItem
 * @property {(collectionId: string, itemId: string, vote: "up" | "down") => Promise<void>} vote
 */

/**
 * What makes time pass for an item. The mock one counts seconds; a real one
 * would wrap an `<audio>` element, a video, a reader's scroll position.
 * @typedef {Object} Engine
 * @property {(item: Item) => void} load replaces whatever was loaded; stays paused
 * @property {() => void} play
 * @property {() => void} pause
 * @property {(fn: (position: number) => void) => void} onTick seconds into the item
 * @property {(fn: () => void) => void} onEnd the item ran out by itself
 */

export {};
