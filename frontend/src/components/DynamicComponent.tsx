import { useEffect, useRef } from 'react'
import type { ComponentInstance } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'

function useLiveProperty<K extends string>(propName: K, value: unknown) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ;(ref.current as unknown as Record<string, unknown>)[propName] = value
  }, [propName, value])
  return ref
}

function Led({ instance }: { instance: ComponentInstance }) {
  // The first LED in the circuit follows the simulator state. Additional LEDs
  // display in their default color but stay dark until the simulator drives
  // their pin (which arrives in phase 5 once we wire per-pin port listeners).
  const ledOn = useAppStore((s) => s.ledOn)
  const components = useAppStore((s) => s.components)
  const firstLedId = components.find((c) => c.type === 'led')?.id
  const isOn = instance.id === firstLedId ? ledOn : false
  const ref = useLiveProperty('value', isOn)
  const color = (instance.props.color as string | undefined) ?? 'red'
  return <wokwi-led ref={ref} color={color} />
}

function Buzzer() {
  const ref = useLiveProperty('hasSignal', false)
  return <wokwi-buzzer ref={ref} />
}

function Servo({ instance }: { instance: ComponentInstance }) {
  const angle = (instance.props.angle as number | undefined) ?? 0
  const ref = useLiveProperty('angle', angle)
  return <wokwi-servo ref={ref} />
}

function Potentiometer({ instance }: { instance: ComponentInstance }) {
  const value = (instance.props.value as number | undefined) ?? 0
  const ref = useLiveProperty('value', value)
  return <wokwi-potentiometer ref={ref} />
}

function Pushbutton({ instance }: { instance: ComponentInstance }) {
  const color = (instance.props.color as string | undefined) ?? 'blue'
  return <wokwi-pushbutton color={color} />
}

function Resistor({ instance }: { instance: ComponentInstance }) {
  const value = (instance.props.value as string | undefined) ?? '220'
  return <wokwi-resistor value={value} />
}

function Lcd1602({ instance }: { instance: ComponentInstance }) {
  const text = (instance.props.text as string | undefined) ?? ''
  const ref = useLiveProperty('text', text)
  return <wokwi-lcd1602 ref={ref} />
}

function SevenSegment({ instance }: { instance: ComponentInstance }) {
  const values = (instance.props.values as string | undefined) ?? '0'
  const color = (instance.props.color as string | undefined) ?? 'red'
  const ref = useLiveProperty('values', values)
  return <wokwi-7segment ref={ref} color={color} />
}

export function DynamicComponent({ instance }: { instance: ComponentInstance }) {
  switch (instance.type) {
    case 'uno':
      return <wokwi-arduino-uno />
    case 'led':
      return <Led instance={instance} />
    case 'resistor':
      return <Resistor instance={instance} />
    case 'pushbutton':
      return <Pushbutton instance={instance} />
    case 'buzzer':
      return <Buzzer />
    case 'servo':
      return <Servo instance={instance} />
    case 'potentiometer':
      return <Potentiometer instance={instance} />
    case 'lcd1602':
      return <Lcd1602 instance={instance} />
    case 'seg7':
      return <SevenSegment instance={instance} />
    default:
      return <div className="rounded bg-rose-100 px-2 text-xs text-rose-700">unknown</div>
  }
}
