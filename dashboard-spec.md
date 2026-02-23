# Pi Dashboard — Project Spec

## Goal

An always-on Raspberry Pi Zero W plugged into a TV, driving a rotating
family dashboard at the calm, steady cadence of The Weather Channel's
"Local on the 8s."  Weather is the first slide; more will follow over time.

## Hardware Target

- **Raspberry Pi Zero W** (single-core ARM1176 @ 1GHz, 512 MB RAM)
- HDMI output to a TV
- Running **Raspberry Pi OS Lite 32-bit** (Bookworm) — no desktop environment
- Co-located with **Pi-hole** (~60-80 MB RAM, negligible CPU)
- Always on, boots unattended

## Architecture

### Display: Pillow → `/dev/fb0` via mmap

No window manager, no browser, no X11.  Render each slide as a
`PIL.Image`, then blit it directly to the Linux framebuffer.

```
┌─────────────────────────────────────────────────┐
│                   main loop                      │
│                                                  │
│   for each slide in rotation:                    │
│       data   = slide.fetch()     # network I/O   │
│       image  = slide.render(w, h, theme)         │
│       fb.write(image)            # mmap blit     │
│       sleep(interval)                            │
└─────────────────────────────────────────────────┘
```

Each frame: ~200-500 ms Pillow render + ~50 ms framebuffer write.
Refresh interval: 10-30 seconds.  CPU is idle >95% of the time.

### Dual output (optional, for development)

- **Framebuffer** (`/dev/fb0`): primary output to the TV
- **Curses** (terminal): secondary output for SSH debugging —
  renders the same data as coloured text, adapts to terminal size

The curses path is not required for v1 but the data/render separation
makes it easy to add later.

### File structure

```
dashboard/
├── main.py              # entry point: slide loop, timing, signal handling
├── framebuffer.py       # open /dev/fb0, mmap, query size, blit PIL.Image
├── render.py            # shared drawing helpers (header bar, separator,
│                        # centered text, detail columns, etc.)
├── theme.py             # colour palettes (WeatherStar blue/gold is the
│                        # first; more can be added later)
├── config.py            # settings: API keys, slide order, intervals,
│                        # location, units (F/C), theme selection
├── slides/
│   ├── __init__.py
│   ├── base.py          # Slide base class / protocol
│   ├── weather.py       # current conditions + forecast (first slide)
│   └── clock.py         # large clock display (simple second slide)
└── fonts/               # TTF fonts bundled for consistent rendering
    └── (a small open-licensed font, e.g. DejaVu Sans Mono or Inter)
```

## Slide contract

Each slide is a module that implements:

```python
def fetch(config) -> dict:
    """Fetch data from network/system.  Called before render.
    May be skipped if cached data is fresh enough."""

def render(data: dict, width: int, height: int, theme: Theme) -> PIL.Image:
    """Return a PIL.Image sized to the framebuffer dimensions.
    Must not do network I/O — all data comes from fetch()."""
```

Separating fetch from render means:
- Network errors don't block display (show stale data with a staleness indicator)
- Slides are testable without a framebuffer (render returns an Image you can .save())
- New slides are added by creating a new file in `slides/` and adding it to config

## Framebuffer interface (`framebuffer.py`)

```python
class Framebuffer:
    def __init__(self, device="/dev/fb0"):
        # open device, ioctl FBIOGET_VSCREENINFO for width/height/bpp
        # mmap the device for direct pixel writes

    @property
    def size(self) -> tuple[int, int]:
        """(width, height) in pixels, queried from hardware."""

    def write(self, image: PIL.Image):
        """Blit a PIL.Image to the screen.
        Handles RGB→BGR conversion (Pi framebuffer is BGR).
        Resizes image if it doesn't match framebuffer dimensions."""

    def close(self):
        """Unmap and close."""
```

### Pi-specific notes

- Pixel format is typically XRGB8888 (32-bit) or RGB565 (16-bit) —
  detect via `ioctl`, don't hardcode
- Pi framebuffer byte order is **BGR**, not RGB —
  use `image.tobytes("raw", "BGRA")` for 32-bit
- Set `hdmi_force_hotplug=1` in `/boot/firmware/config.txt`
  so `/dev/fb0` exists even if the TV is off at boot
- User must be in the `video` group (default `pi` user already is)

## Theme system (`theme.py`)

```python
@dataclass
class Theme:
    bg_top:      tuple[int, int, int]   # background gradient top
    bg_bottom:   tuple[int, int, int]   # background gradient bottom
    header_bg:   tuple[int, int, int]
    accent:      tuple[int, int, int]   # gold bars, separators
    text:        tuple[int, int, int]   # primary text (white)
    text_dim:    tuple[int, int, int]   # secondary text (light gray)
    info_label:  tuple[int, int, int]   # cyan labels
    temp_hi:     tuple[int, int, int]
    temp_lo:     tuple[int, int, int]

WEATHERSTAR = Theme(
    bg_top=(20, 40, 120), bg_bottom=(5, 15, 60),
    header_bg=(40, 70, 170), accent=(255, 200, 50),
    text=(255, 255, 255), text_dim=(180, 190, 210),
    info_label=(100, 220, 255),
    temp_hi=(255, 100, 80), temp_lo=(100, 180, 255),
)
```

## Weather slide (`slides/weather.py`)

### Data source

Any free weather API that serves JSON.  Candidates:
- **Open-Meteo** (free, no API key, has hourly + daily forecasts)
- **OpenWeatherMap** (free tier, requires API key)
- **National Weather Service API** (free, US only, no key)

`fetch()` returns a dict:

```python
{
    "location": "San Francisco, CA",
    "temp": 62,
    "condition": "Partly Cloudy",
    "humidity": 72,
    "wind": "W 12 mph",
    "barometer": "30.12 in",
    "dewpoint": 54,
    "visibility": "10 mi",
    "uv_index": "3 Moderate",
    "forecast": [
        {"day": "SAT", "hi": 68, "lo": 52, "condition": "Sunny"},
        {"day": "SUN", "hi": 65, "lo": 50, "condition": "Cloudy"},
        ...
    ],
    "fetched_at": "2026-02-23T14:30:00",
}
```

### Layout

Adapts to framebuffer resolution.  The WeatherStar layout from the
C prototype is the reference design:

```
┌─────────────────────────────────────────────┐
│  ▬▬▬▬▬▬▬▬ gold accent bar ▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │
│          FAMILY  DASHBOARD                   │
│  ═══════════════════════════════════════════  │
│          LOCAL  FORECAST                     │
│  ─────────────────────────────────────────── │
│          San Francisco, CA                   │
│  ┌───────────────────────────────────────┐   │
│  │ Current Conditions                    │   │
│  │  ☀☁  62°F   Partly Cloudy            │   │
│  │ Humidity: 72%      Dewpoint: 54°F     │   │
│  │ Wind: W 12 mph     Visibility: 10 mi  │   │
│  └───────────────────────────────────────┘   │
│  ═══════════════════════════════════════════  │
│  ┌─────┬─────┬─────┬─────┬─────┐            │
│  │ SAT │ SUN │ MON │ TUE │ WED │            │
│  │Hi 68│Hi 65│Hi 58│Hi 61│Hi 70│            │
│  │Lo 52│Lo 50│Lo 48│Lo 49│Lo 54│            │
│  └─────┴─────┴─────┴─────┴─────┘            │
│  Saturday  Feb 21, 2026    10:25 PM          │
└─────────────────────────────────────────────┘
```

## Main loop (`main.py`)

```
1. open framebuffer
2. load config (slide list, intervals, API keys, theme)
3. loop forever:
     for slide_module in config.slides:
         data = slide_module.fetch(config)    # with cache / error handling
         image = slide_module.render(data, fb.width, fb.height, theme)
         fb.write(image)
         sleep(config.interval)               # 10-30 seconds
```

### Error handling

- Network failures: show last cached data with a "last updated" timestamp
- Framebuffer errors: log and retry
- Unhandled exceptions in a slide: skip it, log, continue to next slide
- SIGTERM/SIGINT: clean shutdown (unmap framebuffer, clear screen)

## Dependencies

```
# requirements.txt
pillow        # image rendering — pre-installed on RPi OS
requests      # HTTP for weather API (or use stdlib urllib)
```

No compiled extensions.  No C libraries beyond what ships with RPi OS.

## Deployment

- Clone to the Pi
- `pip install -r requirements.txt` (likely already satisfied)
- Auto-start via systemd unit:

```ini
[Unit]
Description=Family Dashboard
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/dashboard/main.py
Restart=always
RestartSec=5
User=pi
Group=video

[Install]
WantedBy=multi-user.target
```

## Non-goals for v1

- No touch input / interactivity
- No web interface for configuration (edit config.py directly)
- No animations or transitions between slides (instant swap)
- No remote management beyond SSH

## Future slide ideas

- **Clock** — large readable time/date display
- **Calendar** — upcoming events from an ICS feed
- **Transit** — next bus/train departure times
- **Photo** — rotating family photos from a directory
- **Chores / reminders** — simple text list
- **Air quality / pollen** — additional weather data
- **Pi-hole stats** — queries blocked today (since it's right there)
