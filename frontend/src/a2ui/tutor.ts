/**
 * The A2UI surfaces that power ArduKid's inline tutor lessons.
 *
 * Each `show_tutor_panel` tool result becomes its OWN A2UI surface, rendered as
 * a message inside the chat thread (see ChatPanel / InlineTutor) - the lesson is
 * part of the conversation, not a side panel. All surfaces live in one official
 * `MessageProcessor` from the a2ui-project so quiz interactions keep working and
 * past lessons stay on screen as the chat scrolls.
 *
 * Actions flow the other way: when a child answers a quiz, the renderer raises a
 * client action that we forward back to the agent as a chat turn.
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

const listeners = new Set<() => void>()
function notify(): void {
  for (const l of listeners) l()
}
processor.onSurfaceCreated(() => notify())
processor.onSurfaceDeleted(() => notify())

let panelCount = 0

// Point every message in a panel at a fresh surface id so panels stack in the
// chat instead of replacing one another. The agent emits a placeholder id.
function retargetSurface(messages: A2uiMessage[], surfaceId: string): A2uiMessage[] {
  return messages.map((msg) => {
    const m = msg as unknown as Record<string, Record<string, unknown>>
    for (const key of ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface']) {
      if (m[key] && typeof m[key] === 'object') {
        m[key] = { ...m[key], surfaceId }
      }
    }
    return msg
  })
}

/** Render a new tutor panel as its own surface; returns the surface id so the
 *  chat can place it inline. */
export function addTutorPanel(messages: A2uiMessage[]): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return null
  ensureStyles()
  panelCount += 1
  const surfaceId = `tutor-${panelCount}`
  processor.processMessages(retargetSurface(messages, surfaceId))
  notify()
  return surfaceId
}

/** Clear every lesson (used when the child resets or starts a new chat). */
export function resetTutor(): void {
  for (const id of Array.from(processor.model.surfacesMap.keys())) {
    processor.model.deleteSurface(id)
  }
  notify()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Subscribe a chat message to its tutor surface (or undefined until it exists). */
export function useTutorSurface(surfaceId: string): TutorSurface | undefined {
  return useSyncExternalStore(
    subscribe,
    () => processor.model.surfacesMap.get(surfaceId) as TutorSurface | undefined,
  )
}

interface ClientAction {
  name: string
  context?: Record<string, unknown>
}

async function handleTutorAction(action: ClientAction): Promise<void> {
  const ctx = action.context ?? {}
  // Lazy import keeps this module free of a chat <-> tutor import cycle.
  if (action.name === 'quiz_answer') {
    const question = typeof ctx.question === 'string' ? ctx.question : 'the quiz'
    const selected = typeof ctx.selected === 'string' ? ctx.selected : ''
    const isCorrect = ctx.isCorrect === true
    // The card already showed the child whether they were right. We pass it to
    // the agent as an internal turn so it can add a short, encouraging follow-up.
    const { sendChatMessage } = await import('../agent/chat')
    await sendChatMessage(
      `[tutor quiz] The child answered "${selected}" to: "${question}". ` +
        `That answer was ${isCorrect ? 'correct' : 'incorrect'}. ` +
        'Reply with one short, encouraging sentence. Do not change the circuit or the program.',
      undefined,
      { note: isCorrect ? 'You got it.' : 'Good try - let me explain.' },
    )
    return
  }
  if (action.name === 'predict_result') {
    const question = typeof ctx.question === 'string' ? ctx.question : 'the prediction'
    const predicted = typeof ctx.predicted === 'string' ? ctx.predicted : ''
    const isCorrect = ctx.isCorrect === true
    const { sendChatMessage } = await import('../agent/chat')
    await sendChatMessage(
      `[tutor predict] The child predicted "${predicted}" for: "${question}". ` +
        `That was ${isCorrect ? 'right' : 'not what happens'}. They will press Run to check. ` +
        'Reply with one short, encouraging sentence. Do not change the circuit or the program.',
      undefined,
      { note: isCorrect ? 'Great prediction!' : 'Good guess - let us see.' },
    )
    return
  }
  if (action.name === 'checklist_done') {
    const title = typeof ctx.title === 'string' ? ctx.title : 'the wiring'
    const { sendChatMessage } = await import('../agent/chat')
    await sendChatMessage(
      `[tutor] The child finished the checklist for "${title}". ` +
        'Congratulate them in one short sentence and invite them to press Run to see it work. ' +
        'Do not change the circuit or the program.',
      undefined,
      { note: 'All checked off!' },
    )
    return
  }
}
