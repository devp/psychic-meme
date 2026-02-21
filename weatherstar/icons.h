/*
 * icons.h — Weather icon drawing
 *
 * ═══════════════════════════════════════════════════════════════════
 * OVERVIEW
 * ═══════════════════════════════════════════════════════════════════
 *
 * The WeatherStar 4000 displayed simple, iconic weather graphics —
 * a sun, clouds, rain drops.  We draw these directly into the pixel
 * framebuffer using basic geometry (filled circles, lines).
 *
 * All icons are drawn with a "centre point" coordinate system:
 * you specify where the icon's visual centre should be, and the
 * drawing functions radiate outward from there.
 *
 * ═══════════════════════════════════════════════════════════════════
 * HOW THE CIRCLE-DRAWING WORKS
 * ═══════════════════════════════════════════════════════════════════
 *
 * Both the sun and cloud use a brute-force filled-circle algorithm:
 *
 *   for each (dx, dy) in the bounding box:
 *       if dx² + dy² ≤ r²:  → pixel is inside the circle
 *
 * This is O(r²) per circle, which is perfectly fine for radii under
 * ~20 pixels.  A Bresenham or midpoint algorithm would be faster for
 * large radii, but we're drawing a handful of tiny circles — the
 * brute force approach is clearer and more than fast enough.
 */

#ifndef ICONS_H
#define ICONS_H

#include "fb.h"
#include <math.h>

/* ── draw_sun: sun icon with rays ───────────────────────────────── */
/*
 * Draws a filled yellow circle for the sun body, then 8 radial rays
 * extending outward at 45° intervals (every π/4 radians).
 *
 * Each ray is a line of pixels drawn by stepping outward from the
 * circle edge (r+3) to a fixed length (r+10), computing (x,y) from
 * polar coordinates: x = cos(θ)·d, y = sin(θ)·d.
 *
 * The ray is thickened by also writing the pixel one position to the
 * right (px+1), giving it a 2-pixel width for visual weight.
 */
static void draw_sun(int cx, int cy, int r) {
    /* filled circle — the sun body */
    for (int dy = -r; dy <= r; dy++)
        for (int dx = -r; dx <= r; dx++)
            if (dx * dx + dy * dy <= r * r) {
                int px = cx + dx, py = cy + dy;
                if (px >= 0 && px < FB_W && py >= 0 && py < FB_H)
                    fb[py][px] = COL_YELLOW;
            }

    /* 8 rays at 45° intervals */
    for (int i = 0; i < 8; i++) {
        float angle = (float)i * 3.14159f / 4.0f;
        for (int d = r + 3; d < r + 10; d++) {
            int px = cx + (int)(cosf(angle) * (float)d);
            int py = cy + (int)(sinf(angle) * (float)d);
            if (px >= 0 && px < FB_W && py >= 0 && py < FB_H)
                fb[py][px] = COL_ORANGE;
            if (px + 1 >= 0 && px + 1 < FB_W && py >= 0 && py < FB_H)
                fb[py][px + 1] = COL_ORANGE;
        }
    }
}

/* ── draw_cloud: cloud icon from overlapping circles ────────────── */
/*
 * A cloud shape is approximated by three overlapping filled circles:
 *
 *     - A central circle (radius 12) at the given centre point
 *     - A left circle  (radius 10, offset 10px left and 4px down)
 *     - A right circle (radius 10, offset 10px right and 4px down)
 *
 * The overlap of the three circles produces a convincing "puffy
 * cloud" silhouette:
 *
 *          ████████
 *       ██████████████
 *     ████████████████████
 *       ██████████████
 *
 * The `col` parameter lets the caller choose the cloud colour
 * (e.g. light gray for fair-weather clouds, darker for overcast).
 */
static void draw_cloud(int cx, int cy, rgb_t col) {
    int offsets[][3] = {
        {  0, 0, 12 },   /* centre */
        {-10, 4, 10 },   /* left-bottom lobe */
        { 10, 4, 10 },   /* right-bottom lobe */
    };
    for (int i = 0; i < 3; i++) {
        int ox = offsets[i][0], oy = offsets[i][1], r = offsets[i][2];
        for (int dy = -r; dy <= r; dy++)
            for (int dx = -r; dx <= r; dx++)
                if (dx * dx + dy * dy <= r * r) {
                    int px = cx + ox + dx, py = cy + oy + dy;
                    if (px >= 0 && px < FB_W && py >= 0 && py < FB_H)
                        fb[py][px] = col;
                }
    }
}

#endif /* ICONS_H */
