import { useState } from 'react'
import { ExamplesModal } from './ExamplesModal'
import { SimControls } from './SimControls'
import { UserMenu } from './UserMenu'

export function TopBar() {
  const [examplesOpen, setExamplesOpen] = useState(false)

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 font-bold text-white"
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
          className="ml-2 rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          Examples
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SimControls />
        <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
        <UserMenu />
      </div>
      <ExamplesModal open={examplesOpen} onClose={() => setExamplesOpen(false)} />
    </header>
  )
}
