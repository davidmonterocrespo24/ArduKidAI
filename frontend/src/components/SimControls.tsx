import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { startSim, type SimHandle } from '../sim/runner'
import { resolveAnalogChannel } from '../sim/wireTrace'
import { postJson } from '../lib/api'
import { cn } from '../lib/cn'
import { SaveProjectDialog } from './SaveProjectDialog'

// Walks the live store on every frame: any sensor whose analog output is
// wired to UNO.A<channel> contributes a voltage (0..5 V) on that ADC channel.
// Covers pots/slide-pots (raw 0..1023 / 1023 * 5), photoresistor (lux),
// and NTC temperature (mapped from -10..60 C to 0..5 V).
function getAdcChannelFromStore(channel: number): number {
  const state = useAppStore.getState()
  for (const c of state.components) {
    if (resolveAnalogChannel(c.id, state.wires) !== channel) continue
    if (c.type === 'potentiometer' || c.type === 'slidePotentiometer') {
      const raw = Number(c.props.value ?? 0)
      return clampVolts((raw / 1023) * 5)
    }
    if (c.type === 'photoresistor') {
      const lux = Number(c.props.lux ?? 500)
      return clampVolts((lux / 1023) * 5)
    }
    if (c.type === 'ntcTemperature') {
      // Map -10..60 C linearly onto 0..5 V — close enough for a kid
      // sketch that just calls analogRead and maps it back to Celsius.
      const c1 = Number(c.props.celsius ?? 22)
      const t = Math.max(-10, Math.min(60, c1))
      return clampVolts(((t + 10) / 70) * 5)
    }
    if (c.type === 'soundSensor' || c.type === 'smallSoundSensor') {
      const level = Number(c.props.level ?? 0)
      return clampVolts((level / 1023) * 5)
    }
    if (c.type === 'flameSensor') {
      const flame = Number(c.props.flame ?? 0)
      return clampVolts((flame / 1023) * 5)
    }
    if (c.type === 'gasSensor') {
      const gas = Number(c.props.gas ?? 0)
      return clampVolts((gas / 1023) * 5)
    }
    if (c.type === 'heartBeatSensor') {
      const pulse = Number(c.props.pulse ?? 100)
      return clampVolts((pulse / 1023) * 5)
    }
  }
  // Analog joystick exposes two outputs (VERT/HORZ) so resolveAnalogChannel
  // is not enough - VERT and HORZ may map to different ADC channels.
  // Route per-axis instead.
  for (const c of state.components) {
    if (c.type !== 'analogJoystick') continue
    if (channelMatchesPin(c.id, 'VERT', channel, state.wires)) {
      const raw = Number(c.props.yValue ?? 512)
      return clampVolts((raw / 1023) * 5)
    }
    if (channelMatchesPin(c.id, 'HORZ', channel, state.wires)) {
      const raw = Number(c.props.xValue ?? 512)
      return clampVolts((raw / 1023) * 5)
    }
  }
  return 0
}

function channelMatchesPin(
  componentId: string,
  pinName: string,
  channel: number,
  wires: Array<{ from_pin: string; to_pin: string }>,
): boolean {
  const ref = `${componentId}.${pinName}`
  for (const w of wires) {
    const other = w.from_pin === ref ? w.to_pin : w.to_pin === ref ? w.from_pin : null
    if (!other) continue
    const m = /^UNO\.A([0-5])$/.exec(other)
    if (m && parseInt(m[1], 10) === channel) return true
  }
  return false
}

function clampVolts(v: number): number {
  return Math.min(5, Math.max(0, v))
}

// I2C LCD bridge: every byte the sketch writes to address 0x27 is
// decoded by the HD44780 backpack inside the runner and surfaces here
// as the rendered text. We mirror it onto every lcd1602 on the canvas
// since real I2C only addresses one display at a time anyway.
function pushLcdText(text: string): void {
  const state = useAppStore.getState()
  for (const c of state.components) {
    if (c.type !== 'lcd1602' && c.type !== 'lcd2004') continue
    state.updateComponentProps(c.id, { text })
  }
}

interface CompileResponse {
  ok: boolean
  hex?: string
  stderr?: string
  error?: string
}

export function SimControls() {
  const setPinSnapshot = useAppStore((s) => s.setPinSnapshot)
  const setPwmSnapshot = useAppStore((s) => s.setPwmSnapshot)
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
        onSerialLine: (line) => appendSerial(line + '\n'),
        getAdcChannel: getAdcChannelFromStore,
        onLcdText: pushLcdText,
        onPwmChange: (snap) => setPwmSnapshot(snap),
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
            onSerialLine: (line) => appendSerial(line + '\n'),
            getAdcChannel: getAdcChannelFromStore,
            onLcdText: pushLcdText,
            onPwmChange: (snap) => setPwmSnapshot(snap),
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
