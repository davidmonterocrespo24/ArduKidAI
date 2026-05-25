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

  const hasControl =
    instance.type === 'potentiometer' || instance.type === 'pushbutton'
  if (!hasControl) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Control sensor"
        className="rounded border border-emerald-300 bg-white/90 px-1.5 text-[10px] font-medium text-emerald-700 transition hover:bg-emerald-50"
      >
        control
      </button>
      {open ? (
        <div
          ref={popRef}
          className="absolute left-1/2 top-full z-50 mt-1 w-44 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
        >
          {instance.type === 'potentiometer' ? (
            <PotControl
              instance={instance}
              wires={wires}
              onChange={(v) => updateComponentProps(instance.id, { value: v })}
            />
          ) : null}
          {instance.type === 'pushbutton' ? (
            <ButtonControl instance={instance} wires={wires} />
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
        className="w-full accent-emerald-600"
      />
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>0 V</span>
        <span>5 V</span>
      </div>
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
          className="flex-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-[10px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
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
