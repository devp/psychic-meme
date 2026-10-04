const PLAYERS = { 1: "1", 2: "2", white: "1", black: "2" };

/**
 * TPS with its side-to-move field set to `turn` (1, 2, "white" or "black").
 * Any other `turn`, or a TPS without that field, comes back unchanged.
 * @param {string} tps
 * @param {string | number | null | undefined} turn
 */
export function withTurn(tps, turn) {
  const player = PLAYERS[String(turn).toLowerCase()];
  if (!player) return tps;
  return tps.trim().replace(/(\s)[12](\s+\d+)$/, `$1${player}$2`);
}

/** "turn-indicator" -> "turnIndicator" @param {string} name */
export const camelCase = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** "turnIndicator" -> "turn-indicator" @param {string} name */
export const kebabCase = (name) => name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
