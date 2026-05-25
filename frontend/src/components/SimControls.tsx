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

export function SimControls() {
  const setPinSnapshot = useAppStore((s) => s.setPinSnapshot)
  const setLedOn = useAppStore((s) => s.setLedOn)
  const simStatus = useAppStore((s) => s.simStatus)
  const setSimStatus = useAppStore((s) => s.setSimStatus)
  const hexCode = useAppStore((s) => s.hexCode)
  const setHexCode = useAppStore((s) => s.setHexCode)
  const cppCode = useAppStore((s) => s.cppCode)
  const appendChatMessage = useAppStore((s) => s.appendChatMessage)
  const resetCircuit = useAppStore((s) => s.resetCircuit)
  const setCompileError = useAppStore((s) => s.setCompileError)
  const setRightTab = useAppStore((s) => s.setRightTab)
  const appendCompileLog = useAppStore((s) => s.appendCompileLog)
  const appendSerial = useAppStore((s) => s.appendSerial)
  const setBottomTab = useAppStore((s) => s.setBottomTab)
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
      {
        onPinChange: (snapshot) => setPinSnapshot(snapshot.levels, snapshot.activity),
        onSerialLine: (line) => appendSerial(line),
      },
    )
    setSimStatus('running')
  }

  async function compileAndRun() {
    appendCompileLog('info', 'POST /api/compile (arduino:avr:uno)')
    setBottomTab('compile')
    try {
      const resp = await postJson<CompileResponse>('/api/compile', {
        source: cppCode,
        source_kind: 'cpp',
      })
      if (resp.ok && resp.hex) {
        const bytes = Math.round(resp.hex.length / 2)
        appendCompileLog('success', `OK: HEX ready (~${bytes} bytes of program memory)`)
        if (resp.stderr) appendCompileLog('info', resp.stderr.trim())
        setHexCode(resp.hex)
        setCompileError(null)
        stopSim()
        simRef.current = startSim(
          { kind: 'hex', hex: resp.hex },
          {
            onPinChange: (snapshot) => setPinSnapshot(snapshot.levels, snapshot.activity),
            onSerialLine: (line) => appendSerial(line),
          },
        )
        setSimStatus('running')
      } else {
        const detail = resp.stderr || resp.error || 'unknown compile error'
        appendCompileLog('error', detail)
        setCompileError(detail)
        setRightTab('code')
        appendChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          text: 'Compile failed. See the Compile output tab for the details. Running the fallback blink.',
        })
        stopSim()
        startWithCurrent()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      appendCompileLog('error', `Request failed: ${msg}`)
      setCompileError(`Request failed: ${msg}`)
      setRightTab('code')
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
  const statusDot =
    simStatus === 'running'
      ? 'bg-emerald-500'
      : simStatus === 'error'
      ? 'bg-rose-500'
      : 'bg-slate-300'

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 rounded-full', statusDot)}
        title={`sim ${simStatus}`}
      />
      <button
        type="button"
        onClick={() => (hexCode ? startWithCurrent() : compileAndRun())}
        disabled={isRunning}
        title="Run the loaded program (or compile first if needed)"
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium text-white',
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
        title="POST current C++ to /api/compile and load the returned HEX"
        className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
      >
        Compile &amp; run
      </button>
      <button
        type="button"
        onClick={stopSim}
        disabled={!isRunning}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium',
          isRunning
            ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
            : 'cursor-not-allowed bg-slate-100 text-slate-400',
        )}
      >
        Stop
      </button>
      <button
        type="button"
        onClick={reset}
        title="Clear circuit, blocks, code, sim state"
        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={() => setSaveOpen(true)}
        title="Save the current circuit as a named project"
        className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
      >
        Save
      </button>

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
    </div>
  )
}
