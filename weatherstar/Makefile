CC      ?= gcc
CFLAGS  ?= -O2 -Wall -Wextra
LDFLAGS  = -lpng -lz -lm
TARGET   = weatherstar
HEADERS  = fb.h font.h icons.h display.h screenshot.h

all: $(TARGET)

$(TARGET): main.c $(HEADERS)
	$(CC) $(CFLAGS) -o $@ main.c $(LDFLAGS)

screenshot: $(TARGET)
	./$(TARGET) --no-ansi --screenshot screenshot.png

clean:
	rm -f $(TARGET) screenshot.png

.PHONY: all clean screenshot
