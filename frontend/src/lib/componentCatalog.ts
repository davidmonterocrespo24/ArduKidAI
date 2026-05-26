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
  { type: 'uno',                label: 'Arduino UNO',          pins: UNO_PINS,                                       defaultProps: {} },
  { type: 'led',                label: 'LED',                  pins: ['anode', 'cathode'],                            defaultProps: { color: 'red' } },
  { type: 'resistor',           label: 'Resistor 220',         pins: ['a', 'b'],                                      defaultProps: { value: '220' } },
  { type: 'pushbutton',         label: 'Pushbutton',           pins: ['1a', '1b', '2a', '2b'],                        defaultProps: { color: 'blue' } },
  { type: 'pushbutton6mm',      label: 'Pushbutton 6mm',       pins: ['1a', '1b', '2a', '2b'],                        defaultProps: { color: 'red' } },
  { type: 'buzzer',             label: 'Buzzer',               pins: ['1', '2'],                                      defaultProps: {} },
  { type: 'servo',              label: 'Servo SG90',           pins: ['PWM', 'VCC', 'GND'],                           defaultProps: { angle: 0 } },
  { type: 'potentiometer',      label: 'Potentiometer',        pins: ['GND', 'SIG', 'VCC'],                           defaultProps: { value: 0 } },
  { type: 'slidePotentiometer', label: 'Slide pot (fader)',    pins: ['VCC', 'SIG', 'GND'],                           defaultProps: { value: 0 } },
  { type: 'slideSwitch',        label: 'Slide switch',         pins: ['1', '2', '3'],                                 defaultProps: { value: 1 } },
  { type: 'lcd1602',            label: 'LCD 16x2 (I2C)',       pins: ['GND', 'VCC', 'SDA', 'SCL'],                    defaultProps: {} },
  { type: 'lcd2004',            label: 'LCD 20x4 (I2C)',       pins: ['GND', 'VCC', 'SDA', 'SCL'],                    defaultProps: {} },
  { type: 'dipSwitch8',         label: 'DIP switch (8)',       pins: ['1a', '2a', '3a', '4a', '5a', '6a', '7a', '8a', '1b', '2b', '3b', '4b', '5b', '6b', '7b', '8b'], defaultProps: { values: [0,0,0,0,0,0,0,0] } },
  { type: 'analogJoystick',     label: 'Analog joystick',      pins: ['VCC', 'VERT', 'HORZ', 'SEL', 'GND'],           defaultProps: { xValue: 512, yValue: 512, pressed: false } },
  { type: 'soundSensor',        label: 'Sound sensor (big)',   pins: ['AOUT', 'GND', 'VCC', 'DOUT'],                  defaultProps: { level: 400, threshold: 600 } },
  { type: 'smallSoundSensor',   label: 'Sound sensor (small)', pins: ['AOUT', 'GND', 'VCC', 'DOUT'],                  defaultProps: { level: 400, threshold: 600 } },
  { type: 'flameSensor',        label: 'Flame sensor',         pins: ['VCC', 'GND', 'DOUT', 'AOUT'],                  defaultProps: { flame: 200, threshold: 600 } },
  { type: 'gasSensor',          label: 'Gas sensor (MQ-2)',    pins: ['AOUT', 'DOUT', 'GND', 'VCC'],                  defaultProps: { gas: 200, threshold: 600 } },
  { type: 'heartBeatSensor',    label: 'Heart-beat sensor',    pins: ['GND', 'VCC', 'OUT'],                           defaultProps: { bpm: 60 } },
  { type: 'rotaryEncoder',      label: 'Rotary encoder (KY-040)', pins: ['CLK', 'DT', 'SW', 'VCC', 'GND'],            defaultProps: { angle: 0 } },
  { type: 'seg7',               label: '7-segment',            pins: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP', 'COM'], defaultProps: { color: 'red' } },
  { type: 'photoresistor',      label: 'Light sensor (LDR)',   pins: ['VCC', 'GND', 'DO', 'AO'],                      defaultProps: { lux: 500 } },
  { type: 'ntcTemperature',     label: 'NTC temperature',      pins: ['GND', 'VCC', 'OUT'],                           defaultProps: { celsius: 22 } },
  { type: 'tiltSwitch',         label: 'Tilt switch',          pins: ['GND', 'VCC', 'OUT'],                           defaultProps: { tilted: false } },
  { type: 'pirMotion',          label: 'PIR motion',           pins: ['VCC', 'OUT', 'GND'],                           defaultProps: { triggered: false } },
  { type: 'rgbLed',             label: 'RGB LED',              pins: ['R', 'COM', 'G', 'B'],                          defaultProps: {} },
  { type: 'ledBarGraph',        label: 'LED bar graph (10)',   pins: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'], defaultProps: { color: 'red' } },
]

export const PERIPHERAL_COMPONENTS = COMPONENT_CATALOG.filter((c) => c.type !== 'uno')

export function pinsFor(type: ComponentType): string[] {
  return COMPONENT_CATALOG.find((c) => c.type === type)?.pins ?? []
}
