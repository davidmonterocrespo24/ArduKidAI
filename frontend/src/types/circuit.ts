export type ComponentType =
  | 'uno'
  | 'led'
  | 'resistor'
  | 'pushbutton'
  | 'buzzer'
  | 'servo'
  | 'potentiometer'
  | 'lcd1602'
  | 'seg7'

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
