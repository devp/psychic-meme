// The staples this household actually tracks, and which store each one comes
// from. Everything else -- salt, oil you never run out of, the third jar of
// cumin -- deliberately isn't here: a pantry list you don't trust is a pantry
// list you stop opening.
//
// `store` is what makes the shopping list useful. A single flat list means
// re-sorting it in your head at every door; grouped by store it's a route.

/**
 * @typedef {Object} Store
 * @property {string} id
 * @property {string} name
 * @property {string} note when you're actually there
 */

/** In shopping-route order, which is also the order the list renders. */
export const STORES = [
  { id: "market", name: "Greenmarket / produce", note: "Sunday, 82nd St" },
  { id: "patel", name: "Patel Brothers", note: "74th St run" },
  { id: "ctown", name: "C-Town", note: "the walk-to-it one" },
  { id: "tj", name: "Trader Joe's", note: "batched, not weekly" },
  { id: "costco", name: "Costco", note: "once a month, bulk" },
];

/**
 * @typedef {Object} Staple
 * @property {string} id
 * @property {string} name
 * @property {"protein"|"veg"|"starch"|"dairy"|"pantry"} kind
 * @property {string} store one of STORES[].id
 */

/**
 * Grouped by kind in the order the pantry tab shows them: the things that
 * decide dinner first, the things that flavour it last.
 * @type {Staple[]}
 */
export const STAPLES = [
  // ---- proteins ----
  { id: "chicken-thighs", name: "chicken thighs", kind: "protein", store: "costco" },
  { id: "chicken-breast", name: "chicken breast", kind: "protein", store: "costco" },
  { id: "ground-beef", name: "ground beef", kind: "protein", store: "ctown" },
  { id: "ground-turkey", name: "ground turkey", kind: "protein", store: "tj" },
  { id: "pork-shoulder", name: "pork shoulder", kind: "protein", store: "ctown" },
  { id: "italian-sausage", name: "italian sausage", kind: "protein", store: "ctown" },
  { id: "bacon", name: "bacon", kind: "protein", store: "tj" },
  { id: "salmon", name: "salmon fillets", kind: "protein", store: "costco" },
  { id: "shrimp", name: "shrimp (frozen)", kind: "protein", store: "tj" },
  { id: "rui-fish", name: "rui / tilapia steaks", kind: "protein", store: "patel" },
  { id: "eggs", name: "eggs", kind: "protein", store: "ctown" },
  { id: "paneer", name: "paneer", kind: "protein", store: "patel" },
  { id: "tofu", name: "firm tofu", kind: "protein", store: "tj" },
  { id: "chickpeas", name: "chickpeas (canned)", kind: "protein", store: "tj" },
  { id: "black-beans", name: "black beans (canned)", kind: "protein", store: "ctown" },
  { id: "masoor-dal", name: "masoor dal", kind: "protein", store: "patel" },
  { id: "chana-dal", name: "chana dal", kind: "protein", store: "patel" },

  // ---- veg ----
  { id: "onions", name: "onions", kind: "veg", store: "patel" },
  { id: "garlic", name: "garlic", kind: "veg", store: "patel" },
  { id: "ginger", name: "ginger", kind: "veg", store: "patel" },
  { id: "potatoes", name: "potatoes", kind: "veg", store: "costco" },
  { id: "sweet-potato", name: "sweet potatoes", kind: "veg", store: "market" },
  { id: "carrots", name: "carrots", kind: "veg", store: "ctown" },
  { id: "cauliflower", name: "cauliflower", kind: "veg", store: "market" },
  { id: "broccoli", name: "broccoli", kind: "veg", store: "costco" },
  { id: "cabbage", name: "cabbage", kind: "veg", store: "market" },
  { id: "spinach", name: "spinach", kind: "veg", store: "tj" },
  { id: "green-beans", name: "green beans", kind: "veg", store: "market" },
  { id: "bell-peppers", name: "bell peppers", kind: "veg", store: "ctown" },
  { id: "zucchini", name: "zucchini", kind: "veg", store: "market" },
  { id: "eggplant", name: "eggplant", kind: "veg", store: "patel" },
  { id: "okra", name: "okra", kind: "veg", store: "patel" },
  { id: "mushrooms", name: "mushrooms", kind: "veg", store: "tj" },
  { id: "tomatoes", name: "tomatoes", kind: "veg", store: "market" },
  { id: "canned-tomatoes", name: "canned tomatoes", kind: "veg", store: "ctown" },
  { id: "cucumber", name: "cucumber", kind: "veg", store: "ctown" },
  { id: "scallions", name: "scallions", kind: "veg", store: "patel" },
  { id: "cilantro", name: "cilantro", kind: "veg", store: "patel" },
  { id: "lime", name: "limes", kind: "veg", store: "ctown" },
  { id: "lemon", name: "lemons", kind: "veg", store: "ctown" },
  { id: "frozen-peas", name: "frozen peas", kind: "veg", store: "tj" },
  { id: "frozen-corn", name: "frozen corn", kind: "veg", store: "tj" },

  // ---- starches ----
  { id: "basmati", name: "basmati rice", kind: "starch", store: "patel" },
  { id: "short-rice", name: "short-grain rice", kind: "starch", store: "tj" },
  { id: "pasta", name: "pasta", kind: "starch", store: "ctown" },
  { id: "gnocchi", name: "gnocchi", kind: "starch", store: "tj" },
  { id: "flour-tortillas", name: "flour tortillas", kind: "starch", store: "ctown" },
  { id: "corn-tortillas", name: "corn tortillas", kind: "starch", store: "ctown" },
  { id: "atta", name: "atta flour", kind: "starch", store: "patel" },
  { id: "bread", name: "bread", kind: "starch", store: "tj" },
  { id: "pita", name: "pita", kind: "starch", store: "ctown" },
  { id: "ramen-noodles", name: "ramen noodles", kind: "starch", store: "tj" },
  { id: "rice-noodles", name: "rice noodles", kind: "starch", store: "tj" },
  { id: "couscous", name: "couscous", kind: "starch", store: "tj" },

  // ---- dairy ----
  { id: "butter", name: "butter", kind: "dairy", store: "costco" },
  { id: "milk", name: "milk", kind: "dairy", store: "ctown" },
  { id: "yogurt", name: "yogurt", kind: "dairy", store: "patel" },
  { id: "parmesan", name: "parmesan", kind: "dairy", store: "tj" },
  { id: "mozzarella", name: "mozzarella", kind: "dairy", store: "costco" },
  { id: "cheddar", name: "cheddar", kind: "dairy", store: "costco" },
  { id: "sour-cream", name: "sour cream", kind: "dairy", store: "ctown" },
  { id: "heavy-cream", name: "heavy cream", kind: "dairy", store: "ctown" },

  // ---- pantry (only the ones that actually run out) ----
  { id: "coconut-milk", name: "coconut milk", kind: "pantry", store: "tj" },
  { id: "mustard-oil", name: "mustard oil", kind: "pantry", store: "patel" },
  { id: "panch-phoron", name: "panch phoron", kind: "pantry", store: "patel" },
  { id: "garam-masala", name: "garam masala", kind: "pantry", store: "patel" },
  { id: "soy-sauce", name: "soy sauce", kind: "pantry", store: "tj" },
  { id: "fish-sauce", name: "fish sauce", kind: "pantry", store: "tj" },
  { id: "gochujang", name: "gochujang", kind: "pantry", store: "tj" },
  { id: "thai-curry-paste", name: "thai curry paste", kind: "pantry", store: "tj" },
  { id: "tahini", name: "tahini", kind: "pantry", store: "tj" },
  { id: "peanut-butter", name: "peanut butter", kind: "pantry", store: "costco" },
  { id: "salsa", name: "salsa", kind: "pantry", store: "tj" },
  { id: "tortilla-chips", name: "tortilla chips", kind: "pantry", store: "costco" },
  { id: "stock", name: "stock", kind: "pantry", store: "tj" },
];

/** The kind groups, in pantry-tab order. */
export const KINDS = [
  { id: "protein", label: "proteins" },
  { id: "veg", label: "veg" },
  { id: "starch", label: "starches" },
  { id: "dairy", label: "dairy" },
  { id: "pantry", label: "pantry" },
];

/** @type {Map<string, Staple>} */
export const STAPLE_BY_ID = new Map(STAPLES.map((s) => [s.id, s]));

/** @type {Map<string, Store>} */
export const STORE_BY_ID = new Map(STORES.map((s) => [s.id, s]));
