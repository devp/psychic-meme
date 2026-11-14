// Where the data comes from. This is the only file that knows it's mocked:
// point these two exports somewhere real and delete mock/.
//
// `service` answers questions (lib/types.js Service); `engine` makes time
// pass for the item that's on (lib/types.js Engine).

import { createMockService } from "./mock/service.js";
import { createMockEngine } from "./mock/engine.js";

// ?speed=30 makes mock items end while you watch.
const speed = Number(new URLSearchParams(location.search).get("speed")) || 1;

/** @type {import("./lib/types.js").Service} */
export const service = createMockService();

/** @type {import("./lib/types.js").Engine} */
export const engine = createMockEngine({ speed });
