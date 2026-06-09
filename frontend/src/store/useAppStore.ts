import { create } from 'zustand'
import type { ChatMessage, ComponentInstance, Wire } from '../types/circuit'
import type { UserPublic } from '../auth/api'
import { emptyActivity, emptyPinLevels, type DigitalPinLabel } from '../sim/pinState'
import { emptyPwmSnapshot, type PwmSnapshot } from '../sim/pwm'
import { DEFAULT_BOARD, type BoardId } from '../sim/boards'
import { BLINK_BLOCKS } from '../lib/exampleTemplates'

export type SimStatus = 'idle' | 'running' | 'stopped' | 'error'

export type AgentStatus = 'idle' | 'streaming' | 'error'

export type RightTab = 'blockly' | 'code' | 'tutor'
export type BottomTab = 'compile' | 'serial'

export type CompileLogType = 'info' | 'success' | 'warn' | 'error'

export interface CompileLogEntry {
  id: string
  timestamp: string
  type: CompileLogType
  message: string
}

// Hello-world default: the canvas starts with the standard "blink pin 13"
// program in both tabs so the kid sees something concrete instead of an
// empty workspace. ResetCircuit and the first load both restore this.
const DEFAULT_BLOCKLY_XML = BLINK_BLOCKS

const PLACEHOLDER_SKETCH = `// Hello world for Arduino: blink the LED on pin 13.
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
  pinLevels: Record<DigitalPinLabel, boolean>
  pinActivity: Record<DigitalPinLabel, number>
  setPinSnapshot: (levels: Record<DigitalPinLabel, boolean>, activity: Record<DigitalPinLabel, number>) => void

  pwm: PwmSnapshot
  setPwmSnapshot: (snap: PwmSnapshot) => void

  // Kept for back-compat: legacy LED indicator wired to D13. New components
  // should read pinLevels[pinLabel] directly.
  ledOn: boolean
  setLedOn: (v: boolean) => void

  simStatus: SimStatus
  setSimStatus: (s: SimStatus) => void

  agentStatus: AgentStatus
  setAgentStatus: (s: AgentStatus) => void

  board: BoardId
  setBoard: (b: BoardId) => void

  components: ComponentInstance[]
  addComponent: (c: ComponentInstance) => void
  removeComponent: (id: string) => void
  updateComponentPosition: (id: string, x: number, y: number) => void
  updateComponentProps: (id: string, partial: Record<string, unknown>) => void

  wires: Wire[]
  addWire: (w: Wire) => void
  removeWire: (index: number) => void
  setWireWaypoints: (index: number, waypoints: Array<{ x: number; y: number }>) => void
  insertWireWaypoint: (index: number, position: number, point: { x: number; y: number }) => void

  selectedWireIndex: number | null
  selectWire: (index: number | null) => void

  wireInProgress: { from_pin: string } | null
  startWire: (from_pin: string) => void
  cancelWire: () => void

  blocklyXml: string
  setBlocklyXml: (xml: string) => void

  cppCode: string
  setCppCode: (code: string) => void

  hexCode: string | null
  setHexCode: (h: string | null) => void

  // Bumped by the agent's compile_and_run tool so SimControls compiles the
  // freshly generated C++ and runs it in the simulator automatically.
  runRequest: number
  requestRun: () => void

  compileError: string | null
  setCompileError: (msg: string | null) => void

  // The last compile result, surfaced to the agent so it can self-correct.
  lastCompile: { ok: boolean; error: string } | null
  setLastCompile: (v: { ok: boolean; error: string } | null) => void
  // How many times the agent has auto-retried a failed compile this build,
  // capped so a program it cannot fix does not loop forever.
  autoFixAttempts: number
  bumpAutoFix: () => void
  resetAutoFix: () => void

  chatMessages: ChatMessage[]
  appendChatMessage: (m: ChatMessage) => void
  appendAgentText: (text: string) => void
  setChatMessages: (m: ChatMessage[]) => void

  chatCollapsed: boolean
  setChatCollapsed: (v: boolean) => void

  rightTab: RightTab
  setRightTab: (t: RightTab) => void

  bottomTab: BottomTab
  setBottomTab: (t: BottomTab) => void

  compileLog: CompileLogEntry[]
  appendCompileLog: (type: CompileLogType, message: string) => void
  clearCompileLog: () => void

  serialOutput: string
  appendSerial: (text: string) => void
  clearSerial: () => void

  currentUser: UserPublic | null
  setCurrentUser: (u: UserPublic | null) => void

  resetCircuit: () => void
}

function ts() {
  return new Date().toTimeString().slice(0, 8)
}

export const useAppStore = create<AppState>((set) => ({
  pinLevels: emptyPinLevels(),
  pinActivity: emptyActivity(),
  setPinSnapshot: (levels, activity) =>
    set({ pinLevels: levels, pinActivity: activity, ledOn: levels.D13 }),

  pwm: emptyPwmSnapshot(),
  setPwmSnapshot: (snap) => set({ pwm: snap }),

  ledOn: false,
  setLedOn: (v) => set({ ledOn: v }),

  simStatus: 'idle',
  setSimStatus: (s) => set({ simStatus: s }),

  agentStatus: 'idle',
  setAgentStatus: (s) => set({ agentStatus: s }),

  board: DEFAULT_BOARD,
  // Switching board clears the circuit: existing wires reference the old
  // board's id (e.g. "UNO.D13") and its pins. The program is kept.
  setBoard: (b) =>
    set({
      board: b,
      components: [],
      wires: [],
      wireInProgress: null,
      selectedWireIndex: null,
      hexCode: null,
      compileError: null,
      simStatus: 'idle',
      pinLevels: emptyPinLevels(),
      pinActivity: emptyActivity(),
      pwm: emptyPwmSnapshot(),
    }),

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
  updateComponentPosition: (id, x, y) =>
    set((state) => ({
      components: state.components.map((c) => (c.id === id ? { ...c, x, y } : c)),
    })),
  updateComponentProps: (id, partial) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, props: { ...c.props, ...partial } } : c,
      ),
    })),

  wires: [],
  addWire: (w) =>
    set((state) => ({
      wires: [...state.wires, { waypoints: [], ...w }],
      wireInProgress: null,
    })),
  removeWire: (index) =>
    set((state) => ({
      wires: state.wires.filter((_, i) => i !== index),
      selectedWireIndex: null,
    })),
  setWireWaypoints: (index, waypoints) =>
    set((state) => ({
      wires: state.wires.map((w, i) => (i === index ? { ...w, waypoints } : w)),
    })),
  insertWireWaypoint: (index, position, point) =>
    set((state) => ({
      wires: state.wires.map((w, i) => {
        if (i !== index) return w
        const next = [...(w.waypoints ?? [])]
        next.splice(position, 0, point)
        return { ...w, waypoints: next }
      }),
    })),

  selectedWireIndex: null,
  selectWire: (index) => set({ selectedWireIndex: index }),

  wireInProgress: null,
  startWire: (from_pin) => set({ wireInProgress: { from_pin } }),
  cancelWire: () => set({ wireInProgress: null }),

  blocklyXml: DEFAULT_BLOCKLY_XML,
  setBlocklyXml: (xml) => set({ blocklyXml: xml }),

  cppCode: PLACEHOLDER_SKETCH,
  setCppCode: (code) => set({ cppCode: code }),

  hexCode: null,
  setHexCode: (h) => set({ hexCode: h }),

  runRequest: 0,
  requestRun: () => set((state) => ({ runRequest: state.runRequest + 1 })),

  compileError: null,
  setCompileError: (msg) => set({ compileError: msg }),

  lastCompile: null,
  setLastCompile: (v) => set({ lastCompile: v }),
  autoFixAttempts: 0,
  bumpAutoFix: () => set((s) => ({ autoFixAttempts: s.autoFixAttempts + 1 })),
  resetAutoFix: () => set({ autoFixAttempts: 0 }),

  chatMessages: [],
  appendChatMessage: (m) => set((state) => ({ chatMessages: [...state.chatMessages, m] })),
  setChatMessages: (m) => set({ chatMessages: m }),
  chatCollapsed: false,
  setChatCollapsed: (v) => set({ chatCollapsed: v }),
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

  bottomTab: 'compile',
  setBottomTab: (t) => set({ bottomTab: t }),

  compileLog: [],
  appendCompileLog: (type, message) =>
    set((state) => ({
      compileLog: [
        ...state.compileLog,
        { id: crypto.randomUUID(), timestamp: ts(), type, message },
      ].slice(-500),
    })),
  clearCompileLog: () => set({ compileLog: [] }),

  serialOutput: '',
  appendSerial: (text) =>
    set((state) => {
      const next = state.serialOutput + text
      // First serial line of a session pops the Serial monitor tab open
      // so the kid notices it. Subsequent writes keep whatever tab the
      // kid chose - we never steal focus repeatedly.
      const focusedSerial = state.serialOutput.length > 0 || state.bottomTab === 'serial'
      return {
        serialOutput: next.length > 16_000 ? next.slice(-16_000) : next,
        bottomTab: focusedSerial ? state.bottomTab : 'serial',
      }
    }),
  clearSerial: () => set({ serialOutput: '' }),

  currentUser: null,
  setCurrentUser: (u) => set({ currentUser: u }),

  resetCircuit: () =>
    set({
      components: [],
      wires: [],
      wireInProgress: null,
      selectedWireIndex: null,
      blocklyXml: DEFAULT_BLOCKLY_XML,
      cppCode: PLACEHOLDER_SKETCH,
      hexCode: null,
      compileError: null,
      lastCompile: null,
      autoFixAttempts: 0,
      compileLog: [],
      serialOutput: '',
      ledOn: false,
      pinLevels: emptyPinLevels(),
      pinActivity: emptyActivity(),
      pwm: emptyPwmSnapshot(),
      simStatus: 'idle',
    }),
}))
