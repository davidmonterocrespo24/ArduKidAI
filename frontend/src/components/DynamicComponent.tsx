import { useEffect, useMemo, useRef } from 'react'
import type { ComponentInstance } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'
import { resolveDrivePin } from '../sim/wireTrace'
import { isActive } from '../sim/pinState'
import { servoMicrosToAngle } from '../sim/pwm'
import { driveInputPin } from '../sim/inputBridge'

function useLiveProperty<K extends string>(propName: K, value: unknown) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ;(ref.current as unknown as Record<string, unknown>)[propName] = value
  }, [propName, value])
  return ref
}

function useLiveProperties(props: Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current as unknown as Record<string, unknown>
    for (const [k, v] of Object.entries(props)) {
      el[k] = v
    }
  }, [props])
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
  const duty = useAppStore((s) => (drivePin ? s.pwm.duty[drivePin] : undefined))
  const isOn = drivePin ? pinLevels[drivePin] : legacyLedOn
  // When analogWrite was called on this pin, we treat the LED as
  // continuously on with a brightness proportional to duty. Pure
  // digitalWrite() keeps brightness at 1 and just toggles value.
  const props = useMemo(
    () =>
      duty !== undefined
        ? { value: duty > 0, brightness: duty }
        : { value: isOn, brightness: 1 },
    [duty, isOn],
  )
  const ref = useLiveProperties(props)
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
  const drivePin = useDrivePin(instance.id)
  const pwm = useAppStore((s) => s.pwm)
  // The Arduino Servo library puts Timer1 in /8 prescaler and writes
  // the pulse width (in 0.5 us ticks) to OCR1A (D9) or OCR1B (D10).
  // When that pin is wired to the servo, the OCR value supersedes the
  // static angle the agent set with set_component_props.
  const liveAngle = (() => {
    if (drivePin === 'D9' && pwm.com1a && pwm.ocr1a > 255) {
      return servoMicrosToAngle(pwm.ocr1a)
    }
    if (drivePin === 'D10' && pwm.com1b && pwm.ocr1b > 255) {
      return servoMicrosToAngle(pwm.ocr1b)
    }
    return undefined
  })()
  const angle = liveAngle ?? ((instance.props.angle as number | undefined) ?? 0)
  const ref = useLiveProperty('angle', angle)
  return <wokwi-servo ref={ref} id={instance.id} />
}

function Potentiometer({ instance }: { instance: ComponentInstance }) {
  const value = (instance.props.value as number | undefined) ?? 0
  const ref = useLiveProperty('value', value)
  const updateComponentProps = useAppStore((s) => s.updateComponentProps)

  // Bridge the wokwi-potentiometer's "input" event (fires when the kid
  // drags the knob) back into the store so analogRead picks it up.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => {
      const next = (el as unknown as { value: number }).value
      updateComponentProps(instance.id, { value: next })
    }
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [instance.id, updateComponentProps, ref])

  return <wokwi-potentiometer ref={ref} id={instance.id} />
}

function Pushbutton({ instance }: { instance: ComponentInstance }) {
  const color = (instance.props.color as string | undefined) ?? 'blue'
  const drivePin = useDrivePin(instance.id)
  const ref = useRef<HTMLElement>(null)

  // Seed the connected pin HIGH while the button is idle (the kid's
  // sketch will use pinMode(INPUT_PULLUP) to read it). avr8js' IOPort
  // does not auto-pull on its own, so without this the input would
  // float and `digitalRead` would think the button is forever pressed.
  useEffect(() => {
    if (!drivePin) return
    driveInputPin(drivePin, true)
  }, [drivePin])

  useEffect(() => {
    const el = ref.current
    if (!el || !drivePin) return
    const onPress = () => driveInputPin(drivePin, false)
    const onRelease = () => driveInputPin(drivePin, true)
    el.addEventListener('button-press', onPress)
    el.addEventListener('button-release', onRelease)
    return () => {
      el.removeEventListener('button-press', onPress)
      el.removeEventListener('button-release', onRelease)
    }
  }, [drivePin])

  return <wokwi-pushbutton ref={ref} id={instance.id} color={color} />
}

function Resistor({ instance }: { instance: ComponentInstance }) {
  const value = (instance.props.value as string | undefined) ?? '220'
  return <wokwi-resistor id={instance.id} value={value} />
}

function Lcd1602({ instance }: { instance: ComponentInstance }) {
  const text = (instance.props.text as string | undefined) ?? ''
  const ref = useLiveProperty('text', text)
  // pins="i2c" exposes GND, VCC, SDA, SCL on the element so the kid
  // can wire it the same way as a real $2 LCM1602 backpack. The
  // simulator only models the I2C path - the 16-pin parallel mode is
  // not wired in our HD44780 decoder, so defaulting to i2c also
  // matches what every example here writes to.
  return <wokwi-lcd1602 ref={ref} id={instance.id} pins="i2c" />
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
