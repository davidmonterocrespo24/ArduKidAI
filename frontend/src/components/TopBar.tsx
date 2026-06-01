import { useState } from 'react'
import { ExamplesModal } from './ExamplesModal'
import { LibrariesModal } from './LibrariesModal'
import { KnowledgeModal } from './KnowledgeModal'
import { SimControls } from './SimControls'
import { UserMenu } from './UserMenu'
import { IconBook, IconBrain, IconLibrary } from './Icons'
import { useAppStore } from '../store/useAppStore'
import { BOARDS, SELECTABLE_BOARDS, type BoardId } from '../sim/boards'

export function TopBar() {
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [librariesOpen, setLibrariesOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const board = useAppStore((s) => s.board)
  const setBoard = useAppStore((s) => s.setBoard)

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 font-bold text-white"
        >
          A
        </span>
        <div className="leading-tight">
          <h1 className="text-base font-semibold">ArduKid</h1>
          <p className="text-xs text-slate-500">An AI Arduino IDE for kids</p>
        </div>
        <button
          type="button"
          onClick={() => setExamplesOpen(true)}
          className="ml-2 inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
        >
          <IconBook />
          Examples
        </button>
        <button
          type="button"
          onClick={() => setLibrariesOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
          title="Install Arduino libraries (LCD, NeoPixel, ...)"
        >
          <IconLibrary />
          Libraries
        </button>
        <button
          type="button"
          onClick={() => setKnowledgeOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
          title="Manage what the agent knows (PDFs, links, notes, images)"
        >
          <IconBrain />
          Knowledge
        </button>
        <label className="ml-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
          <span className="text-xs font-medium text-slate-500">Board</span>
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value as BoardId)}
            title="Switching board clears the circuit"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            {SELECTABLE_BOARDS.map((id) => (
              <option key={id} value={id}>
                {BOARDS[id].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SimControls />
        <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
        <UserMenu />
      </div>
      <ExamplesModal open={examplesOpen} onClose={() => setExamplesOpen(false)} />
      <LibrariesModal open={librariesOpen} onClose={() => setLibrariesOpen(false)} />
      <KnowledgeModal open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />
    </header>
  )
}
