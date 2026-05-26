import { useEffect, useRef, useState } from 'react'
import type { ComponentInstance } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'
import { resolveAnalogChannel, resolveDrivePin } from '../sim/wireTrace'
import { driveInputPin } from '../sim/inputBridge'

interface Props {
  instance: ComponentInstance
}

/**
 * Tiny "control" popover shown next to a sensor while the sim is running.
 * For a potentiometer the kid can slide the knob 0..1023. For a pushbutton
 * we offer "Hold" (sticky LOW) and "Pulse" (LOW for 200 ms). Components
 * with no live input (LEDs, LCDs, ...) do not render this control at all.
 */
export function SensorControl({ instance }: Props) {
  const updateComponentProps = useAppStore((s) => s.updateComponentProps)
  const wires = useAppStore((s) => s.wires)
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!popRef.current) return
      if (!popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const hasControl = [
    'potentiometer',
    'slidePotentiometer',
    'pushbutton',
    'pushbutton6mm',
    'photoresistor',
    'ntcTemperature',
    'tiltSwitch',
    'pirMotion',
    'slideSwitch',
    'dipSwitch8',
    'analogJoystick',
    'soundSensor',
    'smallSoundSensor',
    'flameSensor',
    'gasSensor',
    'heartBeatSensor',
    'rotaryEncoder',
  ].includes(instance.type)
  if (!hasControl) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Control sensor"
        className="rounded border border-brand-300 bg-white/90 px-1.5 text-[10px] font-medium text-brand-700 transition hover:bg-brand-50"
      >
        control
      </button>
      {open ? (
        <div
          ref={popRef}
          className="absolute left-1/2 top-full z-50 mt-1 w-44 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
        >
          {instance.type === 'potentiometer' || instance.type === 'slidePotentiometer' ? (
            <PotControl
              instance={instance}
              wires={wires}
              onChange={(v) => updateComponentProps(instance.id, { value: v })}
            />
          ) : null}
          {instance.type === 'pushbutton' || instance.type === 'pushbutton6mm' ? (
            <ButtonControl instance={instance} wires={wires} />
          ) : null}
          {instance.type === 'photoresistor' ? (
            <SliderControl
              label="Light (lux)"
              min={0}
              max={1023}
              value={Number(instance.props.lux ?? 500)}
              onChange={(v) => updateComponentProps(instance.id, { lux: v })}
              wires={wires}
              componentId={instance.id}
            />
          ) : null}
          {instance.type === 'ntcTemperature' ? (
            <SliderControl
              label="Temperature (C)"
              min={-10}
              max={60}
              value={Number(instance.props.celsius ?? 22)}
              onChange={(v) => updateComponentProps(instance.id, { celsius: v })}
              wires={wires}
              componentId={instance.id}
              unit=" C"
            />
          ) : null}
          {instance.type === 'tiltSwitch' ? (
            <BoolControl
              label="Tilted"
              value={Boolean(instance.props.tilted)}
              onChange={(v) => {
                updateComponentProps(instance.id, { tilted: v })
                const pin = resolveDrivePin(instance.id, wires)
                if (pin) driveInputPin(pin, v)
              }}
            />
          ) : null}
          {instance.type === 'pirMotion' ? (
            <PirControl instance={instance} wires={wires} />
          ) : null}
          {instance.type === 'slideSwitch' ? (
            <SlidePositionControl
              value={Number(instance.props.value ?? 1)}
              onChange={(v) => updateComponentProps(instance.id, { value: v })}
            />
          ) : null}
          {instance.type === 'dipSwitch8' ? (
            <DipSwitchControl
              values={(instance.props.values as number[] | undefined) ?? [0,0,0,0,0,0,0,0]}
              onChange={(v) => updateComponentProps(instance.id, { values: v })}
            />
          ) : null}
          {instance.type === 'analogJoystick' ? (
            <JoystickControl
              xValue={Number(instance.props.xValue ?? 512)}
              yValue={Number(instance.props.yValue ?? 512)}
              pressed={Boolean(instance.props.pressed)}
              onChange={(p) => updateComponentProps(instance.id, p)}
            />
          ) : null}
          {instance.type === 'soundSensor' || instance.type === 'smallSoundSensor' ? (
            <SliderControl
              label="Sound"
              min={0}
              max={1023}
              value={Number(instance.props.level ?? 0)}
              onChange={(v) => updateComponentProps(instance.id, { level: v })}
              wires={wires}
              componentId={instance.id}
            />
          ) : null}
          {instance.type === 'gasSensor' ? (
            <SliderControl
              label="Gas"
              min={0}
              max={1023}
              value={Number(instance.props.gas ?? 0)}
              onChange={(v) => updateComponentProps(instance.id, { gas: v })}
              wires={wires}
              componentId={instance.id}
            />
          ) : null}
          {instance.type === 'heartBeatSensor' ? (
            <SliderControl
              label="BPM"
              min={30}
              max={180}
              value={Number(instance.props.bpm ?? 60)}
              onChange={(v) => updateComponentProps(instance.id, { bpm: v })}
              wires={wires}
              componentId={instance.id}
            />
          ) : null}
          {instance.type === 'flameSensor' ? (
            <SliderControl
              label="Flame"
              min={0}
              max={1023}
              value={Number(instance.props.flame ?? 0)}
              onChange={(v) => updateComponentProps(instance.id, { flame: v })}
              wires={wires}
              componentId={instance.id}
            />
          ) : null}
          {instance.type === 'rotaryEncoder' ? (
            <RotaryControl
              instance={instance}
              wires={wires}
              onChange={(p) => updateComponentProps(instance.id, p)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PotControl({
  instance,
  wires,
  onChange,
}: {
  instance: ComponentInstance
  wires: { from_pin: string; to_pin: string }[]
  onChange: (v: number) => void
}) {
  const value = Number(instance.props.value ?? 0)
  const channel = resolveAnalogChannel(instance.id, wires)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-slate-600">
        <span className="font-medium">Knob</span>
        <span className="font-mono">
          {Math.round(value)} {channel !== null ? `(A${channel})` : '(not wired)'}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1023}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>0 V</span>
        <span>5 V</span>
      </div>
    </div>
  )
}

function SliderControl({
  label,
  min,
  max,
  value,
  onChange,
  wires,
  componentId,
  unit = '',
}: {
  label: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  wires: { from_pin: string; to_pin: string }[]
  componentId: string
  unit?: string
}) {
  const channel = resolveAnalogChannel(componentId, wires)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-slate-600">
        <span className="font-medium">{label}</span>
        <span className="font-mono">
          {Math.round(value)}{unit} {channel !== null ? `(A${channel})` : '(not wired)'}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

function BoolControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-700">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={
          value
            ? 'rounded border border-brand-400 bg-brand-500 px-2.5 py-1 text-white hover:bg-brand-600'
            : 'rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50'
        }
      >
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

function PirControl({
  instance,
  wires,
}: {
  instance: ComponentInstance
  wires: { from_pin: string; to_pin: string }[]
}) {
  const pin = resolveDrivePin(instance.id, wires)
  const updateComponentProps = useAppStore((s) => s.updateComponentProps)
  function trigger() {
    if (!pin) return
    driveInputPin(pin, true)
    updateComponentProps(instance.id, { triggered: true })
    window.setTimeout(() => {
      driveInputPin(pin, false)
      updateComponentProps(instance.id, { triggered: false })
    }, 800)
  }
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-700">
      <span className="font-medium">
        Motion {pin ? `(${pin})` : '(not wired)'}
      </span>
      <button
        type="button"
        onClick={trigger}
        disabled={!pin}
        className="rounded border border-brand-300 bg-brand-500 px-2.5 py-1 text-white hover:bg-brand-600 disabled:opacity-40"
      >
        Trigger
      </button>
    </div>
  )
}

function SlidePositionControl({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1 text-[10px] text-slate-700">
      <span className="font-medium">Position</span>
      <div className="flex gap-1">
        {[1, 2, 3].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={
              value === p
                ? 'flex-1 rounded border border-brand-400 bg-brand-500 px-2 py-1 text-white'
                : 'flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50'
            }
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

function DipSwitchControl({
  values,
  onChange,
}: {
  values: number[]
  onChange: (v: number[]) => void
}) {
  return (
    <div className="flex flex-col gap-1 text-[10px] text-slate-700">
      <span className="font-medium">DIP switches</span>
      <div className="flex justify-between gap-0.5">
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              const next = [...values]
              next[i] = v === 1 ? 0 : 1
              onChange(next)
            }}
            className={
              v === 1
                ? 'h-6 w-5 rounded-sm border border-brand-400 bg-brand-500 text-[9px] font-mono text-white'
                : 'h-6 w-5 rounded-sm border border-slate-300 bg-white text-[9px] font-mono text-slate-700 hover:bg-slate-50'
            }
            title={`Switch ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

function JoystickControl({
  xValue,
  yValue,
  pressed,
  onChange,
}: {
  xValue: number
  yValue: number
  pressed: boolean
  onChange: (p: { xValue?: number; yValue?: number; pressed?: boolean }) => void
}) {
  return (
    <div className="flex flex-col gap-1 text-[10px] text-slate-700">
      <div className="flex items-center justify-between font-medium">
        <span>X (HORZ)</span>
        <span className="font-mono">{xValue}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1023}
        value={xValue}
        onChange={(e) => onChange({ xValue: Number(e.target.value) })}
        className="w-full accent-brand-600"
      />
      <div className="flex items-center justify-between font-medium">
        <span>Y (VERT)</span>
        <span className="font-mono">{yValue}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1023}
        value={yValue}
        onChange={(e) => onChange({ yValue: Number(e.target.value) })}
        className="w-full accent-brand-600"
      />
      <div className="flex items-center justify-between pt-1">
        <span className="font-medium">Button</span>
        <button
          type="button"
          onClick={() => onChange({ pressed: !pressed })}
          className={
            pressed
              ? 'rounded border border-brand-400 bg-brand-500 px-2.5 py-1 text-white'
              : 'rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50'
          }
        >
          {pressed ? 'PRESSED' : 'Release'}
        </button>
      </div>
    </div>
  )
}

function RotaryControl({
  instance,
  wires,
  onChange,
}: {
  instance: ComponentInstance
  wires: { from_pin: string; to_pin: string }[]
  onChange: (p: { angle?: number; pressed?: boolean }) => void
}) {
  const angle = Number(instance.props.angle ?? 0)
  const pressed = Boolean(instance.props.pressed)
  const swPin = resolveDrivePin(`${instance.id}.SW` as never, wires) // ignored, just for label
  void swPin
  return (
    <div className="flex flex-col gap-1 text-[10px] text-slate-700">
      <div className="flex items-center justify-between">
        <span className="font-medium">Encoder</span>
        <span className="font-mono">{angle}</span>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange({ angle: angle - 1 })}
          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
        >
          - turn
        </button>
        <button
          type="button"
          onClick={() => onChange({ angle: angle + 1 })}
          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
        >
          + turn
        </button>
      </div>
      <button
        type="button"
        onMouseDown={() => onChange({ pressed: true })}
        onMouseUp={() => onChange({ pressed: false })}
        onMouseLeave={() => pressed && onChange({ pressed: false })}
        className={
          pressed
            ? 'rounded border border-rose-400 bg-rose-500 px-2 py-1 text-white'
            : 'rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50'
        }
      >
        Press knob (SW)
      </button>
    </div>
  )
}

function ButtonControl({
  instance,
  wires,
}: {
  instance: ComponentInstance
  wires: { from_pin: string; to_pin: string }[]
}) {
  const pin = resolveDrivePin(instance.id, wires)
  const [held, setHeld] = useState(false)

  function toggleHold() {
    if (!pin) return
    const next = !held
    setHeld(next)
    driveInputPin(pin, !next)
  }

  function pulse() {
    if (!pin) return
    driveInputPin(pin, false)
    window.setTimeout(() => driveInputPin(pin, true), 200)
  }

  return (
    <div className="flex flex-col gap-2 text-[10px] text-slate-700">
      <div className="flex items-center justify-between">
        <span className="font-medium">Button</span>
        <span className="font-mono">{pin ?? 'not wired'}</span>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={pulse}
          disabled={!pin}
          className="flex-1 rounded border border-brand-300 bg-brand-50 px-1.5 py-1 text-[10px] font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
        >
          Pulse
        </button>
        <button
          type="button"
          onClick={toggleHold}
          disabled={!pin}
          className={
            held
              ? 'flex-1 rounded border border-rose-400 bg-rose-500 px-1.5 py-1 text-[10px] font-medium text-white transition hover:bg-rose-600 disabled:opacity-40'
              : 'flex-1 rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40'
          }
        >
          {held ? 'Release' : 'Hold'}
        </button>
      </div>
    </div>
  )
}
