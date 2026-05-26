import { useState } from 'react'
import { ExamplesModal } from './ExamplesModal'
import { LibrariesModal } from './LibrariesModal'
import { SimControls } from './SimControls'
import { UserMenu } from './UserMenu'

export function TopBar() {
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [librariesOpen, setLibrariesOpen] = useState(false)

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 font-bold text-white"
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
          className="ml-2 rounded-md border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          Examples
        </button>
        <button
          type="button"
          onClick={() => setLibrariesOpen(true)}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          title="Install Arduino libraries (LCD, NeoPixel, ...)"
        >
          Libraries
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SimControls />
        <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
        <UserMenu />
      </div>
      <ExamplesModal open={examplesOpen} onClose={() => setExamplesOpen(false)} />
      <LibrariesModal open={librariesOpen} onClose={() => setLibrariesOpen(false)} />
    </header>
  )
}
