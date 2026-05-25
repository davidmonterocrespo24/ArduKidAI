import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { startSim, type SimHandle } from '../sim/runner'
import { postJson } from '../lib/api'
import { cn } from '../lib/cn'
import { SaveProjectDialog } from './SaveProjectDialog'

interface CompileResponse {
  ok: boolean
  hex?: string
  stderr?: string
  error?: string
}

export function FooterBar() {
  const setLedOn = useAppStore((s) => s.setLedOn)
  const simStatus = useAppStore((s) => s.simStatus)
  const setSimStatus = useAppStore((s) => s.setSimStatus)
  const hexCode = useAppStore((s) => s.hexCode)
  const setHexCode = useAppStore((s) => s.setHexCode)
  const cppCode = useAppStore((s) => s.cppCode)
  const appendChatMessage = useAppStore((s) => s.appendChatMessage)
  const resetCircuit = useAppStore((s) => s.resetCircuit)
  const simRef = useRef<SimHandle | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  useEffect(() => {
    return () => {
      simRef.current?.stop()
      simRef.current = null
    }
  }, [])

  function startWithCurrent() {
    if (simRef.current) return
    simRef.current = startSim(
      hexCode ? { kind: 'hex', hex: hexCode } : { kind: 'fallback' },
      (on) => setLedOn(on),
    )
    setSimStatus('running')
  }

  async function compileAndRun() {
    try {
      const resp = await postJson<CompileResponse>('/api/compile', {
        source: cppCode,
        source_kind: 'cpp',
      })
      if (resp.ok && resp.hex) {
        setHexCode(resp.hex)
        stopSim()
        simRef.current = startSim({ kind: 'hex', hex: resp.hex }, (on) => setLedOn(on))
        setSimStatus('running')
      } else {
        appendChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          text: `compile failed: ${resp.error ?? resp.stderr ?? 'unknown'}. Running fallback blink.`,
        })
        stopSim()
        startWithCurrent()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      appendChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        text: `compile request failed: ${msg}. Running fallback blink.`,
      })
      stopSim()
      startWithCurrent()
    }
  }

  function stopSim() {
    simRef.current?.stop()
    simRef.current = null
    setSimStatus('stopped')
    setLedOn(false)
  }

  function reset() {
    stopSim()
    setSimStatus('idle')
    resetCircuit()
  }

  const isRunning = simStatus === 'running'

  return (
    <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">
        Simulator: <span className="font-mono">{simStatus}</span>
        <span className="mx-2 text-slate-300">|</span>
        Program: <span className="font-mono">{hexCode ? 'compiled HEX' : 'fallback blink'}</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => (hexCode ? startWithCurrent() : compileAndRun())}
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
          onClick={() => void compileAndRun()}
          disabled={isRunning}
          className="rounded-md border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
        >
          Compile & run
        </button>
        <button
          type="button"
          onClick={stopSim}
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
          onClick={() => setSaveOpen(true)}
          className="rounded-md border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
        >
          Save
        </button>
      </div>

      <SaveProjectDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSaved={(_, name) =>
          appendChatMessage({
            id: crypto.randomUUID(),
            role: 'system',
            text: `Saved project "${name}".`,
          })
        }
      />
    </footer>
  )
}
