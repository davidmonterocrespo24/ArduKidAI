/**
 * The single A2UI surface group that powers ArduKid's Tutor panel.
 *
 * The agent emits A2UI messages (createSurface / updateComponents) as the
 * `a2ui` field of a tool result; the SSE dispatcher hands them to
 * `pushTutorMessages`, which feeds the official `MessageProcessor` from the
 * a2ui-project. React reads the resulting surfaces through `useTutorSurfaces`.
 *
 * Actions flow the other way: when a child answers a quiz, the renderer raises
 * a client action that we forward back to the agent as a chat turn, so the
 * lesson stays conversational.
 */
import { useSyncExternalStore } from 'react'
import type { ReactComponentImplementation } from '@a2ui/react/v0_9'
import { MessageProcessor, type A2uiMessage, type SurfaceModel } from '@a2ui/web_core/v0_9'
import { injectBasicCatalogStyles } from '@a2ui/web_core/v0_9/basic_catalog'
import { injectStyles } from '@a2ui/react/styles'
import { arduKidCatalog } from './catalog'

type TutorSurface = SurfaceModel<ReactComponentImplementation>

let stylesInjected = false
function ensureStyles(): void {
  if (stylesInjected) return
  // Structural + component CSS for the renderer, then the basic catalog's
  // colour/spacing variables. The published package omits the standalone
  // structural.css file, so we inject via JS instead of importing the stylesheet.
  injectStyles()
  injectBasicCatalogStyles()
  stylesInjected = true
}

const processor = new MessageProcessor<ReactComponentImplementation>(
  [arduKidCatalog],
  (action) => {
    void handleTutorAction(action)
  },
)

// useSyncExternalStore needs a stable snapshot reference between renders, so we
// recompute the surface list only when a surface is added or removed.
let snapshot: TutorSurface[] = []
const listeners = new Set<() => void>()

function refresh(): void {
  snapshot = Array.from(processor.model.surfacesMap.values())
  for (const l of listeners) l()
}

processor.onSurfaceCreated(() => refresh())
processor.onSurfaceDeleted(() => refresh())

function clearSurfaces(): void {
  for (const id of Array.from(processor.model.surfacesMap.keys())) {
    processor.model.deleteSurface(id)
  }
}

/** Render a fresh tutor panel, replacing whatever was shown before. */
export function pushTutorMessages(messages: A2uiMessage[]): void {
  if (!Array.isArray(messages) || messages.length === 0) return
  ensureStyles()
  clearSurfaces()
  processor.processMessages(messages)
  refresh()
}

/** Clear the panel (used when the child resets the session). */
export function resetTutor(): void {
  clearSurfaces()
  refresh()
}

export function hasTutorContent(): boolean {
  return snapshot.length > 0
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Subscribe a React component to the live list of tutor surfaces. */
export function useTutorSurfaces(): TutorSurface[] {
  return useSyncExternalStore(subscribe, () => snapshot)
}

interface ClientAction {
  name: string
  context?: Record<string, unknown>
}

async function handleTutorAction(action: ClientAction): Promise<void> {
  if (action.name !== 'quiz_answer') return
  const ctx = action.context ?? {}
  const question = typeof ctx.question === 'string' ? ctx.question : 'the quiz'
  const selected = typeof ctx.selected === 'string' ? ctx.selected : ''
  const isCorrect = ctx.isCorrect === true
  // The card already showed the child whether they were right. We pass it to the
  // agent as an internal turn so it can add a short, encouraging follow-up - not
  // a fake user bubble. Lazy import keeps this module free of a chat <-> tutor
  // import cycle.
  const { sendChatMessage } = await import('../agent/chat')
  await sendChatMessage(
    `[tutor quiz] The child answered "${selected}" to: "${question}". ` +
      `That answer was ${isCorrect ? 'correct' : 'incorrect'}. ` +
      'Reply with one short, encouraging sentence. Do not change the circuit or the program.',
    undefined,
    { note: isCorrect ? 'You got it.' : 'Good try - let me explain.' },
  )
}
