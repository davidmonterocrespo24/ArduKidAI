import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { CanvasPanel } from './CanvasPanel'
import { ChatPanel } from './ChatPanel'
import { ConsolePanel } from './ConsolePanel'
import { RightTabs } from './RightTabs'
import { TopBar } from './TopBar'

function HHandle() {
  return (
    <PanelResizeHandle className="group mx-1 flex w-1.5 cursor-col-resize items-center justify-center bg-transparent transition hover:bg-brand-300/40">
      <div className="h-10 w-0.5 rounded bg-slate-300 transition group-hover:bg-brand-500" />
    </PanelResizeHandle>
  )
}

function VHandle() {
  return (
    <PanelResizeHandle className="group my-1 flex h-1.5 cursor-row-resize items-center justify-center bg-transparent transition hover:bg-brand-300/40">
      <div className="h-0.5 w-10 rounded bg-slate-300 transition group-hover:bg-brand-500" />
    </PanelResizeHandle>
  )
}

export function Layout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <TopBar />
      <main className="min-h-0 flex-1 overflow-hidden p-2">
        <PanelGroup direction="horizontal" autoSaveId="ardukid-main">
          <Panel defaultSize={30} minSize={20} maxSize={55}>
            <RightTabs />
          </Panel>
          <HHandle />
          <Panel defaultSize={44} minSize={30}>
            <PanelGroup direction="vertical" autoSaveId="ardukid-canvas-console">
              <Panel defaultSize={70} minSize={40}>
                <CanvasPanel />
              </Panel>
              <VHandle />
              <Panel defaultSize={30} minSize={15}>
                <ConsolePanel />
              </Panel>
            </PanelGroup>
          </Panel>
          <HHandle />
          <Panel defaultSize={26} minSize={18} maxSize={50}>
            <ChatPanel />
          </Panel>
        </PanelGroup>
      </main>
    </div>
  )
}
