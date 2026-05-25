// Hand-encoded AVR program that toggles PB5 (Arduino UNO pin 13) using a
// nested delay loop. This lets phase 1 run avr8js end-to-end without yet
// depending on arduino-cli (which arrives in phase 2). Each entry below is
// one 16-bit instruction word for the ATmega328P.
//
// Mnemonics:
//   idx | mnemonic          | notes
//   ----+-------------------+-----------------------------------------
//    0  | LDI R16, 0x20     | mask = bit 5
//    1  | OUT 0x04, R16     | DDRB  = 0x20  (PB5 as output)
//    2  | IN  R17, 0x05     | loop_start: r17 = PORTB
//    3  | EOR R17, R16      | r17 ^= 0x20  (flip bit 5)
//    4  | OUT 0x05, R17     | PORTB = r17
//    5  | LDI R18, 0xFF     | delay outer-outer counter
//    6  | LDI R19, 0xFF     | delay outer counter
//    7  | LDI R20, 0xFF     | delay inner counter
//    8  | DEC R20           | inner_start
//    9  | BRNE -2           | branch to inner_start
//   10  | DEC R19
//   11  | BRNE -4           | branch to inner_start
//   12  | DEC R18
//   13  | BRNE -6           | branch to inner_start
//   14  | RJMP -13          | jump to loop_start
//
// Approximate cycle count per outer iteration: 255 * 255 * (1 DEC + 2 BRNE)
// at 16 MHz puts the visible LED toggle around once per second.

export const BLINK_PROGRAM: readonly number[] = [
  0xe200, // LDI R16, 0x20
  0xb904, // OUT 0x04, R16   ; DDRB
  0xb115, // IN  R17, 0x05   ; PORTB read
  0x2710, // EOR R17, R16
  0xb915, // OUT 0x05, R17   ; PORTB write
  0xef2f, // LDI R18, 0xFF
  0xef3f, // LDI R19, 0xFF
  0xef4f, // LDI R20, 0xFF
  0x954a, // DEC R20
  0xf7f1, // BRNE -2
  0x953a, // DEC R19
  0xf7e1, // BRNE -4
  0x952a, // DEC R18
  0xf7d1, // BRNE -6
  0xcff3, // RJMP -13
]
