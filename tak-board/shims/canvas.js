// Stands in for node-canvas. tps-ninja's SVG renderer needs a 2D context only for measureText.
export function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  return Object.assign(document.createElement("canvas"), { width, height });
}
