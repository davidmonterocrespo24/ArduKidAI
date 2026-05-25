import { CanvasPanel } from './CanvasPanel'
import { ChatPanel } from './ChatPanel'
import { FooterBar } from './FooterBar'
import { RightTabs } from './RightTabs'
import { TopBar } from './TopBar'

export function Layout() {
  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <TopBar />
      <main className="grid flex-1 grid-cols-[320px_1fr_440px] gap-2 overflow-hidden p-2">
        <ChatPanel />
        <CanvasPanel />
        <RightTabs />
      </main>
      <FooterBar />
    </div>
  )
}
