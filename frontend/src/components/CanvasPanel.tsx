import { useAppStore } from '../store/useAppStore'
import { DynamicComponent } from './DynamicComponent'

export function CanvasPanel() {
  const components = useAppStore((s) => s.components)
  const wires = useAppStore((s) => s.wires)
  const ledOn = useAppStore((s) => s.ledOn)
  const simStatus = useAppStore((s) => s.simStatus)

  const periphs = components.filter((c) => c.type !== 'uno')

  return (
    <section className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Circuit</h2>
        <span className="text-xs text-slate-500">
          {components.length} component{components.length === 1 ? '' : 's'} &middot; {wires.length} wire
          {wires.length === 1 ? '' : 's'}
        </span>
      </header>

      <div className="flex flex-1 overflow-auto p-6">
        <div className="flex w-full flex-col items-center gap-8">
          <div className="self-center">
            <wokwi-arduino-uno />
          </div>

          {periphs.length > 0 && (
            <div className="flex flex-wrap items-end justify-center gap-x-10 gap-y-6">
              {periphs.map((instance) => (
                <div key={instance.id} className="flex flex-col items-center gap-1">
                  <DynamicComponent instance={instance} />
                  <span className="text-xs font-mono text-slate-500">{instance.id}</span>
                </div>
              ))}
            </div>
          )}

          {components.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 px-6 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
              Ask the agent to build something. Try "I want a traffic light".
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
        LED state: <span className="font-mono">{ledOn ? 'ON' : 'OFF'}</span>
        <span className="mx-2 text-slate-300">|</span>
        sim: <span className="font-mono">{simStatus}</span>
        {wires.length > 0 && (
          <>
            <span className="mx-2 text-slate-300">|</span>
            wires:{' '}
            <span className="font-mono">
              {wires
                .slice(0, 3)
                .map((w) => `${w.from_pin}->${w.to_pin}`)
                .join(', ')}
              {wires.length > 3 ? ` ... +${wires.length - 3}` : ''}
            </span>
          </>
        )}
      </footer>
    </section>
  )
}
