import type { ComponentType } from '../types/circuit'

// Pin labels mirror app/db/seed_data.py COMPONENTS_CATALOG so the dropdowns in
// the wire dialog show exactly the same pins the agent thinks about.

export interface ComponentMeta {
  type: ComponentType
  label: string
  pins: string[]
  defaultProps: Record<string, unknown>
}

const UNO_PINS = [
  ...Array.from({ length: 12 }, (_, i) => `D${i + 2}`), // D2..D13
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5',
  '5V', '3V3', 'GND',
]

export const COMPONENT_CATALOG: ComponentMeta[] = [
  { type: 'uno',           label: 'Arduino UNO',         pins: UNO_PINS,                                       defaultProps: {} },
  { type: 'led',           label: 'LED',                 pins: ['anode', 'cathode'],                            defaultProps: { color: 'red' } },
  { type: 'resistor',      label: 'Resistor 220',        pins: ['a', 'b'],                                      defaultProps: { value: '220' } },
  { type: 'pushbutton',    label: 'Pushbutton',          pins: ['1a', '1b', '2a', '2b'],                        defaultProps: { color: 'blue' } },
  { type: 'buzzer',        label: 'Buzzer',              pins: ['1', '2'],                                      defaultProps: {} },
  { type: 'servo',         label: 'Servo SG90',          pins: ['PWM', 'VCC', 'GND'],                           defaultProps: { angle: 0 } },
  { type: 'potentiometer', label: 'Potentiometer',       pins: ['GND', 'SIG', 'VCC'],                           defaultProps: { value: 0 } },
  { type: 'lcd1602',       label: 'LCD 16x2 (I2C)',      pins: ['GND', 'VCC', 'SDA', 'SCL'],                    defaultProps: {} },
  { type: 'seg7',          label: '7-segment',           pins: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP', 'COM'], defaultProps: { color: 'red' } },
]

export const PERIPHERAL_COMPONENTS = COMPONENT_CATALOG.filter((c) => c.type !== 'uno')

export function pinsFor(type: ComponentType): string[] {
  return COMPONENT_CATALOG.find((c) => c.type === type)?.pins ?? []
}
