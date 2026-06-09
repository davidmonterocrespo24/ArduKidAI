import { A2uiSurface, MarkdownContext } from '@a2ui/react/v0_9'
import { renderMarkdown } from '@a2ui/markdown-it'
import { useTutorSurface } from '../a2ui/tutor'

/**
 * One agent-authored A2UI lesson, rendered inline in the chat thread. The agent
 * "speaks UI": it sends a declarative panel (lesson cards, a lit-up board, a
 * quiz) and the official a2ui-project renderer draws it with our trusted
 * catalog. Nothing the agent sends runs as code - it can only ask for the
 * components in `arduKidCatalog`.
 */
export default function InlineTutor({ surfaceId }: { surfaceId: string }) {
  const surface = useTutorSurface(surfaceId)
  if (!surface) return null
  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <div className="ak-tutor flex flex-col gap-3">
        <A2uiSurface surface={surface} />
      </div>
    </MarkdownContext.Provider>
  )
}
