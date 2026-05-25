import { useEffect, useRef } from 'react'
import type * as Blockly from 'blockly'
import { initBlockly } from '../blockly/setup'

export function BlocklyPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    workspaceRef.current = initBlockly(containerRef.current)
    return () => {
      workspaceRef.current?.dispose()
      workspaceRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
