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
  buzzer: 'Piezo speaker. Drive it with tone() to play notes.',
  servo: 'SG90 hobby servo. Set an angle 0-180 with Servo.write().',
  potentiometer: 'Rotary knob (0..1023 on an analog pin).',
  lcd1602: '16x2 character LCD over I2C. Wire to A4/A5 + 5V/GND.',
  seg7: 'Single-digit common-cathode 7-segment. Drives A..G + DP.',
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
