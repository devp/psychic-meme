// The library. 112 dishes this household already knows how to cook.
//
// Note what a recipe here does NOT have: ingredients with quantities, steps,
// a photo, a source link. This app is not for looking up how to cook a thing
// -- you already know, that's why it's in here. It's for answering "what,
// tonight" in under a minute, so a dish carries only what a decision needs:
// how long, how much attention, which lane it scratches, whether the kids
// will eat it, and which tracked staples it burns.
//
// `staples` is the load-bearing field: it's what makes a card say "you're out
// of paneer" before you commit to palak paneer, and it's the only input the
// shopping list has.

/**
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} name
 * @property {string} lane cultural lane, one of LANES[].id
 * @property {string} method cook method, one of METHODS[].id
 * @property {number} prep minutes between deciding and eating
 * @property {boolean} kidOk both kids will eat it without a negotiation
 * @property {string[]} staples STAPLES ids it consumes
 */

/** Filter chips for cook method. `id` matches Recipe.method. */
export const METHODS = [
  { id: "no-cook", label: "no-cook" },
  { id: "stovetop", label: "stovetop" },
  { id: "oven", label: "oven" },
  { id: "sheet-pan", label: "sheet pan" },
  { id: "instant-pot", label: "instant pot" },
  { id: "slow-cooker", label: "slow cooker" },
  { id: "air-fryer", label: "air fryer" },
  { id: "grill", label: "grill" },
];

/** Filter chips for cultural lane. `id` matches Recipe.lane. */
export const LANES = [
  { id: "bengali", label: "bengali" },
  { id: "indian", label: "north indian" },
  { id: "italian", label: "italian" },
  { id: "mexican", label: "mexican" },
  { id: "japanese", label: "japanese" },
  { id: "korean", label: "korean" },
  { id: "chinese", label: "chinese" },
  { id: "thai", label: "thai / sea" },
  { id: "medi", label: "mediterranean" },
  { id: "american", label: "american" },
];

/**
 * Prep-time buckets. Phrased the way you'd actually think at 5:40pm.
 * `max` is inclusive; null means no ceiling.
 */
export const TIME_BUCKETS = [
  { id: "any", label: "any time", max: null },
  { id: "15", label: "≤ 15 min", max: 15 },
  { id: "30", label: "≤ 30 min", max: 30 },
  { id: "45", label: "≤ 45 min", max: 45 },
];

/** @type {Recipe[]} */
export const RECIPES = [
  // ---- bengali ----
  { id: "bn01", name: "Masoor dal & bhaat", lane: "bengali", method: "stovetop", prep: 25, kidOk: true, staples: ["masoor-dal", "basmati", "onions", "garlic", "mustard-oil"] },
  { id: "bn02", name: "Aloo posto", lane: "bengali", method: "stovetop", prep: 30, kidOk: true, staples: ["potatoes", "mustard-oil", "onions", "basmati"] },
  { id: "bn03", name: "Rui macher jhol", lane: "bengali", method: "stovetop", prep: 35, kidOk: false, staples: ["rui-fish", "potatoes", "mustard-oil", "tomatoes", "basmati"] },
  { id: "bn04", name: "Dim curry", lane: "bengali", method: "stovetop", prep: 30, kidOk: true, staples: ["eggs", "onions", "garlic", "ginger", "canned-tomatoes", "garam-masala", "basmati"] },
  { id: "bn05", name: "Begun bhaja & dal", lane: "bengali", method: "stovetop", prep: 20, kidOk: false, staples: ["eggplant", "mustard-oil", "masoor-dal", "basmati"] },
  { id: "bn06", name: "Shukto", lane: "bengali", method: "stovetop", prep: 40, kidOk: false, staples: ["eggplant", "sweet-potato", "green-beans", "milk", "panch-phoron", "basmati"] },
  { id: "bn07", name: "Kacchi biryani", lane: "bengali", method: "oven", prep: 90, kidOk: true, staples: ["chicken-thighs", "basmati", "yogurt", "onions", "garam-masala", "potatoes"] },
  { id: "bn08", name: "Chingri malai curry", lane: "bengali", method: "stovetop", prep: 35, kidOk: false, staples: ["shrimp", "coconut-milk", "onions", "ginger", "garam-masala", "basmati"] },
  { id: "bn09", name: "Bhuna khichuri", lane: "bengali", method: "instant-pot", prep: 30, kidOk: true, staples: ["masoor-dal", "basmati", "potatoes", "cauliflower", "frozen-peas", "panch-phoron"] },
  { id: "bn10", name: "Aloo bhaja & dim bhaji", lane: "bengali", method: "stovetop", prep: 15, kidOk: true, staples: ["potatoes", "eggs", "mustard-oil", "basmati"] },
  { id: "bn11", name: "Dhokar dalna", lane: "bengali", method: "stovetop", prep: 50, kidOk: false, staples: ["chana-dal", "potatoes", "canned-tomatoes", "garam-masala", "basmati"] },
  { id: "bn12", name: "Labra", lane: "bengali", method: "stovetop", prep: 35, kidOk: true, staples: ["cabbage", "potatoes", "eggplant", "green-beans", "panch-phoron", "basmati"] },

  // ---- north indian ----
  { id: "in01", name: "Chana masala", lane: "indian", method: "instant-pot", prep: 30, kidOk: true, staples: ["chickpeas", "onions", "canned-tomatoes", "ginger", "garam-masala", "basmati"] },
  { id: "in02", name: "Palak paneer", lane: "indian", method: "stovetop", prep: 35, kidOk: true, staples: ["paneer", "spinach", "onions", "ginger", "heavy-cream", "basmati"] },
  { id: "in03", name: "Sheet-pan paneer tikka", lane: "indian", method: "sheet-pan", prep: 30, kidOk: false, staples: ["paneer", "bell-peppers", "onions", "yogurt", "garam-masala"] },
  { id: "in04", name: "Chicken korma", lane: "indian", method: "stovetop", prep: 45, kidOk: false, staples: ["chicken-thighs", "yogurt", "onions", "garam-masala", "basmati"] },
  { id: "in05", name: "Rajma-style beans", lane: "indian", method: "instant-pot", prep: 35, kidOk: true, staples: ["black-beans", "onions", "canned-tomatoes", "ginger", "basmati"] },
  { id: "in06", name: "Aloo gobi", lane: "indian", method: "stovetop", prep: 35, kidOk: true, staples: ["potatoes", "cauliflower", "onions", "garam-masala", "atta"] },
  { id: "in07", name: "Bhindi masala", lane: "indian", method: "stovetop", prep: 30, kidOk: false, staples: ["okra", "onions", "tomatoes", "atta"] },
  { id: "in08", name: "Air-fryer tandoori chicken", lane: "indian", method: "air-fryer", prep: 30, kidOk: true, staples: ["chicken-thighs", "yogurt", "garam-masala", "lemon", "basmati"] },
  { id: "in09", name: "Keema matar", lane: "indian", method: "stovetop", prep: 30, kidOk: true, staples: ["ground-turkey", "frozen-peas", "onions", "ginger", "garam-masala", "basmati"] },
  { id: "in10", name: "Roti & sabzi night", lane: "indian", method: "stovetop", prep: 40, kidOk: true, staples: ["atta", "cauliflower", "potatoes", "frozen-peas"] },
  { id: "in11", name: "Dal tadka", lane: "indian", method: "instant-pot", prep: 25, kidOk: true, staples: ["masoor-dal", "garlic", "onions", "basmati", "butter"] },

  // ---- italian ----
  { id: "it01", name: "Cacio e pepe, roughly", lane: "italian", method: "stovetop", prep: 15, kidOk: true, staples: ["pasta", "parmesan", "butter"] },
  { id: "it02", name: "Spaghetti marinara", lane: "italian", method: "stovetop", prep: 25, kidOk: true, staples: ["pasta", "canned-tomatoes", "garlic", "parmesan"] },
  { id: "it03", name: "Sausage & pepper pasta", lane: "italian", method: "stovetop", prep: 30, kidOk: false, staples: ["pasta", "italian-sausage", "bell-peppers", "onions", "parmesan"] },
  { id: "it04", name: "Sheet-pan gnocchi & tomatoes", lane: "italian", method: "sheet-pan", prep: 30, kidOk: true, staples: ["gnocchi", "tomatoes", "zucchini", "mozzarella"] },
  { id: "it05", name: "Baked ziti", lane: "italian", method: "oven", prep: 55, kidOk: true, staples: ["pasta", "canned-tomatoes", "mozzarella", "italian-sausage", "parmesan"] },
  { id: "it06", name: "Pasta e ceci", lane: "italian", method: "stovetop", prep: 30, kidOk: true, staples: ["pasta", "chickpeas", "canned-tomatoes", "garlic", "parmesan"] },
  { id: "it07", name: "Lemon butter shrimp pasta", lane: "italian", method: "stovetop", prep: 25, kidOk: false, staples: ["pasta", "shrimp", "lemon", "butter", "garlic", "parmesan"] },
  { id: "it08", name: "Air-fryer chicken parm", lane: "italian", method: "air-fryer", prep: 35, kidOk: true, staples: ["chicken-breast", "canned-tomatoes", "mozzarella", "bread", "parmesan"] },
  { id: "it09", name: "Zucchini mushroom risotto", lane: "italian", method: "stovetop", prep: 40, kidOk: true, staples: ["short-rice", "zucchini", "mushrooms", "parmesan", "stock", "butter"] },
  { id: "it10", name: "Frittata & bread", lane: "italian", method: "oven", prep: 30, kidOk: true, staples: ["eggs", "potatoes", "spinach", "parmesan", "bread"] },
  { id: "it11", name: "Creamy tomato pasta", lane: "italian", method: "stovetop", prep: 25, kidOk: true, staples: ["pasta", "canned-tomatoes", "heavy-cream", "parmesan", "garlic"] },
  { id: "it12", name: "Minestrone", lane: "italian", method: "instant-pot", prep: 35, kidOk: true, staples: ["canned-tomatoes", "carrots", "cabbage", "chickpeas", "pasta", "stock"] },

  // ---- mexican ----
  { id: "mx01", name: "Weeknight tacos", lane: "mexican", method: "stovetop", prep: 20, kidOk: true, staples: ["ground-beef", "corn-tortillas", "cheddar", "salsa", "lime"] },
  { id: "mx02", name: "Black bean quesadillas", lane: "mexican", method: "stovetop", prep: 15, kidOk: true, staples: ["flour-tortillas", "black-beans", "cheddar", "salsa"] },
  { id: "mx03", name: "Sheet-pan chicken fajitas", lane: "mexican", method: "sheet-pan", prep: 30, kidOk: false, staples: ["chicken-breast", "bell-peppers", "onions", "flour-tortillas", "lime", "sour-cream"] },
  { id: "mx04", name: "Carnitas, all afternoon", lane: "mexican", method: "slow-cooker", prep: 240, kidOk: false, staples: ["pork-shoulder", "onions", "lime", "corn-tortillas"] },
  { id: "mx05", name: "Shrimp tacos", lane: "mexican", method: "stovetop", prep: 25, kidOk: false, staples: ["shrimp", "cabbage", "lime", "corn-tortillas", "sour-cream"] },
  { id: "mx06", name: "Chilaquiles", lane: "mexican", method: "stovetop", prep: 20, kidOk: true, staples: ["tortilla-chips", "eggs", "salsa", "cheddar", "sour-cream"] },
  { id: "mx07", name: "Black bean soup", lane: "mexican", method: "instant-pot", prep: 30, kidOk: true, staples: ["black-beans", "onions", "carrots", "stock", "sour-cream", "lime"] },
  { id: "mx08", name: "Taco salad bowls", lane: "mexican", method: "no-cook", prep: 15, kidOk: true, staples: ["black-beans", "cabbage", "tomatoes", "cheddar", "tortilla-chips", "salsa"] },
  { id: "mx09", name: "Enchilada bake", lane: "mexican", method: "oven", prep: 45, kidOk: true, staples: ["corn-tortillas", "chicken-breast", "canned-tomatoes", "cheddar", "black-beans"] },
  { id: "mx10", name: "Corn & bean rice bowls", lane: "mexican", method: "stovetop", prep: 25, kidOk: true, staples: ["frozen-corn", "basmati", "black-beans", "lime", "sour-cream", "cheddar"] },
  { id: "mx11", name: "Breakfast burritos for dinner", lane: "mexican", method: "stovetop", prep: 20, kidOk: true, staples: ["eggs", "flour-tortillas", "cheddar", "potatoes", "salsa"] },
  { id: "mx12", name: "Pork tinga, roughly", lane: "mexican", method: "instant-pot", prep: 45, kidOk: false, staples: ["pork-shoulder", "canned-tomatoes", "onions", "corn-tortillas", "lime"] },

  // ---- japanese ----
  { id: "jp01", name: "Oyakodon", lane: "japanese", method: "stovetop", prep: 25, kidOk: true, staples: ["chicken-thighs", "eggs", "onions", "short-rice", "soy-sauce"] },
  { id: "jp02", name: "Salmon shioyaki & rice", lane: "japanese", method: "oven", prep: 25, kidOk: true, staples: ["salmon", "short-rice", "lemon", "cabbage"] },
  { id: "jp03", name: "Gyudon", lane: "japanese", method: "stovetop", prep: 20, kidOk: true, staples: ["ground-beef", "onions", "short-rice", "soy-sauce"] },
  { id: "jp04", name: "Tofu & greens donburi", lane: "japanese", method: "stovetop", prep: 25, kidOk: true, staples: ["tofu", "spinach", "short-rice", "soy-sauce", "scallions"] },
  { id: "jp05", name: "Japanese curry rice", lane: "japanese", method: "stovetop", prep: 40, kidOk: true, staples: ["chicken-thighs", "potatoes", "carrots", "onions", "short-rice"] },
  { id: "jp06", name: "Ramen with jammy eggs", lane: "japanese", method: "stovetop", prep: 25, kidOk: true, staples: ["ramen-noodles", "eggs", "scallions", "spinach", "stock", "soy-sauce"] },
  { id: "jp07", name: "Yakisoba-ish noodles", lane: "japanese", method: "stovetop", prep: 25, kidOk: true, staples: ["ramen-noodles", "cabbage", "carrots", "soy-sauce", "bacon"] },
  { id: "jp08", name: "Onigirazu plates", lane: "japanese", method: "no-cook", prep: 15, kidOk: true, staples: ["short-rice", "eggs", "cucumber", "soy-sauce"] },
  { id: "jp09", name: "Air-fryer teriyaki salmon bowls", lane: "japanese", method: "air-fryer", prep: 25, kidOk: true, staples: ["salmon", "short-rice", "broccoli", "soy-sauce"] },

  // ---- korean ----
  { id: "kr01", name: "Bibimbap bowls", lane: "korean", method: "stovetop", prep: 35, kidOk: false, staples: ["short-rice", "eggs", "spinach", "carrots", "zucchini", "gochujang"] },
  { id: "kr02", name: "Dakgalbi-ish chicken", lane: "korean", method: "stovetop", prep: 30, kidOk: false, staples: ["chicken-thighs", "cabbage", "sweet-potato", "gochujang", "short-rice"] },
  { id: "kr03", name: "Tofu jjigae", lane: "korean", method: "stovetop", prep: 30, kidOk: false, staples: ["tofu", "gochujang", "zucchini", "scallions", "stock", "short-rice"] },
  { id: "kr04", name: "Gochujang pork & rice", lane: "korean", method: "stovetop", prep: 30, kidOk: false, staples: ["pork-shoulder", "gochujang", "onions", "short-rice", "cucumber"] },

  // ---- chinese ----
  { id: "cn01", name: "Garlic green beans & pork", lane: "chinese", method: "stovetop", prep: 20, kidOk: false, staples: ["green-beans", "ground-turkey", "garlic", "soy-sauce", "basmati"] },
  { id: "cn02", name: "Tomato & egg stir-fry", lane: "chinese", method: "stovetop", prep: 15, kidOk: true, staples: ["eggs", "tomatoes", "scallions", "short-rice", "soy-sauce"] },
  { id: "cn03", name: "Mapo-ish tofu", lane: "chinese", method: "stovetop", prep: 25, kidOk: false, staples: ["tofu", "ground-beef", "scallions", "garlic", "short-rice", "soy-sauce"] },
  { id: "cn04", name: "Clean-the-fridge fried rice", lane: "chinese", method: "stovetop", prep: 20, kidOk: true, staples: ["short-rice", "eggs", "frozen-peas", "frozen-corn", "carrots", "soy-sauce", "scallions"] },
  { id: "cn05", name: "Chicken & broccoli", lane: "chinese", method: "stovetop", prep: 25, kidOk: true, staples: ["chicken-breast", "broccoli", "garlic", "soy-sauce", "basmati"] },
  { id: "cn06", name: "Dumpling & greens soup", lane: "chinese", method: "stovetop", prep: 20, kidOk: true, staples: ["ramen-noodles", "cabbage", "stock", "ginger", "scallions", "soy-sauce"] },
  { id: "cn07", name: "Dumpling-folding night", lane: "chinese", method: "stovetop", prep: 75, kidOk: true, staples: ["atta", "cabbage", "ground-turkey", "ginger", "scallions", "soy-sauce"] },

  // ---- thai / southeast asian ----
  { id: "th01", name: "Thai red curry", lane: "thai", method: "stovetop", prep: 30, kidOk: false, staples: ["thai-curry-paste", "coconut-milk", "chicken-thighs", "bell-peppers", "green-beans", "basmati"] },
  { id: "th02", name: "Green curry tofu", lane: "thai", method: "stovetop", prep: 25, kidOk: true, staples: ["thai-curry-paste", "coconut-milk", "tofu", "zucchini", "basmati"] },
  { id: "th03", name: "Pad see ew, roughly", lane: "thai", method: "stovetop", prep: 25, kidOk: true, staples: ["rice-noodles", "chicken-breast", "broccoli", "eggs", "soy-sauce"] },
  { id: "th04", name: "Cold peanut noodles", lane: "thai", method: "no-cook", prep: 15, kidOk: true, staples: ["rice-noodles", "peanut-butter", "cucumber", "carrots", "lime", "soy-sauce"] },
  { id: "th05", name: "Larb-style turkey cups", lane: "thai", method: "stovetop", prep: 20, kidOk: false, staples: ["ground-turkey", "cabbage", "lime", "fish-sauce", "cilantro", "short-rice"] },
  { id: "th06", name: "Coconut shrimp curry", lane: "thai", method: "stovetop", prep: 30, kidOk: false, staples: ["shrimp", "coconut-milk", "thai-curry-paste", "spinach", "basmati"] },

  // ---- mediterranean ----
  { id: "md01", name: "Sheet-pan chicken & lemon potatoes", lane: "medi", method: "sheet-pan", prep: 50, kidOk: true, staples: ["chicken-thighs", "potatoes", "lemon", "garlic"] },
  { id: "md02", name: "Air-fryer chickpea patties", lane: "medi", method: "air-fryer", prep: 30, kidOk: false, staples: ["chickpeas", "cilantro", "garlic", "tahini", "pita", "cucumber"] },
  { id: "md03", name: "Shakshuka", lane: "medi", method: "stovetop", prep: 30, kidOk: true, staples: ["eggs", "canned-tomatoes", "bell-peppers", "onions", "bread"] },
  { id: "md04", name: "Chopped salad & pita", lane: "medi", method: "no-cook", prep: 15, kidOk: true, staples: ["cucumber", "tomatoes", "pita", "lemon"] },
  { id: "md05", name: "Couscous & roasted veg", lane: "medi", method: "sheet-pan", prep: 35, kidOk: true, staples: ["couscous", "zucchini", "bell-peppers", "chickpeas", "lemon"] },
  { id: "md06", name: "Lemon chicken & couscous", lane: "medi", method: "stovetop", prep: 30, kidOk: true, staples: ["chicken-breast", "couscous", "lemon", "spinach"] },
  { id: "md07", name: "Tahini chickpea bowls", lane: "medi", method: "no-cook", prep: 15, kidOk: true, staples: ["chickpeas", "tahini", "cucumber", "tomatoes", "pita", "lemon"] },
  { id: "md08", name: "Baked fish with tomatoes", lane: "medi", method: "oven", prep: 30, kidOk: false, staples: ["rui-fish", "tomatoes", "lemon", "garlic", "couscous"] },
  { id: "md09", name: "Stuffed peppers", lane: "medi", method: "oven", prep: 55, kidOk: true, staples: ["bell-peppers", "ground-beef", "basmati", "canned-tomatoes", "parmesan"] },
  { id: "md10", name: "Lentil soup with lemon", lane: "medi", method: "instant-pot", prep: 30, kidOk: true, staples: ["masoor-dal", "carrots", "onions", "lemon", "spinach", "stock", "bread"] },
  { id: "md11", name: "Shawarma-ish chicken pitas", lane: "medi", method: "air-fryer", prep: 30, kidOk: false, staples: ["chicken-thighs", "yogurt", "pita", "cucumber", "tomatoes", "garam-masala"] },
  { id: "md12", name: "Grilled chicken & flatbread", lane: "medi", method: "grill", prep: 40, kidOk: false, staples: ["chicken-thighs", "yogurt", "pita", "cucumber", "lemon"] },
  { id: "md13", name: "Grilled veg platter", lane: "medi", method: "grill", prep: 35, kidOk: false, staples: ["zucchini", "bell-peppers", "eggplant", "lemon", "couscous"] },

  // ---- american ----
  { id: "am01", name: "Sheet-pan sausage & veg", lane: "american", method: "sheet-pan", prep: 35, kidOk: true, staples: ["italian-sausage", "potatoes", "broccoli", "bell-peppers"] },
  { id: "am02", name: "Roast chicken thighs & carrots", lane: "american", method: "oven", prep: 45, kidOk: true, staples: ["chicken-thighs", "carrots", "potatoes", "butter"] },
  { id: "am03", name: "Turkey chili", lane: "american", method: "instant-pot", prep: 40, kidOk: true, staples: ["ground-turkey", "black-beans", "canned-tomatoes", "onions", "cheddar", "frozen-corn"] },
  { id: "am04", name: "Grilled cheese & tomato soup", lane: "american", method: "stovetop", prep: 20, kidOk: true, staples: ["bread", "cheddar", "butter", "canned-tomatoes", "heavy-cream"] },
  { id: "am05", name: "Breakfast hash", lane: "american", method: "stovetop", prep: 25, kidOk: true, staples: ["potatoes", "eggs", "bacon", "bell-peppers", "cheddar"] },
  { id: "am06", name: "Stovetop mac & cheese", lane: "american", method: "stovetop", prep: 25, kidOk: true, staples: ["pasta", "cheddar", "milk", "butter"] },
  { id: "am07", name: "BLTs", lane: "american", method: "stovetop", prep: 15, kidOk: true, staples: ["bacon", "bread", "tomatoes", "cucumber"] },
  { id: "am08", name: "Cast-iron burgers", lane: "american", method: "stovetop", prep: 25, kidOk: true, staples: ["ground-beef", "bread", "cheddar", "tomatoes", "onions"] },
  { id: "am09", name: "Chicken noodle soup", lane: "american", method: "instant-pot", prep: 40, kidOk: true, staples: ["chicken-thighs", "carrots", "pasta", "onions", "stock"] },
  { id: "am10", name: "Salmon cakes", lane: "american", method: "stovetop", prep: 30, kidOk: true, staples: ["salmon", "potatoes", "eggs", "bread", "lemon"] },
  { id: "am11", name: "Loaded baked potatoes", lane: "american", method: "oven", prep: 60, kidOk: true, staples: ["potatoes", "cheddar", "sour-cream", "bacon", "broccoli"] },
  { id: "am12", name: "Sloppy joes", lane: "american", method: "stovetop", prep: 25, kidOk: true, staples: ["ground-beef", "canned-tomatoes", "bread", "onions", "bell-peppers"] },
  { id: "am13", name: "Slow pulled pork", lane: "american", method: "slow-cooker", prep: 300, kidOk: false, staples: ["pork-shoulder", "onions", "bread", "cabbage"] },
  { id: "am14", name: "Sheet-pan salmon & sweet potato", lane: "american", method: "sheet-pan", prep: 35, kidOk: true, staples: ["salmon", "sweet-potato", "broccoli", "lemon"] },
  { id: "am15", name: "Slow-cooker pork stew", lane: "american", method: "slow-cooker", prep: 300, kidOk: true, staples: ["pork-shoulder", "potatoes", "carrots", "canned-tomatoes", "stock", "bread"] },
  { id: "am16", name: "Homemade pizza night", lane: "american", method: "oven", prep: 60, kidOk: true, staples: ["atta", "mozzarella", "canned-tomatoes", "italian-sausage", "bell-peppers"] },
  { id: "am17", name: "Mushroom & egg toast", lane: "american", method: "stovetop", prep: 15, kidOk: true, staples: ["bread", "eggs", "mushrooms", "butter"] },

  // ---- the ten-minute shelf ----
  // The point of this lane is that it exists. On the worst nights the deck
  // should still have somewhere to land, and "cereal again" isn't it.
  { id: "qk01", name: "Yogurt, cucumber & chickpea plates", lane: "medi", method: "no-cook", prep: 10, kidOk: true, staples: ["yogurt", "cucumber", "chickpeas", "pita"] },
  { id: "qk02", name: "Cheese-and-things board", lane: "american", method: "no-cook", prep: 10, kidOk: true, staples: ["cheddar", "bread", "cucumber", "tomatoes"] },
  { id: "qk03", name: "Egg salad sandwiches", lane: "american", method: "no-cook", prep: 15, kidOk: true, staples: ["eggs", "bread", "cucumber"] },
  { id: "qk04", name: "Leftover rice bowls", lane: "japanese", method: "stovetop", prep: 10, kidOk: true, staples: ["basmati", "eggs", "frozen-peas", "soy-sauce"] },
  { id: "qk05", name: "Ten-minute quesadilla", lane: "mexican", method: "stovetop", prep: 10, kidOk: true, staples: ["flour-tortillas", "cheddar", "salsa"] },
  { id: "qk06", name: "Buttered pasta & peas", lane: "italian", method: "stovetop", prep: 15, kidOk: true, staples: ["pasta", "butter", "frozen-peas", "parmesan"] },
  { id: "qk07", name: "Freezer dal & rice", lane: "bengali", method: "stovetop", prep: 15, kidOk: true, staples: ["masoor-dal", "basmati", "butter"] },
  { id: "qk08", name: "Upgraded ramen", lane: "japanese", method: "stovetop", prep: 12, kidOk: true, staples: ["ramen-noodles", "eggs", "scallions", "frozen-corn"] },
  { id: "qk09", name: "Toast, eggs, greens", lane: "american", method: "stovetop", prep: 12, kidOk: true, staples: ["bread", "eggs", "spinach", "butter"] },
  { id: "qk10", name: "Chips, beans & cheese tray", lane: "mexican", method: "oven", prep: 20, kidOk: true, staples: ["tortilla-chips", "black-beans", "cheddar", "salsa", "sour-cream"] },
  { id: "qk11", name: "Biryani, the long way", lane: "bengali", method: "oven", prep: 120, kidOk: true, staples: ["chicken-thighs", "basmati", "yogurt", "onions", "garam-masala", "potatoes"] },
  { id: "qk12", name: "Paneer & pea pulao", lane: "indian", method: "instant-pot", prep: 30, kidOk: true, staples: ["paneer", "frozen-peas", "basmati", "onions", "garam-masala"] },
];

/** @type {Map<string, Recipe>} */
export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/** Lane and method label lookups, for the card and the plan rows. */
export const LANE_LABEL = new Map(LANES.map((l) => [l.id, l.label]));
export const METHOD_LABEL = new Map(METHODS.map((m) => [m.id, m.label]));
