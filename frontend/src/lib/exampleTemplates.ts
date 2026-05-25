/**
 * Pure example templates. The Examples modal loads them directly into the
 * Zustand store: full reset, then drop in the components, wires and C++ for
 * the selected one. The agent is NOT involved in this path - these are
 * starter circuits, not LLM-generated.
 *
 * Wire endpoints use the agent-style pin names ("L1.anode", "R1.a",
 * "UNO.D13", "UNO.GND", "UNO.A0", "UNO.5V", ...) - the WireOverlay alias
 * table maps them to the wokwi short names ("A", "C", "1", "2", "13",
 * "GND.1", "5V", "V+", ...). Keep these consistent.
 */

import type { ComponentInstance, ComponentType, Wire } from '../types/circuit'
import { nextSpawnPosition } from './spawnPosition'
import {
  chain,
  digitalWrite,
  ifThen,
  loop,
  pinMode,
  setup,
  toXml,
  wait,
} from './blocklyXml'

export type Difficulty = 1 | 2 | 3

export interface ExampleTemplate {
  id: string
  title: string
  intent_es: string
  intent_en: string
  tags: string[]
  difficulty: Difficulty
  components: ComponentInstance[]
  wires: Wire[]
  cpp_code: string
  /** Optional starter Blockly program. Examples whose C++ uses libraries or
   * patterns we do not have block coverage for leave this blank and the kid
   * sees the program in the Arduino code tab only. */
  blockly_xml?: string
}

// ---------------------------------------------------------------------------
// Reusable Blockly fragments. Helpers from blocklyXml.ts compose the trees.
// ---------------------------------------------------------------------------

export const BLINK_BLOCKS = toXml(
  setup(pinMode(13, 'OUTPUT')),
  loop(
    chain(
      digitalWrite(13, 'HIGH'),
      wait(500),
      digitalWrite(13, 'LOW'),
      wait(500),
    ),
  ),
)

const TWO_LEDS_BLOCKS = toXml(
  setup(chain(pinMode(12, 'OUTPUT'), pinMode(13, 'OUTPUT'))),
  loop(
    chain(
      digitalWrite(13, 'HIGH'),
      digitalWrite(12, 'LOW'),
      wait(400),
      digitalWrite(13, 'LOW'),
      digitalWrite(12, 'HIGH'),
      wait(400),
    ),
  ),
)

const TRAFFIC_BLOCKS = toXml(
  setup(chain(pinMode(11, 'OUTPUT'), pinMode(12, 'OUTPUT'), pinMode(13, 'OUTPUT'))),
  loop(
    chain(
      digitalWrite(13, 'HIGH'),
      digitalWrite(12, 'LOW'),
      digitalWrite(11, 'LOW'),
      wait(3000),
      digitalWrite(13, 'LOW'),
      digitalWrite(12, 'HIGH'),
      wait(1000),
      digitalWrite(12, 'LOW'),
      digitalWrite(11, 'HIGH'),
      wait(3000),
      digitalWrite(11, 'LOW'),
    ),
  ),
)

const CHRISTMAS_BLOCKS = toXml(
  setup(chain(pinMode(11, 'OUTPUT'), pinMode(12, 'OUTPUT'), pinMode(13, 'OUTPUT'))),
  loop(
    chain(
      digitalWrite(13, 'HIGH'),
      wait(200),
      digitalWrite(13, 'LOW'),
      digitalWrite(12, 'HIGH'),
      wait(200),
      digitalWrite(12, 'LOW'),
      digitalWrite(11, 'HIGH'),
      wait(200),
      digitalWrite(11, 'LOW'),
    ),
  ),
)

const POLICE_BLOCKS = toXml(
  setup(chain(pinMode(12, 'OUTPUT'), pinMode(13, 'OUTPUT'))),
  loop(
    chain(
      digitalWrite(13, 'HIGH'),
      digitalWrite(12, 'LOW'),
      wait(80),
      digitalWrite(13, 'LOW'),
      digitalWrite(12, 'HIGH'),
      wait(80),
    ),
  ),
)

const BUTTON_PRESS_BLOCKS = toXml(
  setup(chain(pinMode(2, 'INPUT_PULLUP'), pinMode(13, 'OUTPUT'))),
  loop(
    chain(
      ifThen(
        // digitalRead block already returns boolean (true == HIGH)
        { type: 'ardukid_digital_read', fields: { PIN: '2' } },
        digitalWrite(13, 'LOW'),
      ),
      ifThen(
        {
          type: 'logic_compare',
          fields: { OP: 'EQ' },
          values: {
            A: { type: 'ardukid_digital_read', fields: { PIN: '2' } },
            B: { type: 'logic_boolean', fields: { BOOL: 'FALSE' } },
          },
        },
        digitalWrite(13, 'HIGH'),
      ),
    ),
  ),
)

const DOORBELL_BLOCKS = toXml(
  setup(pinMode(2, 'INPUT_PULLUP')),
  loop(
    ifThen(
      {
        type: 'logic_compare',
        fields: { OP: 'EQ' },
        values: {
          A: { type: 'ardukid_digital_read', fields: { PIN: '2' } },
          B: { type: 'logic_boolean', fields: { BOOL: 'FALSE' } },
        },
      },
      chain(
        { type: 'ardukid_tone', fields: { PIN: '8' }, values: { FREQ: { type: 'math_number', fields: { NUM: 880 } }, DURATION: { type: 'math_number', fields: { NUM: 200 } } } },
        wait(220),
        { type: 'ardukid_tone', fields: { PIN: '8' }, values: { FREQ: { type: 'math_number', fields: { NUM: 660 } }, DURATION: { type: 'math_number', fields: { NUM: 220 } } } },
        wait(260),
      ),
    ),
  ),
)

const BUZZER_TONE_BLOCKS = toXml(
  setup(
    {
      type: 'ardukid_tone',
      fields: { PIN: '8' },
      values: {
        FREQ: { type: 'math_number', fields: { NUM: 440 } },
        DURATION: { type: 'math_number', fields: { NUM: 500 } },
      },
    },
  ),
  loop({ type: 'ardukid_pin_mode', fields: { PIN: '13', MODE: 'OUTPUT' } }),
)

const PREFIX: Record<ComponentType, string> = {
  uno: 'UNO',
  led: 'L',
  resistor: 'R',
  pushbutton: 'B',
  buzzer: 'BZ',
  servo: 'S',
  potentiometer: 'P',
  lcd1602: 'LCD',
  seg7: 'SEG',
}

interface ComponentSpec {
  type: ComponentType
  props?: Record<string, unknown>
}

/**
 * Turn a compact list of (type, props) into laid-out ComponentInstances
 * with the canonical IDs the wires reference (L1, L2, R1, R2, BZ1, ...).
 */
function layout(specs: ComponentSpec[]): ComponentInstance[] {
  const counters: Record<string, number> = {}
  return specs.map((spec, i) => {
    const prefix = PREFIX[spec.type]
    counters[prefix] = (counters[prefix] ?? 0) + 1
    const id = `${prefix}${counters[prefix]}`
    const { x, y } = nextSpawnPosition(i)
    return {
      id,
      type: spec.type,
      x,
      y,
      props: spec.props ? { ...spec.props } : {},
    }
  })
}

const w = (from_pin: string, to_pin: string): Wire => ({ from_pin, to_pin })

// ---------------------------------------------------------------------------
// Reusable wiring fragments
// ---------------------------------------------------------------------------

// L<i> anode -> R<j> a -> UNO.D<pin>; L<i> cathode -> UNO.GND
function ledOnPin(ledIdx: number, resIdx: number, pin: string): Wire[] {
  return [
    w(`L${ledIdx}.anode`, `R${resIdx}.a`),
    w(`R${resIdx}.b`, `UNO.D${pin}`),
    w(`L${ledIdx}.cathode`, 'UNO.GND'),
  ]
}

// Pushbutton on a digital pin with INPUT_PULLUP wiring
function buttonOnPin(buttonIdx: number, pin: string): Wire[] {
  return [
    w(`B${buttonIdx}.1a`, `UNO.D${pin}`),
    w(`B${buttonIdx}.2a`, 'UNO.GND'),
  ]
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const BLINK_CPP = `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
`

const TWO_LEDS_CPP = `void setup() {
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  digitalWrite(12, LOW);
  delay(400);
  digitalWrite(13, LOW);
  digitalWrite(12, HIGH);
  delay(400);
}
`

const TRAFFIC_CPP = `void setup() {
  pinMode(11, OUTPUT); // green
  pinMode(12, OUTPUT); // yellow
  pinMode(13, OUTPUT); // red
}

void loop() {
  digitalWrite(13, HIGH); digitalWrite(12, LOW); digitalWrite(11, LOW);
  delay(3000);
  digitalWrite(13, LOW); digitalWrite(12, HIGH); digitalWrite(11, LOW);
  delay(1000);
  digitalWrite(13, LOW); digitalWrite(12, LOW); digitalWrite(11, HIGH);
  delay(3000);
}
`

const POLICE_CPP = `void setup() {
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  for (int i = 0; i < 6; i++) {
    digitalWrite(13, HIGH); digitalWrite(12, LOW); delay(80);
    digitalWrite(13, LOW); digitalWrite(12, HIGH); delay(80);
  }
  delay(200);
}
`

const KNIGHT_CPP = `int pins[] = {11, 12, 13};
int n = 3;

void setup() {
  for (int i = 0; i < n; i++) pinMode(pins[i], OUTPUT);
}

void loop() {
  for (int i = 0; i < n; i++) {
    digitalWrite(pins[i], HIGH); delay(120); digitalWrite(pins[i], LOW);
  }
  for (int i = n - 2; i > 0; i--) {
    digitalWrite(pins[i], HIGH); delay(120); digitalWrite(pins[i], LOW);
  }
}
`

const CHRISTMAS_CPP = `int pins[] = {11, 12, 13};

void setup() {
  for (int i = 0; i < 3; i++) pinMode(pins[i], OUTPUT);
}

void loop() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(pins[i], HIGH); delay(200); digitalWrite(pins[i], LOW);
  }
}
`

const BINARY_CPP = `void setup() {
  pinMode(11, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  for (int n = 0; n < 8; n++) {
    digitalWrite(11, n & 0b001);
    digitalWrite(12, n & 0b010);
    digitalWrite(13, n & 0b100);
    delay(700);
  }
}
`

const BUTTON_LED_PRESS_CPP = `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, digitalRead(2) == LOW ? HIGH : LOW);
}
`

const BUTTON_LED_TOGGLE_CPP = `bool state = false;
bool last = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  bool now = digitalRead(2);
  if (last == HIGH && now == LOW) {
    state = !state;
    digitalWrite(13, state);
    delay(50); // debounce
  }
  last = now;
}
`

const FADE_CPP = `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  for (int v = 0; v < 256; v++) { analogWrite(9, v); delay(8); }
  for (int v = 255; v >= 0; v--) { analogWrite(9, v); delay(8); }
}
`

const HEARTBEAT_CPP = `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  for (int v = 0; v < 256; v++) { analogWrite(9, v); delay(2); }
  for (int v = 255; v >= 0; v--) { analogWrite(9, v); delay(2); }
  delay(80);
  for (int v = 0; v < 256; v++) { analogWrite(9, v); delay(2); }
  for (int v = 255; v >= 0; v--) { analogWrite(9, v); delay(2); }
  delay(500);
}
`

const POT_DIM_CPP = `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  int v = analogRead(A0) / 4;
  analogWrite(9, v);
}
`

const BUZZER_TONE_CPP = `void setup() {
  tone(8, 440, 500);
}

void loop() {}
`

const BUZZER_MELODY_CPP = `int notes[] = {262, 262, 294, 262, 349, 330};
int beats[] = {350, 350, 600, 600, 600, 800};

void setup() {
  for (int i = 0; i < 6; i++) {
    tone(8, notes[i], beats[i]);
    delay(beats[i] + 60);
  }
  noTone(8);
}

void loop() {}
`

const DOORBELL_CPP = `void setup() {
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(2) == LOW) {
    tone(8, 880, 200); delay(220);
    tone(8, 660, 220); delay(260);
  }
}
`

const POT_BUZZER_CPP = `void setup() {}

void loop() {
  int freq = map(analogRead(A0), 0, 1023, 220, 1760);
  tone(8, freq, 30);
  delay(10);
}
`

const PIANO_CPP = `int pins[] = {2, 3, 4};
int notes[] = {262, 294, 330}; // C4, D4, E4

void setup() {
  for (int i = 0; i < 3; i++) pinMode(pins[i], INPUT_PULLUP);
}

void loop() {
  for (int i = 0; i < 3; i++) {
    if (digitalRead(pins[i]) == LOW) {
      tone(8, notes[i], 120);
      delay(120);
    }
  }
}
`

const MORSE_SOS_CPP = `int dot = 200;
int dash = 600;
int gap = 200;
int letter = 600;
int word = 1400;

void blink(int ms) {
  digitalWrite(13, HIGH); delay(ms);
  digitalWrite(13, LOW); delay(gap);
}

void setup() { pinMode(13, OUTPUT); }

void loop() {
  blink(dot); blink(dot); blink(dot); delay(letter); // S
  blink(dash); blink(dash); blink(dash); delay(letter); // O
  blink(dot); blink(dot); blink(dot); delay(word); // S
}
`

const REACTION_CPP = `unsigned long startMs;
bool armed = false;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (!armed) {
    delay(random(2000, 5000));
    digitalWrite(13, HIGH);
    startMs = millis();
    armed = true;
  }
  if (digitalRead(2) == LOW) {
    Serial.print("Reaction: ");
    Serial.print(millis() - startMs);
    Serial.println(" ms");
    digitalWrite(13, LOW);
    armed = false;
    delay(1000);
  }
}
`

const SERVO_SWEEP_CPP = `#include <Servo.h>
Servo s;

void setup() {
  s.attach(9);
}

void loop() {
  for (int a = 0; a <= 180; a++) { s.write(a); delay(15); }
  for (int a = 180; a >= 0; a--) { s.write(a); delay(15); }
}
`

const POT_SERVO_CPP = `#include <Servo.h>
Servo s;

void setup() {
  s.attach(9);
}

void loop() {
  int a = map(analogRead(A0), 0, 1023, 0, 180);
  s.write(a);
  delay(15);
}
`

const SERVO_LOCK_CPP = `#include <Servo.h>
Servo s;
bool locked = true;
bool last = HIGH;

void setup() {
  s.attach(9);
  pinMode(2, INPUT_PULLUP);
  s.write(0);
}

void loop() {
  bool now = digitalRead(2);
  if (last == HIGH && now == LOW) {
    locked = !locked;
    s.write(locked ? 0 : 90);
    delay(50);
  }
  last = now;
}
`

const LCD_HELLO_CPP = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Hello, world!");
  lcd.setCursor(0, 1);
  lcd.print("From ArduKid");
}

void loop() {}
`

const LCD_POT_CPP = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Pot value:");
}

void loop() {
  int v = analogRead(A0);
  lcd.setCursor(0, 1);
  lcd.print("       ");
  lcd.setCursor(0, 1);
  lcd.print(v);
  delay(100);
}
`

const LCD_THERMOMETER_CPP = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Temperature:");
}

void loop() {
  int t = map(analogRead(A0), 0, 1023, 15, 35);
  lcd.setCursor(0, 1);
  lcd.print("      ");
  lcd.setCursor(0, 1);
  lcd.print(t);
  lcd.print(" C");
  delay(200);
}
`

const SEG7_COUNTER_CPP = `// Common-cathode 7-seg on pins 2..8 (A..G), DP on 9.
byte digits[10][7] = {
  {1,1,1,1,1,1,0}, // 0
  {0,1,1,0,0,0,0}, // 1
  {1,1,0,1,1,0,1}, // 2
  {1,1,1,1,0,0,1}, // 3
  {0,1,1,0,0,1,1}, // 4
  {1,0,1,1,0,1,1}, // 5
  {1,0,1,1,1,1,1}, // 6
  {1,1,1,0,0,0,0}, // 7
  {1,1,1,1,1,1,1}, // 8
  {1,1,1,1,0,1,1}, // 9
};

void showDigit(int d) {
  for (int i = 0; i < 7; i++) digitalWrite(i + 2, digits[d][i]);
}

void setup() {
  for (int i = 2; i <= 9; i++) pinMode(i, OUTPUT);
}

void loop() {
  for (int d = 0; d < 10; d++) {
    showDigit(d);
    delay(800);
  }
}
`

const SEG7_BUTTON_CPP = `byte digits[10][7] = {
  {1,1,1,1,1,1,0},{0,1,1,0,0,0,0},{1,1,0,1,1,0,1},{1,1,1,1,0,0,1},
  {0,1,1,0,0,1,1},{1,0,1,1,0,1,1},{1,0,1,1,1,1,1},{1,1,1,0,0,0,0},
  {1,1,1,1,1,1,1},{1,1,1,1,0,1,1},
};

int counter = 0;
bool last = HIGH;

void showDigit(int d) {
  for (int i = 0; i < 7; i++) digitalWrite(i + 2, digits[d][i]);
}

void setup() {
  pinMode(10, INPUT_PULLUP);
  for (int i = 2; i <= 9; i++) pinMode(i, OUTPUT);
  showDigit(0);
}

void loop() {
  bool now = digitalRead(10);
  if (last == HIGH && now == LOW) {
    counter = (counter + 1) % 10;
    showDigit(counter);
    delay(50);
  }
  last = now;
}
`

const SEG7_RANDOM_CPP = `byte digits[10][7] = {
  {1,1,1,1,1,1,0},{0,1,1,0,0,0,0},{1,1,0,1,1,0,1},{1,1,1,1,0,0,1},
  {0,1,1,0,0,1,1},{1,0,1,1,0,1,1},{1,0,1,1,1,1,1},{1,1,1,0,0,0,0},
  {1,1,1,1,1,1,1},{1,1,1,1,0,1,1},
};

bool last = HIGH;

void showDigit(int d) {
  for (int i = 0; i < 7; i++) digitalWrite(i + 2, digits[d][i]);
}

void setup() {
  pinMode(10, INPUT_PULLUP);
  for (int i = 2; i <= 9; i++) pinMode(i, OUTPUT);
  randomSeed(analogRead(A0));
}

void loop() {
  bool now = digitalRead(10);
  if (last == HIGH && now == LOW) {
    showDigit(random(0, 10));
    delay(50);
  }
  last = now;
}
`

const GREETING_CPP = `int melody[] = {262, 262, 392, 392, 440, 440, 392};
int beats[] = {300, 300, 300, 300, 300, 300, 600};

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  if (digitalRead(2) == LOW) {
    for (int i = 0; i < 7; i++) {
      digitalWrite(13, HIGH);
      tone(8, melody[i], beats[i]);
      delay(beats[i]);
      digitalWrite(13, LOW);
      delay(40);
    }
    delay(500);
  }
}
`

// ---------------------------------------------------------------------------
// Examples (titles + intent + tags from the original seed_data.py)
// ---------------------------------------------------------------------------

export const EXAMPLE_TEMPLATES: ExampleTemplate[] = [
  {
    id: 'ex-001',
    title: 'Blink the on-board LED',
    intent_en: 'blink the LED on pin 13 once per second',
    intent_es: 'hacer parpadear el LED del pin 13 una vez por segundo',
    tags: ['led', 'blink', 'starter'],
    difficulty: 1,
    components: layout([{ type: 'led', props: { color: 'red' } }, { type: 'resistor', props: { value: '220' } }]),
    wires: ledOnPin(1, 1, '13'),
    cpp_code: BLINK_CPP,
    blockly_xml: BLINK_BLOCKS,
  },
  {
    id: 'ex-002',
    title: 'Two LEDs alternating',
    intent_en: 'alternate two LEDs so one is on while the other is off',
    intent_es: 'alternar dos LEDs, uno prendido y el otro apagado',
    tags: ['led', 'blink', 'alternate'],
    difficulty: 1,
    components: layout([
      { type: 'led', props: { color: 'red' } },
      { type: 'led', props: { color: 'green' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [...ledOnPin(1, 1, '13'), ...ledOnPin(2, 2, '12')],
    cpp_code: TWO_LEDS_CPP,
    blockly_xml: TWO_LEDS_BLOCKS,
  },
  {
    id: 'ex-003',
    title: 'Traffic light',
    intent_en: 'three LEDs sequencing red, yellow, green like a traffic light',
    intent_es: 'tres LEDs en secuencia rojo, amarillo, verde como un semaforo',
    tags: ['led', 'traffic', 'sequence'],
    difficulty: 2,
    components: layout([
      { type: 'led', props: { color: 'red' } },
      { type: 'led', props: { color: 'yellow' } },
      { type: 'led', props: { color: 'green' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [...ledOnPin(1, 1, '13'), ...ledOnPin(2, 2, '12'), ...ledOnPin(3, 3, '11')],
    cpp_code: TRAFFIC_CPP,
    blockly_xml: TRAFFIC_BLOCKS,
  },
  {
    id: 'ex-004',
    title: 'Button-controlled LED',
    intent_en: 'an LED that turns on while a button is pressed',
    intent_es: 'un LED que se prende mientras se aprieta un boton',
    tags: ['led', 'button'],
    difficulty: 1,
    components: layout([
      { type: 'pushbutton' },
      { type: 'led', props: { color: 'green' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [...buttonOnPin(1, '2'), ...ledOnPin(1, 1, '13')],
    cpp_code: BUTTON_LED_PRESS_CPP,
    blockly_xml: BUTTON_PRESS_BLOCKS,
  },
  {
    id: 'ex-005',
    title: 'Button toggles LED on and off',
    intent_en: 'press the button once to turn the LED on, press again to turn it off',
    intent_es: 'apretar el boton una vez prende el LED, otra vez lo apaga',
    tags: ['led', 'button', 'toggle'],
    difficulty: 2,
    components: layout([
      { type: 'pushbutton' },
      { type: 'led', props: { color: 'blue' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [...buttonOnPin(1, '2'), ...ledOnPin(1, 1, '13')],
    cpp_code: BUTTON_LED_TOGGLE_CPP,
  },
  {
    id: 'ex-006',
    title: 'Fading LED (PWM)',
    intent_en: 'smoothly fade an LED in and out using PWM',
    intent_es: 'hacer que un LED se prenda y apague suavemente con PWM',
    tags: ['led', 'pwm', 'fade'],
    difficulty: 2,
    components: layout([
      { type: 'led', props: { color: 'yellow' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: ledOnPin(1, 1, '9'),
    cpp_code: FADE_CPP,
  },
  {
    id: 'ex-007',
    title: 'Potentiometer dims an LED',
    intent_en: 'read a potentiometer and use it to set LED brightness',
    intent_es: 'leer un potenciometro y usarlo para regular el brillo del LED',
    tags: ['led', 'potentiometer', 'pwm'],
    difficulty: 2,
    components: layout([
      { type: 'potentiometer' },
      { type: 'led', props: { color: 'blue' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [
      w('P1.GND', 'UNO.GND'),
      w('P1.VCC', 'UNO.5V'),
      w('P1.SIG', 'UNO.A0'),
      ...ledOnPin(1, 1, '9'),
    ],
    cpp_code: POT_DIM_CPP,
  },
  {
    id: 'ex-008',
    title: 'Buzzer plays a tone',
    intent_en: 'play a single tone on a buzzer when the sketch starts',
    intent_es: 'hacer que un buzzer toque una nota al arrancar',
    tags: ['buzzer', 'tone'],
    difficulty: 1,
    components: layout([{ type: 'buzzer' }]),
    wires: [w('BZ1.1', 'UNO.D8'), w('BZ1.2', 'UNO.GND')],
    cpp_code: BUZZER_TONE_CPP,
    blockly_xml: BUZZER_TONE_BLOCKS,
  },
  {
    id: 'ex-009',
    title: 'Happy Birthday melody',
    intent_en: 'play the Happy Birthday melody on a buzzer',
    intent_es: 'tocar la melodia de Feliz Cumpleanos con un buzzer',
    tags: ['buzzer', 'melody', 'music'],
    difficulty: 3,
    components: layout([{ type: 'buzzer' }]),
    wires: [w('BZ1.1', 'UNO.D8'), w('BZ1.2', 'UNO.GND')],
    cpp_code: BUZZER_MELODY_CPP,
  },
  {
    id: 'ex-010',
    title: 'Servo sweep 0 to 180',
    intent_en: 'make a servo sweep from 0 to 180 degrees back and forth',
    intent_es: 'hacer que un servo barra de 0 a 180 grados y vuelva',
    tags: ['servo', 'sweep'],
    difficulty: 2,
    components: layout([{ type: 'servo' }]),
    wires: [w('S1.PWM', 'UNO.D9'), w('S1.VCC', 'UNO.5V'), w('S1.GND', 'UNO.GND')],
    cpp_code: SERVO_SWEEP_CPP,
  },
  {
    id: 'ex-011',
    title: 'Potentiometer controls a servo',
    intent_en: 'use a potentiometer to control the angle of a servo motor',
    intent_es: 'controlar el angulo de un servo con un potenciometro',
    tags: ['servo', 'potentiometer', 'motor'],
    difficulty: 2,
    components: layout([{ type: 'servo' }, { type: 'potentiometer' }]),
    wires: [
      w('S1.PWM', 'UNO.D9'),
      w('S1.VCC', 'UNO.5V'),
      w('S1.GND', 'UNO.GND'),
      w('P1.GND', 'UNO.GND'),
      w('P1.VCC', 'UNO.5V'),
      w('P1.SIG', 'UNO.A0'),
    ],
    cpp_code: POT_SERVO_CPP,
  },
  {
    id: 'ex-012',
    title: 'Doorbell',
    intent_en: 'press a button to play a doorbell sound on the buzzer',
    intent_es: 'apretar un boton y que suene un timbre de puerta en el buzzer',
    tags: ['buzzer', 'button', 'doorbell'],
    difficulty: 2,
    components: layout([{ type: 'pushbutton' }, { type: 'buzzer' }]),
    wires: [
      ...buttonOnPin(1, '2'),
      w('BZ1.1', 'UNO.D8'),
      w('BZ1.2', 'UNO.GND'),
    ],
    cpp_code: DOORBELL_CPP,
    blockly_xml: DOORBELL_BLOCKS,
  },
  {
    id: 'ex-013',
    title: 'Hello world on LCD',
    intent_en: "show 'Hello world' on a 16x2 I2C LCD display",
    intent_es: "mostrar 'Hola mundo' en una pantalla LCD 16x2 por I2C",
    tags: ['lcd', 'display'],
    difficulty: 2,
    components: layout([{ type: 'lcd1602' }]),
    wires: [
      w('LCD1.GND', 'UNO.GND'),
      w('LCD1.VCC', 'UNO.5V'),
      w('LCD1.SDA', 'UNO.A4'),
      w('LCD1.SCL', 'UNO.A5'),
    ],
    cpp_code: LCD_HELLO_CPP,
  },
  {
    id: 'ex-014',
    title: 'Show potentiometer value on LCD',
    intent_en: 'read a potentiometer and display its value on a 16x2 LCD',
    intent_es: 'leer un potenciometro y mostrar su valor en un LCD 16x2',
    tags: ['lcd', 'potentiometer'],
    difficulty: 3,
    components: layout([{ type: 'lcd1602' }, { type: 'potentiometer' }]),
    wires: [
      w('LCD1.GND', 'UNO.GND'),
      w('LCD1.VCC', 'UNO.5V'),
      w('LCD1.SDA', 'UNO.A4'),
      w('LCD1.SCL', 'UNO.A5'),
      w('P1.GND', 'UNO.GND'),
      w('P1.VCC', 'UNO.5V'),
      w('P1.SIG', 'UNO.A0'),
    ],
    cpp_code: LCD_POT_CPP,
  },
  {
    id: 'ex-015',
    title: '7-segment counts 0 to 9',
    intent_en: 'count from 0 to 9 on a single 7-segment display once per second',
    intent_es: 'contar de 0 a 9 en un display de 7 segmentos una vez por segundo',
    tags: ['7segment', 'counter'],
    difficulty: 2,
    components: layout([{ type: 'seg7' }]),
    wires: [
      ...(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((s, i) => w(`SEG1.${s}`, `UNO.D${i + 2}`))),
      w('SEG1.DP', 'UNO.D9'),
      w('SEG1.COM', 'UNO.GND'),
    ],
    cpp_code: SEG7_COUNTER_CPP,
  },
  {
    id: 'ex-016',
    title: '7-segment counts button presses',
    intent_en: 'count how many times a button is pressed and show the digit on a 7-segment',
    intent_es: 'contar cuantas veces se aprieta un boton y mostrar el digito en un 7 segmentos',
    tags: ['7segment', 'button', 'counter'],
    difficulty: 3,
    components: layout([{ type: 'seg7' }, { type: 'pushbutton' }]),
    wires: [
      ...(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((s, i) => w(`SEG1.${s}`, `UNO.D${i + 2}`))),
      w('SEG1.DP', 'UNO.D9'),
      w('SEG1.COM', 'UNO.GND'),
      ...buttonOnPin(1, '10'),
    ],
    cpp_code: SEG7_BUTTON_CPP,
  },
  {
    id: 'ex-017',
    title: 'Reaction time game',
    intent_en: 'wait a random delay then turn on an LED; measure how fast a button is pressed in response',
    intent_es: 'esperar un tiempo aleatorio, prender un LED y medir cuanto tarda en apretarse un boton',
    tags: ['led', 'button', 'game'],
    difficulty: 3,
    components: layout([
      { type: 'led', props: { color: 'red' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'pushbutton' },
    ]),
    wires: [...ledOnPin(1, 1, '13'), ...buttonOnPin(1, '2')],
    cpp_code: REACTION_CPP,
  },
  {
    id: 'ex-018',
    title: 'Christmas lights',
    intent_en: 'alternate three colored LEDs in a holiday-light sequence',
    intent_es: 'alternar tres LEDs de colores como luces de navidad',
    tags: ['led', 'sequence'],
    difficulty: 1,
    components: layout([
      { type: 'led', props: { color: 'red' } },
      { type: 'led', props: { color: 'green' } },
      { type: 'led', props: { color: 'yellow' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [...ledOnPin(1, 1, '13'), ...ledOnPin(2, 2, '12'), ...ledOnPin(3, 3, '11')],
    cpp_code: CHRISTMAS_CPP,
    blockly_xml: CHRISTMAS_BLOCKS,
  },
  {
    id: 'ex-019',
    title: 'SOS Morse with LED',
    intent_en: 'blink an LED in Morse code spelling SOS',
    intent_es: 'hacer parpadear un LED con codigo Morse de SOS',
    tags: ['led', 'morse'],
    difficulty: 2,
    components: layout([{ type: 'led', props: { color: 'red' } }, { type: 'resistor', props: { value: '220' } }]),
    wires: ledOnPin(1, 1, '13'),
    cpp_code: MORSE_SOS_CPP,
  },
  {
    id: 'ex-020',
    title: 'Knight Rider scanner',
    intent_en: 'scan a row of LEDs left and right like the Knight Rider car',
    intent_es: 'barrer una fila de LEDs ida y vuelta estilo el auto de Knight Rider',
    tags: ['led', 'sequence', 'scan'],
    difficulty: 2,
    components: layout([
      { type: 'led', props: { color: 'red' } },
      { type: 'led', props: { color: 'red' } },
      { type: 'led', props: { color: 'red' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [...ledOnPin(1, 1, '11'), ...ledOnPin(2, 2, '12'), ...ledOnPin(3, 3, '13')],
    cpp_code: KNIGHT_CPP,
  },
  {
    id: 'ex-021',
    title: 'Heartbeat LED',
    intent_en: 'make an LED pulse like a heartbeat using PWM',
    intent_es: 'hacer que un LED lata como un corazon con PWM',
    tags: ['led', 'pwm', 'heartbeat'],
    difficulty: 2,
    components: layout([{ type: 'led', props: { color: 'red' } }, { type: 'resistor', props: { value: '220' } }]),
    wires: ledOnPin(1, 1, '9'),
    cpp_code: HEARTBEAT_CPP,
  },
  {
    id: 'ex-022',
    title: 'Police lights',
    intent_en: 'alternate red and blue LEDs quickly like emergency vehicle lights',
    intent_es: 'alternar LEDs rojo y azul rapido como luces de emergencia',
    tags: ['led', 'alternate'],
    difficulty: 1,
    components: layout([
      { type: 'led', props: { color: 'red' } },
      { type: 'led', props: { color: 'blue' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [...ledOnPin(1, 1, '13'), ...ledOnPin(2, 2, '12')],
    cpp_code: POLICE_CPP,
    blockly_xml: POLICE_BLOCKS,
  },
  {
    id: 'ex-023',
    title: 'Theremin-style buzzer',
    intent_en: 'use a potentiometer to change the pitch played on a buzzer in real time',
    intent_es: 'cambiar la nota que toca el buzzer girando un potenciometro',
    tags: ['buzzer', 'potentiometer'],
    difficulty: 2,
    components: layout([{ type: 'buzzer' }, { type: 'potentiometer' }]),
    wires: [
      w('BZ1.1', 'UNO.D8'),
      w('BZ1.2', 'UNO.GND'),
      w('P1.GND', 'UNO.GND'),
      w('P1.VCC', 'UNO.5V'),
      w('P1.SIG', 'UNO.A0'),
    ],
    cpp_code: POT_BUZZER_CPP,
  },
  {
    id: 'ex-024',
    title: 'Dimmer with potentiometer',
    intent_en: 'read a potentiometer and use its value to dim a single LED',
    intent_es: 'leer un potenciometro y usarlo para regular el brillo de un LED',
    tags: ['led', 'potentiometer', 'dimmer'],
    difficulty: 2,
    components: layout([
      { type: 'potentiometer' },
      { type: 'led', props: { color: 'green' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [
      w('P1.GND', 'UNO.GND'),
      w('P1.VCC', 'UNO.5V'),
      w('P1.SIG', 'UNO.A0'),
      ...ledOnPin(1, 1, '9'),
    ],
    cpp_code: POT_DIM_CPP,
  },
  {
    id: 'ex-025',
    title: 'Three-button mini piano',
    intent_en: 'three buttons that each play a different note on a buzzer',
    intent_es: 'tres botones que tocan notas distintas en un buzzer',
    tags: ['buzzer', 'button', 'music'],
    difficulty: 3,
    components: layout([
      { type: 'pushbutton' },
      { type: 'pushbutton' },
      { type: 'pushbutton' },
      { type: 'buzzer' },
    ]),
    wires: [
      ...buttonOnPin(1, '2'),
      ...buttonOnPin(2, '3'),
      ...buttonOnPin(3, '4'),
      w('BZ1.1', 'UNO.D8'),
      w('BZ1.2', 'UNO.GND'),
    ],
    cpp_code: PIANO_CPP,
  },
  {
    id: 'ex-026',
    title: 'Servo door lock',
    intent_en: 'press a button to toggle a servo between locked and unlocked positions',
    intent_es: 'apretar un boton para que un servo cambie entre posicion abierta y cerrada',
    tags: ['servo', 'button', 'lock'],
    difficulty: 2,
    components: layout([{ type: 'servo' }, { type: 'pushbutton' }]),
    wires: [
      w('S1.PWM', 'UNO.D9'),
      w('S1.VCC', 'UNO.5V'),
      w('S1.GND', 'UNO.GND'),
      ...buttonOnPin(1, '2'),
    ],
    cpp_code: SERVO_LOCK_CPP,
  },
  {
    id: 'ex-027',
    title: 'Random number on 7-segment',
    intent_en: 'show a random digit 0-9 on a 7-segment when a button is pressed',
    intent_es: 'mostrar un numero aleatorio del 0 al 9 en un display de 7 segmentos al apretar un boton',
    tags: ['7segment', 'button', 'random'],
    difficulty: 2,
    components: layout([{ type: 'seg7' }, { type: 'pushbutton' }]),
    wires: [
      ...(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((s, i) => w(`SEG1.${s}`, `UNO.D${i + 2}`))),
      w('SEG1.DP', 'UNO.D9'),
      w('SEG1.COM', 'UNO.GND'),
      ...buttonOnPin(1, '10'),
    ],
    cpp_code: SEG7_RANDOM_CPP,
  },
  {
    id: 'ex-028',
    title: 'Binary counter on LEDs',
    intent_en: 'count up in binary using three LEDs, advancing once per second',
    intent_es: 'contar en binario con tres LEDs, avanzando cada segundo',
    tags: ['led', 'binary', 'counter'],
    difficulty: 3,
    components: layout([
      { type: 'led', props: { color: 'red' } },
      { type: 'led', props: { color: 'yellow' } },
      { type: 'led', props: { color: 'green' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'resistor', props: { value: '220' } },
    ]),
    wires: [...ledOnPin(1, 1, '11'), ...ledOnPin(2, 2, '12'), ...ledOnPin(3, 3, '13')],
    cpp_code: BINARY_CPP,
  },
  {
    id: 'ex-029',
    title: 'Fake thermometer on LCD',
    intent_en: 'use a potentiometer as a fake temperature sensor and display the value on the LCD',
    intent_es: 'usar un potenciometro como sensor de temperatura falso y mostrar el valor en el LCD',
    tags: ['lcd', 'potentiometer', 'sensor'],
    difficulty: 3,
    components: layout([{ type: 'lcd1602' }, { type: 'potentiometer' }]),
    wires: [
      w('LCD1.GND', 'UNO.GND'),
      w('LCD1.VCC', 'UNO.5V'),
      w('LCD1.SDA', 'UNO.A4'),
      w('LCD1.SCL', 'UNO.A5'),
      w('P1.GND', 'UNO.GND'),
      w('P1.VCC', 'UNO.5V'),
      w('P1.SIG', 'UNO.A0'),
    ],
    cpp_code: LCD_THERMOMETER_CPP,
  },
  {
    id: 'ex-030',
    title: 'Greeting card',
    intent_en: 'press a button to play a melody and blink a colored LED in time',
    intent_es: 'apretar un boton para que suene una melodia y un LED parpadee al ritmo',
    tags: ['buzzer', 'led', 'button', 'music'],
    difficulty: 3,
    components: layout([
      { type: 'pushbutton' },
      { type: 'led', props: { color: 'red' } },
      { type: 'resistor', props: { value: '220' } },
      { type: 'buzzer' },
    ]),
    wires: [
      ...buttonOnPin(1, '2'),
      ...ledOnPin(1, 1, '13'),
      w('BZ1.1', 'UNO.D8'),
      w('BZ1.2', 'UNO.GND'),
    ],
    cpp_code: GREETING_CPP,
  },
]
