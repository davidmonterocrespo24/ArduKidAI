import { useAppStore } from '../store/useAppStore'
import type { ComponentInstance, Wire } from '../types/circuit'
import { nextSpawnPosition } from '../lib/spawnPosition'

type ToolResult = {
  ok?: boolean
  error?: string
  component?: ComponentInstance
  wire?: Wire
  removed_id?: string
  hex?: string
  stderr?: string
  components?: unknown
  project?: unknown
  length?: number
}

export function applyToolCall(name: string, args: Record<string, unknown>): void {
  const store = useAppStore.getState()
  switch (name) {
    case 'set_blocks': {
      const xml = typeof args.blockly_xml === 'string' ? args.blockly_xml : ''
      if (xml) {
        store.setBlocklyXml(xml)
      }
      break
    }
    default:
      // Most tools take effect on the result side, where the backend has
      // assigned the canonical id.
      break
  }
}

export function applyToolResult(name: string, result: ToolResult): void {
  const store = useAppStore.getState()
  if (!result.ok) {
    store.appendChatMessage({
      id: crypto.randomUUID(),
      role: 'system',
      text: `Tool ${name} failed: ${result.error ?? 'unknown error'}`,
      toolName: name,
    })
    return
  }
  switch (name) {
    case 'add_component':
      if (result.component) {
        const c = { ...result.component }
        // Backend assigns id but x/y default to 0,0; spread agent-added
        // components on the same grid the manual picker uses so they do
        // not all stack at the origin.
        if ((c.x ?? 0) === 0 && (c.y ?? 0) === 0) {
          const peripherals = store.components.filter((existing) => existing.type !== 'uno')
          const pos = nextSpawnPosition(peripherals.length)
          c.x = pos.x
          c.y = pos.y
        }
        store.addComponent(c)
      }
      break
    case 'remove_component':
      if (result.removed_id) {
        store.removeComponent(result.removed_id)
      }
      break
    case 'wire':
      if (result.wire) {
        store.addWire(result.wire)
      }
      break
    case 'compile_and_run':
      if (typeof result.hex === 'string') {
        store.setHexCode(result.hex)
      }
      break
    default:
      break
  }
}

export function handleAgentEvent(event: string, raw: string): void {
  const store = useAppStore.getState()
  let payload: unknown
  try {
    payload = raw.length > 0 ? JSON.parse(raw) : {}
  } catch {
    payload = { raw }
  }
  const data = payload as Record<string, unknown>

  switch (event) {
    case 'agent_start':
      store.setAgentStatus('streaming')
      break
    case 'agent_text': {
      const content = typeof data.content === 'string' ? data.content : ''
      if (content) {
        store.appendAgentText(content)
      }
      break
    }
    case 'tool_call': {
      const name = typeof data.name === 'string' ? data.name : ''
      const args = (data.args as Record<string, unknown> | undefined) ?? {}
      if (name) {
        store.appendChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          text: `Calling ${name}(${Object.keys(args).join(', ')})`,
          toolName: name,
        })
        applyToolCall(name, args)
      }
      break
    }
    case 'tool_result': {
      const name = typeof data.name === 'string' ? data.name : ''
      const result = (data.result as ToolResult | undefined) ?? {}
      if (name) {
        applyToolResult(name, result)
      }
      break
    }
    case 'error': {
      const message = typeof data.message === 'string' ? data.message : 'agent error'
      store.appendChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        text: `Error: ${message}`,
      })
      store.setAgentStatus('error')
      break
    }
    case 'done':
      store.setAgentStatus('idle')
      break
    default:
      break
  }
}
