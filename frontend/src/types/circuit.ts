export type ComponentType =
  | 'uno'
  | 'led'
  | 'resistor'
  | 'pushbutton'
  | 'pushbutton6mm'
  | 'buzzer'
  | 'servo'
  | 'potentiometer'
  | 'slidePotentiometer'
  | 'slideSwitch'
  | 'lcd1602'
  | 'lcd2004'
  | 'seg7'
  | 'dipSwitch8'
  | 'analogJoystick'
  | 'soundSensor'
  | 'smallSoundSensor'
  | 'flameSensor'
  | 'gasSensor'
  | 'heartBeatSensor'
  | 'rotaryEncoder'
  | 'photoresistor'
  | 'ntcTemperature'
  | 'tiltSwitch'
  | 'pirMotion'
  | 'rgbLed'
  | 'ledBarGraph'

export interface ComponentInstance {
  id: string
  type: ComponentType
  x: number
  y: number
  props: Record<string, unknown>
}

export interface Wire {
  from_pin: string
  to_pin: string
  color?: string
  /** Orthogonal bend points the kid dragged onto the wire. Each entry
   * is an absolute point in canvas (SVG) coordinates that the path
   * routes through between the two endpoints. Empty / undefined means
   * the wire goes directly start -> end. */
  waypoints?: Array<{ x: number; y: number }>
}

export interface CircuitState {
  components: ComponentInstance[]
  wires: Wire[]
  blockly_xml: string
  cpp_code: string
}

export type ChatRole = 'user' | 'agent' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  toolName?: string
}
