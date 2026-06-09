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
 *   - `CircuitBoard` - an Arduino UNO drawn in SVG with the pins the lesson is
 *     about lit up, so the agent can literally point at "pin 13" while it talks.
 *   - `QuizCard` - a self-contained multiple-choice question that grades the
 *     child's answer on the spot and reports it back to the agent.
 *
 * The agent emits A2UI v0.9 messages (createSurface / updateComponents) that
 * reference these by name; see backend `services/a2ui_build.py`.
 */
import { useMemo, useState } from 'react'
import { basicCatalog, createComponentImplementation } from '@a2ui/react/v0_9'
import { Catalog, CommonSchemas } from '@a2ui/web_core/v0_9'
import { z } from 'zod'

/** The id the agent must put in `createSurface.catalogId`. Keep in sync with
 *  backend `a2ui_build.TUTOR_CATALOG_ID`. */
export const TUTOR_CATALOG_ID = 'https://ardukid.app/catalogs/tutor/v1'

// --- CircuitBoard ----------------------------------------------------------

// Where each UNO pin sits on our schematic board, in SVG user units. The top
// header is the digital side (D0-D13 + power-ish pins), the bottom header is
// power + analog, matching the real board's two long headers.
const BOARD_W = 540
const BOARD_H = 300
const PIN_R = 9

interface PinSpot {
  name: string
  x: number
  y: number
  /** label drawn above (top header) or below (bottom header) the dot */
  below?: boolean
}

function topHeader(): PinSpot[] {
  // D13 .. D0 left-to-right plus the AREF/GND that share that header.
  const labels = ['GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0']
  const startX = 40
  const gap = (BOARD_W - 2 * startX) / (labels.length - 1)
  return labels.map((name, i) => ({ name, x: startX + i * gap, y: 64 }))
}

function bottomHeader(): PinSpot[] {
  const labels = ['5V', '3V3', 'GND', 'VIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5']
  const startX = 70
  const gap = (BOARD_W - 2 * startX) / (labels.length - 1)
  return labels.map((name, i) => ({ name, x: startX + i * gap, y: BOARD_H - 60, below: true }))
}

/** Normalise a pin reference the agent might send ("13", "d13", "gnd", "A0",
 *  "UNO.D13") to the canonical label drawn on the board. */
function canonicalPin(raw: string): string {
  let p = raw.trim()
  if (p.includes('.')) p = p.split('.').pop() as string
  p = p.toUpperCase()
  if (/^\d+$/.test(p)) return `D${p}`
  if (p === '3.3V' || p === '3V' || p === '3.3') return '3V3'
  return p
}

const CircuitBoardApi = {
  name: 'CircuitBoard',
  schema: z.object({
    caption: CommonSchemas.DynamicString.optional(),
    board: CommonSchemas.DynamicString.optional(),
    highlightPins: CommonSchemas.DynamicStringList.optional(),
  }),
}

export const CircuitBoard = createComponentImplementation(
  CircuitBoardApi,
  ({ props }) => {
    const highlight = useMemo(() => {
      const list = Array.isArray(props.highlightPins) ? props.highlightPins : []
      return new Set(list.map((p) => canonicalPin(String(p))))
    }, [props.highlightPins])
    const pins = useMemo(() => [...topHeader(), ...bottomHeader()], [])

    return (
      <figure className="m-0 w-full">
        <svg
          viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
          className="w-full"
          role="img"
          aria-label={String(props.caption ?? 'Arduino UNO board')}
        >
          <defs>
            <filter id="ak-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* board body */}
          <rect x="14" y="22" width={BOARD_W - 28} height={BOARD_H - 44} rx="18" fill="#0b7a73" />
          <rect
            x="14"
            y="22"
            width={BOARD_W - 28}
            height={BOARD_H - 44}
            rx="18"
            fill="none"
            stroke="#0a5f59"
            strokeWidth="3"
          />
          {/* the two pin-header strips */}
          <rect x="28" y="50" width={BOARD_W - 56} height="28" rx="5" fill="#062f2c" />
          <rect x="28" y={BOARD_H - 74} width={BOARD_W - 56} height="28" rx="5" fill="#062f2c" />
          {/* a usb + power nub so it reads as an UNO */}
          <rect x="6" y="92" width="26" height="44" rx="4" fill="#9aa3a1" />
          <rect x="6" y="158" width="26" height="34" rx="4" fill="#1b1b1b" />
          <text x={BOARD_W / 2} y={BOARD_H / 2 + 4} textAnchor="middle" fill="#bfe9e4" fontSize="22" fontWeight="700" letterSpacing="2">
            ARDUINO UNO
          </text>

          {pins.map((pin) => {
            const on = highlight.has(pin.name)
            const labelY = pin.below ? pin.y + PIN_R + 16 : pin.y - PIN_R - 8
            return (
              <g key={pin.name}>
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={PIN_R}
                  fill={on ? '#ffd23f' : '#10302d'}
                  stroke={on ? '#ff8a00' : '#0a5f59'}
                  strokeWidth={on ? 3 : 2}
                  filter={on ? 'url(#ak-glow)' : undefined}
                />
                <text
                  x={pin.x}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={on ? 700 : 500}
                  fill={on ? '#b45309' : '#cbd5e1'}
                >
                  {pin.name}
                </text>
              </g>
            )
          })}
        </svg>
        {props.caption ? (
          <figcaption className="mt-1 text-center text-sm text-slate-600">{String(props.caption)}</figcaption>
        ) : null}
      </figure>
    )
  },
)

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
