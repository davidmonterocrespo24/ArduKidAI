import { useEffect, useMemo, useRef } from 'react'
import type { ComponentInstance } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'
import { resolveAllDrivePins, resolveDrivePin } from '../sim/wireTrace'
import { isActive } from '../sim/pinState'
import { servoMicrosToAngle } from '../sim/pwm'
import { driveInputPin } from '../sim/inputBridge'
import { getAudioContext, onPinToggle } from '../sim/audioBridge'

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
  const simStatus = useAppStore((s) => s.simStatus)
  const hasSignal = drivePin ? isActive(drivePin, pinActivity, 250) : false
  const ref = useLiveProperty('hasSignal', hasSignal)

  // Live audio: time each pin toggle on the wired pin and feed the
  // measured frequency to a square-wave oscillator. tone(8, 440) toggles
  // D8 at 880 Hz; we want the speaker to hum at ~440. Silence the gain
  // when no toggles arrive for 120 ms so digitalWrite-only sketches do
  // not produce a permanent hum.
  useEffect(() => {
    if (!drivePin || simStatus !== 'running') return
    const ctx = getAudioContext()
    if (!ctx) return
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 440
    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(gain).connect(ctx.destination)
    osc.start()

    const timestamps: number[] = []
    let lastUpdate = 0
    const TARGET_VOL = 0.05
    const unsub = onPinToggle((pin) => {
      if (pin !== drivePin) return
      const now = performance.now()
      timestamps.push(now)
      while (timestamps.length > 0 && now - timestamps[0] > 120) timestamps.shift()
      if (timestamps.length < 4) return
      const span = timestamps[timestamps.length - 1] - timestamps[0]
      if (span <= 0) return
      // (n - 1) half-periods in `span` ms -> n-1 transitions
      // freq = (n-1) / (2 * span / 1000)
      const freq = ((timestamps.length - 1) * 1000) / (2 * span)
      if (freq < 30 || freq > 8000) return
      osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.005)
      gain.gain.setTargetAtTime(TARGET_VOL, ctx.currentTime, 0.005)
      lastUpdate = now
    })

    const mute = window.setInterval(() => {
      if (performance.now() - lastUpdate > 120) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02)
      }
    }, 80)

    return () => {
      unsub()
      window.clearInterval(mute)
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
      try { osc.stop(ctx.currentTime + 0.05) } catch {
        // already stopped
      }
      window.setTimeout(() => {
        try { osc.disconnect() } catch { /* noop */ }
        try { gain.disconnect() } catch { /* noop */ }
      }, 100)
    }
  }, [drivePin, simStatus])

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

function Lcd2004({ instance }: { instance: ComponentInstance }) {
  const text = (instance.props.text as string | undefined) ?? ''
  const ref = useLiveProperty('text', text)
  return <wokwi-lcd2004 ref={ref} id={instance.id} pins="i2c" />
}

function DipSwitch8({ instance }: { instance: ComponentInstance }) {
  const wires = useAppStore((s) => s.wires)
  const values = useMemo(
    () => (instance.props.values as number[] | undefined) ?? [0, 0, 0, 0, 0, 0, 0, 0],
    [instance.props.values],
  )
  const ref = useLiveProperty('values', values)
  // Each switch a-side connects to a digital pin. When the switch is
  // on (value === 1) we drive that pin LOW (closed to ground via the
  // b-side); off leaves the pin HIGH (assumes INPUT_PULLUP wiring).
  useEffect(() => {
    for (let i = 0; i < 8; i++) {
      const pin = resolveSingleWireToUno(`${instance.id}.${i + 1}a`, wires)
      if (!pin) continue
      driveInputPin(pin, values[i] !== 1)
    }
  }, [instance.id, wires, values])
  return <wokwi-dip-switch-8 ref={ref} id={instance.id} />
}

function SoundSensor({ instance }: { instance: ComponentInstance }) {
  // Threshold sensor: while running, when "sound level" exceeds threshold
  // DOUT goes LOW (typical active-low module). The AOUT analog reading is
  // routed via the existing ADC bridge.
  const wires = useAppStore((s) => s.wires)
  const level = (instance.props.level as number | undefined) ?? 0
  const threshold = (instance.props.threshold as number | undefined) ?? 600
  useEffect(() => {
    const pin = resolveSingleWireToUno(`${instance.id}.DOUT`, wires)
    if (!pin) return
    driveInputPin(pin, level < threshold)
  }, [instance.id, wires, level, threshold])
  return <wokwi-big-sound-sensor id={instance.id} />
}

function FlameSensor({ instance }: { instance: ComponentInstance }) {
  const wires = useAppStore((s) => s.wires)
  const flame = (instance.props.flame as number | undefined) ?? 0
  const threshold = (instance.props.threshold as number | undefined) ?? 600
  // Visual indicator on the wokwi element: ledSignal lights when the
  // simulated flame reading is above threshold (matches the on-board LED
  // on real modules).
  const props = useMemo(
    () => ({ ledPower: true, ledSignal: flame >= threshold }),
    [flame, threshold],
  )
  const ref = useLiveProperties(props)
  useEffect(() => {
    const pin = resolveSingleWireToUno(`${instance.id}.DOUT`, wires)
    if (!pin) return
    driveInputPin(pin, flame < threshold)
  }, [instance.id, wires, flame, threshold])
  return <wokwi-flame-sensor ref={ref} id={instance.id} />
}

function RotaryEncoder({ instance }: { instance: ComponentInstance }) {
  // KY-040 quadrature emulation: when the kid rotates (control panel
  // +/- buttons set props.angle), we fire a CLK pulse on the wired
  // CLK pin and a phase-shifted DT pulse so the sketch's interrupt or
  // quadrature decoder sees direction-encoded rising edges.
  const wires = useAppStore((s) => s.wires)
  const angle = (instance.props.angle as number | undefined) ?? 0
  const pressed = (instance.props.pressed as boolean | undefined) ?? false
  const ref = useLiveProperty('angle', angle)
  const lastAngle = useRef(angle)
  useEffect(() => {
    if (angle === lastAngle.current) return
    const dir = angle > lastAngle.current ? 1 : -1
    lastAngle.current = angle
    const clkPin = resolveSingleWireToUno(`${instance.id}.CLK`, wires)
    const dtPin = resolveSingleWireToUno(`${instance.id}.DT`, wires)
    if (!clkPin) return
    // Idle high. Clockwise: CLK falls before DT. Counter-clockwise: DT
    // falls before CLK. After 30 ms both go high again.
    const first = dir > 0 ? clkPin : dtPin
    const second = dir > 0 ? dtPin : clkPin
    if (first) driveInputPin(first, false)
    if (second) window.setTimeout(() => driveInputPin(second, false), 10)
    if (first) window.setTimeout(() => driveInputPin(first, true), 20)
    if (second) window.setTimeout(() => driveInputPin(second, true), 30)
  }, [angle, wires, instance.id])
  useEffect(() => {
    const pin = resolveSingleWireToUno(`${instance.id}.SW`, wires)
    if (!pin) return
    driveInputPin(pin, !pressed)
  }, [instance.id, wires, pressed])
  return <wokwi-ky-040 ref={ref} id={instance.id} />
}

function AnalogJoystick({ instance }: { instance: ComponentInstance }) {
  const xValue = (instance.props.xValue as number | undefined) ?? 512
  const yValue = (instance.props.yValue as number | undefined) ?? 512
  const pressed = (instance.props.pressed as boolean | undefined) ?? false
  const props = useMemo(() => ({ xValue, yValue, pressed }), [xValue, yValue, pressed])
  const ref = useLiveProperties(props)
  // SEL pin: when pressed, drives the connected digital pin LOW (the
  // joystick's switch closes to GND).
  const wires = useAppStore((s) => s.wires)
  useEffect(() => {
    const pin = resolveSingleWireToUno(`${instance.id}.SEL`, wires)
    if (!pin) return
    driveInputPin(pin, !pressed)
  }, [instance.id, wires, pressed])
  return <wokwi-analog-joystick ref={ref} id={instance.id} />
}

// Walk the wires for the exact `componentId.pinName` reference and
// return the UNO digital pin it connects to (or null if it leads
// somewhere else / nowhere).
function resolveSingleWireToUno(
  pinRef: string,
  wires: Array<{ from_pin: string; to_pin: string }>,
): import('../sim/pinState').DigitalPinLabel | null {
  for (const w of wires) {
    const other = w.from_pin === pinRef ? w.to_pin : w.to_pin === pinRef ? w.from_pin : null
    if (!other) continue
    const m = /^UNO\.(D\d+)$/.exec(other)
    if (m) return m[1] as import('../sim/pinState').DigitalPinLabel
  }
  return null
}

// Segment ordering as wokwi expects: A B C D E F G DP. Each entry is a
// flag for that segment being lit in common-cathode mode (pin HIGH ==
// segment on). Sketches drive each segment over its own digital pin.
const SEG_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'] as const

function Pushbutton6mm({ instance }: { instance: ComponentInstance }) {
  // Same drive-input wiring as the regular pushbutton: idle pin is
  // seeded HIGH so INPUT_PULLUP reads behave, press/release toggle
  // the connected pin via the bridge.
  const color = (instance.props.color as string | undefined) ?? 'red'
  const drivePin = useDrivePin(instance.id)
  const ref = useRef<HTMLElement>(null)
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
  return <wokwi-pushbutton-6mm ref={ref} id={instance.id} color={color} />
}

function SlidePotentiometer({ instance }: { instance: ComponentInstance }) {
  const value = (instance.props.value as number | undefined) ?? 0
  const ref = useLiveProperty('value', value)
  return <wokwi-slide-potentiometer ref={ref} id={instance.id} />
}

function SlideSwitch({ instance }: { instance: ComponentInstance }) {
  const value = (instance.props.value as number | undefined) ?? 1
  const ref = useLiveProperty('value', value)
  const drivePin = useDrivePin(instance.id)
  // Position 1 -> common tied to ground (LOW). Positions 2/3 -> common
  // pulled high (HIGH). Without a real contact matrix this is the
  // simplest mapping that matches the most common kid wiring: pin "2"
  // to a digital pin, pin "1" to GND, pin "3" to VCC.
  useEffect(() => {
    if (!drivePin) return
    driveInputPin(drivePin, value !== 1)
  }, [drivePin, value])
  return <wokwi-slide-switch ref={ref} id={instance.id} />
}

function Photoresistor({ instance }: { instance: ComponentInstance }) {
  // Visual prop: a brightness 0..1 value is what wokwi expects, not lux.
  // Translate the kid's 0..1023 "lux" prop into the wokwi 0..1 range.
  const lux = (instance.props.lux as number | undefined) ?? 500
  const ref = useLiveProperty('value', Math.max(0, Math.min(1, lux / 1023)))
  return <wokwi-photoresistor-sensor ref={ref} id={instance.id} />
}

function NtcTemperature({ instance }: { instance: ComponentInstance }) {
  const celsius = (instance.props.celsius as number | undefined) ?? 22
  const ref = useLiveProperty('temperature', celsius)
  return <wokwi-ntc-temperature-sensor ref={ref} id={instance.id} />
}

function TiltSwitch({ instance }: { instance: ComponentInstance }) {
  const tilted = (instance.props.tilted as boolean | undefined) ?? false
  const ref = useLiveProperty('tilted', tilted)
  return <wokwi-tilt-switch ref={ref} id={instance.id} />
}

function PirMotion({ instance }: { instance: ComponentInstance }) {
  const triggered = (instance.props.triggered as boolean | undefined) ?? false
  const ref = useLiveProperty('value', triggered)
  return <wokwi-pir-motion-sensor ref={ref} id={instance.id} />
}

function RgbLed({ instance }: { instance: ComponentInstance }) {
  // Each of R, G, B is a separate pin (common-cathode). Read the PWM
  // duty cycle per pin, fall back to digital level for non-PWM pins.
  const wires = useAppStore((s) => s.wires)
  const pinLevels = useAppStore((s) => s.pinLevels)
  const duty = useAppStore((s) => s.pwm.duty)
  const pins = useMemo(() => resolveAllDrivePins(instance.id, wires), [instance.id, wires])
  function brightness(pinName: string): number {
    const p = pins[pinName]
    if (!p) return 0
    const d = duty[p]
    if (d !== undefined) return d
    return pinLevels[p] ? 1 : 0
  }
  const props = useMemo(
    () => ({
      ledRed: brightness('R'),
      ledGreen: brightness('G'),
      ledBlue: brightness('B'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pins, duty, pinLevels],
  )
  const ref = useLiveProperties(props)
  return <wokwi-rgb-led ref={ref} id={instance.id} />
}

function LedBarGraph({ instance }: { instance: ComponentInstance }) {
  const wires = useAppStore((s) => s.wires)
  const pinLevels = useAppStore((s) => s.pinLevels)
  const color = (instance.props.color as string | undefined) ?? 'red'
  const pins = useMemo(() => resolveAllDrivePins(instance.id, wires), [instance.id, wires])
  const values = useMemo(() => {
    const out: number[] = []
    for (let i = 1; i <= 10; i++) {
      const p = pins[`A${i}`]
      out.push(p && pinLevels[p] ? 1 : 0)
    }
    return out
  }, [pins, pinLevels])
  const ref = useLiveProperty('values', values)
  return <wokwi-led-bar-graph ref={ref} id={instance.id} color={color} />
}

function SevenSegment({ instance }: { instance: ComponentInstance }) {
  const wires = useAppStore((s) => s.wires)
  const pinLevels = useAppStore((s) => s.pinLevels)
  const color = (instance.props.color as string | undefined) ?? 'red'
  const segmentPins = useMemo(
    () => resolveAllDrivePins(instance.id, wires),
    [instance.id, wires],
  )
  // Live segment array: read the pin level for each connected segment.
  // Pins the kid did not wire stay off. wokwi expects 1 / 0 numbers.
  const values = useMemo(() => {
    return SEG_ORDER.map((seg) => {
      const pin = segmentPins[seg]
      if (!pin) return 0
      return pinLevels[pin] ? 1 : 0
    })
  }, [segmentPins, pinLevels])
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
    case 'pushbutton6mm':
      return <Pushbutton6mm instance={instance} />
    case 'buzzer':
      return <Buzzer instance={instance} />
    case 'servo':
      return <Servo instance={instance} />
    case 'potentiometer':
      return <Potentiometer instance={instance} />
    case 'slidePotentiometer':
      return <SlidePotentiometer instance={instance} />
    case 'slideSwitch':
      return <SlideSwitch instance={instance} />
    case 'lcd1602':
      return <Lcd1602 instance={instance} />
    case 'lcd2004':
      return <Lcd2004 instance={instance} />
    case 'seg7':
      return <SevenSegment instance={instance} />
    case 'dipSwitch8':
      return <DipSwitch8 instance={instance} />
    case 'analogJoystick':
      return <AnalogJoystick instance={instance} />
    case 'soundSensor':
      return <SoundSensor instance={instance} />
    case 'flameSensor':
      return <FlameSensor instance={instance} />
    case 'rotaryEncoder':
      return <RotaryEncoder instance={instance} />
    case 'photoresistor':
      return <Photoresistor instance={instance} />
    case 'ntcTemperature':
      return <NtcTemperature instance={instance} />
    case 'tiltSwitch':
      return <TiltSwitch instance={instance} />
    case 'pirMotion':
      return <PirMotion instance={instance} />
    case 'rgbLed':
      return <RgbLed instance={instance} />
    case 'ledBarGraph':
      return <LedBarGraph instance={instance} />
    default:
      return <div className="rounded bg-rose-100 px-2 text-xs text-rose-700">unknown</div>
  }
}
