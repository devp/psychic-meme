/*
 * weatherstar.c — WeatherStar 4000 style console display
 *
 * Renders a classic Weather Channel "Local on the 8s" screen using
 * ANSI/256-color escape sequences.  Produces both terminal output
 * and a PNG screenshot (via libpng).
 *
 * Build:  gcc -O2 -o weatherstar weatherstar.c -lpng -lz -lm
 * Usage:  ./weatherstar [--screenshot FILE.png]
 *
 * No GUI, no heavy runtimes.  ~600 lines of portable C.
 */

#include <math.h>
#include <png.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* ── framebuffer ────────────────────────────────────────────────── */

#define FB_W 640
#define FB_H 400
#define CELL_W 8
#define CELL_H 16
#define COLS (FB_W / CELL_W)   /* 80 */
#define ROWS (FB_H / CELL_H)  /* 25 */

typedef struct { uint8_t r, g, b; } rgb_t;

static rgb_t fb[FB_H][FB_W]; /* pixel framebuffer for PNG */

/* ── colour palette (WeatherStar blue theme) ────────────────────── */

static const rgb_t COL_HEADER   = {  40,  70, 170 };  /* header bar blue       */
static const rgb_t COL_ACCENT   = {  60, 120, 210 };  /* accent / highlight    */
static const rgb_t COL_GOLD     = { 255, 200,  50 };  /* gold bar              */
static const rgb_t COL_WHITE    = { 255, 255, 255 };
static const rgb_t COL_LTGRAY   = { 180, 190, 210 };
static const rgb_t COL_YELLOW   = { 255, 255, 100 };
static const rgb_t COL_CYAN     = { 100, 220, 255 };
static const rgb_t COL_GREEN    = {  80, 220, 120 };
static const rgb_t COL_ORANGE   = { 255, 160,  50 };
static const rgb_t COL_GRADTOP  = {  20,  40, 120 };
static const rgb_t COL_GRADBOT  = {   5,  15,  60 };
static const rgb_t COL_SEP      = {  50,  80, 160 };
static const rgb_t COL_TEMPHI   = { 255, 100,  80 };
static const rgb_t COL_TEMPLO   = { 100, 180, 255 };

/* ── basic framebuffer drawing ──────────────────────────────────── */

static void fb_clear(void) {
    for (int y = 0; y < FB_H; y++)
        for (int x = 0; x < FB_W; x++) {
            float t = (float)y / FB_H;
            fb[y][x].r = COL_GRADTOP.r + (int)((COL_GRADBOT.r - COL_GRADTOP.r) * t);
            fb[y][x].g = COL_GRADTOP.g + (int)((COL_GRADBOT.g - COL_GRADTOP.g) * t);
            fb[y][x].b = COL_GRADTOP.b + (int)((COL_GRADBOT.b - COL_GRADTOP.b) * t);
        }
}

static void fb_rect(int x0, int y0, int w, int h, rgb_t c) {
    for (int y = y0; y < y0 + h && y < FB_H; y++)
        for (int x = x0; x < x0 + w && x < FB_W; x++)
            if (x >= 0 && y >= 0)
                fb[y][x] = c;
}

static void fb_rect_grad_v(int x0, int y0, int w, int h, rgb_t top, rgb_t bot) {
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

static void fb_hline(int x0, int x1, int y, rgb_t c) {
    if (y < 0 || y >= FB_H) return;
    for (int x = x0; x <= x1 && x < FB_W; x++)
        if (x >= 0) fb[y][x] = c;
}

/* ── 5x7 bitmap font ───────────────────────────────────────────── */

/* Minimal built-in font covering ASCII 32..126 */
static const uint8_t font5x7[][7] = {
    /* 32 ' ' */ {0x00,0x00,0x00,0x00,0x00,0x00,0x00},
    /* 33 '!' */ {0x04,0x04,0x04,0x04,0x04,0x00,0x04},
    /* 34 '"' */ {0x0A,0x0A,0x00,0x00,0x00,0x00,0x00},
    /* 35 '#' */ {0x0A,0x1F,0x0A,0x0A,0x1F,0x0A,0x00},
    /* 36 '$' */ {0x04,0x0F,0x14,0x0E,0x05,0x1E,0x04},
    /* 37 '%' */ {0x18,0x19,0x02,0x04,0x08,0x13,0x03},
    /* 38 '&' */ {0x08,0x14,0x14,0x08,0x15,0x12,0x0D},
    /* 39 ''' */ {0x04,0x04,0x00,0x00,0x00,0x00,0x00},
    /* 40 '(' */ {0x02,0x04,0x08,0x08,0x08,0x04,0x02},
    /* 41 ')' */ {0x08,0x04,0x02,0x02,0x02,0x04,0x08},
    /* 42 '*' */ {0x00,0x04,0x15,0x0E,0x15,0x04,0x00},
    /* 43 '+' */ {0x00,0x04,0x04,0x1F,0x04,0x04,0x00},
    /* 44 ',' */ {0x00,0x00,0x00,0x00,0x00,0x04,0x08},
    /* 45 '-' */ {0x00,0x00,0x00,0x1F,0x00,0x00,0x00},
    /* 46 '.' */ {0x00,0x00,0x00,0x00,0x00,0x00,0x04},
    /* 47 '/' */ {0x01,0x01,0x02,0x04,0x08,0x10,0x10},
    /* 48 '0' */ {0x0E,0x11,0x13,0x15,0x19,0x11,0x0E},
    /* 49 '1' */ {0x04,0x0C,0x04,0x04,0x04,0x04,0x0E},
    /* 50 '2' */ {0x0E,0x11,0x01,0x06,0x08,0x10,0x1F},
    /* 51 '3' */ {0x0E,0x11,0x01,0x06,0x01,0x11,0x0E},
    /* 52 '4' */ {0x02,0x06,0x0A,0x12,0x1F,0x02,0x02},
    /* 53 '5' */ {0x1F,0x10,0x1E,0x01,0x01,0x11,0x0E},
    /* 54 '6' */ {0x06,0x08,0x10,0x1E,0x11,0x11,0x0E},
    /* 55 '7' */ {0x1F,0x01,0x02,0x04,0x08,0x08,0x08},
    /* 56 '8' */ {0x0E,0x11,0x11,0x0E,0x11,0x11,0x0E},
    /* 57 '9' */ {0x0E,0x11,0x11,0x0F,0x01,0x02,0x0C},
    /* 58 ':' */ {0x00,0x00,0x04,0x00,0x00,0x04,0x00},
    /* 59 ';' */ {0x00,0x00,0x04,0x00,0x00,0x04,0x08},
    /* 60 '<' */ {0x02,0x04,0x08,0x10,0x08,0x04,0x02},
    /* 61 '=' */ {0x00,0x00,0x1F,0x00,0x1F,0x00,0x00},
    /* 62 '>' */ {0x08,0x04,0x02,0x01,0x02,0x04,0x08},
    /* 63 '?' */ {0x0E,0x11,0x01,0x02,0x04,0x00,0x04},
    /* 64 '@' */ {0x0E,0x11,0x17,0x15,0x17,0x10,0x0E},
    /* 65 'A' */ {0x0E,0x11,0x11,0x1F,0x11,0x11,0x11},
    /* 66 'B' */ {0x1E,0x11,0x11,0x1E,0x11,0x11,0x1E},
    /* 67 'C' */ {0x0E,0x11,0x10,0x10,0x10,0x11,0x0E},
    /* 68 'D' */ {0x1E,0x11,0x11,0x11,0x11,0x11,0x1E},
    /* 69 'E' */ {0x1F,0x10,0x10,0x1E,0x10,0x10,0x1F},
    /* 70 'F' */ {0x1F,0x10,0x10,0x1E,0x10,0x10,0x10},
    /* 71 'G' */ {0x0E,0x11,0x10,0x17,0x11,0x11,0x0F},
    /* 72 'H' */ {0x11,0x11,0x11,0x1F,0x11,0x11,0x11},
    /* 73 'I' */ {0x0E,0x04,0x04,0x04,0x04,0x04,0x0E},
    /* 74 'J' */ {0x07,0x02,0x02,0x02,0x02,0x12,0x0C},
    /* 75 'K' */ {0x11,0x12,0x14,0x18,0x14,0x12,0x11},
    /* 76 'L' */ {0x10,0x10,0x10,0x10,0x10,0x10,0x1F},
    /* 77 'M' */ {0x11,0x1B,0x15,0x15,0x11,0x11,0x11},
    /* 78 'N' */ {0x11,0x19,0x15,0x13,0x11,0x11,0x11},
    /* 79 'O' */ {0x0E,0x11,0x11,0x11,0x11,0x11,0x0E},
    /* 80 'P' */ {0x1E,0x11,0x11,0x1E,0x10,0x10,0x10},
    /* 81 'Q' */ {0x0E,0x11,0x11,0x11,0x15,0x12,0x0D},
    /* 82 'R' */ {0x1E,0x11,0x11,0x1E,0x14,0x12,0x11},
    /* 83 'S' */ {0x0E,0x11,0x10,0x0E,0x01,0x11,0x0E},
    /* 84 'T' */ {0x1F,0x04,0x04,0x04,0x04,0x04,0x04},
    /* 85 'U' */ {0x11,0x11,0x11,0x11,0x11,0x11,0x0E},
    /* 86 'V' */ {0x11,0x11,0x11,0x11,0x0A,0x0A,0x04},
    /* 87 'W' */ {0x11,0x11,0x11,0x15,0x15,0x1B,0x11},
    /* 88 'X' */ {0x11,0x11,0x0A,0x04,0x0A,0x11,0x11},
    /* 89 'Y' */ {0x11,0x11,0x0A,0x04,0x04,0x04,0x04},
    /* 90 'Z' */ {0x1F,0x01,0x02,0x04,0x08,0x10,0x1F},
    /* 91 '[' */ {0x0E,0x08,0x08,0x08,0x08,0x08,0x0E},
    /* 92 '\' */ {0x10,0x10,0x08,0x04,0x02,0x01,0x01},
    /* 93 ']' */ {0x0E,0x02,0x02,0x02,0x02,0x02,0x0E},
    /* 94 '^' */ {0x04,0x0A,0x11,0x00,0x00,0x00,0x00},
    /* 95 '_' */ {0x00,0x00,0x00,0x00,0x00,0x00,0x1F},
    /* 96 '`' */ {0x08,0x04,0x00,0x00,0x00,0x00,0x00},
    /* 97 'a' */ {0x00,0x00,0x0E,0x01,0x0F,0x11,0x0F},
    /* 98 'b' */ {0x10,0x10,0x1E,0x11,0x11,0x11,0x1E},
    /* 99 'c' */ {0x00,0x00,0x0E,0x11,0x10,0x11,0x0E},
    /*100 'd' */ {0x01,0x01,0x0F,0x11,0x11,0x11,0x0F},
    /*101 'e' */ {0x00,0x00,0x0E,0x11,0x1F,0x10,0x0E},
    /*102 'f' */ {0x06,0x08,0x1E,0x08,0x08,0x08,0x08},
    /*103 'g' */ {0x00,0x00,0x0F,0x11,0x0F,0x01,0x0E},
    /*104 'h' */ {0x10,0x10,0x1E,0x11,0x11,0x11,0x11},
    /*105 'i' */ {0x04,0x00,0x0C,0x04,0x04,0x04,0x0E},
    /*106 'j' */ {0x02,0x00,0x06,0x02,0x02,0x12,0x0C},
    /*107 'k' */ {0x10,0x10,0x12,0x14,0x18,0x14,0x12},
    /*108 'l' */ {0x0C,0x04,0x04,0x04,0x04,0x04,0x0E},
    /*109 'm' */ {0x00,0x00,0x1A,0x15,0x15,0x15,0x15},
    /*110 'n' */ {0x00,0x00,0x1E,0x11,0x11,0x11,0x11},
    /*111 'o' */ {0x00,0x00,0x0E,0x11,0x11,0x11,0x0E},
    /*112 'p' */ {0x00,0x00,0x1E,0x11,0x1E,0x10,0x10},
    /*113 'q' */ {0x00,0x00,0x0F,0x11,0x0F,0x01,0x01},
    /*114 'r' */ {0x00,0x00,0x16,0x19,0x10,0x10,0x10},
    /*115 's' */ {0x00,0x00,0x0F,0x10,0x0E,0x01,0x1E},
    /*116 't' */ {0x08,0x08,0x1E,0x08,0x08,0x09,0x06},
    /*117 'u' */ {0x00,0x00,0x11,0x11,0x11,0x11,0x0F},
    /*118 'v' */ {0x00,0x00,0x11,0x11,0x0A,0x0A,0x04},
    /*119 'w' */ {0x00,0x00,0x11,0x11,0x15,0x15,0x0A},
    /*120 'x' */ {0x00,0x00,0x11,0x0A,0x04,0x0A,0x11},
    /*121 'y' */ {0x00,0x00,0x11,0x11,0x0F,0x01,0x0E},
    /*122 'z' */ {0x00,0x00,0x1F,0x02,0x04,0x08,0x1F},
    /*123 '{' */ {0x02,0x04,0x04,0x08,0x04,0x04,0x02},
    /*124 '|' */ {0x04,0x04,0x04,0x04,0x04,0x04,0x04},
    /*125 '}' */ {0x08,0x04,0x04,0x02,0x04,0x04,0x08},
    /*126 '~' */ {0x00,0x00,0x08,0x15,0x02,0x00,0x00},
};

static void fb_char(int px, int py, char ch, rgb_t fg, int scale) {
    int idx = ch - 32;
    if (idx < 0 || idx > 94) idx = 0;
    for (int row = 0; row < 7; row++)
        for (int col = 0; col < 5; col++)
            if (font5x7[idx][row] & (0x10 >> col))
                for (int sy = 0; sy < scale; sy++)
                    for (int sx = 0; sx < scale; sx++) {
                        int fx = px + col * scale + sx;
                        int fy = py + row * scale + sy;
                        if (fx >= 0 && fx < FB_W && fy >= 0 && fy < FB_H)
                            fb[fy][fx] = fg;
                    }
}

static void fb_string(int px, int py, const char *s, rgb_t fg, int scale) {
    int spacing = 6 * scale;
    for (; *s; s++, px += spacing)
        fb_char(px, py, *s, fg, scale);
}

static int fb_string_width(const char *s, int scale) {
    return (int)strlen(s) * 6 * scale;
}

static void fb_string_centered(int y, const char *s, rgb_t fg, int scale) {
    int w = fb_string_width(s, scale);
    fb_string((FB_W - w) / 2, y, s, fg, scale);
}

/* ── degree symbol (small circle) ───────────────────────────────── */

static void fb_degree(int px, int py, rgb_t fg, int scale) {
    /* 3x3 circle */
    static const uint8_t deg[3] = {0x02, 0x05, 0x02};
    for (int row = 0; row < 3; row++)
        for (int col = 0; col < 3; col++)
            if (deg[row] & (0x04 >> col))
                for (int sy = 0; sy < scale; sy++)
                    for (int sx = 0; sx < scale; sx++) {
                        int fx = px + col * scale + sx;
                        int fy = py + row * scale + sy;
                        if (fx >= 0 && fx < FB_W && fy >= 0 && fy < FB_H)
                            fb[fy][fx] = fg;
                    }
}

/* ── decorative elements ────────────────────────────────────────── */

static void draw_rounded_rect(int x0, int y0, int w, int h, int r, rgb_t fill) {
    /* simplified: fill rect then round corners by clearing pixels */
    fb_rect(x0, y0, w, h, fill);
    /* knock out corners */
    for (int dy = 0; dy < r; dy++)
        for (int dx = 0; dx < r; dx++) {
            float dist = sqrtf((float)((r - dx) * (r - dx) + (r - dy) * (r - dy)));
            if (dist > r) {
                /* clear four corners */
                int cx, cy;
                /* top-left */
                cx = x0 + dx; cy = y0 + dy;
                if (cx >= 0 && cx < FB_W && cy >= 0 && cy < FB_H) {
                    float t2 = (float)cy / FB_H;
                    fb[cy][cx].r = COL_GRADTOP.r + (int)((COL_GRADBOT.r - COL_GRADTOP.r) * t2);
                    fb[cy][cx].g = COL_GRADTOP.g + (int)((COL_GRADBOT.g - COL_GRADTOP.g) * t2);
                    fb[cy][cx].b = COL_GRADTOP.b + (int)((COL_GRADBOT.b - COL_GRADTOP.b) * t2);
                }
                /* top-right */
                cx = x0 + w - 1 - dx; cy = y0 + dy;
                if (cx >= 0 && cx < FB_W && cy >= 0 && cy < FB_H) {
                    float t2 = (float)cy / FB_H;
                    fb[cy][cx].r = COL_GRADTOP.r + (int)((COL_GRADBOT.r - COL_GRADTOP.r) * t2);
                    fb[cy][cx].g = COL_GRADTOP.g + (int)((COL_GRADBOT.g - COL_GRADTOP.g) * t2);
                    fb[cy][cx].b = COL_GRADTOP.b + (int)((COL_GRADBOT.b - COL_GRADTOP.b) * t2);
                }
                /* bottom-left */
                cx = x0 + dx; cy = y0 + h - 1 - dy;
                if (cx >= 0 && cx < FB_W && cy >= 0 && cy < FB_H) {
                    float t2 = (float)cy / FB_H;
                    fb[cy][cx].r = COL_GRADTOP.r + (int)((COL_GRADBOT.r - COL_GRADTOP.r) * t2);
                    fb[cy][cx].g = COL_GRADTOP.g + (int)((COL_GRADBOT.g - COL_GRADTOP.g) * t2);
                    fb[cy][cx].b = COL_GRADTOP.b + (int)((COL_GRADBOT.b - COL_GRADTOP.b) * t2);
                }
                /* bottom-right */
                cx = x0 + w - 1 - dx; cy = y0 + h - 1 - dy;
                if (cx >= 0 && cx < FB_W && cy >= 0 && cy < FB_H) {
                    float t2 = (float)cy / FB_H;
                    fb[cy][cx].r = COL_GRADTOP.r + (int)((COL_GRADBOT.r - COL_GRADTOP.r) * t2);
                    fb[cy][cx].g = COL_GRADTOP.g + (int)((COL_GRADBOT.g - COL_GRADTOP.g) * t2);
                    fb[cy][cx].b = COL_GRADTOP.b + (int)((COL_GRADBOT.b - COL_GRADTOP.b) * t2);
                }
            }
        }
}

/* ── weather icon drawing ───────────────────────────────────────── */

static void draw_sun(int cx, int cy, int r) {
    rgb_t yellow = COL_YELLOW;
    rgb_t orange = COL_ORANGE;
    /* filled circle */
    for (int dy = -r; dy <= r; dy++)
        for (int dx = -r; dx <= r; dx++)
            if (dx * dx + dy * dy <= r * r) {
                int px = cx + dx, py = cy + dy;
                if (px >= 0 && px < FB_W && py >= 0 && py < FB_H)
                    fb[py][px] = yellow;
            }
    /* rays */
    for (int i = 0; i < 8; i++) {
        float angle = i * 3.14159f / 4.0f;
        for (int d = r + 3; d < r + 10; d++) {
            int px = cx + (int)(cosf(angle) * d);
            int py = cy + (int)(sinf(angle) * d);
            if (px >= 0 && px < FB_W && py >= 0 && py < FB_H)
                fb[py][px] = orange;
            /* make rays thicker */
            if (px + 1 < FB_W) fb[py][px + 1] = orange;
        }
    }
}

static void draw_cloud(int cx, int cy, rgb_t col) {
    /* three overlapping circles */
    int offsets[][3] = {{0, 0, 12}, {-10, 4, 10}, {10, 4, 10}};
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

/* ── ANSI terminal output ──────────────────────────────────────── */

static void ansi_output(void) {
    /* Map framebuffer to terminal using half-block characters (▀) */
    /* Each cell uses the top half-block with fg=top pixel, bg=bottom pixel */
    printf("\033[H\033[2J"); /* clear screen */
    for (int y = 0; y < FB_H; y += 2) {
        for (int x = 0; x < FB_W; x++) {
            rgb_t top = fb[y][x];
            rgb_t bot = (y + 1 < FB_H) ? fb[y + 1][x] : top;
            printf("\033[38;2;%d;%d;%dm\033[48;2;%d;%d;%dm\xe2\x96\x80",
                   top.r, top.g, top.b, bot.r, bot.g, bot.b);
        }
        printf("\033[0m\n");
    }
    printf("\033[0m");
    fflush(stdout);
}

/* ── PNG screenshot ─────────────────────────────────────────────── */

static int write_png(const char *path) {
    FILE *fp = fopen(path, "wb");
    if (!fp) { perror(path); return -1; }

    png_structp png = png_create_write_struct(PNG_LIBPNG_VER_STRING,
                                              NULL, NULL, NULL);
    png_infop info = png_create_info_struct(png);
    if (setjmp(png_jmpbuf(png))) {
        fclose(fp);
        return -1;
    }
    png_init_io(png, fp);
    png_set_IHDR(png, info, FB_W, FB_H, 8, PNG_COLOR_TYPE_RGB,
                 PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_DEFAULT,
                 PNG_FILTER_TYPE_DEFAULT);
    png_write_info(png, info);

    uint8_t *row = malloc(FB_W * 3);
    for (int y = 0; y < FB_H; y++) {
        for (int x = 0; x < FB_W; x++) {
            row[x * 3 + 0] = fb[y][x].r;
            row[x * 3 + 1] = fb[y][x].g;
            row[x * 3 + 2] = fb[y][x].b;
        }
        png_write_row(png, row);
    }
    free(row);
    png_write_end(png, NULL);
    png_destroy_write_struct(&png, &info);
    fclose(fp);
    return 0;
}

/* ── compose the full WeatherStar display ───────────────────────── */

static void compose_display(void) {
    time_t now = time(NULL);
    struct tm *lt = localtime(&now);
    char timebuf[64], datebuf[64];
    strftime(timebuf, sizeof timebuf, "%I:%M %p", lt);
    strftime(datebuf, sizeof datebuf, "%A  %b %d, %Y", lt);
    /* strip leading zero from hour */
    const char *timestr = (timebuf[0] == '0') ? timebuf + 1 : timebuf;

    fb_clear();

    /* ── top gold accent bar ──────────────────────────────────── */
    fb_rect(0, 0, FB_W, 4, COL_GOLD);

    /* ── header: "THE WEATHER CHANNEL" ────────────────────────── */
    fb_rect_grad_v(0, 4, FB_W, 36, COL_HEADER,
                   (rgb_t){30, 55, 140});
    fb_string_centered(10, "THE  WEATHER  CHANNEL", COL_WHITE, 2);

    /* ── thin separator ───────────────────────────────────────── */
    fb_hline(0, FB_W - 1, 40, COL_GOLD);
    fb_hline(0, FB_W - 1, 41, COL_GOLD);

    /* ── location bar ─────────────────────────────────────────── */
    fb_rect_grad_v(0, 42, FB_W, 30, (rgb_t){30, 50, 140},
                   (rgb_t){20, 35, 110});
    fb_string_centered(48, "LOCAL  FORECAST", COL_CYAN, 2);

    fb_hline(20, FB_W - 21, 73, COL_SEP);

    /* ── location name ────────────────────────────────────────── */
    fb_string_centered(80, "San Francisco, CA", COL_WHITE, 2);

    /* ── current conditions card ──────────────────────────────── */
    int card_y = 104;
    draw_rounded_rect(20, card_y, FB_W - 40, 140, 6,
                      (rgb_t){15, 25, 90});
    /* inner border glow */
    fb_hline(22, FB_W - 23, card_y + 1, COL_SEP);

    /* "Current Conditions" label */
    fb_string(36, card_y + 8, "Current Conditions", COL_ACCENT, 1);

    fb_hline(36, FB_W - 57, card_y + 20, (rgb_t){40, 60, 130});

    /* weather icon area - partly cloudy */
    draw_sun(90, card_y + 55, 18);
    draw_cloud(110, card_y + 60, COL_LTGRAY);

    /* big temperature */
    fb_string(180, card_y + 30, "62", COL_WHITE, 5);
    fb_degree(180 + 5 * 6 * 2, card_y + 30, COL_WHITE, 3);
    fb_string(180 + 5 * 6 * 2 + 12, card_y + 30, "F", COL_WHITE, 4);

    /* condition text */
    fb_string(180, card_y + 75, "Partly Cloudy", COL_LTGRAY, 2);

    /* details — left column */
    int lbl_x = 36, val_x = 36 + 11 * 6;  /* fixed value column */
    fb_string(lbl_x, card_y + 100, "Humidity:", COL_CYAN, 1);
    fb_string(val_x, card_y + 100, "72%", COL_WHITE, 1);

    fb_string(lbl_x, card_y + 112, "Wind:", COL_CYAN, 1);
    fb_string(val_x, card_y + 112, "W 12 mph", COL_WHITE, 1);

    fb_string(lbl_x, card_y + 124, "Barometer:", COL_CYAN, 1);
    fb_string(val_x, card_y + 124, "30.12 in", COL_WHITE, 1);

    /* details — right column */
    int rlbl_x = 320, rval_x = 320 + 12 * 6;
    fb_string(rlbl_x, card_y + 100, "Dewpoint:", COL_CYAN, 1);
    fb_string(rval_x, card_y + 100, "54 F", COL_WHITE, 1);

    fb_string(rlbl_x, card_y + 112, "Visibility:", COL_CYAN, 1);
    fb_string(rval_x, card_y + 112, "10 mi", COL_WHITE, 1);

    fb_string(rlbl_x, card_y + 124, "UV Index:", COL_CYAN, 1);
    fb_string(rval_x, card_y + 124, "3 Moderate", COL_GREEN, 1);

    /* ── forecast strip ───────────────────────────────────────── */
    int strip_y = 252;
    fb_hline(20, FB_W - 21, strip_y, COL_GOLD);
    fb_hline(20, FB_W - 21, strip_y + 1, COL_GOLD);

    fb_string(30, strip_y + 8, "EXTENDED FORECAST", COL_GOLD, 1);

    fb_hline(20, FB_W - 21, strip_y + 20, (rgb_t){40, 60, 130});

    /* 5-day forecast boxes */
    const char *days[]   = {"SAT", "SUN", "MON", "TUE", "WED"};
    const char *conds[]  = {"Sunny","Cloudy","Rain","P.Cloud","Sunny"};
    const int   his[]    = { 68, 65, 58, 61, 70 };
    const int   los[]    = { 52, 50, 48, 49, 54 };

    int box_w = 110, box_gap = 10;
    int box_start = (FB_W - (5 * box_w + 4 * box_gap)) / 2;

    for (int i = 0; i < 5; i++) {
        int bx = box_start + i * (box_w + box_gap);
        int by = strip_y + 26;

        /* box background */
        fb_rect(bx, by, box_w, 95, (rgb_t){15, 25, 90});
        fb_hline(bx, bx + box_w - 1, by, COL_SEP);

        /* day label */
        int dw = fb_string_width(days[i], 2);
        fb_string(bx + (box_w - dw) / 2, by + 4, days[i], COL_WHITE, 2);

        /* hi / lo */
        char hilo[32];
        snprintf(hilo, sizeof hilo, "Hi %d", his[i]);
        fb_string(bx + 8, by + 30, hilo, COL_TEMPHI, 1);
        snprintf(hilo, sizeof hilo, "Lo %d", los[i]);
        fb_string(bx + 8, by + 44, hilo, COL_TEMPLO, 1);

        /* condition text */
        fb_string(bx + 8, by + 62, conds[i], COL_LTGRAY, 1);

        /* mini icon hint - small colored dot */
        rgb_t dot = (i == 2) ? COL_CYAN : COL_YELLOW;
        for (int dy = -3; dy <= 3; dy++)
            for (int dx = -3; dx <= 3; dx++)
                if (dx * dx + dy * dy <= 9) {
                    int px = bx + box_w - 18 + dx;
                    int py = by + 72 + dy;
                    if (px >= 0 && px < FB_W && py >= 0 && py < FB_H)
                        fb[py][px] = dot;
                }
    }

    /* ── bottom bar with time ─────────────────────────────────── */
    int bot_y = FB_H - 30;
    fb_rect(0, bot_y, FB_W, 30, (rgb_t){10, 15, 55});
    fb_hline(0, FB_W - 1, bot_y, COL_GOLD);
    fb_hline(0, FB_W - 1, bot_y + 1, COL_GOLD);

    fb_string(20, bot_y + 10, datebuf, COL_LTGRAY, 1);

    int tw = fb_string_width(timestr, 2);
    fb_string(FB_W - tw - 20, bot_y + 6, timestr, COL_WHITE, 2);

    fb_string_centered(bot_y + 10, "Local on the 8s", COL_GOLD, 1);
}

/* ── main ───────────────────────────────────────────────────────── */

int main(int argc, char **argv) {
    const char *screenshot = NULL;
    int no_ansi = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--screenshot") == 0 && i + 1 < argc)
            screenshot = argv[++i];
        else if (strcmp(argv[i], "--no-ansi") == 0)
            no_ansi = 1;
        else if (strcmp(argv[i], "--help") == 0) {
            printf("Usage: weatherstar [--screenshot FILE.png] [--no-ansi]\n");
            return 0;
        }
    }

    compose_display();

    if (!no_ansi)
        ansi_output();

    if (screenshot) {
        if (write_png(screenshot) == 0)
            fprintf(stderr, "Screenshot saved to %s\n", screenshot);
        else
            return 1;
    }

    return 0;
}
