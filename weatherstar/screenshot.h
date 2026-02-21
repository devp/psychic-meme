/*
 * screenshot.h — PNG and ANSI output from the framebuffer
 *
 * ═══════════════════════════════════════════════════════════════════
 * PNG OUTPUT
 * ═══════════════════════════════════════════════════════════════════
 *
 * write_png() converts the in-memory framebuffer into a PNG file
 * using libpng.  The process is:
 *
 *   1. Open the output file for binary writing.
 *   2. Create the libpng write structures (png_structp, png_infop).
 *   3. Set the image header: 640×400, 8-bit RGB, non-interlaced.
 *   4. Walk each row of the framebuffer, pack it into a flat
 *      [R,G,B, R,G,B, ...] byte array, and hand it to libpng.
 *   5. Finalise the PNG and close the file.
 *
 * libpng uses setjmp/longjmp for error handling — if any libpng
 * call fails, execution jumps back to the setjmp point, where we
 * clean up and return an error code.
 *
 * ═══════════════════════════════════════════════════════════════════
 * ANSI TERMINAL OUTPUT
 * ═══════════════════════════════════════════════════════════════════
 *
 * ansi_output() renders the framebuffer to a terminal that supports
 * 24-bit ("true color") ANSI escape sequences.
 *
 * The trick: Unicode character U+2580 (▀, "upper half block") fills
 * the top half of a character cell.  By setting the foreground colour
 * to the upper pixel row and the background colour to the lower pixel
 * row, each terminal character cell displays TWO vertical pixels.
 * This doubles the effective vertical resolution.
 *
 * So a 640×400 pixel image requires a 640-column × 200-row terminal.
 * That's huge — this mode is primarily useful piped to a file or
 * viewed in a very wide terminal.  The PNG output is the more
 * practical output mode.
 *
 * The escape sequences used:
 *   \033[H       — move cursor to home position (top-left)
 *   \033[2J      — clear entire screen
 *   \033[38;2;R;G;Bm — set foreground to 24-bit RGB
 *   \033[48;2;R;G;Bm — set background to 24-bit RGB
 *   \033[0m      — reset all attributes
 */

#ifndef SCREENSHOT_H
#define SCREENSHOT_H

#include "fb.h"
#include <png.h>
#include <stdio.h>
#include <stdlib.h>

/* ── write_png: save framebuffer as a PNG file ──────────────────── */
static int write_png(const char *path) {
    FILE *fp = fopen(path, "wb");
    if (!fp) { perror(path); return -1; }

    png_structp png = png_create_write_struct(
        PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);
    if (!png) { fclose(fp); return -1; }

    png_infop info = png_create_info_struct(png);
    if (!info) {
        png_destroy_write_struct(&png, NULL);
        fclose(fp);
        return -1;
    }

    /*
     * Allocate the row buffer BEFORE setjmp so it can be freed on
     * the longjmp error path.  If we allocated after setjmp, a
     * longjmp triggered between malloc and free would leak the row.
     */
    uint8_t *row = malloc(FB_W * 3);
    if (!row) {
        png_destroy_write_struct(&png, &info);
        fclose(fp);
        return -1;
    }

    /*
     * libpng error handling: if any png_* call fails, it will
     * longjmp back here.  We clean up everything and return failure.
     */
    if (setjmp(png_jmpbuf(png))) {
        free(row);
        png_destroy_write_struct(&png, &info);
        fclose(fp);
        return -1;
    }

    png_init_io(png, fp);
    png_set_IHDR(png, info, FB_W, FB_H, 8, PNG_COLOR_TYPE_RGB,
                 PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_DEFAULT,
                 PNG_FILTER_TYPE_DEFAULT);
    png_write_info(png, info);

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

/* ── ansi_output: render framebuffer to terminal with true-color ── */
/*
 * Performance note: each pixel needs ~30 bytes of escape sequences.
 * 640 pixels × 200 rows × 30 bytes ≈ 3.6 MB of output.  Instead of
 * calling printf 128,000 times (one per pixel), we write into a
 * line buffer and flush once per row.  This reduces syscall overhead
 * dramatically and makes output roughly 10× faster.
 */
static void ansi_output(void) {
    /*
     * Worst case per pixel: two SGR sequences + 3-byte UTF-8 char.
     *   "\033[38;2;RRR;GGG;BBBm\033[48;2;RRR;GGG;BBBm\xe2\x96\x80"
     * That's at most ~44 bytes.  Plus "\033[0m\n" per line.
     * Buffer: 640 × 48 + 16 = ~30 KB per line — fits easily on stack.
     */
    char line[640 * 48 + 16];

    printf("\033[H\033[2J");  /* cursor home + clear screen */

    for (int y = 0; y < FB_H; y += 2) {
        int pos = 0;
        for (int x = 0; x < FB_W; x++) {
            rgb_t top = fb[y][x];
            rgb_t bot = (y + 1 < FB_H) ? fb[y + 1][x] : top;
            /*
             * snprintf into the line buffer.  The half-block trick:
             * foreground = top pixel, background = bottom pixel.
             */
            pos += snprintf(line + pos, sizeof(line) - (size_t)pos,
                            "\033[38;2;%d;%d;%dm\033[48;2;%d;%d;%dm"
                            "\xe2\x96\x80",
                            top.r, top.g, top.b, bot.r, bot.g, bot.b);
        }
        pos += snprintf(line + pos, sizeof(line) - (size_t)pos,
                        "\033[0m\n");
        fwrite(line, 1, (size_t)pos, stdout);
    }
    printf("\033[0m");
    fflush(stdout);
}

#endif /* SCREENSHOT_H */
