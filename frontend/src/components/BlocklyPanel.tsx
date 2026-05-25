import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import { initBlockly } from '../blockly/setup'
import { generateCpp } from '../blockly/cppGenerator'
import { useAppStore } from '../store/useAppStore'

export function BlocklyPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const lastAppliedXmlRef = useRef<string>('')

  const xml = useAppStore((s) => s.blocklyXml)
  const setCppCode = useAppStore((s) => s.setCppCode)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const workspace = initBlockly(container)
    workspaceRef.current = workspace

    // Blockly measures its SVG once at inject() time. When the host panel is
    // hidden behind a Suspense fallback or briefly zero-sized, the workspace
    // boots collapsed. Force a resize on the next frame and watch the
    // container so user-driven panel resizes keep the workspace in sync.
    requestAnimationFrame(() => Blockly.svgResize(workspace))
    const observer = new ResizeObserver(() => {
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current)
    })
    observer.observe(container)

    const listener = () => {
      try {
        const cpp = generateCpp(workspace)
        if (cpp) setCppCode(cpp)
      } catch (err) {
        console.error('cpp generation failed', err)
      }
    }
    workspace.addChangeListener(listener)

    return () => {
      observer.disconnect()
      workspace.removeChangeListener(listener)
      workspace.dispose()
      workspaceRef.current = null
    }
  }, [setCppCode])

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || !xml) return
    if (xml === lastAppliedXmlRef.current) return
    try {
      const dom = Blockly.utils.xml.textToDom(xml)
      workspace.clear()
      Blockly.Xml.domToWorkspace(dom, workspace)
      lastAppliedXmlRef.current = xml
    } catch (err) {
      console.error('failed to apply Blockly XML from agent', err)
    }
  }, [xml])

  return <div ref={containerRef} className="h-full w-full" />
}
