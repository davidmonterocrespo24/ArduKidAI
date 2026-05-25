# Arduino UNO emulation - completeness roadmap

Tracks what is wired in `frontend/src/sim/runner.ts` versus what a real
ATmega328P does. Populated from the velxio audit on 2026-05-25.

Legend: `[x]` done, `[ ]` pending, `[/]` partial.

## Done

- [x] **CPU** (`new CPU(progMem)`)
- [x] **AVRIOPort B/C/D** - digital pin reads/writes (`pinMode`, `digitalRead`, `digitalWrite`)
- [x] **AVRTimer 0/1/2** - `millis()`, `delay()`, `tone()` actually advance (commit `5d4e7b5`)
- [x] **AVRUSART** - `Serial.print` / `Serial.println` reach the Serial monitor panel
- [x] **Intel HEX load** - the `arduino-cli` compiler output is parsed in `lib/intelHex.ts` and written into program memory
- [x] **setInterval frame loop** - sim ticks regardless of tab visibility (commit `d249ee0`)
- [x] **WireOverlay alias map** - agent-style pin names ("UNO.D13", "L1.anode") resolve to wokwi's native names

## In progress / next up

- [x] **AVRADC** + pot bridge - `analogRead(A0..A5)` returns the live potentiometer knob value. Wire-trace finds the component connected to each A-pin and writes its 0..5 V into `adc.channelValues[ch]` every frame. (commit `b5f0299`)
- [x] **AVRTWI (I2C)** + virtual PCF8574 LCD backpack - `LiquidCrystal_I2C lcd(0x27, 16, 2)` decodes nibbles into the visible 2x16 string and pushes it to every `wokwi-lcd1602` on the canvas via `updateComponentProps`. (commit `71304a4`)
- [x] **PWM register polling** - `analogWrite(pin, duty)` modulates `<wokwi-led>` brightness (D3/D5/D6/D9/D10/D11 read OCRnA/B + TCCRnA COM bits) and `<wokwi-servo>` angle via the Servo library's Timer1 pulse-width on D9/D10. (commit pending)
- [ ] **External / pin-change interrupts** - `attachInterrupt(0, fn, CHANGE)` fires.
- [ ] **Serial line buffering polish** - Already use `onLineTransmit`. Verify long `Serial.print(...)` without `\n` flushes correctly on disconnect.

## Nice-to-have (after the hackathon MVP)

- [ ] **AVRSPI** + SpiBus for TFT/SD-card examples.
- [ ] **EEPROM** (via I2C 24C256 or `AVREEPROM` if available) for persistent calibration.
- [ ] **Watchdog + sleep modes**.
- [ ] **Cycle-accurate scheduled pin changes** for 1-wire sensors (DHT22, DS18B20).
- [ ] **Pushbutton mouse-click → pin LOW** so the kid can drive `digitalRead` inputs.

## Notes

- `avr8js` exports for things we have not wired: `AVRADC`, `adcConfig`,
  `atmega328Channels`, `AVRTWI`, `AVRSPI`, `AVREEPROM`, `AVRWatchdog`,
  `INT0`, `INT1`, `PCINT0`, `PCINT1`, `PCINT2`.
- Velxio reference paths: `/home/dave/velxio/frontend/src/simulation/AVRSimulator.ts` (master file), `/home/dave/velxio/frontend/src/simulation/I2CBusManager.ts`, `/home/dave/velxio/frontend/src/simulation/parts/`.
- One commit per item. Push after every commit (memory rule
  [[push-after-commit]]). When a row flips to `[x]`, also append the
  commit hash in parentheses.
