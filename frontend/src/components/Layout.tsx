import { useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import { useAppStore } from '../store/useAppStore'
import { CanvasPanel } from './CanvasPanel'
import { ChatPanel } from './ChatPanel'
import { ConsolePanel } from './ConsolePanel'
import { RightTabs } from './RightTabs'
import { TopBar } from './TopBar'
import { IconChevronRight } from './Icons'

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
  const chatCollapsed = useAppStore((s) => s.chatCollapsed)
  const setChatCollapsed = useAppStore((s) => s.setChatCollapsed)
  const chatRef = useRef<ImperativePanelHandle>(null)

  useEffect(() => {
    const panel = chatRef.current
    if (!panel) return
    if (chatCollapsed && !panel.isCollapsed()) panel.collapse()
    if (!chatCollapsed && panel.isCollapsed()) panel.expand()
  }, [chatCollapsed])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <TopBar />
      <main className="relative min-h-0 flex-1 overflow-hidden p-2">
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
          <Panel
            ref={chatRef}
            collapsible
            collapsedSize={0}
            defaultSize={26}
            minSize={18}
            maxSize={50}
            onCollapse={() => setChatCollapsed(true)}
            onExpand={() => setChatCollapsed(false)}
          >
            <ChatPanel />
          </Panel>
        </PanelGroup>

        {chatCollapsed && (
          <button
            type="button"
            onClick={() => setChatCollapsed(false)}
            title="Open the agent chat"
            className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-1 rounded-l-md bg-brand-500 py-3 pl-2 pr-1.5 text-xs font-semibold text-white shadow-md hover:bg-brand-600"
          >
            <IconChevronRight className="rotate-180" />
            <span className="[writing-mode:vertical-rl]">Chat</span>
          </button>
        )}
      </main>
    </div>
  )
}
