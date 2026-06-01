/**
 * avr8js configuration per board. The UNO and Nano share the ATmega328P
 * configuration that avr8js ships. The Mega (ATmega2560) reuses avr8js's
 * built-in PORTA..PORTL configs but needs its timer interrupt-vector addresses
 * overridden, because the ATmega2560 vector table is larger than the 328P's so
 * the timer/USART vectors sit at different word addresses. Those addresses are
 * ATmega2560 datasheet facts.
 */

import {
  portAConfig,
  portBConfig,
  portCConfig,
  portDConfig,
  portEConfig,
  portFConfig,
  portGConfig,
  portHConfig,
  portJConfig,
  portKConfig,
  portLConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  type AVRPortConfig,
  type AVRTimerConfig,
} from 'avr8js'
import type { BoardId } from './boards'

/** A port to instantiate, plus the Arduino pin label for each used bit. */
export interface PortDescriptor {
  config: AVRPortConfig
  pins: Array<[string, number]> // [label, bit]
}

export interface AvrBoardSim {
  programMemWords: number
  sramBytes?: number
  ports: PortDescriptor[]
  timers: AVRTimerConfig[]
  adcChannels: number
}

// --- ATmega328P (UNO / Nano) ---
const ATMEGA328P_PORTS: PortDescriptor[] = [
  {
    config: portDConfig,
    pins: [
      ['D0', 0], ['D1', 1], ['D2', 2], ['D3', 3],
      ['D4', 4], ['D5', 5], ['D6', 6], ['D7', 7],
    ],
  },
  {
    config: portBConfig,
    pins: [['D8', 0], ['D9', 1], ['D10', 2], ['D11', 3], ['D12', 4], ['D13', 5]],
  },
  { config: portCConfig, pins: [] }, // A0..A5 are ADC inputs, not tracked as outputs
]

export const ATMEGA328P_SIM: AvrBoardSim = {
  programMemWords: 0x4000, // 16K words (32 KB flash)
  ports: ATMEGA328P_PORTS,
  timers: [timer0Config, timer1Config, timer2Config],
  adcChannels: 8, // 328P has 8 ADC channels; the UNO breaks out 6, the Nano 8
}

// --- ATmega2560 (Mega) ---
// avr8js ships only the 328P timer vectors. Override the interrupt-vector word
// addresses for the 2560 (datasheet). Register addresses (TCCRn, OCRn, TCNT,
// TIFR, TIMSK) are identical to the 328P, so we keep those from avr8js.
const megaTimer0: AVRTimerConfig = {
  ...timer0Config,
  compAInterrupt: 0x2a,
  compBInterrupt: 0x2c,
  ovfInterrupt: 0x2e,
}
const megaTimer1: AVRTimerConfig = {
  ...timer1Config,
  captureInterrupt: 0x20,
  compAInterrupt: 0x22,
  compBInterrupt: 0x24,
  compCInterrupt: 0x26,
  ovfInterrupt: 0x28,
}
const megaTimer2: AVRTimerConfig = {
  ...timer2Config,
  compAInterrupt: 0x1a,
  compBInterrupt: 0x1c,
  ovfInterrupt: 0x1e,
}

// Arduino Mega pin number -> port bit (from the ATmega2560 datasheet pinout).
const ATMEGA2560_PORTS: PortDescriptor[] = [
  { config: portAConfig, pins: [['D22', 0], ['D23', 1], ['D24', 2], ['D25', 3], ['D26', 4], ['D27', 5], ['D28', 6], ['D29', 7]] },
  { config: portBConfig, pins: [['D53', 0], ['D52', 1], ['D51', 2], ['D50', 3], ['D10', 4], ['D11', 5], ['D12', 6], ['D13', 7]] },
  { config: portCConfig, pins: [['D37', 0], ['D36', 1], ['D35', 2], ['D34', 3], ['D33', 4], ['D32', 5], ['D31', 6], ['D30', 7]] },
  { config: portDConfig, pins: [['D21', 0], ['D20', 1], ['D19', 2], ['D18', 3], ['D38', 7]] },
  { config: portEConfig, pins: [['D0', 0], ['D1', 1], ['D5', 3], ['D2', 4], ['D3', 5]] },
  { config: portFConfig, pins: [] }, // A0..A7 are ADC inputs
  { config: portGConfig, pins: [['D41', 0], ['D40', 1], ['D39', 2], ['D4', 5]] },
  { config: portHConfig, pins: [['D17', 0], ['D16', 1], ['D6', 3], ['D7', 4], ['D8', 5], ['D9', 6]] },
  { config: portJConfig, pins: [['D15', 0], ['D14', 1]] },
  { config: portKConfig, pins: [] }, // A8..A15 are ADC inputs
  { config: portLConfig, pins: [['D49', 0], ['D48', 1], ['D47', 2], ['D46', 3], ['D45', 4], ['D44', 5], ['D43', 6], ['D42', 7]] },
]

export const ATMEGA2560_SIM: AvrBoardSim = {
  programMemWords: 0x20000, // 128K words (256 KB flash)
  sramBytes: 0x2200, // 8 KB SRAM + register space
  ports: ATMEGA2560_PORTS,
  timers: [megaTimer0, megaTimer1, megaTimer2],
  // analogRead(A0..A7) works via the shared 328P ADC mux; A8..A15 (channels
  // 8..15 behind the MUX5 bit) are a known limitation.
  adcChannels: 8,
}

export const BOARD_SIMS: Record<BoardId, AvrBoardSim> = {
  uno: ATMEGA328P_SIM,
  nano: ATMEGA328P_SIM,
  mega: ATMEGA2560_SIM,
}

export function simForBoard(id: BoardId): AvrBoardSim {
  return BOARD_SIMS[id] ?? ATMEGA328P_SIM
}
