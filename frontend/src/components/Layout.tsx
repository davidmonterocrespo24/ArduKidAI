import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { CanvasPanel } from './CanvasPanel'
import { ChatPanel } from './ChatPanel'
import { RightTabs } from './RightTabs'
import { TopBar } from './TopBar'

function Handle() {
  return (
    <PanelResizeHandle className="group mx-1 flex w-1.5 cursor-col-resize items-center justify-center bg-transparent transition hover:bg-emerald-300/40">
      <div className="h-10 w-0.5 rounded bg-slate-300 transition group-hover:bg-emerald-500" />
    </PanelResizeHandle>
  )
}

export function Layout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <TopBar />
      <main className="min-h-0 flex-1 overflow-hidden p-2">
        <PanelGroup direction="horizontal" autoSaveId="ardukid-main">
          <Panel defaultSize={32} minSize={20} maxSize={55}>
            <RightTabs />
          </Panel>
          <Handle />
          <Panel defaultSize={40} minSize={25}>
            <CanvasPanel />
          </Panel>
          <Handle />
          <Panel defaultSize={28} minSize={18} maxSize={50}>
            <ChatPanel />
          </Panel>
        </PanelGroup>
      </main>
    </div>
  )
}
