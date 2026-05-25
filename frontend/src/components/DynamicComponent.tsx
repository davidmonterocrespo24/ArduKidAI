import { useEffect, useMemo, useRef } from 'react'
import type { ComponentInstance } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'
import { resolveDrivePin } from '../sim/wireTrace'
import { isActive } from '../sim/pinState'

function useLiveProperty<K extends string>(propName: K, value: unknown) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ;(ref.current as unknown as Record<string, unknown>)[propName] = value
  }, [propName, value])
  return ref
}

function useDrivePin(componentId: string) {
  const wires = useAppStore((s) => s.wires)
  return useMemo(() => resolveDrivePin(componentId, wires), [componentId, wires])
}

function Led({ instance }: { instance: ComponentInstance }) {
  const drivePin = useDrivePin(instance.id)
  const pinLevels = useAppStore((s) => s.pinLevels)
  const legacyLedOn = useAppStore((s) => s.ledOn)
  const isOn = drivePin ? pinLevels[drivePin] : legacyLedOn
  const ref = useLiveProperty('value', isOn)
  const color = (instance.props.color as string | undefined) ?? 'red'
  return <wokwi-led ref={ref} id={instance.id} color={color} />
}

function Buzzer({ instance }: { instance: ComponentInstance }) {
  const drivePin = useDrivePin(instance.id)
  const pinActivity = useAppStore((s) => s.pinActivity)
  const hasSignal = drivePin ? isActive(drivePin, pinActivity, 250) : false
  const ref = useLiveProperty('hasSignal', hasSignal)
  return <wokwi-buzzer ref={ref} id={instance.id} />
}

function Servo({ instance }: { instance: ComponentInstance }) {
  const angle = (instance.props.angle as number | undefined) ?? 0
  const ref = useLiveProperty('angle', angle)
  return <wokwi-servo ref={ref} id={instance.id} />
}

function Potentiometer({ instance }: { instance: ComponentInstance }) {
  const value = (instance.props.value as number | undefined) ?? 0
  const ref = useLiveProperty('value', value)
  return <wokwi-potentiometer ref={ref} id={instance.id} />
}

function Pushbutton({ instance }: { instance: ComponentInstance }) {
  const color = (instance.props.color as string | undefined) ?? 'blue'
  return <wokwi-pushbutton id={instance.id} color={color} />
}

function Resistor({ instance }: { instance: ComponentInstance }) {
  const value = (instance.props.value as string | undefined) ?? '220'
  return <wokwi-resistor id={instance.id} value={value} />
}

function Lcd1602({ instance }: { instance: ComponentInstance }) {
  const text = (instance.props.text as string | undefined) ?? ''
  const ref = useLiveProperty('text', text)
  return <wokwi-lcd1602 ref={ref} id={instance.id} />
}

function SevenSegment({ instance }: { instance: ComponentInstance }) {
  const values = (instance.props.values as string | undefined) ?? '0'
  const color = (instance.props.color as string | undefined) ?? 'red'
  const ref = useLiveProperty('values', values)
  return <wokwi-7segment ref={ref} id={instance.id} color={color} />
}

export function DynamicComponent({ instance }: { instance: ComponentInstance }) {
  switch (instance.type) {
    case 'uno':
      return <wokwi-arduino-uno id={instance.id} />
    case 'led':
      return <Led instance={instance} />
    case 'resistor':
      return <Resistor instance={instance} />
    case 'pushbutton':
      return <Pushbutton instance={instance} />
    case 'buzzer':
      return <Buzzer instance={instance} />
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
