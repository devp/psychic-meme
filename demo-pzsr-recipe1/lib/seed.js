// First-run seeding.
//
// A meal planner that opens empty is a meal planner you close: the pantry is
// 75 toggles of setup before the deck can say anything useful. So the first
// run writes a plausible mid-week kitchen -- mostly stocked, a few things
// low, a few things out -- and the app is immediately worth looking at.
//
// Kept out of app.js because it runs exactly once and never again, and out of
// state.js because state.js should describe shape, not content.

import { STAPLES } from "../data/staples.js";

/**
 * The kitchen as of a Wednesday. Everything not named here starts "have".
 * Chosen to make the demo honest rather than tidy: paneer being out is why
 * palak paneer shows a warning, and why the shop tab isn't empty.
 */
const LOW = ["onions", "yogurt", "basmati", "eggs", "butter", "frozen-peas", "garlic", "cilantro"];
const OUT = ["paneer", "shrimp", "coconut-milk", "corn-tortillas", "spinach", "gochujang", "salmon"];

/**
 * Fill the pantry record with one entry per tracked staple.
 *
 * Every staple gets a row, including the "have" ones: a pantry where absence
 * means "fine" and absence also means "never checked" is a pantry you can't
 * trust, and lib/plan.js treats an unknown staple as on hand.
 *
 * @param {ReturnType<typeof import("./store.js").recordStore>} pantryStore
 * @returns {string} the record id
 */
export function seedPantry(pantryStore) {
  const rec = pantryStore.ensureActive();
  if (rec.items.length > 0) return rec.id;
  pantryStore.rename(rec.id, "kitchen");
  for (const staple of STAPLES) {
    const status = OUT.includes(staple.id) ? "out" : LOW.includes(staple.id) ? "low" : "have";
    pantryStore.append(rec.id, { stapleId: staple.id, status });
  }
  return rec.id;
}
