/**
 * ArduKid's A2UI component catalog.
 *
 * A2UI (the Agent-to-User-Interface project, github.com/a2ui-project/a2ui) lets
 * the agent "speak UI": it sends a declarative JSON description of a panel and
 * the client renders it with its OWN trusted components. No agent code runs in
 * the browser - the agent can only ask for components that live in this catalog.
 *
 * We take the official basic catalog (Card / Column / Text / Image / Button ...)
 * from `@a2ui/react` and add two ArduKid-specific components a tutor needs:
 *   - `CircuitBoard` - the SAME wokwi Arduino element the circuit canvas renders,
 *     with the pins the lesson is about lit up, so the agent can literally point
 *     at "pin 13" on the real board while it talks.
 *   - `QuizCard` - a self-contained multiple-choice question that grades the
 *     child's answer on the spot and reports it back to the agent.
 *
 * The agent emits A2UI v0.9 messages (createSurface / updateComponents) that
 * reference these by name; see backend `services/a2ui_build.py`.
 */
/* eslint-disable react-refresh/only-export-components -- this is a component
   catalog: it intentionally exports both the A2UI components and the assembled
   `arduKidCatalog`. Fast-refresh granularity does not matter for this lazy chunk. */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { basicCatalog, createComponentImplementation } from '@a2ui/react/v0_9'
import { Catalog, CommonSchemas } from '@a2ui/web_core/v0_9'
import { z } from 'zod'
import { DynamicComponent } from '../components/DynamicComponent'
import type { ComponentType } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'

/** The id the agent must put in `createSurface.catalogId`. Keep in sync with
 *  backend `a2ui_build.TUTOR_CATALOG_ID`. */
export const TUTOR_CATALOG_ID = 'https://ardukid.app/catalogs/tutor/v1'

// --- CircuitBoard ----------------------------------------------------------
// Renders the same `@wokwi/elements` board the canvas uses (registered globally
// in main.tsx) and overlays a glowing dot on each highlighted pin, read from the
// element's own `pinInfo` coordinates - so the diagram is pixel-accurate to the
// real part, not a redrawing of it.

interface PinInfo {
  name: string
  x: number
  y: number
}

const BOARD_TAGS: Record<string, string> = {
  uno: 'wokwi-arduino-uno',
  nano: 'wokwi-arduino-nano',
  mega: 'wokwi-arduino-mega',
}

/** Reduce any pin reference - a wokwi name ("13", "GND.2", "A4.2"), a request
 *  ("D13", "gnd", "5v"), or a wired ref ("UNO.D13") - to one comparable token. */
function pinToken(raw: string): string {
  let p = String(raw).trim()
  const dot = p.indexOf('.')
  if (dot >= 0) {
    const head = p.slice(0, dot)
    const tail = p.slice(dot + 1)
    if (/^gnd$/i.test(head)) return 'GND' // GND.1 / GND.2 / GND.3
    if (/^[a-z]+$/i.test(head) && !/^\d/.test(tail)) p = tail // UNO.D13 / UNO.GND
    else p = head // A4.2 -> A4
  }
  if (/^gnd/i.test(p)) return 'GND'
  if (/^\d+$/.test(p)) return `D${p}` // wokwi digital pins are bare "13"
  if (/^d\d+$/i.test(p)) return p.toUpperCase() // request "D13"
  if (/^3\.?3v?$/i.test(p) || /^3v3$/i.test(p)) return '3V3'
  return p.toUpperCase()
}

const CircuitBoardApi = {
  name: 'CircuitBoard',
  schema: z.object({
    caption: CommonSchemas.DynamicString.optional(),
    board: CommonSchemas.DynamicString.optional(),
    highlightPins: CommonSchemas.DynamicStringList.optional(),
  }),
}

export const CircuitBoard = createComponentImplementation(CircuitBoardApi, ({ props }) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLElement>(null)
  const [pins, setPins] = useState<PinInfo[]>([])
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(1)

  const tag = BOARD_TAGS[String(props.board ?? 'uno')] ?? BOARD_TAGS.uno

  const wanted = useMemo(() => {
    const list = Array.isArray(props.highlightPins) ? props.highlightPins : []
    return new Set(list.map((p) => pinToken(String(p))))
  }, [props.highlightPins])

  // The wokwi element upgrades asynchronously; poll a few frames for its pin
  // coordinates and intrinsic size.
  useEffect(() => {
    let tries = 0
    let raf = 0
    const read = () => {
      const el = boardRef.current as unknown as { pinInfo?: PinInfo[] } | null
      const rect = boardRef.current?.getBoundingClientRect()
      if (el?.pinInfo && Array.isArray(el.pinInfo) && rect && rect.width > 0) {
        setPins(el.pinInfo.map((p) => ({ name: p.name, x: p.x, y: p.y })))
        setSize({ w: rect.width, h: rect.height })
        return
      }
      if (tries++ < 30) raf = requestAnimationFrame(read)
    }
    read()
    return () => cancelAnimationFrame(raf)
  }, [tag])

  // Scale the board (and its overlay together) down to fit the chat column.
  useLayoutEffect(() => {
    if (!size) return
    const fit = () => {
      const avail = wrapRef.current?.clientWidth ?? size.w
      setScale(Math.min(1, avail / size.w))
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [size])

  const highlights = useMemo(
    () => pins.filter((p) => wanted.has(pinToken(p.name))),
    [pins, wanted],
  )

  return (
    <figure className="m-0 w-full">
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden"
        style={size ? { height: size.h * scale } : undefined}
      >
        <div className="absolute left-0 top-0" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {tag === 'wokwi-arduino-nano' ? (
            <wokwi-arduino-nano ref={boardRef} />
          ) : tag === 'wokwi-arduino-mega' ? (
            <wokwi-arduino-mega ref={boardRef} />
          ) : (
            <wokwi-arduino-uno ref={boardRef} />
          )}
          {size && highlights.length > 0 ? (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={size.w}
              height={size.h}
              aria-hidden="true"
            >
              <defs>
                <filter id="ak-pin-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="3.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {highlights.map((p, i) => (
                <circle
                  key={`${p.name}-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill="#ffd23f"
                  stroke="#ff8a00"
                  strokeWidth={3}
                  filter="url(#ak-pin-glow)"
                >
                  <animate attributeName="r" values="6.5;10;6.5" dur="1.4s" repeatCount="indefinite" />
                </circle>
              ))}
            </svg>
          ) : null}
        </div>
      </div>
      {props.caption ? (
        <figcaption className="mt-1 text-center text-sm text-slate-600">{String(props.caption)}</figcaption>
      ) : null}
    </figure>
  )
})

// --- CircuitPart -----------------------------------------------------------
// Renders a single real component the same way the canvas does (the exact wokwi
// SVG via DynamicComponent), scaled to fit, so the agent can show "this is a
// resistor" / "this is a push button" with the genuine part, not a drawing.

/** Plain renderer for one real wokwi part (same SVG as the canvas), scaled to
 *  fit its container. Shared by CircuitPart and the flashcards. */
function PartView({
  type,
  color,
  text,
  maxScale = 1.6,
}: {
  type: string
  color?: string
  text?: string
  maxScale?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(1)
  // A unique DOM id so a tutor part never collides with a real canvas component
  // (wokwi elements register by id).
  const domId = `tut-part-${useId().replace(/:/g, '')}`

  const instance = useMemo(() => {
    const partProps: Record<string, unknown> = {}
    if (color) partProps.color = color
    if (text) partProps.text = text
    return { id: domId, type: type as ComponentType, x: 0, y: 0, props: partProps }
  }, [type, color, text, domId])

  useEffect(() => {
    let tries = 0
    let raf = 0
    const read = () => {
      const el = holderRef.current?.firstElementChild as HTMLElement | null
      const rect = el?.getBoundingClientRect()
      if (rect && rect.width > 0) {
        setSize({ w: rect.width, h: rect.height })
        return
      }
      if (tries++ < 30) raf = requestAnimationFrame(read)
    }
    read()
    return () => cancelAnimationFrame(raf)
  }, [instance.type])

  useLayoutEffect(() => {
    if (!size) return
    const fit = () => {
      const avail = wrapRef.current?.clientWidth ?? size.w
      // Fit wide parts (LCD) to the column but never blow up small ones (LED).
      setScale(Math.min(maxScale, avail / size.w))
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [size, maxScale])

  return (
    <div
      ref={wrapRef}
      className="relative flex w-full justify-center overflow-hidden"
      style={size ? { height: size.h * scale } : undefined}
    >
      <div
        ref={holderRef}
        className="absolute left-1/2 top-0"
        style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' }}
      >
        <DynamicComponent instance={instance} />
      </div>
    </div>
  )
}

const CircuitPartApi = {
  name: 'CircuitPart',
  schema: z.object({
    part: CommonSchemas.DynamicString,
    label: CommonSchemas.DynamicString.optional(),
    caption: CommonSchemas.DynamicString.optional(),
    color: CommonSchemas.DynamicString.optional(),
    text: CommonSchemas.DynamicString.optional(),
  }),
}

export const CircuitPart = createComponentImplementation(CircuitPartApi, ({ props }) => (
  <figure className="m-0 flex flex-col items-center">
    <PartView
      type={String(props.part ?? '')}
      color={props.color ? String(props.color) : undefined}
      text={props.text ? String(props.text) : undefined}
    />
    {props.label ? (
      <figcaption className="mt-1 text-center text-sm font-semibold text-slate-700">
        {String(props.label)}
      </figcaption>
    ) : null}
    {props.caption ? (
      <p className="mt-0.5 text-center text-xs text-slate-500">{String(props.caption)}</p>
    ) : null}
  </figure>
))

// --- QuizCard --------------------------------------------------------------

const QuizCardApi = {
  name: 'QuizCard',
  schema: z.object({
    question: CommonSchemas.DynamicString,
    options: CommonSchemas.DynamicStringList,
    answerIndex: CommonSchemas.DynamicNumber,
    explanation: CommonSchemas.DynamicString.optional(),
  }),
}

export const QuizCard = createComponentImplementation(QuizCardApi, ({ props, context }) => {
  const [picked, setPicked] = useState<number | null>(null)
  const options = Array.isArray(props.options) ? props.options.map(String) : []
  const answer = Number(props.answerIndex)
  const revealed = picked !== null
  const correct = picked === answer

  function choose(i: number) {
    if (revealed) return
    setPicked(i)
    // Tell the agent how it went so it can react in chat (A2UI's two-way street).
    // The renderer turns this `event` into a client action -> our tutor handler.
    void context.dispatchAction({
      event: {
        name: 'quiz_answer',
        context: {
          question: String(props.question ?? ''),
          selected: options[i] ?? '',
          isCorrect: i === answer,
        },
      },
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-base font-semibold text-slate-800">{String(props.question ?? '')}</p>
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const isAnswer = i === answer
          const isPicked = i === picked
          let tone = 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
          if (revealed && isAnswer) tone = 'border-emerald-400 bg-emerald-50 text-emerald-800'
          else if (revealed && isPicked) tone = 'border-rose-400 bg-rose-50 text-rose-800'
          else if (revealed) tone = 'border-slate-200 bg-white text-slate-400'
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => choose(i)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${tone}`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>
      {revealed ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            correct ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
          }`}
        >
          <span className="font-semibold">{correct ? 'Correct! ' : 'Not quite. '}</span>
          {props.explanation ? String(props.explanation) : correct ? 'Nice work.' : `The answer is ${options[answer] ?? ''}.`}
        </div>
      ) : null}
    </div>
  )
})

// --- WiringChecklist -------------------------------------------------------
// A follow-along checklist: tick each connection; the "done" button stays
// disabled until every item is ticked, then notifies the agent. We own the
// gating in React (reliable + styled to match), rather than relying on the basic
// catalog's checks system.

const WiringChecklistApi = {
  name: 'WiringChecklist',
  schema: z.object({
    items: CommonSchemas.DynamicStringList,
    title: CommonSchemas.DynamicString.optional(),
    intro: CommonSchemas.DynamicString.optional(),
    doneLabel: CommonSchemas.DynamicString.optional(),
  }),
}

export const WiringChecklist = createComponentImplementation(WiringChecklistApi, ({ props, context }) => {
  const items = useMemo(
    () => (Array.isArray(props.items) ? props.items.map(String) : []),
    [props.items],
  )
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false))
  const [done, setDone] = useState(false)
  const allChecked = items.length > 0 && checked.length === items.length && checked.every(Boolean)

  function toggle(i: number) {
    if (done) return
    setChecked((prev) => {
      const next = items.map((_, idx) => prev[idx] ?? false)
      next[i] = !next[i]
      return next
    })
  }

  function finish() {
    if (!allChecked || done) return
    setDone(true)
    void context.dispatchAction({
      event: { name: 'checklist_done', context: { title: String(props.title ?? 'the wiring') } },
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {props.title ? (
        <p className="mb-1 text-base font-semibold text-slate-800">{String(props.title)}</p>
      ) : null}
      {props.intro ? <p className="mb-3 text-sm text-slate-600">{String(props.intro)}</p> : null}
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => toggle(i)}
              disabled={done}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                checked[i]
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                  checked[i] ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {checked[i] ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </span>
              <span className={checked[i] ? 'line-through' : ''}>{item}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!allChecked || done}
        onClick={finish}
        className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          allChecked && !done
            ? 'bg-brand-500 text-white hover:bg-brand-600'
            : 'cursor-not-allowed bg-slate-200 text-slate-400'
        }`}
      >
        {done ? 'Done!' : String(props.doneLabel ?? 'I connected everything!')}
      </button>
    </div>
  )
})

// --- PredictCard -----------------------------------------------------------
// Predict-then-run (PRIMM): the child predicts the outcome, then runs the real
// avr8js simulation and compares. Grades locally, then offers a Run button that
// drives the actual sim.

const PredictCardApi = {
  name: 'PredictCard',
  schema: z.object({
    question: CommonSchemas.DynamicString,
    options: CommonSchemas.DynamicStringList,
    answerIndex: CommonSchemas.DynamicNumber,
    explanation: CommonSchemas.DynamicString.optional(),
  }),
}

export const PredictCard = createComponentImplementation(PredictCardApi, ({ props, context }) => {
  const [picked, setPicked] = useState<number | null>(null)
  const [ran, setRan] = useState(false)
  const options = Array.isArray(props.options) ? props.options.map(String) : []
  const answer = Number(props.answerIndex)
  const revealed = picked !== null
  const correct = picked === answer

  function choose(i: number) {
    if (revealed) return
    setPicked(i)
    void context.dispatchAction({
      event: {
        name: 'predict_result',
        context: {
          question: String(props.question ?? ''),
          predicted: options[i] ?? '',
          isCorrect: i === answer,
        },
      },
    })
  }

  function run() {
    setRan(true)
    useAppStore.getState().requestRun()
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">Predict first</p>
      <p className="mb-3 text-base font-semibold text-slate-800">{String(props.question ?? '')}</p>
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const isAnswer = i === answer
          const isPicked = i === picked
          let tone = 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
          if (revealed && isAnswer) tone = 'border-emerald-400 bg-emerald-50 text-emerald-800'
          else if (revealed && isPicked) tone = 'border-rose-400 bg-rose-50 text-rose-800'
          else if (revealed) tone = 'border-slate-200 bg-white text-slate-400'
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => choose(i)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${tone}`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>
      {revealed ? (
        <>
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              correct ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
            }`}
          >
            <span className="font-semibold">{correct ? 'Good prediction! ' : 'Let us check. '}</span>
            {props.explanation ? String(props.explanation) : `The answer is ${options[answer] ?? ''}.`}
          </div>
          <button
            type="button"
            onClick={run}
            className="mt-3 w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
          >
            {ran ? 'Running - watch the board!' : 'Run it and see!'}
          </button>
        </>
      ) : null}
    </div>
  )
})

// --- FlashcardDeck ----------------------------------------------------------
// A row of flip cards for spaced review of concepts/components. Each card flips
// front<->back on click and can show a real component on the front.

interface FlashcardData {
  front?: string
  back?: string
  part?: string
}

function Flashcard({ card }: { card: FlashcardData }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="flex h-40 w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm transition-colors hover:border-brand-300"
    >
      {flipped ? (
        <p className="text-sm text-slate-700">{card.back ?? ''}</p>
      ) : (
        <>
          {card.part ? (
            <div className="pointer-events-none w-full">
              <PartView type={card.part} maxScale={1} />
            </div>
          ) : null}
          <p className="text-sm font-semibold text-slate-800">{card.front ?? ''}</p>
        </>
      )}
      <span className="mt-auto text-[10px] uppercase tracking-wide text-slate-400">
        {flipped ? 'tap to flip back' : 'tap to flip'}
      </span>
    </button>
  )
}

const FlashcardDeckApi = {
  name: 'FlashcardDeck',
  schema: z.object({
    title: CommonSchemas.DynamicString.optional(),
    cards: CommonSchemas.DynamicValue,
  }),
}

export const FlashcardDeck = createComponentImplementation(FlashcardDeckApi, ({ props }) => {
  const cards: FlashcardData[] = Array.isArray(props.cards) ? (props.cards as FlashcardData[]) : []
  return (
    <div>
      {props.title ? (
        <p className="mb-2 text-base font-semibold text-slate-800">{String(props.title)}</p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cards.map((c, i) => (
          <Flashcard key={i} card={c} />
        ))}
      </div>
    </div>
  )
})

// --- ProgressTracker --------------------------------------------------------
// A skill map + badges, so the child sees their growth. The agent fills it from
// what the child has done (and load_memory).

interface SkillRow {
  label?: string
  status?: string // done | doing | locked
}
interface BadgeRow {
  label?: string
  earned?: boolean
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (status === 'doing') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

const ProgressTrackerApi = {
  name: 'ProgressTracker',
  schema: z.object({
    title: CommonSchemas.DynamicString.optional(),
    skills: CommonSchemas.DynamicValue,
    badges: CommonSchemas.DynamicValue.optional(),
  }),
}

export const ProgressTracker = createComponentImplementation(ProgressTrackerApi, ({ props }) => {
  const skills: SkillRow[] = Array.isArray(props.skills) ? (props.skills as SkillRow[]) : []
  const badges: BadgeRow[] = Array.isArray(props.badges) ? (props.badges as BadgeRow[]) : []
  const done = skills.filter((s) => s.status === 'done').length
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-base font-semibold text-slate-800">{String(props.title ?? 'Your progress')}</p>
        {skills.length > 0 ? (
          <span className="text-xs font-medium text-slate-500">
            {done}/{skills.length} skills
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {skills.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <StatusIcon status={s.status ?? 'locked'} />
            <span className={s.status === 'locked' ? 'text-slate-400' : 'text-slate-700'}>{s.label ?? ''}</span>
          </li>
        ))}
      </ul>
      {badges.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((b, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                b.earned ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={b.earned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l3 6.5 7 .6-5.3 4.6 1.6 6.8L12 17.5 5.7 20.1l1.6-6.8L2 8.7l7-.6z" />
              </svg>
              {b.label ?? ''}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
})

// --- the assembled catalog -------------------------------------------------

/** Basic catalog (Card/Column/Text/Image/Button/...) plus ArduKid's tutor
 *  components, under one catalog id the agent targets. */
export const arduKidCatalog = new Catalog(
  TUTOR_CATALOG_ID,
  [
    ...basicCatalog.components.values(),
    CircuitBoard,
    CircuitPart,
    QuizCard,
    WiringChecklist,
    PredictCard,
    FlashcardDeck,
    ProgressTracker,
  ],
  [...basicCatalog.functions.values()],
  basicCatalog.themeSchema,
)
