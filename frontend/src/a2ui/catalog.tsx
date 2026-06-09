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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { basicCatalog, createComponentImplementation } from '@a2ui/react/v0_9'
import { Catalog, CommonSchemas } from '@a2ui/web_core/v0_9'
import { z } from 'zod'

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

// --- the assembled catalog -------------------------------------------------

/** Basic catalog (Card/Column/Text/Image/Button/...) plus ArduKid's tutor
 *  components, under one catalog id the agent targets. */
export const arduKidCatalog = new Catalog(
  TUTOR_CATALOG_ID,
  [...basicCatalog.components.values(), CircuitBoard, QuizCard],
  [...basicCatalog.functions.values()],
  basicCatalog.themeSchema,
)
