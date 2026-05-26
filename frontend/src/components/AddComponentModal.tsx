import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { PERIPHERAL_COMPONENTS } from '../lib/componentCatalog'
import { nextComponentId } from '../lib/nextComponentId'
import { nextSpawnPosition } from '../lib/spawnPosition'
import type { ComponentType } from '../types/circuit'

interface Props {
  open: boolean
  onClose: () => void
}

// One-line description per kit part. Kept short so the modal stays
// dense; the visual preview does most of the explaining.
const DESCRIPTIONS: Record<ComponentType, string> = {
  uno: 'Arduino UNO board (always pinned to the canvas)',
  led: 'Lights up when its anode is HIGH.',
  resistor: '220 ohm current limiter (use with every LED).',
  pushbutton: 'Momentary tactile switch. Pulls a digital pin low.',
  pushbutton6mm: 'Small 6 mm tactile button. Same wiring as the big one.',
  buzzer: 'Piezo speaker. Drive it with tone() to play notes.',
  servo: 'SG90 hobby servo. Set an angle 0-180 with Servo.write().',
  potentiometer: 'Rotary knob (0..1023 on an analog pin).',
  slidePotentiometer: 'Linear fader, same 0..1023 analog signal as the knob pot.',
  slideSwitch: 'SPDT 3-pin slide switch (left / middle / right).',
  lcd1602: '16x2 character LCD over I2C. Wire to A4/A5 + 5V/GND.',
  lcd2004: '20x4 character LCD over I2C. Same wiring as the 16x2, bigger window.',
  seg7: 'Single-digit common-cathode 7-segment. Drives A..G + DP.',
  dipSwitch8: '8-way DIP switch. Each switch ties its a-side pin LOW when ON.',
  analogJoystick: 'Thumb joystick. X / Y feed two analog pins, SEL is a button.',
  photoresistor: 'Light sensor (LDR). Slider sets the lux while running.',
  ntcTemperature: 'NTC temperature sensor. Slider sets the C while running.',
  tiltSwitch: 'Tilt switch. Toggle to drive the output pin HIGH / LOW.',
  pirMotion: 'PIR motion sensor. Tap "Trigger" to pulse the output pin.',
  rgbLed: 'Common-cathode RGB LED. Wire R / G / B to 3 PWM pins.',
  ledBarGraph: '10-LED bar graph. Anodes A1..A10 wired to digital pins.',
}

// Render the actual wokwi element as the preview so kids see the real
// thing they're about to drop. A non-interactive wrapper isolates it
// from clicks.
function Preview({ type }: { type: ComponentType }) {
  const common = 'pointer-events-none flex h-20 items-center justify-center'
  switch (type) {
    case 'led':
      return (
        <div className={common}>
          <wokwi-led color="red" />
        </div>
      )
    case 'resistor':
      return (
        <div className={common}>
          <wokwi-resistor value="220" />
        </div>
      )
    case 'pushbutton':
      return (
        <div className={common}>
          <wokwi-pushbutton color="blue" />
        </div>
      )
    case 'buzzer':
      return (
        <div className={common}>
          <wokwi-buzzer />
        </div>
      )
    case 'servo':
      return (
        <div className={common}>
          <wokwi-servo />
        </div>
      )
    case 'potentiometer':
      return (
        <div className={common}>
          <wokwi-potentiometer />
        </div>
      )
    case 'lcd1602':
      return (
        <div className={common} style={{ transform: 'scale(0.55)' }}>
          <wokwi-lcd1602 pins="i2c" />
        </div>
      )
    case 'seg7':
      return (
        <div className={common}>
          <wokwi-7segment color="red" />
        </div>
      )
    case 'pushbutton6mm':
      return (
        <div className={common}>
          <wokwi-pushbutton-6mm color="red" />
        </div>
      )
    case 'slidePotentiometer':
      return (
        <div className={common} style={{ transform: 'scale(0.7)' }}>
          <wokwi-slide-potentiometer />
        </div>
      )
    case 'slideSwitch':
      return (
        <div className={common}>
          <wokwi-slide-switch />
        </div>
      )
    case 'photoresistor':
      return (
        <div className={common} style={{ transform: 'scale(0.6)' }}>
          <wokwi-photoresistor-sensor />
        </div>
      )
    case 'ntcTemperature':
      return (
        <div className={common} style={{ transform: 'scale(0.7)' }}>
          <wokwi-ntc-temperature-sensor />
        </div>
      )
    case 'tiltSwitch':
      return (
        <div className={common}>
          <wokwi-tilt-switch />
        </div>
      )
    case 'pirMotion':
      return (
        <div className={common} style={{ transform: 'scale(0.7)' }}>
          <wokwi-pir-motion-sensor />
        </div>
      )
    case 'rgbLed':
      return (
        <div className={common}>
          <wokwi-rgb-led />
        </div>
      )
    case 'ledBarGraph':
      return (
        <div className={common} style={{ transform: 'scale(0.7)' }}>
          <wokwi-led-bar-graph color="red" />
        </div>
      )
    case 'lcd2004':
      return (
        <div className={common} style={{ transform: 'scale(0.45)' }}>
          <wokwi-lcd2004 pins="i2c" />
        </div>
      )
    case 'dipSwitch8':
      return (
        <div className={common} style={{ transform: 'scale(0.8)' }}>
          <wokwi-dip-switch-8 />
        </div>
      )
    case 'analogJoystick':
      return (
        <div className={common} style={{ transform: 'scale(0.5)' }}>
          <wokwi-analog-joystick />
        </div>
      )
    default:
      return <div className={common}>?</div>
  }
}

export function AddComponentModal({ open, onClose }: Props) {
  const components = useAppStore((s) => s.components)
  const addComponent = useAppStore((s) => s.addComponent)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function pick(meta: (typeof PERIPHERAL_COMPONENTS)[number]) {
    const id = nextComponentId(meta.type, components)
    const peripherals = components.filter((c) => c.type !== 'uno')
    const { x, y } = nextSpawnPosition(peripherals.length)
    addComponent({
      id,
      type: meta.type,
      x,
      y,
      props: { ...meta.defaultProps },
    })
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Add component</h2>
            <p className="text-xs text-slate-500">
              Pick a part to drop on the canvas. You can wire it up after.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
          {PERIPHERAL_COMPONENTS.map((meta) => (
            <button
              key={meta.type}
              type="button"
              onClick={() => pick(meta)}
              className="group flex flex-col items-stretch rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
            >
              <Preview type={meta.type} />
              <div className="mt-2 text-sm font-semibold text-slate-800 group-hover:text-emerald-700">
                {meta.label}
              </div>
              <div className="mt-1 text-[11px] leading-snug text-slate-500">
                {DESCRIPTIONS[meta.type]}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
