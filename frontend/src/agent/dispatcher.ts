import { useAppStore } from '../store/useAppStore'
import type { ComponentInstance, Wire } from '../types/circuit'
import { nextSpawnPosition } from '../lib/spawnPosition'

type ToolResult = {
  ok?: boolean
  error?: string
  component?: ComponentInstance
  components?: ComponentInstance[]
  wire?: Wire
  wires?: Wire[]
  removed_id?: string
  hex?: string
  stderr?: string
  project?: unknown
  length?: number
  blockly_xml?: string
  errors?: Array<{ error?: string }>
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
  // Only our canvas/data tools return {ok: false} on failure. ADK skill tools
  // (list_skills, load_skill, ...) return other shapes and must not be flagged.
  if (result && typeof result === 'object' && result.ok === false) {
    // Batch tools (add_components / wire_many) report per-item failures in
    // `errors[]`; fall back to those so a partial failure never shows a blank
    // "unknown error".
    const detail =
      result.error ??
      (Array.isArray(result.errors) && result.errors.length > 0
        ? result.errors.map((e) => e?.error ?? 'failed').join('; ')
        : 'unknown error')
    store.appendChatMessage({
      id: crypto.randomUUID(),
      role: 'system',
      text: `That step did not work (${detail}). Let me try another way.`,
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
    case 'add_components':
      // Batch add: the backend already assigned non-overlapping positions, so
      // render each component at the position it returned.
      if (Array.isArray(result.components)) {
        for (const comp of result.components) store.addComponent(comp)
      }
      break
    case 'wire':
      if (result.wire) {
        store.addWire(result.wire)
      }
      break
    case 'wire_many':
      if (Array.isArray(result.wires)) {
        for (const w of result.wires) store.addWire(w)
      }
      break
    case 'set_program':
    case 'edit_program':
      // Neither has XML in its call args (unlike set_blocks); the backend builds
      // the XML and returns it here. Load that into the editor.
      if (typeof result.blockly_xml === 'string' && result.blockly_xml) {
        store.setBlocklyXml(result.blockly_xml)
      }
      break
    case 'compile_and_run':
      // The backend compiles a stale snapshot, so ignore result.hex. Ask the
      // frontend to compile the freshly generated C++ and run it in the sim.
      store.requestRun()
      break
    default:
      break
  }
}

// Kid-friendly names for each part, so the chat says "Adding a button" instead
// of "Adding pushbutton".
const PART_LABEL: Record<string, string> = {
  led: 'LED', resistor: 'resistor', pushbutton: 'button', pushbutton6mm: 'button',
  buzzer: 'buzzer', servo: 'servo motor', potentiometer: 'knob',
  slidePotentiometer: 'slider', slideSwitch: 'switch', lcd1602: 'LCD screen',
  lcd2004: 'LCD screen', ssd1306: 'OLED screen', seg7: '7-segment display',
  dipSwitch8: 'DIP switch', analogJoystick: 'joystick', soundSensor: 'sound sensor',
  smallSoundSensor: 'sound sensor', flameSensor: 'flame sensor', gasSensor: 'gas sensor',
  heartBeatSensor: 'heartbeat sensor', rotaryEncoder: 'rotary encoder',
  dht22: 'temperature sensor', hcSr04: 'distance sensor', photoresistor: 'light sensor',
  ntcTemperature: 'temperature sensor', tiltSwitch: 'tilt sensor', pirMotion: 'motion sensor',
  rgbLed: 'RGB LED', ledBarGraph: 'LED bar',
}

// Friendly names for the things the agent reads (load_skill).
const SKILL_LABEL: Record<string, string> = {
  'blockly-programming': 'how to write the code',
  'project-patterns': 'common projects',
  'arduino-uno': 'the Arduino board',
  'arduino-nano': 'the Arduino board',
  'arduino-mega': 'the Arduino board',
}

function partLabel(type: string): string {
  return PART_LABEL[type] ?? type
}

function skillLabel(name: unknown): string {
  if (typeof name !== 'string') return 'a part'
  return SKILL_LABEL[name] ?? PART_LABEL[name] ?? name
}

function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`
}

function countLabel(word: string, n: number): string {
  return n === 1 ? withArticle(word) : `${n} ${word}s`
}

function summarizeParts(components: unknown): string {
  if (!Array.isArray(components) || components.length === 0) return 'some parts'
  const counts = new Map<string, number>()
  for (const c of components) {
    const type =
      c && typeof c === 'object' && typeof (c as { type?: unknown }).type === 'string'
        ? (c as { type: string }).type
        : 'part'
    const label = partLabel(type)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const items = [...counts.entries()].map(([label, n]) => countLabel(label, n))
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// Turn a raw tool call into a friendly, child-readable step. Returns null for
// internal calls (listing skills/parts) that are noise to a kid.
function describeToolCall(name: string, args: Record<string, unknown>): string | null {
  switch (name) {
    case 'add_component':
      return `Adding ${withArticle(partLabel(String(args.type ?? 'part')))}.`
    case 'add_components':
      return `Adding ${summarizeParts(args.components)}.`
    case 'remove_component':
      return `Removing ${typeof args.id === 'string' ? args.id : 'a part'}.`
    case 'wire':
      return 'Connecting a wire.'
    case 'wire_many': {
      const n = Array.isArray(args.wires) ? args.wires.length : 0
      return n > 1 ? `Connecting ${n} wires.` : 'Connecting the wires.'
    }
    case 'set_program':
    case 'set_blocks':
      return 'Writing the program.'
    case 'edit_program':
      return 'Updating the program.'
    case 'compile_and_run':
      return 'Compiling the code and starting the simulation.'
    case 'validate_circuit':
      return 'Checking the circuit for mistakes.'
    case 'describe_circuit':
      return 'Looking at your circuit.'
    case 'save_project':
      return `Saving your project${typeof args.name === 'string' ? ` as "${args.name}"` : ''}.`
    case 'find_similar_example':
      return 'Looking for a similar project for ideas.'
    case 'search_docs':
      return 'Looking it up in my notes.'
    case 'search_web':
      return 'Searching the web.'
    case 'read_web_page':
      return 'Reading that web page.'
    case 'watch_youtube':
      return 'Watching the video.'
    case 'load_memory':
      return 'Remembering what we did before.'
    case 'list_saved_projects':
    case 'list_projects':
      return 'Looking at your saved projects.'
    case 'load_project':
      return 'Opening your saved project.'
    default:
      // list_skills, list_available_components and any other internal call:
      // not worth showing a child.
      return null
  }
}

// Append a friendly step line for a tool call. Consecutive load_skill calls are
// merged into one line ("Reading my notes about: LED, button, ...") instead of
// one cryptic line per skill.
function appendToolStep(name: string, args: Record<string, unknown>): void {
  const store = useAppStore.getState()
  if (name === 'load_skill') {
    const label = skillLabel(args.skill_name)
    const msgs = store.chatMessages
    const last = msgs[msgs.length - 1]
    if (last && last.toolName === 'load_skill') {
      store.setChatMessages(
        msgs.map((m, i) =>
          i === msgs.length - 1 ? { ...m, text: `${m.text}, ${label}` } : m,
        ),
      )
    } else {
      store.appendChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        text: `Reading my notes about: ${label}`,
        toolName: 'load_skill',
      })
    }
    return
  }
  const text = describeToolCall(name, args)
  if (text) {
    store.appendChatMessage({ id: crypto.randomUUID(), role: 'system', text, toolName: name })
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
        appendToolStep(name, args)
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
