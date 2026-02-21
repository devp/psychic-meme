/*
 * fb.h — Framebuffer and primitive drawing
 *
 * ═══════════════════════════════════════════════════════════════════
 * OVERVIEW
 * ═══════════════════════════════════════════════════════════════════
 *
 * This file defines the pixel framebuffer at the heart of the renderer.
 * Instead of writing to the screen directly, every drawing operation writes
 * into a flat 2D array of RGB pixels (fb[][]).  Once the full scene is
 * composed, the framebuffer is read out either as ANSI terminal sequences
 * or as a PNG file — the drawing code never needs to know which.
 *
 * The framebuffer is sized to 640×400 pixels, which matches the original
 * WeatherStar 4000's NTSC-era resolution.
 *
 * ═══════════════════════════════════════════════════════════════════
 * COLOUR MODEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * All colours are stored as 24-bit RGB triples (rgb_t).  The WeatherStar
 * 4000 palette is dominated by deep blues, golds, and cyans — a distinctive
 * look that came from the Amiga-based hardware TWC used in the early '90s.
 *
 * ═══════════════════════════════════════════════════════════════════
 * DRAWING PRIMITIVES
 * ═══════════════════════════════════════════════════════════════════
 *
 * fb_clear()         — Fill the entire framebuffer with a vertical gradient
 *                      from COL_GRADTOP to COL_GRADBOT.  This produces the
 *                      subtle dark-blue gradient visible behind all content.
 *
 * fb_rect()          — Solid-colour filled rectangle.
 *
 * fb_rect_grad_v()   — Rectangle with a vertical colour gradient.  Used for
 *                      the header bar and location bar, where the colour
 *                      shifts from a lighter blue at the top to a darker
 *                      blue at the bottom.
 *
 * fb_hline()         — Horizontal line spanning [x0, x1] at row y.
 *
 * draw_rounded_rect() — A filled rectangle with rounded corners.  Works by
 *                       first filling the whole rectangle, then "knocking
 *                       out" corner pixels that fall outside the radius
 *                       circle, replacing them with the background gradient.
 */

#ifndef FB_H_INCLUDED
#define FB_H_INCLUDED

#include <stdint.h>

/* ── framebuffer dimensions ─────────────────────────────────────── */
/*
 * 640×400 was chosen to approximate the original WeatherStar 4000
 * output resolution.  The CELL_W/CELL_H constants are vestigial
 * (from a text-cell model) but kept for reference.
 */
#define FB_W   640
#define FB_H   400
#define CELL_W 8
#define CELL_H 16

/* ── colour type ────────────────────────────────────────────────── */
/*
 * A single pixel: 8 bits per channel, no alpha.
 * "rgb_t" rather than a library type so we stay dependency-free.
 */
typedef struct { uint8_t r, g, b; } rgb_t;

/* ── the framebuffer itself ─────────────────────────────────────── */
/*
 * A global 640×400 pixel grid.  ~750 KB of static BSS memory.
 * Every drawing function writes directly into this array.
 */
static rgb_t fb[FB_H][FB_W];

/* ── WeatherStar colour palette ─────────────────────────────────── */
/*
 * These are tuned to match the WeatherStar 4000's signature look:
 * deep blue backgrounds, gold accent bars, cyan info text, and
 * white/light-gray content text.
 */
static const rgb_t COL_HEADER  = {  40,  70, 170 };  /* header bar fill      */
static const rgb_t COL_ACCENT  = {  60, 120, 210 };  /* subheadings          */
static const rgb_t COL_GOLD    = { 255, 200,  50 };  /* gold separator bars  */
static const rgb_t COL_WHITE   = { 255, 255, 255 };
static const rgb_t COL_LTGRAY  = { 180, 190, 210 };
static const rgb_t COL_YELLOW  = { 255, 255, 100 };
static const rgb_t COL_CYAN    = { 100, 220, 255 };  /* info label text      */
static const rgb_t COL_GREEN   = {  80, 220, 120 };
static const rgb_t COL_ORANGE  = { 255, 160,  50 };
static const rgb_t COL_GRADTOP = {  20,  40, 120 };  /* background gradient  */
static const rgb_t COL_GRADBOT = {   5,  15,  60 };  /*   top → bottom       */
static const rgb_t COL_SEP     = {  50,  80, 160 };  /* thin rule lines      */
static const rgb_t COL_TEMPHI  = { 255, 100,  80 };  /* high temperature     */
static const rgb_t COL_TEMPLO  = { 100, 180, 255 };  /* low temperature      */

/* ── helper: compute background gradient colour at a given y ──── */
/*
 * The background is a vertical gradient.  Several routines need to
 * "erase" pixels back to the gradient (e.g. rounded-rect corners),
 * so we centralise the interpolation here.
 */
static rgb_t fb_bg_at(int y) {
    float t = (float)y / FB_H;
    return (rgb_t){
        (uint8_t)(COL_GRADTOP.r + (COL_GRADBOT.r - COL_GRADTOP.r) * t),
        (uint8_t)(COL_GRADTOP.g + (COL_GRADBOT.g - COL_GRADTOP.g) * t),
        (uint8_t)(COL_GRADTOP.b + (COL_GRADBOT.b - COL_GRADTOP.b) * t)
    };
}

/* ── fb_clear: fill the framebuffer with the background gradient ── */
static void fb_clear(void) {
    for (int y = 0; y < FB_H; y++) {
        rgb_t c = fb_bg_at(y);
        for (int x = 0; x < FB_W; x++)
            fb[y][x] = c;
    }
}

/* ── fb_rect: filled solid-colour rectangle ─────────────────────── */
/*
 * Clips to framebuffer bounds.  Coordinates may be negative
 * (partially off-screen) without crashing.
 */
static void fb_rect(int x0, int y0, int w, int h, rgb_t c) {
    for (int y = y0; y < y0 + h && y < FB_H; y++)
        for (int x = x0; x < x0 + w && x < FB_W; x++)
            if (x >= 0 && y >= 0)
                fb[y][x] = c;
}

/* ── fb_rect_grad_v: rectangle with a vertical colour gradient ─── */
/*
 * Linearly interpolates between `top` and `bot` colours from the
 * first row to the last row of the rectangle.  Used for the header
 * and location bars where the colour subtly darkens downward.
 */
static void fb_rect_grad_v(int x0, int y0, int w, int h,
                            rgb_t top, rgb_t bot)
{
    for (int y = y0; y < y0 + h && y < FB_H; y++) {
        float t = (h > 1) ? (float)(y - y0) / (h - 1) : 0;
        rgb_t c = {
            (uint8_t)(top.r + (bot.r - top.r) * t),
            (uint8_t)(top.g + (bot.g - top.g) * t),
            (uint8_t)(top.b + (bot.b - top.b) * t)
        };
        for (int x = x0; x < x0 + w && x < FB_W; x++)
            if (x >= 0 && y >= 0)
                fb[y][x] = c;
    }
}

/* ── fb_hline: horizontal line from x0 to x1 at row y ──────────── */
static void fb_hline(int x0, int x1, int y, rgb_t c) {
    if (y < 0 || y >= FB_H) return;
    for (int x = x0; x <= x1 && x < FB_W; x++)
        if (x >= 0) fb[y][x] = c;
}

/* ── draw_rounded_rect: filled rectangle with rounded corners ──── */
/*
 * Strategy: fill the entire rectangle with the given colour, then
 * iterate over the r×r corner regions.  For each pixel, compute its
 * distance from the corner's arc centre.  If it falls outside the
 * radius, overwrite it with the background gradient colour — this
 * "punches out" the corners to simulate rounding.
 *
 * This is a visual approximation (the "erased" pixels assume the
 * background gradient is showing through), but it works perfectly
 * for our use case since rounded rects are only drawn over the
 * gradient background.
 */
static void draw_rounded_rect(int x0, int y0, int w, int h,
                               int r, rgb_t fill)
{
    fb_rect(x0, y0, w, h, fill);

    int r_sq = r * r;  /* compare squared distances — avoids sqrtf */
    for (int dy = 0; dy < r; dy++)
        for (int dx = 0; dx < r; dx++) {
            int dist_sq = (r-dx)*(r-dx) + (r-dy)*(r-dy);
            if (dist_sq <= r_sq) continue;  /* inside arc — keep */

            /* Outside the arc: restore background at all four corners. */
            int corners[4][2] = {
                { x0 + dx,             y0 + dy             },  /* top-left     */
                { x0 + w - 1 - dx,     y0 + dy             },  /* top-right    */
                { x0 + dx,             y0 + h - 1 - dy     },  /* bottom-left  */
                { x0 + w - 1 - dx,     y0 + h - 1 - dy     },  /* bottom-right */
            };
            for (int c = 0; c < 4; c++) {
                int cx = corners[c][0], cy = corners[c][1];
                if (cx >= 0 && cx < FB_W && cy >= 0 && cy < FB_H)
                    fb[cy][cx] = fb_bg_at(cy);
            }
        }
}

#endif /* FB_H_INCLUDED */
