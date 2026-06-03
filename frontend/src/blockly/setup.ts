import * as Blockly from 'blockly'
import { ARDUINO_TOOLBOX_CATEGORIES, registerArduinoBlocks } from './arduinoBlocks'

const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    ...ARDUINO_TOOLBOX_CATEGORIES,
    {
      kind: 'category',
      name: 'Logic',
      colour: '210',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      colour: '120',
      contents: [
        {
          kind: 'block',
          type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } },
        },
        { kind: 'block', type: 'controls_whileUntil' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: '230',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
      ],
    },
    {
      kind: 'category',
      name: 'Variables',
      colour: '330',
      custom: 'VARIABLE',
    },
  ],
}

export function initBlockly(container: HTMLElement): Blockly.WorkspaceSvg {
  registerArduinoBlocks()
  return Blockly.inject(container, {
    toolbox: TOOLBOX,
    grid: { spacing: 20, length: 3, colour: '#e2e8f0', snap: true },
    // Zoom lives on the +/- controls so the mouse wheel is free to scroll.
    zoom: { controls: true, wheel: false, startScale: 0.9 },
    trashcan: true,
    renderer: 'zelos',
    // Navigate freely: visible scrollbars on both axes, drag an empty area to
    // pan, and the mouse wheel scrolls (Shift+wheel scrolls horizontally).
    move: { scrollbars: true, drag: true, wheel: true },
  })
}
