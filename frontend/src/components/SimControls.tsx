import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { sendChatMessage } from '../agent/chat'
import { newSession } from '../lib/sessionId'
import { startSim, type SimHandle } from '../sim/runner'
import { resolveAllDrivePins, resolveAnalogChannel } from '../sim/wireTrace'
import type { DigitalPinLabel } from '../sim/pinState'
import { getBoard } from '../sim/boards'
import { postJson } from '../lib/api'
import { cn } from '../lib/cn'
import { SaveProjectDialog } from './SaveProjectDialog'
import { IconBolt, IconPlay, IconReset, IconSave, IconStop } from './Icons'

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

// Walk the live store for every DHT22 component and return the
// `dhtSensors` payload the runner expects: one entry per sensor whose
// data pin is wired to a digital pin. The getValues closure reads the
// live store every time the runner calls it, so dragging the panel
// sliders changes the very next library read.
function buildDhtSensorsFromStore(): Array<{
  pin: DigitalPinLabel
  getValues: () => { celsius: number; humidity: number }
}> {
  const state = useAppStore.getState()
  const out: Array<{
    pin: DigitalPinLabel
    getValues: () => { celsius: number; humidity: number }
  }> = []
  for (const c of state.components) {
    if (c.type !== 'dht22') continue
    const pins = resolveAllDrivePins(c.id, useAppStore.getState().wires)
    // wokwi-dht22 names the data pin "SDA" (it's a one-wire device,
    // but that is the label the SVG ships with).
    const dataPin = pins.SDA
    if (!dataPin) continue
    const componentId = c.id
    out.push({
      pin: dataPin,
      getValues: () => {
        const fresh = useAppStore.getState().components.find((x) => x.id === componentId)
        return {
          celsius: Number(fresh?.props.celsius ?? 22),
          humidity: Number(fresh?.props.humidity ?? 50),
        }
      },
    })
  }
  return out
}

// SSD1306 frame buffer bridge: copy the 128x64 monochrome buffer the
// runner produced into every wokwi-ssd1306 on the canvas. Done by
// addressing the element directly (it owns the canvas inside its
// shadow DOM); we bypass the store because pixel data is too big to
// JSON-stringify on every frame.
function pushOledPixels(pixels: Uint8Array): void {
  const oleds = document.querySelectorAll('wokwi-ssd1306') as NodeListOf<HTMLElement & {
    imageData?: ImageData
    redraw?: () => void
  }>
  for (const el of oleds) {
    const img = el.imageData
    if (!img) continue
    const data = img.data
    for (let i = 0; i < pixels.length; i++) {
      const lit = pixels[i]
      const off = i * 4
      data[off] = lit ? 255 : 0
      data[off + 1] = lit ? 255 : 0
      data[off + 2] = lit ? 255 : 0
      data[off + 3] = 255
    }
    el.redraw?.()
  }
}

interface CompileResponse {
  ok: boolean
  hex?: string
  stdout?: string
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
  const board = useAppStore((s) => s.board)
  const appendChatMessage = useAppStore((s) => s.appendChatMessage)
  const resetCircuit = useAppStore((s) => s.resetCircuit)
  const setCompileError = useAppStore((s) => s.setCompileError)
  const setLastCompile = useAppStore((s) => s.setLastCompile)
  const bumpAutoFix = useAppStore((s) => s.bumpAutoFix)
  const resetAutoFix = useAppStore((s) => s.resetAutoFix)
  const setRightTab = useAppStore((s) => s.setRightTab)
  const appendCompileLog = useAppStore((s) => s.appendCompileLog)
  const appendSerial = useAppStore((s) => s.appendSerial)
  const setBottomTab = useAppStore((s) => s.setBottomTab)
  const runRequest = useAppStore((s) => s.runRequest)
  const simRef = useRef<SimHandle | null>(null)
  const lastRunRef = useRef(0)
  const [saveOpen, setSaveOpen] = useState(false)

  useEffect(() => {
    return () => {
      simRef.current?.stop()
      simRef.current = null
    }
  }, [])

  // Tear down any running sim handle when the store flips to idle (a
  // new example was loaded, or the kid hit Reset). Without this, the
  // previous handle keeps ticking in the background and the next
  // Compile & run silently fights it for port listeners.
  useEffect(() => {
    if (simStatus === 'idle' && simRef.current) {
      simRef.current.stop()
      simRef.current = null
    }
  }, [simStatus])

  // When the agent finishes a build (its compile_and_run tool bumps runRequest),
  // compile the freshly generated C++ and start the simulator automatically.
  useEffect(() => {
    if (runRequest > 0 && runRequest !== lastRunRef.current) {
      lastRunRef.current = runRequest
      // Agent-triggered run: enable auto-fix so a compile error feeds back to
      // the agent for self-correction.
      void compile(true, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runRequest])

  // How many times the agent may auto-retry a failed compile before asking the
  // child for help (prevents an unfixable program from looping forever).
  const MAX_AUTO_FIX = 2

  function startWithCurrent() {
    if (simRef.current) return
    simRef.current = startSim(
      hexCode ? { kind: 'hex', hex: hexCode } : { kind: 'fallback' },
      {
        onPinChange: (snapshot) => setPinSnapshot(snapshot.levels, snapshot.activity),
        onSerialLine: (line) => appendSerial(line + '\n'),
        getAdcChannel: getAdcChannelFromStore,
        onLcdText: pushLcdText,
        onOledPixels: pushOledPixels,
        onPwmChange: (snap) => setPwmSnapshot(snap),
        dhtSensors: buildDhtSensorsFromStore(),
      },
      board,
    )
    setSimStatus('running')
  }

  async function compile(run: boolean, autoFix = false) {
    appendCompileLog('info', `POST /api/compile (${getBoard(board).fqbn})`)
    setBottomTab('compile')
    try {
      const resp = await postJson<CompileResponse>('/api/compile', {
        source: cppCode,
        source_kind: 'cpp',
        board,
      })
      if (resp.ok && resp.hex) {
        const bytes = Math.round(resp.hex.length / 2)
        appendCompileLog('success', `OK: HEX ready (~${bytes} bytes of program memory)`)
        if (resp.stdout && resp.stdout.trim()) appendCompileLog('info', resp.stdout.trim())
        if (resp.stderr && resp.stderr.trim()) appendCompileLog('warn', resp.stderr.trim())
        setHexCode(resp.hex)
        setCompileError(null)
        setLastCompile({ ok: true, error: '' })
        resetAutoFix()
        stopSim()
        if (run) {
          simRef.current = startSim(
            { kind: 'hex', hex: resp.hex },
            {
              onPinChange: (snapshot) => setPinSnapshot(snapshot.levels, snapshot.activity),
              onSerialLine: (line) => appendSerial(line + '\n'),
              getAdcChannel: getAdcChannelFromStore,
              onLcdText: pushLcdText,
              onOledPixels: pushOledPixels,
              onPwmChange: (snap) => setPwmSnapshot(snap),
              dhtSensors: buildDhtSensorsFromStore(),
            },
            board,
          )
          setSimStatus('running')
        } else {
          setSimStatus('stopped')
        }
      } else {
        const detail = resp.stderr || resp.error || 'unknown compile error'
        appendCompileLog('error', detail)
        if (resp.stdout && resp.stdout.trim()) appendCompileLog('info', resp.stdout.trim())
        setCompileError(detail)
        setLastCompile({ ok: false, error: detail })
        setRightTab('code')
        stopSim()
        const attempts = useAppStore.getState().autoFixAttempts
        if (autoFix && attempts < MAX_AUTO_FIX) {
          // Self-correct: feed the compiler error back to the agent so it fixes
          // the program and runs again, without the child having to ask. The
          // compile can finish while the agent is still streaming its turn, so
          // wait until it is idle before starting the fix turn (bounded).
          bumpAutoFix()
          sendWhenIdle(
            `The program did not compile. The Arduino compiler reported this error:\n\n${detail}\n\n` +
              'Please fix the program so it compiles, then run it again.',
            'The code had an error. Let me fix it and try again.',
          )
        } else {
          appendChatMessage({
            id: crypto.randomUUID(),
            role: 'system',
            text: autoFix
              ? 'I could not fix the code automatically. Tell me what it should do and I will try again.'
              : 'Compile failed. See the Compile output tab for the details.',
          })
          if (run) startWithCurrent()
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      appendCompileLog('error', `Request failed: ${msg}`)
      setCompileError(`Request failed: ${msg}`)
      setRightTab('code')
      appendChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        text: run
          ? `compile request failed: ${msg}. Running fallback blink.`
          : `compile request failed: ${msg}.`,
      })
      stopSim()
      if (run) startWithCurrent()
    }
  }

  // Send the auto-fix turn once the agent's current turn has finished streaming,
  // so we never run two turns on the same session at once. Bounded so it gives
  // up if the agent never goes idle.
  function sendWhenIdle(message: string, note: string, tries = 0) {
    if (useAppStore.getState().agentStatus !== 'streaming') {
      void sendChatMessage(message, undefined, { note })
    } else if (tries < 30) {
      window.setTimeout(() => sendWhenIdle(message, note, tries + 1), 300)
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
    // Start a fresh agent conversation so it does not try to remove parts that
    // the reset just cleared.
    newSession()
  }

  const isRunning = simStatus === 'running'

  return (
    <div className="flex items-center gap-1.5">
      {isRunning ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
          title="The simulation is running"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
          Running
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            simStatus === 'error' ? 'bg-rose-500' : 'bg-slate-300',
          )}
          title={`sim ${simStatus}`}
        />
      )}
      <button
        type="button"
        onClick={() => void compile(false)}
        title="Compile the current program to check it builds (does not run it)"
        className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
      >
        <IconBolt />
        Compile
      </button>
      <button
        type="button"
        onClick={() => void compile(true)}
        title={isRunning ? 'Re-compile and restart the simulation' : 'Compile the current program and run it in the simulator'}
        className={cn(
          'inline-flex items-center gap-2 rounded-md bg-brand-500 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600',
          isRunning && 'opacity-60',
        )}
      >
        <IconPlay />
        Compile &amp; run
      </button>
      <button
        type="button"
        onClick={stopSim}
        disabled={!isRunning}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-semibold shadow-sm',
          isRunning
            ? 'bg-rose-500 text-white hover:bg-rose-600'
            : 'cursor-not-allowed bg-slate-100 text-slate-400',
        )}
      >
        <IconStop />
        Stop
      </button>
      <button
        type="button"
        onClick={reset}
        title="Clear circuit, blocks, code, sim state"
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
      >
        <IconReset />
        Reset
      </button>
      <button
        type="button"
        onClick={() => setSaveOpen(true)}
        title="Save the current circuit as a named project"
        className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
      >
        <IconSave />
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
