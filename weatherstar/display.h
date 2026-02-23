/*
 * display.h — WeatherStar 4000 screen layout composition
 *
 * ═══════════════════════════════════════════════════════════════════
 * OVERVIEW
 * ═══════════════════════════════════════════════════════════════════
 *
 * This file contains the single function that paints every element
 * of the classic "Local on the 8s" display onto the framebuffer.
 * Think of it as the "scene graph" — calling compose_display() fills
 * the framebuffer from top to bottom with:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  ████████ gold accent bar (4px) ████████    │  y = 0..3
 *   │  THE  WEATHER  CHANNEL                      │  y = 4..39
 *   │  ════════ gold separator ════════           │  y = 40..41
 *   │  LOCAL  FORECAST                            │  y = 42..71
 *   │  ──────── rule line ────────                │  y = 73
 *   │  San Francisco, CA                          │  y = 80
 *   │  ┌──────────────────────────────────────┐   │
 *   │  │ Current Conditions                   │   │  y = 104..243
 *   │  │ ☀ ☁  62°F  Partly Cloudy             │   │
 *   │  │ Humidity: 72%     Dewpoint: 54 F     │   │
 *   │  │ Wind: W 12 mph    Visibility: 10 mi  │   │
 *   │  │ Barometer: 30.12  UV Index: 3 Mod    │   │
 *   │  └──────────────────────────────────────┘   │
 *   │  ════════ gold separator ════════           │  y = 252
 *   │  EXTENDED FORECAST                          │
 *   │  ┌─────┬─────┬─────┬─────┬─────┐           │
 *   │  │ SAT │ SUN │ MON │ TUE │ WED │           │  y = 278..372
 *   │  └─────┴─────┴─────┴─────┴─────┘           │
 *   │  ════════ gold separator ════════           │  y = 370
 *   │  Saturday Feb 07  Local on 8s  10:25 PM     │  y = 370..399
 *   └─────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════
 * COORDINATE SYSTEM
 * ═══════════════════════════════════════════════════════════════════
 *
 * All positions are in absolute pixel coordinates (origin = top-left).
 * The layout is hardcoded for a 640×400 framebuffer.  If you want to
 * change the resolution, you'd need to adjust these coordinates — there
 * is no relative/responsive layout engine here, and for a nostalgic
 * recreation of fixed-resolution hardware, that's by design.
 *
 * ═══════════════════════════════════════════════════════════════════
 * WEATHER DATA
 * ═══════════════════════════════════════════════════════════════════
 *
 * The weather data is hardcoded (San Francisco, 62°F, etc.).  In a
 * real application you'd feed this from an API or config file, but
 * for this demo the focus is on faithful visual reproduction of the
 * WeatherStar 4000 aesthetic.
 */

#ifndef DISPLAY_H
#define DISPLAY_H

#include "fb.h"
#include "font.h"
#include "icons.h"
#include <stdio.h>
#include <time.h>

static void compose_display(void) {
    /*
     * ── time and date strings ────────────────────────────────────
     * We format the current local time for the bottom status bar.
     * strftime %I gives 12-hour with leading zero, so "08:30 PM".
     * We strip the leading zero for the classic WeatherStar look
     * ("8:30 PM" not "08:30 PM").
     */
    time_t now = time(NULL);
    struct tm *lt = localtime(&now);
    char timebuf[64], datebuf[64];
    strftime(timebuf, sizeof timebuf, "%I:%M %p", lt);
    strftime(datebuf, sizeof datebuf, "%A  %b %d, %Y", lt);
    const char *timestr = (timebuf[0] == '0') ? timebuf + 1 : timebuf;

    /*
     * ── background gradient ──────────────────────────────────────
     * The signature WeatherStar look: a deep blue that gets slightly
     * darker toward the bottom of the screen.
     */
    fb_clear();

    /*
     * ── top gold accent bar ──────────────────────────────────────
     * A 4-pixel-tall gold strip across the very top of the screen.
     * This is the first visual cue that you're watching The Weather
     * Channel.  The gold colour was a TWC brand signature.
     */
    fb_rect(0, 0, FB_W, 4, COL_GOLD);

    /*
     * ── "THE WEATHER CHANNEL" header ─────────────────────────────
     * A gradient-filled banner from y=4 to y=39.  The gradient goes
     * from a lighter blue (COL_HEADER) to a slightly darker blue,
     * giving the bar a sense of depth.  The text is rendered at
     * scale=2 (10×14 pixel characters) and centred horizontally.
     *
     * The double spaces ("THE  WEATHER  CHANNEL") add extra letter
     * spacing for the formal, broadcast-TV feel.
     */
    fb_rect_grad_v(0, 4, FB_W, 36, COL_HEADER, (rgb_t){30, 55, 140});
    fb_string_centered(10, "THE  WEATHER  CHANNEL", COL_WHITE, 2);

    /*
     * ── gold separator (2px thick) ───────────────────────────────
     * Gold horizontal rules are used throughout the WeatherStar UI
     * to divide sections.  Two adjacent 1px lines give a 2px rule.
     */
    fb_hline(0, FB_W - 1, 40, COL_GOLD);
    fb_hline(0, FB_W - 1, 41, COL_GOLD);

    /*
     * ── "LOCAL FORECAST" sub-header ──────────────────────────────
     * Another gradient bar, slightly darker than the main header.
     * The cyan text distinguishes it from the white title above.
     */
    fb_rect_grad_v(0, 42, FB_W, 30, (rgb_t){30, 50, 140},
                                     (rgb_t){20, 35, 110});
    fb_string_centered(48, "LOCAL  FORECAST", COL_CYAN, 2);

    /* thin blue rule to separate the location bar from content */
    fb_hline(20, FB_W - 21, 73, COL_SEP);

    /*
     * ── location name ────────────────────────────────────────────
     * Centred, white, scale=2.  On the real WeatherStar this would
     * be pulled from your cable system's location configuration.
     */
    fb_string_centered(80, "San Francisco, CA", COL_WHITE, 2);

    /*
     * ── current conditions card ──────────────────────────────────
     * A rounded rectangle that acts as a "card" containing the main
     * weather data.  The rounded corners (radius=6) add a bit of
     * polish over a plain rectangle.
     *
     * Inside the card:
     *   - "Current Conditions" subheading in accent blue
     *   - A sun + cloud icon on the left (the "partly cloudy" icon)
     *   - Large temperature text (62°F) — scale=5 for the digits
     *   - Condition description ("Partly Cloudy") in light gray
     *   - Two columns of detail readings below
     */
    int card_y = 104;
    draw_rounded_rect(20, card_y, FB_W - 40, 140, 6, (rgb_t){15, 25, 90});

    /* top edge highlight — a 1px lighter line simulating a bevel */
    fb_hline(22, FB_W - 23, card_y + 1, COL_SEP);

    fb_string(36, card_y + 8, "Current Conditions", COL_ACCENT, 1);
    fb_hline(36, FB_W - 57, card_y + 20, (rgb_t){40, 60, 130});

    /*
     * Weather icon: a sun partially behind a cloud.
     * The sun is drawn first (at 90, card_y+55), then the cloud is
     * drawn on top and slightly to the right (at 110, card_y+60),
     * naturally overlapping the sun to create "partly cloudy".
     */
    draw_sun(90, card_y + 55, 18);
    draw_cloud(110, card_y + 60, COL_LTGRAY);

    /*
     * Large temperature display.  The "62" is rendered at scale=5
     * (25×35 pixel characters).  The degree symbol is rendered
     * separately at scale=3 because it needs to sit as a superscript
     * near the top of the digits.  The "F" is at scale=4.
     *
     * The x-position arithmetic:
     *   "62" = 2 chars × 6px × scale5 = 60px wide
     *   degree symbol starts at 180 + 60 = 240
     *   "F" starts at 240 + 12 (degree width) = 252
     */
    fb_string(180, card_y + 30, "62", COL_WHITE, 5);
    fb_degree(180 + 5 * 6 * 2, card_y + 30, COL_WHITE, 3);
    fb_string(180 + 5 * 6 * 2 + 12, card_y + 30, "F", COL_WHITE, 4);

    fb_string(180, card_y + 75, "Partly Cloudy", COL_LTGRAY, 2);

    /*
     * Detail readings in two columns.  Labels are cyan, values are
     * white.  The columns are aligned by giving labels and values
     * fixed x positions (val_x = lbl_x + 11 chars × 6px).
     */
    int lbl_x = 36, val_x = 36 + 11 * 6;
    fb_string(lbl_x, card_y + 100, "Humidity:",  COL_CYAN,  1);
    fb_string(val_x, card_y + 100, "72%",        COL_WHITE, 1);
    fb_string(lbl_x, card_y + 112, "Wind:",      COL_CYAN,  1);
    fb_string(val_x, card_y + 112, "W 12 mph",   COL_WHITE, 1);
    fb_string(lbl_x, card_y + 124, "Barometer:",  COL_CYAN,  1);
    fb_string(val_x, card_y + 124, "30.12 in",   COL_WHITE, 1);

    int rlbl_x = 320, rval_x = 320 + 12 * 6;
    fb_string(rlbl_x, card_y + 100, "Dewpoint:",   COL_CYAN,  1);
    fb_string(rval_x, card_y + 100, "54 F",        COL_WHITE, 1);
    fb_string(rlbl_x, card_y + 112, "Visibility:", COL_CYAN,  1);
    fb_string(rval_x, card_y + 112, "10 mi",       COL_WHITE, 1);
    fb_string(rlbl_x, card_y + 124, "UV Index:",   COL_CYAN,  1);
    fb_string(rval_x, card_y + 124, "3 Moderate",  COL_GREEN, 1);

    /*
     * ── forecast strip ───────────────────────────────────────────
     * Below the current conditions, a gold-bordered section shows
     * the 5-day extended forecast.  Each day gets a fixed-width
     * box containing the day name, high/low temperatures, and a
     * short condition description.
     */
    int strip_y = 252;
    fb_hline(20, FB_W - 21, strip_y,     COL_GOLD);
    fb_hline(20, FB_W - 21, strip_y + 1, COL_GOLD);
    fb_string(30, strip_y + 8, "EXTENDED FORECAST", COL_GOLD, 1);
    fb_hline(20, FB_W - 21, strip_y + 20, (rgb_t){40, 60, 130});

    /*
     * Forecast data — five days of hardcoded weather.  In a real
     * system these arrays would be populated from API data.
     */
    const char *days[]  = { "SAT",  "SUN",    "MON", "TUE",     "WED"   };
    const char *conds[] = { "Sunny","Cloudy",  "Rain","P.Cloud", "Sunny" };
    const int   his[]   = { 68,      65,        58,    61,        70     };
    const int   los[]   = { 52,      50,        48,    49,        54     };

    /*
     * Layout: 5 boxes × 110px wide with 10px gaps between them,
     * centred horizontally.  Total width = 5×110 + 4×10 = 590px.
     * Starting x = (640 − 590) / 2 = 25.
     */
    int box_w = 110, box_gap = 10;
    int box_start = (FB_W - (5 * box_w + 4 * box_gap)) / 2;

    for (int i = 0; i < 5; i++) {
        int bx = box_start + i * (box_w + box_gap);
        int by = strip_y + 26;

        /* dark blue box background */
        fb_rect(bx, by, box_w, 95, (rgb_t){15, 25, 90});
        /* top edge highlight */
        fb_hline(bx, bx + box_w - 1, by, COL_SEP);

        /* day name, centred within the box */
        int dw = fb_string_width(days[i], 2);
        fb_string(bx + (box_w - dw) / 2, by + 4, days[i], COL_WHITE, 2);

        /* high and low temperatures */
        char buf[32];
        snprintf(buf, sizeof buf, "Hi %d", his[i]);
        fb_string(bx + 8, by + 30, buf, COL_TEMPHI, 1);
        snprintf(buf, sizeof buf, "Lo %d", los[i]);
        fb_string(bx + 8, by + 44, buf, COL_TEMPLO, 1);

        /* short condition text */
        fb_string(bx + 8, by + 62, conds[i], COL_LTGRAY, 1);

        /*
         * Mini weather indicator dot — a small filled circle in the
         * lower-right of each box.  Yellow for sunny/fair days,
         * cyan for rainy days.  A real WeatherStar would show a
         * small icon here; we use a coloured dot as a compact hint.
         */
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

    /*
     * ── bottom status bar ────────────────────────────────────────
     * The very bottom of the screen shows the current date on the
     * left, "Local on the 8s" centred (the classic TWC segment name),
     * and the current time on the right in large text.
     */
    int bot_y = FB_H - 30;
    fb_rect(0, bot_y, FB_W, 30, (rgb_t){10, 15, 55});
    fb_hline(0, FB_W - 1, bot_y,     COL_GOLD);
    fb_hline(0, FB_W - 1, bot_y + 1, COL_GOLD);

    fb_string(20, bot_y + 10, datebuf, COL_LTGRAY, 1);

    int tw = fb_string_width(timestr, 2);
    fb_string(FB_W - tw - 20, bot_y + 6, timestr, COL_WHITE, 2);

    fb_string_centered(bot_y + 10, "Local on the 8s", COL_GOLD, 1);
}

#endif /* DISPLAY_H */
