/* EVOTEST: a tiny homebrew cartridge for testing the web player end to end.
 *
 * It draws one creature (a square) on a paper-white screen. The creature's colour and size are
 * its "genes", stored in ROM behind the magic "EVOGENE!" so a .bps patch can mutate them.
 *   D-pad  moves the creature
 *   A      adds a dot to the row at the bottom and stores the count in SRAM (so saves can be tested)
 *   B      clears the dots
 * Written for this site, public domain (CC0). No Nintendo code or assets. */

typedef unsigned short u16;
typedef unsigned char u8;

#define REG_DISPCNT  (*(volatile u16 *)0x04000000)
#define REG_VCOUNT   (*(volatile u16 *)0x04000006)
#define REG_KEYINPUT (*(volatile u16 *)0x04000130)
#define REG_WAITCNT  (*(volatile u16 *)0x04000204)
#define VRAM         ((volatile u16 *)0x06000000)
#define SRAM         ((volatile u8 *)0x0E000000)
#define RGB(r, g, b) ((u16)((r) | ((g) << 5) | ((b) << 10)))

#define K_A 0x001
#define K_B 0x002
#define K_RIGHT 0x010
#define K_LEFT 0x020
#define K_UP 0x040
#define K_DOWN 0x080

struct gene { char magic[8]; u16 color; u16 size; };

/* The genome. Volatile so the compiler reads it from ROM instead of folding it in. */
__attribute__((section(".gene"), used, aligned(4)))
const volatile struct gene GENE = { "EVOGENE!", RGB(6, 9, 14), 24 };

/* Tells mGBA (and real save-type detectors) that this cartridge has 32 KB of SRAM. */
__attribute__((section(".savetag"), used, aligned(4)))
const char SAVE_TAG[] = "SRAM_V113";

static const u16 PAPER = RGB(30, 30, 29);
static const u16 DOT = RGB(3, 3, 3);

static void rect(int x, int y, int w, int h, u16 c) {
    for (int j = 0; j < h; j++) {
        volatile u16 *row = VRAM + (y + j) * 240 + x;
        for (int i = 0; i < w; i++) row[i] = c;
    }
}

static void vsync(void) {
    while (REG_VCOUNT >= 160) {}
    while (REG_VCOUNT < 160) {}
}

static void dots(int n) {
    rect(8, 146, 224, 6, PAPER);
    if (n > 37) n = 37;
    for (int i = 0; i < n; i++) rect(8 + i * 6, 146, 4, 4, DOT);
}

int main(void) {
    REG_WAITCNT = 0x0003;           /* SRAM wait state 8 cycles */
    REG_DISPCNT = 0x0403;           /* mode 3, BG2 on */
    rect(0, 0, 240, 160, PAPER);

    int s = GENE.size;
    if (s < 4) s = 4;
    if (s > 64) s = 64;
    u16 c = GENE.color;
    int x = 120 - s / 2, y = 70 - s / 2;

    u8 count = SRAM[0];
    if (SRAM[1] != 0xE5) { count = 0; SRAM[0] = 0; SRAM[1] = 0xE5; }
    dots(count);
    rect(x, y, s, s, c);

    u16 prev = 0;
    for (;;) {
        vsync();
        u16 keys = ~REG_KEYINPUT & 0x3FF;
        u16 pressed = keys & ~prev;
        prev = keys;

        int nx = x, ny = y;
        if (keys & K_LEFT) nx -= 2;
        if (keys & K_RIGHT) nx += 2;
        if (keys & K_UP) ny -= 2;
        if (keys & K_DOWN) ny += 2;
        if (nx < 0) nx = 0;
        if (nx > 240 - s) nx = 240 - s;
        if (ny < 0) ny = 0;
        if (ny > 140 - s) ny = 140 - s;
        if (nx != x || ny != y) {
            rect(x, y, s, s, PAPER);
            x = nx; y = ny;
            rect(x, y, s, s, c);
        }
        if (pressed & K_A) { if (count < 255) count++; SRAM[0] = count; dots(count); }
        if (pressed & K_B) { count = 0; SRAM[0] = 0; dots(0); }
    }
}
