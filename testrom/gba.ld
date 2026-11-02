ENTRY(_start)
MEMORY {
  rom   : ORIGIN = 0x08000000, LENGTH = 32M
  iwram : ORIGIN = 0x03000000, LENGTH = 31K
}
SECTIONS {
  .text : { KEEP(*(.text.start)) *(.text*) *(.rodata*) KEEP(*(.gene)) KEEP(*(.savetag)) } > rom
  .bss (NOLOAD) : { *(.bss*) *(COMMON) } > iwram
  /DISCARD/ : { *(.ARM.exidx*) *(.comment) }
}
