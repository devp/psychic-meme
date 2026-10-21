// The skeleton's language is the host's JavaScript: nothing to load. A port
// runs its engine's classic script in this context first, then imports.
export const lang = await import("../lang.js");
