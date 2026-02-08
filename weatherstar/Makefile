CC      ?= gcc
CFLAGS  ?= -O2 -Wall -Wextra
LDFLAGS  = -lpng -lz -lm
TARGET   = weatherstar

all: $(TARGET)

$(TARGET): weatherstar.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)

screenshot: $(TARGET)
	./$(TARGET) --no-ansi --screenshot screenshot.png

clean:
	rm -f $(TARGET) screenshot.png

.PHONY: all clean screenshot
