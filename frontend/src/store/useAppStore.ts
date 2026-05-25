import { create } from 'zustand'
import type { ChatMessage, ComponentInstance, Wire } from '../types/circuit'

export type SimStatus = 'idle' | 'running' | 'stopped' | 'error'

export type AgentStatus = 'idle' | 'streaming' | 'error'

export type RightTab = 'blockly' | 'code'

const EMPTY_BLOCKLY_XML =
  '<xml xmlns="https://developers.google.com/blockly/xml"></xml>'

const PLACEHOLDER_SKETCH = `// The agent will overwrite this when it generates a program from your blocks.
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
`

export interface AppState {
  ledOn: boolean
  setLedOn: (v: boolean) => void

  simStatus: SimStatus
  setSimStatus: (s: SimStatus) => void

  agentStatus: AgentStatus
  setAgentStatus: (s: AgentStatus) => void

  components: ComponentInstance[]
  addComponent: (c: ComponentInstance) => void
  removeComponent: (id: string) => void

  wires: Wire[]
  addWire: (w: Wire) => void

  blocklyXml: string
  setBlocklyXml: (xml: string) => void

  cppCode: string
  setCppCode: (code: string) => void

  hexCode: string | null
  setHexCode: (h: string | null) => void

  compileError: string | null
  setCompileError: (msg: string | null) => void

  chatMessages: ChatMessage[]
  appendChatMessage: (m: ChatMessage) => void
  appendAgentText: (text: string) => void

  rightTab: RightTab
  setRightTab: (t: RightTab) => void

  resetCircuit: () => void
}

export const useAppStore = create<AppState>((set) => ({
  ledOn: false,
  setLedOn: (v) => set({ ledOn: v }),

  simStatus: 'idle',
  setSimStatus: (s) => set({ simStatus: s }),

  agentStatus: 'idle',
  setAgentStatus: (s) => set({ agentStatus: s }),

  components: [],
  addComponent: (c) =>
    set((state) => ({
      components: state.components.some((existing) => existing.id === c.id)
        ? state.components.map((existing) => (existing.id === c.id ? c : existing))
        : [...state.components, c],
    })),
  removeComponent: (id) =>
    set((state) => ({
      components: state.components.filter((c) => c.id !== id),
      wires: state.wires.filter((w) => !w.from_pin.startsWith(`${id}.`) && !w.to_pin.startsWith(`${id}.`)),
    })),

  wires: [],
  addWire: (w) => set((state) => ({ wires: [...state.wires, w] })),

  blocklyXml: EMPTY_BLOCKLY_XML,
  setBlocklyXml: (xml) => set({ blocklyXml: xml }),

  cppCode: PLACEHOLDER_SKETCH,
  setCppCode: (code) => set({ cppCode: code }),

  hexCode: null,
  setHexCode: (h) => set({ hexCode: h }),

  compileError: null,
  setCompileError: (msg) => set({ compileError: msg }),

  chatMessages: [],
  appendChatMessage: (m) => set((state) => ({ chatMessages: [...state.chatMessages, m] })),
  appendAgentText: (text) =>
    set((state) => {
      const last = state.chatMessages[state.chatMessages.length - 1]
      if (last?.role === 'agent' && !last.toolName) {
        return {
          chatMessages: state.chatMessages.map((m, i) =>
            i === state.chatMessages.length - 1 ? { ...m, text: m.text + text } : m,
          ),
        }
      }
      return {
        chatMessages: [
          ...state.chatMessages,
          { id: crypto.randomUUID(), role: 'agent', text },
        ],
      }
    }),

  rightTab: 'blockly',
  setRightTab: (t) => set({ rightTab: t }),

  resetCircuit: () =>
    set({
      components: [],
      wires: [],
      blocklyXml: EMPTY_BLOCKLY_XML,
      cppCode: PLACEHOLDER_SKETCH,
      hexCode: null,
      compileError: null,
      ledOn: false,
      simStatus: 'idle',
    }),
}))
