import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { startBlinkSim, type SimHandle } from '../sim/runner'
import { cn } from '../lib/cn'

export function FooterBar() {
  const setLedOn = useAppStore((s) => s.setLedOn)
  const simStatus = useAppStore((s) => s.simStatus)
  const setSimStatus = useAppStore((s) => s.setSimStatus)
  const simRef = useRef<SimHandle | null>(null)

  useEffect(() => {
    return () => {
      simRef.current?.stop()
      simRef.current = null
    }
  }, [])

  function run() {
    if (simRef.current) return
    simRef.current = startBlinkSim((on) => setLedOn(on))
    setSimStatus('running')
  }

  function stop() {
    simRef.current?.stop()
    simRef.current = null
    setSimStatus('stopped')
    setLedOn(false)
  }

  function reset() {
    stop()
    setSimStatus('idle')
  }

  const isRunning = simStatus === 'running'

  return (
    <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">
        Simulator: <span className="font-mono">{simStatus}</span>
        <span className="mx-2 text-slate-300">|</span>
        Program: <span className="font-mono">hardcoded blink (PB5 toggle)</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={isRunning}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium text-white',
            isRunning
              ? 'cursor-not-allowed bg-emerald-500/50'
              : 'bg-emerald-500 hover:bg-emerald-600',
          )}
        >
          Run
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!isRunning}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            isRunning
              ? 'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
              : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600',
          )}
        >
          Stop
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Reset
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-400 dark:border-slate-700"
          title="Save lands in phase 4 (MongoDB)"
        >
          Save
        </button>
      </div>
    </footer>
  )
}
