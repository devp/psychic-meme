/*
 * main.c — WeatherStar 4000 console display — entry point
 *
 * ═══════════════════════════════════════════════════════════════════
 * WHAT THIS PROGRAM DOES
 * ═══════════════════════════════════════════════════════════════════
 *
 * Renders a faithful recreation of The Weather Channel's "Local on
 * the 8s" display (circa early 1990s, WeatherStar 4000 era) using
 * nothing but a C compiler and libpng.
 *
 * The architecture is simple:
 *
 *   1. compose_display()  → Paint the full scene into a 640×400
 *                           pixel framebuffer (fb.h + display.h)
 *
 *   2. ansi_output()      → Dump the framebuffer to stdout as ANSI
 *                           24-bit colour escape sequences, using
 *                           Unicode half-block characters (▀) to
 *                           pack two pixel rows per terminal line.
 *
 *   3. write_png()        → Optionally write the framebuffer as a
 *                           PNG image file (screenshot.h).
 *
 * ═══════════════════════════════════════════════════════════════════
 * FILE STRUCTURE
 * ═══════════════════════════════════════════════════════════════════
 *
 *   main.c        — this file; CLI parsing and orchestration
 *   fb.h          — framebuffer type, colour palette, drawing prims
 *   font.h        — 5×7 bitmap font data and text rendering
 *   icons.h       — weather icon shapes (sun, cloud)
 *   display.h     — full WeatherStar screen layout composition
 *   screenshot.h  — PNG file output and ANSI terminal output
 *
 * All headers use static functions and are included only by main.c,
 * so the whole program compiles as a single translation unit:
 *
 *   gcc -O2 -o weatherstar main.c -lpng -lz -lm
 *
 * This keeps the build trivially simple (no object files, no link
 * ordering issues) while still splitting the logic into readable,
 * focused modules.
 *
 * ═══════════════════════════════════════════════════════════════════
 * USAGE
 * ═══════════════════════════════════════════════════════════════════
 *
 *   ./weatherstar                           # render to terminal
 *   ./weatherstar --screenshot out.png      # terminal + PNG
 *   ./weatherstar --no-ansi --screenshot out.png  # PNG only
 *   ./weatherstar --help
 *
 * Build:  make
 *         (or: gcc -O2 -o weatherstar main.c -lpng -lz -lm)
 */

#include "display.h"
#include "screenshot.h"
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
    const char *screenshot = NULL;
    int no_ansi = 0;

    /* ── argument parsing ─────────────────────────────────────── */
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--screenshot") == 0 && i + 1 < argc)
            screenshot = argv[++i];
        else if (strcmp(argv[i], "--no-ansi") == 0)
            no_ansi = 1;
        else if (strcmp(argv[i], "--help") == 0) {
            printf("Usage: weatherstar "
                   "[--screenshot FILE.png] [--no-ansi]\n");
            return 0;
        }
    }

    /* ── render ───────────────────────────────────────────────── */
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
