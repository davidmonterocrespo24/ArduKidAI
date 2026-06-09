import { A2uiSurface, MarkdownContext } from '@a2ui/react/v0_9'
import { renderMarkdown } from '@a2ui/markdown-it'
import { useTutorSurfaces } from '../a2ui/tutor'

/**
 * Renders the agent's A2UI tutor surfaces. The agent "speaks UI": it sends a
 * declarative panel (lesson cards, a lit-up board, a quiz) and the official
 * a2ui-project renderer draws it with our trusted catalog. Nothing the agent
 * sends executes as code - it can only ask for components in `arduKidCatalog`.
 */
export function TutorPanel() {
  const surfaces = useTutorSurfaces()

  if (surfaces.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-400">
          <path d="M12 14l9-5-9-5-9 5 9 5z" />
          <path d="M12 14l6.16-3.42A12.08 12.08 0 0112 21a12.08 12.08 0 01-6.16-10.42L12 14z" />
        </svg>
        <p className="max-w-xs text-sm text-slate-500">
          Ask me to <span className="font-semibold text-slate-700">explain your circuit</span> or to{' '}
          <span className="font-semibold text-slate-700">quiz you</span>, and an interactive lesson
          will appear here.
        </p>
      </div>
    )
  }

  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
        {surfaces.map((surface) => (
          <A2uiSurface key={surface.id} surface={surface} />
        ))}
      </div>
    </MarkdownContext.Provider>
  )
}
