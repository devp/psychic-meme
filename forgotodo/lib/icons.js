// Desktop icons, drawn as bitmaps: `#` is a pixel, `+` a dithered one (drawn on
// alternate pixels, checkerboard-style, the way 1-bit screens did greys), `.`
// is blank. Rows can be any width. Rendered as a crisp SVG in currentColor,
// so every theme gets them for free.

/** @type {Record<string, string[]>} */
export const ICONS = {
  beam: [
    "#####.....",
    "#...#...#.",
    "#...#.#..#",
    "#...#..#.#",
    "#####..#.#",
    "#.#.#..#.#",
    "#####.#..#",
    "#.#.#...#.",
    "#####.....",
    "..........",
  ],
  receive: [
    "....##....",
    "....##....",
    "....##....",
    "..######..",
    "...####...",
    "#...##...#",
    "#........#",
    "#.######.#",
    "#........#",
    "##########",
  ],
  sweep: [
    "....##....",
    "....##....",
    "....##....",
    "....##....",
    "..######..",
    "..#.##.#..",
    ".########.",
    ".########.",
    "#.#.##.#.#",
    "#.#.##.#.#",
  ],
  recycle: [
    "...####...",
    "##########",
    ".#......#.",
    ".#.#..#.#.",
    ".#.#..#.#.",
    ".#.#..#.#.",
    ".#.#..#.#.",
    ".#.#..#.#.",
    ".#......#.",
    "..######..",
  ],
  forget: [
    "..++++++..",
    ".++....++.",
    ".......++.",
    "......++..",
    ".....++...",
    "....++....",
    "....++....",
    "..........",
    "....++....",
    "....++....",
  ],
  remember: [
    "....##....",
    "#..####..#",
    "...####...",
    "...####...",
    "#..####..#",
    "....##....",
    "....##....",
    "..........",
    "....##....",
    "....##....",
  ],
  prefs: [
    ".#...#..#.",
    "###..#..#.",
    "###..#..#.",
    ".#...#.###",
    ".#...#.###",
    ".#..###.#.",
    ".#..###.#.",
    ".#...#..#.",
    ".#...#..#.",
    ".#...#..#.",
  ],
};

/**
 * SVG markup for a bitmap: one rect-run per row of pixels.
 * @param {string[]} rows
 * @returns {string}
 */
export function bitmapSvg(rows) {
  let d = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const on = (/** @type {number} */ i) => row[i] === "#" || (row[i] === "+" && (i + y) % 2 === 0);
      if (!on(x)) {
        x++;
        continue;
      }
      const start = x;
      while (on(x)) x++;
      d += `M${start} ${y}h${x - start}v1h-${x - start}z`;
    }
  });
  const w = Math.max(...rows.map((r) => r.length));
  return `<svg class="icon" viewBox="0 0 ${w} ${rows.length}" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="${d}"/></svg>`;
}
