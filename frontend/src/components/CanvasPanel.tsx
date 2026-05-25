import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

function Led({ on, color = 'red' }: { on: boolean; color?: string }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (ref.current) {
      // wokwi-led exposes `value` as a boolean property; set it directly so
      // React does not coerce it to a string attribute.
      ;(ref.current as unknown as { value: boolean }).value = on
    }
  }, [on])
  return <wokwi-led ref={ref} color={color} />
}

export function CanvasPanel() {
  const ledOn = useAppStore((s) => s.ledOn)
  const simStatus = useAppStore((s) => s.simStatus)

  return (
    <section className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Circuit</h2>
        <span className="text-xs text-slate-500">
          Hardcoded scene (phase 1): UNO + LED on pin 13 + pushbutton on pin 2
        </span>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-auto p-6">
        <div className="relative inline-block">
          <wokwi-arduino-uno />

          <div
            className="absolute"
            style={{ top: '-72px', left: '210px' }}
            aria-label="LED on pin 13"
          >
            <Led on={ledOn} color="red" />
          </div>

          <div
            className="absolute"
            style={{ top: '-40px', left: '170px' }}
            aria-label="220 ohm resistor"
          >
            <wokwi-resistor value="220" />
          </div>

          <div
            className="absolute"
            style={{ top: '-72px', left: '320px' }}
            aria-label="Pushbutton on pin 2"
          >
            <wokwi-pushbutton color="blue" />
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
        LED state: <span className="font-mono">{ledOn ? 'ON' : 'OFF'}</span> &middot;
        sim: <span className="font-mono">{simStatus}</span>
      </footer>
    </section>
  )
}
