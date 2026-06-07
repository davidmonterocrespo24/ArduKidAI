"""Seed a curated educational corpus into `knowledge_chunks` for the RAG store.

Two kinds of content, both safe to index and to cite:

1. AUTHORED_LESSONS - original, in-depth lessons written for ArduKid, in Markdown
   (headings, lists, code). They ground the agent's "teach the concept" answers
   and are shown, rendered, in the Knowledge modal preview. They are our own
   text, so there is no licensing question, and they complement the
   per-component skills (which cover exact pins) rather than duplicating them.
2. CURATED_URLS - trusted, openly licensed pages (SparkFun Learn is CC BY-SA
   4.0; Wikipedia is CC BY-SA). search_docs cites source + page, which satisfies
   the attribution CC BY-SA asks for.

Usage:
    cd backend
    uv run python -m scripts.seed_knowledge              # lessons + URLs + index
    uv run python -m scripts.seed_knowledge --text-only  # just the lessons (offline-safe)
    uv run python -m scripts.seed_knowledge --urls-only
    uv run python -m scripts.seed_knowledge --ensure-index
    uv run python -m scripts.seed_knowledge --dry-run    # list what would be indexed

Requires MONGODB_URI (and GOOGLE_CLOUD_PROJECT for real Gemini embeddings) in
the env or backend/.env. Re-running is idempotent (delete + re-index per source)."""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.db.seed import _create_index
from app.services import knowledge
from app.services.knowledge import KNOWLEDGE_VECTOR_INDEX

# --- Authored Markdown lessons (our own text; license-clean) -------------------
# Each is an in-depth, kid-friendly lesson. Kept in Markdown so the preview
# renders headings/lists/code and the agent can quote structured passages.
AUTHORED_LESSONS: list[tuple[str, str]] = [
    (
        "ArduKid Basics: Electricity and Ohm's Law",
        """## Electricity and Ohm's Law

Every circuit is about moving tiny electric charges around a loop. Three measurements describe what is happening, and one simple law ties them together.

### The three quantities

- **Voltage (V)**, in volts, is the *push* that moves charge. An Arduino UNO output pin gives `0 V` for LOW and `5 V` for HIGH.
- **Current (I)**, in amps, is *how much* charge flows per second. Most kid projects use milliamps (mA): 1 mA = 0.001 A.
- **Resistance (R)**, in ohms, *slows the flow*. Resistors, LEDs and wires all have some.

### Ohm's Law

The relationship is `V = I x R`. Rearranged, it answers the questions you actually ask:

- How much current will flow? `I = V / R`
- What resistor do I need for a target current? `R = V / I`

More resistance means less current for the same voltage. That is exactly why we add resistors: to keep the current at a safe level so nothing overheats.

### A worked example

An LED on 5 V that should draw about 12 mA, after the LED uses ~2 V, leaves 3 V across the resistor:

```text
R = 3 V / 0.012 A = 250 ohms  ->  a common 220 or 330 ohm resistor works
```

### Remember

- Volts push, amps flow, ohms resist.
- A short circuit (a wire from `5V` straight to `GND` with nothing between) has almost no resistance, so a huge current flows. Never do it.
""",
    ),
    (
        "ArduKid Basics: How an LED works and why it needs a resistor",
        """## How an LED works (and why it needs a resistor)

An **LED** (light-emitting diode) turns electricity into light. It is the most common output in beginner projects, but it has two rules you must respect.

### Rule 1: it only works one way

An LED is a *diode*: current may flow through it in one direction only.

- The **longer leg** is the **anode (+)**. Current enters here.
- The **shorter leg** is the **cathode (-)**. Current leaves here, heading to `GND`.

Wire it backwards and it simply stays dark - it will not break, it just will not light.

### Rule 2: it needs a current-limiting resistor

An LED has very little resistance of its own. Connect it straight across 5 V and a huge current rushes through, destroying the LED (and possibly the Arduino pin) in an instant. A **series resistor** of about `220` to `330` ohms holds the current to a safe ~10-15 mA.

### How to wire one

```arduino
void setup() { pinMode(13, OUTPUT); }
void loop()  { digitalWrite(13, HIGH); }   // current flows -> the LED lights
```

- Arduino pin `D13` -> resistor -> LED **anode**
- LED **cathode** -> `GND`

### Remember

- Every LED gets **its own** resistor.
- Polarity matters: long leg toward the positive side.
- No resistor = a dead LED. This is the single most common beginner mistake.
""",
    ),
    (
        "ArduKid Basics: Choosing the LED resistor value",
        """## Choosing the LED resistor value

You size an LED resistor with Ohm's Law, using the voltage *left over* after the LED takes its share.

### The recipe

1. Start with the supply: `5 V` from an Arduino pin.
2. Subtract the LED's **forward voltage** (the volts it "uses up"):
   - Red, yellow, green: about `2 V`
   - Blue, white: about `3 V`
3. What remains is the voltage across the resistor.
4. Pick a safe current, usually `10-15 mA`, and divide: `R = V_resistor / I`.

### Example for a red LED

```text
V_resistor = 5 V - 2 V = 3 V
R = 3 V / 0.012 A = 250 ohms  ->  use 220 or 330 ohms
```

### What the value changes

- **Bigger** resistor (470, 1k): dimmer but extra safe.
- **Smaller** resistor: brighter, but go too low and you cook the LED or the pin.
- A blue/white LED leaves less voltage, so the *same* 220-330 ohm resistor is still fine.

### Remember

When in doubt, **220 or 330 ohms** is a great default for any single LED on 5 V.
""",
    ),
    (
        "ArduKid Basics: Using a breadboard",
        """## Using a breadboard

A **breadboard** lets you build circuits by pushing legs into holes - no soldering, easy to change.

### How the holes connect

- The two long strips along each edge are the **power rails**, usually marked `+` and `-`. Every hole in a rail is connected along its whole length. Use one rail for `5V` and one for `GND`.
- The middle area has many short **rows of five holes**. The five holes in one row are connected to each other.
- A **gap** runs down the centre. The left half of a row and the right half are *not* connected - the gap is made to straddle chips.

### How to connect two parts

- Put their legs in the **same row**, or
- Run a **jumper wire** from a hole in one row to a hole in another.

### A tidy habit

1. Run a wire from Arduino `5V` to the `+` rail and `GND` to the `-` rail first.
2. Build outward from there, giving every part power and ground from the rails.

### Remember

Same row = connected. Across the centre gap = **not** connected. A missing connection to the ground rail is a top cause of "nothing works".
""",
    ),
    (
        "ArduKid Basics: Digital versus analog signals",
        """## Digital versus analog signals

The Arduino reads and writes the world in two different ways. Knowing which to use is half of programming it.

### Digital: just on or off

Digital means only two states: **HIGH** (`5 V`, on) or **LOW** (`0 V`, off).

```arduino
pinMode(13, OUTPUT);
digitalWrite(13, HIGH);     // turn an LED or buzzer on
bool b = digitalRead(2);    // read a button: true = HIGH
```

### Analog input: a smooth range

`analogRead(A0)` measures the voltage on an analog pin `A0`-`A5` and returns a number from **0** (0 V) to **1023** (5 V). Perfect for knobs, light sensors and temperature sensors.

```arduino
int value = analogRead(A0);          // 0 .. 1023
int volts = map(value, 0, 1023, 0, 5);
```

### Analog output: PWM

The Arduino cannot make a true in-between voltage, so it *fakes* one with **PWM**: `analogWrite(pin, value)` with `value` from **0** to **255**. Use it to dim an LED or set a motor's speed (only on the `~` pins).

### Remember

- On/off -> `digitalWrite` / `digitalRead`.
- A range coming in -> `analogRead` (0-1023).
- A range going out -> `analogWrite` (0-255, PWM, only `~` pins).
""",
    ),
    (
        "ArduKid Basics: PWM (Pulse Width Modulation)",
        """## PWM (Pulse Width Modulation)

PWM is the trick that lets a purely on/off pin act like a dimmer or a throttle.

### The idea: switch fast

Instead of a steady in-between voltage, the pin flips on and off **hundreds of times a second**. The fraction of each cycle that it stays on is the **duty cycle**.

- 0% duty = always off
- 50% duty = half brightness / half speed
- 100% duty = always on

Your eyes and most motors are too slow to see the flicker, so they feel the *average*.

### Using it in code

```arduino
analogWrite(9, 64);    // ~25% -> a dim LED
analogWrite(9, 191);   // ~75% -> brighter
```

`analogWrite` takes a value from **0 to 255**. 255 means 100% on.

### Which pins?

Only the pins marked with a tilde support PWM on the UNO: **~3, ~5, ~6, ~9, ~10, ~11**. Ask a plain pin to PWM and you just get on/off.

### What it is good for

- Dimming LEDs and fading colours on an RGB LED.
- Setting DC motor speed.
- Making simple tones.

### Remember

PWM = fast blinking whose *duty cycle* sets the average power. `analogWrite(pin, 0..255)`, only on `~` pins.
""",
    ),
    (
        "ArduKid Basics: The Arduino UNO pins",
        """## The Arduino UNO pins

The header sockets around the board are how it talks to the world. Here is what each group does.

### Digital pins (D0-D13)

Fourteen on/off pins. Set each as an input or output with `pinMode`.

- Pins **~3, ~5, ~6, ~9, ~10, ~11** (the tilde ones) also do **PWM**.
- **D13** has a tiny LED soldered onto the board - handy for testing without wiring anything.
- D0 and D1 are also the USB serial RX/TX; avoid them unless you need serial.

### Analog input pins (A0-A5)

Six pins that read a voltage with `analogRead`, returning **0-1023**. They can also be used as ordinary digital pins if you need more.

### Power pins

- **5V** and **3.3V**: regulated power *out* for your parts.
- **GND**: ground, the `0 V` reference. There are several GND pins and they are all connected.
- **Vin**: raw input voltage.

### The golden rule: share a ground

Every part that talks to the Arduino must connect back to a **GND** pin. A circuit with no common ground is the most common reason a project does nothing.

### Remember

Digital = on/off (`~` = PWM), analog `A0`-`A5` = read 0-1023, and **always** connect grounds together.
""",
    ),
    (
        "ArduKid Basics: Buttons and pull-up resistors",
        """## Buttons and pull-up resistors

A pushbutton is the simplest way for a person to talk to an Arduino. Inside, it just connects two of its legs together while you press, and springs apart when you let go. The tricky part is reading a clean HIGH or LOW.

### Why a lone button "floats"

Wire a button to an input pin with *nothing else* and, while the button is open, the pin connects to nothing. An unconnected input does not read a steady 0 V - it picks up electrical noise and flips HIGH/LOW at random, so your sketch sees ghost presses.

### The fix: a pull-up resistor

A **pull-up resistor** gently ties the pin to `5 V`, so an open button reads a solid HIGH. Press the button and you connect the pin straight to `GND`, which wins and pulls it LOW. The Arduino has these built in, so you need no extra part:

```arduino
void setup() {
  pinMode(2, INPUT_PULLUP);          // internal pull-up on pin 2
}

void loop() {
  bool pressed = digitalRead(2) == LOW;   // pressed reads LOW!
}
```

### Wiring

- One leg of the button -> pin `D2`
- The other leg -> `GND`
- No external resistor needed with `INPUT_PULLUP`.

### Remember

- With `INPUT_PULLUP`: **pressed = LOW**, **released = HIGH**. It feels backwards at first.
- Want pressed = HIGH instead? Use a real pull-**down** resistor to GND and wire the other leg to `5V`.
""",
    ),
    (
        "ArduKid Basics: How sensors connect",
        """## How sensors connect

A sensor turns something in the real world - light, heat, motion, sound - into an electrical signal the Arduino can read. They come in two families.

### Analog sensors

These output a *changing voltage* that rises and falls with the thing they measure: a potentiometer knob, a photoresistor (light), many temperature sensors.

- Wire the **signal** to an analog pin `A0`-`A5`.
- Read it with `analogRead`, which gives **0-1023**.

```arduino
int light = analogRead(A0);
if (light < 300) digitalWrite(13, HIGH);   // dark -> lamp on
```

### Digital sensors

These output only **HIGH or LOW** when something happens: a PIR motion sensor, a tilt switch, many flame/sound modules.

- Wire the **output** to a digital pin.
- Read it with `digitalRead`, often comparing against a threshold the module sets with its own little knob.

```arduino
if (digitalRead(2) == HIGH) { /* motion! */ }
```

### Every sensor needs power

Besides its signal pin, almost every sensor needs **VCC** (usually `5V`) and **GND**. Forget the ground and it reads nonsense.

### Remember

A changing value -> analog pin + `analogRead`. A yes/no event -> digital pin + `digitalRead`. Always give it power and ground.
""",
    ),
    (
        "ArduKid Basics: Controlling a servo motor",
        """## Controlling a servo motor

A hobby **servo** (like the SG90) is a little motor that turns its arm to an exact angle between `0` and `180` degrees and holds it there. Great for steering, levers and pointers.

### The three wires

- **Signal** (orange or yellow) -> a digital pin
- **Power** (red) -> `5V`
- **Ground** (brown or black) -> `GND`

### Driving it in code

The Arduino Servo library handles the special timing pulse for you:

```arduino
#include <Servo.h>
Servo arm;

void setup() {
  arm.attach(9);     // signal wire on pin 9
}

void loop() {
  arm.write(0);      // point to 0 degrees
  delay(1000);
  arm.write(180);    // swing to 180 degrees
  delay(1000);
}
```

### A power warning

A servo can yank a lot of current the moment it moves, which can dip the Arduino's `5V` and reset the board. For a big servo, give it its **own 5 V supply** and just share the `GND` with the Arduino.

### Remember

Three wires (signal/5V/GND), `attach()` then `write(angle)`, and watch the power if it twitches or resets.
""",
    ),
    (
        "ArduKid Basics: The 7-segment display",
        """## The 7-segment display

A **7-segment display** shows a single digit using seven bar-shaped LEDs, plus a dot.

### The segments

They are named with letters:

```text
 AAA
F   B
F   B
 GGG
E   C
E   C
 DDD   . DP
```

Light the right combination to form a number:

- **1** = B, C
- **7** = A, B, C
- **8** = all of A-G

### Common cathode wiring

In a common-cathode display, all the segment cathodes join one **COM** pin that goes to `GND`. Each segment then lights when **its** pin is driven `HIGH` - and just like any LED, each segment needs **its own current-limiting resistor**.

```arduino
// show the digit 7: light A, B, C (each through a resistor)
digitalWrite(2, HIGH);  // A
digitalWrite(3, HIGH);  // B
digitalWrite(4, HIGH);  // C
```

### Showing more than one digit

Several digits share the segment wires and are lit one at a time, very fast, in turn - a trick called **multiplexing**. The eye blends them into a steady number.

### Remember

`COM` -> `GND`, one resistor per segment, drive a segment `HIGH` to light it. If nothing shows, check the resistors and the common pin first.
""",
    ),
    (
        "ArduKid Basics: Real traffic-light timing",
        """## Real traffic-light timing

When you build a traffic light, it is fun to use realistic timing - and to know that real signals are not fixed at all.

### How engineers set it

Real signals are timed from the speed limit, how busy the road is, and how wide the crossing is, so there is no single "correct" number. As a rough guide for a city intersection:

- **Green:** about `30` to `60` seconds (short on a side street, longer on a main road).
- **Yellow (amber):** about `3` to `5` seconds - roughly one second for every 10 mph of the speed limit.
- **All-red clearance:** a `1` to `2` second gap where every direction is red, so the intersection empties before the cross traffic moves.

### For a demo

Real times are too long to watch, so shrink them - for example `3 s` green, `1 s` yellow, `3 s` red - and let the cycle repeat.

```arduino
digitalWrite(GREEN, HIGH);  delay(3000); digitalWrite(GREEN, LOW);
digitalWrite(YELLOW, HIGH); delay(1000); digitalWrite(YELLOW, LOW);
digitalWrite(RED, HIGH);    delay(3000); digitalWrite(RED, LOW);
```

### Remember

Yellow is short, green/red are long, and a brief all-red keeps everyone safe. Scale the numbers down for a fun, watchable model.
""",
    ),
    (
        "ArduKid Basics: The setup and loop structure",
        """## The setup() and loop() structure

Every Arduino program ("sketch") is built from exactly two parts. Understanding them is the key to reading any example.

### setup() runs once

When the board powers on or is reset, `setup()` runs a single time. Put your *one-time* jobs here:

- `pinMode(...)` to choose which pins are inputs or outputs.
- `Serial.begin(9600)` to start talking to the computer.

```arduino
void setup() {
  pinMode(13, OUTPUT);
}
```

### loop() runs forever

After `setup()` finishes, `loop()` runs over and over, for as long as the board has power. Put the *repeating behaviour* here - blinking, reading sensors, reacting.

```arduino
void loop() {
  digitalWrite(13, HIGH);
  delay(500);            // wait half a second
  digitalWrite(13, LOW);
  delay(500);
}
```

### delay() pauses

`delay(ms)` stops the program for that many **milliseconds** (`1000 ms = 1 second`). It is the simplest way to control timing.

### Remember

- One-time set-up -> `setup()`.
- Repeating behaviour -> `loop()`.
- Anything you want to keep happening must live inside `loop()`.
""",
    ),
    (
        "ArduKid Basics: Troubleshooting when nothing lights up",
        """## Troubleshooting when nothing lights up

When a circuit does nothing, do not panic - check these, in order. Most problems are one of five things.

### 1. Ground

Almost every part needs a wire back to a `GND` pin. A missing ground is the **number one** cause of a dead circuit. Trace each part: does it reach ground?

### 2. Resistor and LED polarity

- Every LED needs a **series resistor** - without one it may have burned out.
- The LED's **longer leg (anode)** must face the positive side. Backwards = dark.

### 3. pinMode

- A pin you drive must be set to `OUTPUT` in `setup()`.
- A pin you read as a button usually needs `INPUT_PULLUP`.

```arduino
pinMode(13, OUTPUT);        // before digitalWrite(13, ...)
pinMode(2, INPUT_PULLUP);   // before reading a button
```

### 4. The right pin

Make sure the pin **number in the code** matches the pin the **wire** actually uses. Mixing up D9 and D10 is easy to do.

### 5. Short circuits

Never wire `5V` straight to `GND`, or a digital pin straight to `GND` with no part between. That is a short - it can reset or damage the board.

### Remember

Ground, resistor + polarity, `pinMode`, correct pin, no shorts. Check them in that order and you will find almost any beginner bug.
""",
    ),
]

# --- Curated, openly licensed reference URLs ----------------------------------
CURATED_URLS: list[tuple[str, str]] = [
    ("https://learn.sparkfun.com/tutorials/voltage-current-resistance-and-ohms-law/all",
     "SparkFun (CC BY-SA): Voltage, Current, Resistance, and Ohm's Law"),
    ("https://learn.sparkfun.com/tutorials/light-emitting-diodes-leds/all",
     "SparkFun (CC BY-SA): Light-Emitting Diodes (LEDs)"),
    ("https://learn.sparkfun.com/tutorials/resistors/all",
     "SparkFun (CC BY-SA): Resistors"),
    ("https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all",
     "SparkFun (CC BY-SA): How to Use a Breadboard"),
    ("https://learn.sparkfun.com/tutorials/analog-vs-digital/all",
     "SparkFun (CC BY-SA): Analog vs. Digital"),
    ("https://learn.sparkfun.com/tutorials/pulse-width-modulation/all",
     "SparkFun (CC BY-SA): Pulse Width Modulation"),
    ("https://learn.sparkfun.com/tutorials/pull-up-resistors/all",
     "SparkFun (CC BY-SA): Pull-up Resistors"),
    ("https://learn.sparkfun.com/tutorials/what-is-an-arduino/all",
     "SparkFun (CC BY-SA): What is an Arduino?"),
    ("https://en.wikipedia.org/wiki/Seven-segment_display",
     "Wikipedia (CC BY-SA): Seven-segment display"),
    ("https://en.wikipedia.org/wiki/Ohm%27s_law",
     "Wikipedia (CC BY-SA): Ohm's law"),
]


async def _seed_text(limit: int | None, dry_run: bool) -> int:
    docs = AUTHORED_LESSONS[:limit] if limit else AUTHORED_LESSONS
    total = 0
    for source, text in docs:
        if dry_run:
            print(f"  [text] would index: {source}")
            continue
        print(f"indexing lesson: {source} ...", flush=True)
        try:
            await knowledge.delete_source(source)  # replace cleanly; content size changes
            n = await knowledge.index_plain_text(text, source=source)
            total += n
            print(f"  indexed {n} chunks")
        except Exception as exc:  # keep going; one failure must not abort the rest
            print(f"  failed: {exc}", file=sys.stderr)
    return total


async def _seed_urls(limit: int | None, dry_run: bool) -> int:
    urls = CURATED_URLS[:limit] if limit else CURATED_URLS
    total = 0
    for url, label in urls:
        if dry_run:
            print(f"  [url]  would index: {label} <- {url}")
            continue
        print(f"indexing URL: {label} ...", flush=True)
        try:
            n = await knowledge.index_url(url, source=label)
            total += n
            print(f"  indexed {n} chunks" if n else "  (no extractable text, skipped)")
        except Exception as exc:
            print(f"  failed: {exc}", file=sys.stderr)
    return total


async def main_async(args: argparse.Namespace) -> int:
    if args.ensure_index:
        await _create_index(collection="knowledge_chunks", name=KNOWLEDGE_VECTOR_INDEX, path="embedding")
        print("ensured knowledge vector index")
        return 0

    total = 0
    if not args.urls_only:
        total += await _seed_text(args.limit, args.dry_run)
    if not args.text_only:
        total += await _seed_urls(args.limit, args.dry_run)

    if not args.dry_run:
        print("ensuring knowledge vector index ...", flush=True)
        await _create_index(collection="knowledge_chunks", name=KNOWLEDGE_VECTOR_INDEX, path="embedding")
        print(f"done - {total} chunks indexed")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the curated RAG knowledge corpus.")
    parser.add_argument("--text-only", action="store_true", help="Index only the authored lessons.")
    parser.add_argument("--urls-only", action="store_true", help="Index only the curated URLs.")
    parser.add_argument("--ensure-index", action="store_true", help="Only (re)create the vector index.")
    parser.add_argument("--limit", type=int, default=None, help="Cap items per kind (smoke test).")
    parser.add_argument("--dry-run", action="store_true", help="List what would be indexed, write nothing.")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
