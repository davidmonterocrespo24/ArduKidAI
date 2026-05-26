import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import { initBlockly } from '../blockly/setup'
import { generateCpp } from '../blockly/cppGenerator'
import { useAppStore } from '../store/useAppStore'

export function BlocklyPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  // Tracks the last XML the panel itself wrote to the store. When the store
  // changes we only re-hydrate the workspace if the XML did NOT originate
  // here (e.g. it came from a set_blocks agent tool call). Without this guard
  // the change-listener -> store -> useEffect cycle would loop forever.
  const lastWrittenXmlRef = useRef<string>('')

  const xml = useAppStore((s) => s.blocklyXml)
  const setBlocklyXml = useAppStore((s) => s.setBlocklyXml)
  const setCppCode = useAppStore((s) => s.setCppCode)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const workspace = initBlockly(container)
    workspaceRef.current = workspace

    requestAnimationFrame(() => {
      Blockly.svgResize(workspace)
      workspace.scrollCenter()
    })
    // Recenter on container resize too: when the right pane is shown again
    // (e.g. switching back from the Code tab) the panel mounts at its
    // natural size and the kid would otherwise see an empty workspace
    // because the blocks live at the previous scroll offset.
    const observer = new ResizeObserver(() => {
      if (!workspaceRef.current) return
      Blockly.svgResize(workspaceRef.current)
      workspaceRef.current.scrollCenter()
    })
    observer.observe(container)

    // Blockly 11 leaves flyout scrollbar <svg>s sitting around at the
    // edge of the workspace after the kid clicks different toolbox
    // categories. The flyout container itself goes display:none, but
    // its scrollbar SVG is a SIBLING (under injectionDiv), not a
    // descendant, so it never inherits the hide. Watch every style
    // mutation under the host and reconcile: any scrollbar whose
    // nearest visible flyout does not contain its x position gets
    // its display flipped to none.
    const reconcileScrollbars = () => {
      const flyouts = container.querySelectorAll<HTMLElement>('.blocklyFlyout')
      let anyVisible = false
      for (const fl of flyouts) {
        if (window.getComputedStyle(fl).display !== 'none') {
          anyVisible = true
          break
        }
      }
      // Toggle a class instead of setting inline display so Blockly's
      // own show / position logic can put the scrollbar back when the
      // next category opens. The CSS rule (see index.css) forces
      // display: none !important when the class is on; removing it
      // lets Blockly's display:block (set inline) win again.
      const bars = container.querySelectorAll<HTMLElement>('.blocklyFlyoutScrollbar')
      for (const b of bars) b.classList.toggle('ardukid-hide-flyout-bar', !anyVisible)
    }
    const scrollObserver = new MutationObserver(reconcileScrollbars)
    scrollObserver.observe(container, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true,
    })
    // Initial pass after Blockly has finished bootstrapping its DOM.
    requestAnimationFrame(reconcileScrollbars)

    // Re-hydrate on mount if the store already has XML (e.g. user switched
    // away to the code tab and back). Without this the workspace would boot
    // empty even though the kid built blocks earlier.
    const initialXml = useAppStore.getState().blocklyXml
    if (initialXml && initialXml.includes('<block')) {
      try {
        const dom = Blockly.utils.xml.textToDom(initialXml)
        Blockly.Xml.domToWorkspace(dom, workspace)
        lastWrittenXmlRef.current = initialXml
        requestAnimationFrame(() => workspace.scrollCenter())
      } catch (err) {
        console.error('failed to hydrate Blockly from store on mount', err)
      }
    }

    const listener = (event: Blockly.Events.Abstract) => {
      // Ignore UI-only events (selection, viewport pan) to avoid thrashing
      // serialisation; isUiEvent is true for them.
      if (event.isUiEvent) return
      try {
        const dom = Blockly.Xml.workspaceToDom(workspace)
        const serialised = Blockly.Xml.domToText(dom)
        lastWrittenXmlRef.current = serialised
        setBlocklyXml(serialised)
        const cpp = generateCpp(workspace)
        if (cpp) setCppCode(cpp)
      } catch (err) {
        console.error('failed to serialise workspace', err)
      }
    }
    workspace.addChangeListener(listener)

    return () => {
      observer.disconnect()
      scrollObserver.disconnect()
      workspace.removeChangeListener(listener)
      workspace.dispose()
      workspaceRef.current = null
    }
  }, [setBlocklyXml, setCppCode])

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || !xml) return
    if (xml === lastWrittenXmlRef.current) return
    try {
      const dom = Blockly.utils.xml.textToDom(xml)
      Blockly.Events.disable()
      workspace.clear()
      Blockly.Xml.domToWorkspace(dom, workspace)
      Blockly.Events.enable()
      lastWrittenXmlRef.current = xml
      requestAnimationFrame(() => workspace.scrollCenter())
    } catch (err) {
      console.error('failed to apply Blockly XML from store', err)
    }
  }, [xml])

  return <div ref={containerRef} className="h-full w-full" />
}
