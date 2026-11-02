@ Entry point and cartridge header for the test cartridge.
    .section .text.start,"ax"
    .arm
    .global _start
_start:
    b       rom_start
    .fill   156, 1, 0               @ 0x04-0x9F logo (mGBA's HLE BIOS does not check it)
    .ascii  "EVOTEST     "          @ 0xA0 title, 12 bytes
    .ascii  "AEVE"                  @ 0xAC game code
    .ascii  "01"                    @ 0xB0 maker code
    .byte   0x96                    @ 0xB2 fixed value
    .byte   0, 0                    @ 0xB3 unit code, 0xB4 device type
    .fill   7, 1, 0                 @ 0xB5-0xBB reserved
    .byte   0                       @ 0xBC version
    .byte   0                       @ 0xBD header complement, written by build.sh
    .byte   0, 0                    @ 0xBE-0xBF reserved
rom_start:
    mov     r0, #0x12               @ IRQ mode stack
    msr     cpsr_c, r0
    ldr     sp, =0x03007FA0
    mov     r0, #0x1F               @ system mode stack
    msr     cpsr_c, r0
    ldr     sp, =0x03007F00
    ldr     r0, =main
    bx      r0
    .ltorg
