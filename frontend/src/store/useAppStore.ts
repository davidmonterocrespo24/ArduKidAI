import { create } from 'zustand'

export type SimStatus = 'idle' | 'running' | 'stopped' | 'error'

export type RightTab = 'blockly' | 'code'

export interface AppState {
  ledOn: boolean
  setLedOn: (v: boolean) => void

  simStatus: SimStatus
  setSimStatus: (s: SimStatus) => void

  blocklyXml: string
  setBlocklyXml: (xml: string) => void

  cppCode: string
  setCppCode: (code: string) => void

  rightTab: RightTab
  setRightTab: (t: RightTab) => void
}

const PHASE1_PLACEHOLDER_SKETCH = `// Phase 1 placeholder. Real codegen lands in phase 3.
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

export const useAppStore = create<AppState>((set) => ({
  ledOn: false,
  setLedOn: (v) => set({ ledOn: v }),

  simStatus: 'idle',
  setSimStatus: (s) => set({ simStatus: s }),

  blocklyXml: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
  setBlocklyXml: (xml) => set({ blocklyXml: xml }),

  cppCode: PHASE1_PLACEHOLDER_SKETCH,
  setCppCode: (code) => set({ cppCode: code }),

  rightTab: 'blockly',
  setRightTab: (t) => set({ rightTab: t }),
}))
