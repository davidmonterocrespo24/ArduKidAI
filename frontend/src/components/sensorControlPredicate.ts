// Component types that expose a runtime control panel (sliders /
// buttons) while the sim is running. Lives in its own module so the
// React Refresh "components-only export" rule stays happy for
// SensorControl.tsx.
const CONTROLLABLE_TYPES = new Set<string>([
  'potentiometer',
  'slidePotentiometer',
  'pushbutton',
  'pushbutton6mm',
  'photoresistor',
  'ntcTemperature',
  'tiltSwitch',
  'pirMotion',
  'slideSwitch',
  'dipSwitch8',
  'analogJoystick',
  'soundSensor',
  'smallSoundSensor',
  'flameSensor',
  'gasSensor',
  'heartBeatSensor',
  'rotaryEncoder',
  'dht22',
  'hcSr04',
])

export function hasSensorControl(type: string): boolean {
  return CONTROLLABLE_TYPES.has(type)
}
